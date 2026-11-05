'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { enrichStoresWithSyncModes, saveStoreSyncMode } from '@/lib/daraz/store-sync-config'

async function getSupabaseServer() {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options)
                    } catch (error) {
                        // Cookie setting error
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', options)
                    } catch (error) {
                        // Cookie removal error
                    }
                },
            },
        }
    )
}

// ============================================
// FISCAL YEARS ACTIONS
// ============================================

export async function getFiscalYears() {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .order('start_date', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function getActiveFiscalYear() {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('is_active', true)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        return { error: error.message }
    }

    return { data }
}

export async function createFiscalYear(fiscalYear: {
    name: string
    start_date: string
    end_date: string
}) {
    const supabase = await getSupabaseServer()

    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('fiscal_years')
        .insert({
            ...fiscalYear,
            created_by: userData?.user?.id,
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function updateFiscalYear(
    id: string,
    fiscalYear: {
        name?: string
        start_date?: string
        end_date?: string
    }
) {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('fiscal_years')
        .update(fiscalYear)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function deleteFiscalYear(id: string) {
    const supabase = await getSupabaseServer()

    const { error } = await supabase
        .from('fiscal_years')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

// ============================================
// ONLINE STORES ACTIONS
// ============================================

export async function getOnlineStores(options?: { onlyOrderSync?: boolean; onlyChatReview?: boolean; [key: string]: any }) {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('online_stores')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    let enriched = await enrichStoresWithSyncModes(data || [])

    if (options?.onlyOrderSync) {
        enriched = enriched.filter(s => s.order_sync_enabled !== false)
    }

    if (options?.onlyChatReview) {
        enriched = enriched.filter(s => s.chat_review_enabled !== false)
    }

    return { data: enriched }
}

export async function createOnlineStore(store: {
    seller_account: string
    seller_id: string
    company_name: string
    address: string
    pan_vat_number: string
    contact: string
    logo_url?: string
    order_sync_enabled?: boolean
    chat_review_enabled?: boolean
}) {
    const supabase = await getSupabaseServer()

    const { data: userData } = await supabase.auth.getUser()

    const { order_sync_enabled, chat_review_enabled, ...dbFields } = store

    const { data, error } = await supabase
        .from('online_stores')
        .insert({
            ...dbFields,
            created_by: userData?.user?.id,
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    const syncMode = await saveStoreSyncMode(data.id, {
        order_sync_enabled: order_sync_enabled !== undefined ? order_sync_enabled : true,
        chat_review_enabled: chat_review_enabled !== undefined ? chat_review_enabled : true,
    })

    return { data: { ...data, ...syncMode } }
}

export async function updateOnlineStore(id: string, store: any) {
    const supabase = await getSupabaseServer()

    const { order_sync_enabled, chat_review_enabled, ...dbFields } = store || {}

    let updatedRow: any = { id }
    if (Object.keys(dbFields).length > 0) {
        const { data, error } = await supabase
            .from('online_stores')
            .update(dbFields)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return { error: error.message }
        }
        updatedRow = data
    }

    if (order_sync_enabled !== undefined || chat_review_enabled !== undefined) {
        const syncMode = await saveStoreSyncMode(id, {
            order_sync_enabled,
            chat_review_enabled,
        })
        updatedRow = { ...updatedRow, ...syncMode }
    }

    return { data: updatedRow }
}

export async function updateOnlineStoreSyncMode(
    id: string,
    mode: { order_sync_enabled?: boolean; chat_review_enabled?: boolean }
) {
    try {
        const updatedMode = await saveStoreSyncMode(id, mode)
        return { data: { id, ...updatedMode } }
    } catch (err: any) {
        return { error: err.message || 'Failed to update store sync mode' }
    }
}

export async function deleteOnlineStore(id: string) {
    const supabase = await getSupabaseServer()

    const { error } = await supabase
        .from('online_stores')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

// ============================================
// RETAIL STORES ACTIONS
// ============================================

export async function getRetailStores() {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('retail_stores')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function createRetailStore(store: {
    store_name: string
    location: string
    store_id: string
    company_name?: string
    pan_vat_number?: string
    logo_url?: string
    latitude?: number
    longitude?: number
}) {
    const supabase = await getSupabaseServer()

    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('retail_stores')
        .insert({
            ...store,
            created_by: userData?.user?.id,
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function updateRetailStore(id: string, store: any) {
    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
        .from('retail_stores')
        .update(store)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    return { data }
}

export async function deleteRetailStore(id: string) {
    const supabase = await getSupabaseServer()

    const { error } = await supabase
        .from('retail_stores')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}
