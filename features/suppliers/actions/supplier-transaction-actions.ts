'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SupplierTransaction {
    id: string
    created_at: string
    transaction_date: string
    supplier_id: string
    transaction_mode: string
    transaction_type: string
    amount: number
    payment_method: string
    cheque_date?: string | null
    cheque_type?: string | null
    cheque_name?: string | null
    cheque_image_url?: string | null
    remarks?: string | null
    supplier?: {
        supplier_name: string
    }
}

export interface CreateSupplierTransactionData {
    transaction_date: string
    supplier_id: string
    transaction_mode: string
    transaction_type: string
    amount: number
    payment_method: string
    cheque_date?: string | null
    cheque_type?: string | null
    cheque_name?: string | null
    cheque_image_url?: string | null
    remarks?: string | null
}

export async function getSupplierTransactions({
    search = '',
    limit = 50
}: {
    search?: string
    limit?: number
}) {
    const supabase = await createClient()

    let query = supabase
        .from('supplier_transactions')
        .select(`
            *,
            supplier:suppliers(supplier_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (search) {
        query = query.ilike('supplier.supplier_name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching supplier transactions:', error)
        return { transactions: [] }
    }

    // Client-side filter for relation search if ilike on generic relation fails 
    // (Supabase sometimes has issues filtering joined tables directly if not set up with precise hints, 
    // but standard join filtering syntax is !inner for filtering. 
    // For simplicity, we can fetch basic list or assume the user wants filtering. 
    // Actually, simple .ilike('supplier.supplier_name') works if the embedded resource is correct, 
    // but easier to verify if we filter in memory or use !inner join. 
    // Let's rely on standard search or just fetch recent.)
    // If search param is passed, we might better use:
    if (search) {
        // Re-query with inner join to filter
        const { data: searchData, error: searchError } = await supabase
            .from('supplier_transactions')
            .select(`
                *,
                supplier:suppliers!inner(supplier_name)
            `)
            .ilike('supplier.supplier_name', `%${search}%`)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (searchError) {
            console.error('Error searching supplier transactions:', searchError)
            return { transactions: [] }
        }
        return { transactions: searchData as SupplierTransaction[] }
    }

    return { transactions: data as SupplierTransaction[] }
}

export async function createSupplierTransaction(data: CreateSupplierTransactionData) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('supplier_transactions')
        .insert([data])

    if (error) {
        console.error('Error creating supplier transaction:', error)
        throw new Error('Failed to create transaction')
    }

    revalidatePath('/dashboard/suppliers/suppliers-transaction')
    return { success: true }
}

export async function updateSupplierTransaction({ id, data }: { id: string; data: CreateSupplierTransactionData }) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('supplier_transactions')
        .update(data)
        .eq('id', id)

    if (error) {
        console.error('Error updating supplier transaction:', error)
        throw new Error('Failed to update transaction')
    }

    revalidatePath('/dashboard/suppliers/suppliers-transaction')
    return { success: true }
}
