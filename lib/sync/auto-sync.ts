import { getPendingSyncOperations, markSyncCompleted, markSyncFailed, updateSyncOperation } from '@/lib/db/sync-manager'
import { getDB } from '@/lib/db/indexed-db'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

/**
 * Auto-sync manager - syncs pending operations when online
 */
export class AutoSyncManager {
    private isSyncing = false
    private syncListeners: Set<(status: 'idle' | 'syncing' | 'success' | 'error') => void> = new Set()

    /**
     * Subscribe to sync status changes
     */
    onSyncStatusChange(callback: (status: 'idle' | 'syncing' | 'success' | 'error') => void) {
        this.syncListeners.add(callback)
        return () => this.syncListeners.delete(callback)
    }

    private notifyListeners(status: 'idle' | 'syncing' | 'success' | 'error') {
        this.syncListeners.forEach(cb => cb(status))
    }

    /**
     * Main sync function - process all pending operations
     */
    async sync(): Promise<{ success: number; failed: number }> {
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping...')
            return { success: 0, failed: 0 }
        }

        // Check if online
        if (typeof window !== 'undefined' && !navigator.onLine) {
            console.log('Cannot sync while offline')
            return { success: 0, failed: 0 }
        }

        this.isSyncing = true
        this.notifyListeners('syncing')

        let successCount = 0
        let failedCount = 0

        try {
            const pendingOps = await getPendingSyncOperations()

            if (pendingOps.length === 0) {
                console.log('No pending operations to sync')
                this.notifyListeners('idle')
                return { success: 0, failed: 0 }
            }

            console.log(`Syncing ${pendingOps.length} operations...`)
            toast.info(`Syncing ${pendingOps.length} items...`)

            // Process each operation
            for (const op of pendingOps) {
                try {
                    await updateSyncOperation(op.id, { status: 'syncing' })

                    switch (op.operation_type) {
                        case 'add_purchase':
                            await this.syncAddPurchase(op)
                            break
                        case 'update_purchase':
                            await this.syncUpdatePurchase(op)
                            break
                        case 'complete_plan':
                            await this.syncCompletePlan(op)
                            break
                        case 'add_plan':
                            await this.syncAddPlan(op)
                            break
                        default:
                            throw new Error(`Unknown operation type: ${op.operation_type}`)
                    }

                    await markSyncCompleted(op.id)
                    successCount++
                } catch (error) {
                    console.error(`Failed to sync operation ${op.id}:`, error)
                    await markSyncFailed(op.id, error instanceof Error ? error.message : 'Unknown error')
                    failedCount++
                }
            }

            if (failedCount === 0) {
                toast.success(`Successfully synced ${successCount} items`)
                this.notifyListeners('success')
            } else {
                toast.warning(`Synced ${successCount} items, ${failedCount} failed`)
                this.notifyListeners('error')
            }
        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Sync failed')
            this.notifyListeners('error')
        } finally {
            this.isSyncing = false
            setTimeout(() => {
                this.notifyListeners('idle')
            }, 2000)
        }

        return { success: successCount, failed: failedCount }
    }

    /**
     * Sync add purchase operation
     */
    private async syncAddPurchase(op: any) {
        const db = await getDB()

        // Get the purchase from IndexedDB
        const purchase = await db.get('purchases', op.entity_id)
        if (!purchase) {
            throw new Error('Purchase not found in local database')
        }

        // Insert into Supabase
        const { data, error } = await supabase
            .from('purchases')
            .insert({
                product_id: purchase.product_id,
                supplier_id: purchase.supplier_id,
                quantity: purchase.quantity,
                unit_price: purchase.unit_price,
                total_amount: purchase.total_amount,
                purchase_date: purchase.purchase_date,
                notes: purchase.notes,
            })
            .select()
            .single()

        if (error) throw error

        // Update local record with server ID
        await db.put('purchases', {
            ...purchase,
            synced: true,
            server_id: data.id,
        })

        console.log('✅ Purchase synced:', data.id)
    }

    /**
     * Sync update purchase operation
     */
    private async syncUpdatePurchase(op: any) {
        const { error } = await supabase
            .from('purchases')
            .update(op.data)
            .eq('id', op.entity_id)

        if (error) throw error

        console.log('✅ Purchase updated:', op.entity_id)
    }

    /**
     * Sync complete plan operation
     */
    private async syncCompletePlan(op: any) {
        const db = await getDB()

        // Update plan in IndexedDB
        const plan = await db.get('purchase_plans', op.entity_id)
        if (plan) {
            await db.put('purchase_plans', {
                ...plan,
                completed: true,
                last_synced: Date.now(),
            })
        }

        console.log('✅ Plan completed:', op.entity_id)
    }

    /**
     * Sync add plan operation
     */
    private async syncAddPlan(op: any) {
        const { data, error } = await supabase
            .from('purchase_plans')
            .insert(op.data)
            .select()
            .single()

        if (error) throw error

        console.log('✅ Plan added:', data.id)
    }
}

// Singleton instance
let autoSyncInstance: AutoSyncManager | null = null

export function getAutoSyncManager(): AutoSyncManager {
    if (!autoSyncInstance) {
        autoSyncInstance = new AutoSyncManager()
    }
    return autoSyncInstance
}

/**
 * Initialize auto-sync listeners (call once in root layout)
 */
export function initAutoSync() {
    if (typeof window === 'undefined') return

    const syncManager = getAutoSyncManager()

    // Sync on online event
    window.addEventListener('online', () => {
        console.log('🟢 Connection restored - triggering auto-sync')
        setTimeout(() => syncManager.sync(), 1000) // Delay to ensure connection is stable
    })

    // Sync on custom trigger event
    window.addEventListener('trigger-auto-sync', () => {
        console.log('🔄 Manual sync triggered')
        syncManager.sync()
    })

    // Sync on service worker sync event
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'SYNC_TRIGGERED') {
                syncManager.sync()
            }
        })
    }

    console.log('✅ Auto-sync initialized')
}
