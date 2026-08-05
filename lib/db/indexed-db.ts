import { openDB, DBSchema, IDBPDatabase } from 'idb'

// Database schema definition
interface InventoryOfflineDB extends DBSchema {
    // Purchase plans cache
    purchase_plans: {
        key: string // plan ID
        value: {
            id: string
            product_id: string
            product_name: string
            quantity: number
            unit: string
            notes?: string
            created_at: string
            completed: boolean
            last_synced: number // timestamp
            _full_plan?: string // Serialized complete plan data for reconstruction
        }
        indexes: { 'by-product': string }
    }

    // Offline purchases (pending sync)
    purchases: {
        key: string // local UUID
        value: {
            id: string // local UUID
            product_id: string
            supplier_id?: string
            quantity: number
            unit_price: number
            total_amount: number
            purchase_date: string
            notes?: string
            created_at: string
            synced: boolean
            sync_error?: string
            server_id?: string // ID from Supabase after sync
        }
        indexes: { 'by-sync-status': number; 'by-date': string }
    }

    // Sync queue for all operations
    sync_queue: {
        key: string // operation ID
        value: {
            id: string
            operation_type: 'add_purchase' | 'update_purchase' | 'complete_plan' | 'add_plan'
            entity_type: 'purchase' | 'plan'
            entity_id: string
            data: any
            created_at: number
            retry_count: number
            last_error?: string
            status: 'pending' | 'syncing' | 'completed' | 'failed'
        }
        indexes: { 'by-status': string; 'by-created': number }
    }

    // Dashboard cache (for mobile view)
    dashboard_cache: {
        key: string // cache key
        value: {
            key: string
            data: any
            cached_at: number
            expires_at: number
        }
    }

    // App metadata
    metadata: {
        key: string
        value: {
            key: string
            value: any
            updated_at: number
        }
    }
}

const DB_NAME = 'inventory-app-offline'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<InventoryOfflineDB> | null = null

/**
 * Initialize and get the IndexedDB instance
 */
export async function getDB(): Promise<IDBPDatabase<InventoryOfflineDB>> {
    if (dbInstance) {
        return dbInstance
    }

    dbInstance = await openDB<InventoryOfflineDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Create object stores if they don't exist

            // Purchase plans store
            if (!db.objectStoreNames.contains('purchase_plans')) {
                const planStore = db.createObjectStore('purchase_plans', { keyPath: 'id' })
                planStore.createIndex('by-product', 'product_id')
            }

            // Purchases store
            if (!db.objectStoreNames.contains('purchases')) {
                const purchaseStore = db.createObjectStore('purchases', { keyPath: 'id' })
                purchaseStore.createIndex('by-sync-status', 'synced')
                purchaseStore.createIndex('by-date', 'purchase_date')
            }

            // Sync queue store
            if (!db.objectStoreNames.contains('sync_queue')) {
                const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
                queueStore.createIndex('by-status', 'status')
                queueStore.createIndex('by-created', 'created_at')
            }

            // Dashboard cache store
            if (!db.objectStoreNames.contains('dashboard_cache')) {
                db.createObjectStore('dashboard_cache', { keyPath: 'key' })
            }

            // Metadata store
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' })
            }
        },
        blocked() {
            console.warn('Database upgrade blocked. Please close other tabs.')
        },
        blocking() {
            console.warn('Database is blocking a newer version.')
            // Close current database to allow upgrade
            if (dbInstance) {
                dbInstance.close()
                dbInstance = null
            }
        },
    })

    return dbInstance
}

/**
 * Clear all offline data (useful for logout or reset)
 */
export async function clearOfflineData(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['purchases', 'purchase_plans', 'sync_queue', 'dashboard_cache'], 'readwrite')

    await Promise.all([
        tx.objectStore('purchases').clear(),
        tx.objectStore('purchase_plans').clear(),
        tx.objectStore('sync_queue').clear(),
        tx.objectStore('dashboard_cache').clear(),
    ])

    await tx.done
}

/**
 * Get metadata value
 */
export async function getMetadata(key: string): Promise<any> {
    const db = await getDB()
    const item = await db.get('metadata', key)
    return item?.value
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: any): Promise<void> {
    const db = await getDB()
    await db.put('metadata', {
        key,
        value,
        updated_at: Date.now(),
    })
}

/**
 * Check if the database is ready
 */
export async function isDatabaseReady(): Promise<boolean> {
    try {
        const db = await getDB()
        return db !== null
    } catch (error) {
        console.error('Database check failed:', error)
        return false
    }
}

/**
 * Get database stats
 */
export async function getDatabaseStats(): Promise<{
    pendingSyncs: number
    cachedPlans: number
    offlinePurchases: number
}> {
    const db = await getDB()

    const pendingSyncs = await db.countFromIndex('sync_queue', 'by-status', 'pending')
    const cachedPlans = await db.count('purchase_plans')
    const offlinePurchases = await db.countFromIndex('purchases', 'by-sync-status', IDBKeyRange.only(0))

    return {
        pendingSyncs,
        cachedPlans,
        offlinePurchases,
    }
}
