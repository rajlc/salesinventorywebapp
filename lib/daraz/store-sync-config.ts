import { createAdminClient } from '@/lib/supabase/server'

export interface StoreSyncMode {
    order_sync_enabled: boolean
    chat_review_enabled: boolean
}

export const STORE_SYNC_MODES_KEY = 'daraz_store_sync_modes'

/**
 * Fetches the store sync modes map from `app_settings` (`daraz_store_sync_modes`).
 * Works immediately without requiring manual DDL changes on `online_stores`,
 * while also honoring `online_stores.order_sync_enabled` / `chat_review_enabled` if present.
 */
export async function getStoreSyncModesMap(supabaseClient?: any): Promise<Record<string, StoreSyncMode>> {
    try {
        const supabase = supabaseClient || (await createAdminClient())
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', STORE_SYNC_MODES_KEY)
            .maybeSingle()

        if (!error && data?.value && typeof data.value === 'object') {
            return data.value as Record<string, StoreSyncMode>
        }
    } catch (err) {
        console.warn('[StoreSyncConfig] Failed to read daraz_store_sync_modes:', err)
    }
    return {}
}

/**
 * Enriches an array of `online_stores` records with `order_sync_enabled` and `chat_review_enabled`
 * (both defaulting to `true` for existing stores).
 */
export async function enrichStoresWithSyncModes<T extends { id: string; order_sync_enabled?: boolean; chat_review_enabled?: boolean }>(
    stores: T[],
    supabaseClient?: any
): Promise<(T & StoreSyncMode)[]> {
    if (!stores || stores.length === 0) return []
    const modesMap = await getStoreSyncModesMap(supabaseClient)

    return stores.map(store => {
        const saved = modesMap[store.id]
        const orderSync = saved?.order_sync_enabled !== undefined
            ? Boolean(saved.order_sync_enabled)
            : (store.order_sync_enabled !== undefined ? Boolean(store.order_sync_enabled) : true)

        const chatReview = saved?.chat_review_enabled !== undefined
            ? Boolean(saved.chat_review_enabled)
            : (store.chat_review_enabled !== undefined ? Boolean(store.chat_review_enabled) : true)

        return {
            ...store,
            order_sync_enabled: orderSync,
            chat_review_enabled: chatReview,
        }
    })
}

/**
 * Checks whether a specific store has Order & Finance Sync enabled.
 */
export async function isStoreOrderSyncEnabled(
    storeId: string,
    supabaseClient?: any,
    storeRow?: { order_sync_enabled?: boolean } | null
): Promise<boolean> {
    if (!storeId) return true
    const modesMap = await getStoreSyncModesMap(supabaseClient)
    const saved = modesMap[storeId]
    if (saved?.order_sync_enabled !== undefined) {
        return Boolean(saved.order_sync_enabled)
    }
    if (storeRow?.order_sync_enabled !== undefined) {
        return Boolean(storeRow.order_sync_enabled)
    }
    return true
}

/**
 * Checks whether a specific store has Chat AI & Customer Reviews enabled.
 */
export async function isStoreChatReviewEnabled(
    storeId: string,
    supabaseClient?: any,
    storeRow?: { chat_review_enabled?: boolean } | null
): Promise<boolean> {
    if (!storeId) return true
    const modesMap = await getStoreSyncModesMap(supabaseClient)
    const saved = modesMap[storeId]
    if (saved?.chat_review_enabled !== undefined) {
        return Boolean(saved.chat_review_enabled)
    }
    if (storeRow?.chat_review_enabled !== undefined) {
        return Boolean(storeRow.chat_review_enabled)
    }
    return true
}

/**
 * Persists `order_sync_enabled` and/or `chat_review_enabled` for a store in `app_settings`
 * and also updates `online_stores` columns if the SQL migration has been applied.
 */
export async function saveStoreSyncMode(
    storeId: string,
    mode: Partial<StoreSyncMode>,
    supabaseClient?: any
): Promise<StoreSyncMode> {
    const supabase = supabaseClient || (await createAdminClient())
    const currentMap = await getStoreSyncModesMap(supabase)
    const existing = currentMap[storeId] || {
        order_sync_enabled: true,
        chat_review_enabled: true,
    }

    const updated: StoreSyncMode = {
        order_sync_enabled: mode.order_sync_enabled !== undefined ? Boolean(mode.order_sync_enabled) : existing.order_sync_enabled,
        chat_review_enabled: mode.chat_review_enabled !== undefined ? Boolean(mode.chat_review_enabled) : existing.chat_review_enabled,
    }

    const nextMap: Record<string, StoreSyncMode> = {
        ...currentMap,
        [storeId]: updated,
    }

    const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert(
            {
                key: STORE_SYNC_MODES_KEY,
                value: nextMap,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
        )

    if (upsertError) {
        console.error('[StoreSyncConfig] Failed to save daraz_store_sync_modes in app_settings:', upsertError)
    }

    // Best-effort sync to online_stores columns if SQL migration is applied
    try {
        await supabase
            .from('online_stores')
            .update({
                order_sync_enabled: updated.order_sync_enabled,
                chat_review_enabled: updated.chat_review_enabled,
            })
            .eq('id', storeId)
    } catch {
        // Ignore if columns are not yet present in online_stores
    }

    return updated
}
