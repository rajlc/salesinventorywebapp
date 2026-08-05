import { getDB } from './indexed-db'

export type SyncOperation = {
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

/**
 * Add operation to sync queue
 */
export async function addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'created_at' | 'retry_count' | 'status'>): Promise<string> {
    const db = await getDB()
    const id = crypto.randomUUID()

    const newOperation: SyncOperation = {
        id,
        ...operation,
        created_at: Date.now(),
        retry_count: 0,
        status: 'pending',
    }

    await db.add('sync_queue', newOperation)

    // Emit custom event for sync queue change
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: { operationId: id } }))
    }

    return id
}

/**
 * Get all pending sync operations
 */
export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
    const db = await getDB()
    const operations = await db.getAllFromIndex('sync_queue', 'by-status', 'pending')

    // Sort by created_at (oldest first)
    return operations.sort((a, b) => a.created_at - b.created_at)
}

/**
 * Update sync operation status
 */
export async function updateSyncOperation(
    id: string,
    updates: Partial<Pick<SyncOperation, 'status' | 'retry_count' | 'last_error'>>
): Promise<void> {
    const db = await getDB()
    const operation = await db.get('sync_queue', id)

    if (!operation) {
        throw new Error(`Sync operation ${id} not found`)
    }

    const updated = { ...operation, ...updates }
    await db.put('sync_queue', updated)

    // Emit sync status change event
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-status-updated', {
            detail: { operationId: id, status: updates.status }
        }))
    }
}

/**
 * Mark sync operation as completed
 */
export async function markSyncCompleted(id: string): Promise<void> {
    await updateSyncOperation(id, { status: 'completed' })

    // Optionally remove completed operations after a delay
    setTimeout(async () => {
        const db = await getDB()
        await db.delete('sync_queue', id)
    }, 5000) // Keep for 5 seconds for UI feedback
}

/**
 * Mark sync operation as failed
 */
export async function markSyncFailed(id: string, error: string): Promise<void> {
    const db = await getDB()
    const operation = await db.get('sync_queue', id)

    if (!operation) return

    await updateSyncOperation(id, {
        status: 'failed',
        retry_count: operation.retry_count + 1,
        last_error: error,
    })
}

/**
 * Clear completed sync operations
 */
export async function clearCompletedSyncs(): Promise<void> {
    const db = await getDB()
    const completed = await db.getAllFromIndex('sync_queue', 'by-status', 'completed')

    const tx = db.transaction('sync_queue', 'readwrite')
    await Promise.all(completed.map(op => tx.store.delete(op.id)))
    await tx.done
}

/**
 * Get sync status for a specific entity
 */
export async function getEntitySyncStatus(entityId: string): Promise<SyncOperation | null> {
    const db = await getDB()
    const allPending = await db.getAllFromIndex('sync_queue', 'by-status', 'pending')

    return allPending.find(op => op.entity_id === entityId) || null
}

/**
 * Get count of pending operations
 */
export async function getPendingSyncCount(): Promise<number> {
    const db = await getDB()
    return await db.countFromIndex('sync_queue', 'by-status', 'pending')
}

/**
 * Retry failed operations (with exponential backoff check)
 */
export async function retryFailedOperations(): Promise<SyncOperation[]> {
    const db = await getDB()
    const failed = await db.getAllFromIndex('sync_queue', 'by-status', 'failed')

    const retryable = failed.filter(op => {
        // Max 5 retries
        if (op.retry_count >= 5) return false

        // Exponential backoff: wait 2^retry_count minutes
        const backoffMs = Math.pow(2, op.retry_count) * 60 * 1000
        const timeSinceCreation = Date.now() - op.created_at

        return timeSinceCreation >= backoffMs
    })

    // Update status to pending for retry
    const tx = db.transaction('sync_queue', 'readwrite')
    await Promise.all(
        retryable.map(op =>
            tx.store.put({ ...op, status: 'pending' as const })
        )
    )
    await tx.done

    return retryable
}
