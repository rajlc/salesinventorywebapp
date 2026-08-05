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

export interface ChequeNotification {
    id: string
    supplier_id: string
    date: string
    dateLabel: string
    isToday: boolean
    isTomorrow: boolean
    isYesterday: boolean
    amount: number
    supplierName: string
    text: string
}

export async function getChequeNotifications(): Promise<ChequeNotification[]> {
    const supabase = await createClient()

    // Query supplier_transactions where transaction_mode or payment_method is Cheque
    const { data: transactions, error } = await supabase
        .from('supplier_transactions')
        .select(`
            id,
            transaction_date,
            cheque_date,
            amount,
            transaction_mode,
            payment_method,
            supplier_id,
            supplier:suppliers(supplier_name)
        `)
        .or('transaction_mode.ilike.%cheque%,payment_method.ilike.%cheque%')
        .order('created_at', { ascending: false })

    if (error || !transactions) {
        console.error('Error fetching cheque notifications:', error)
        return []
    }

    // Helper for YYYY-MM-DD string in local time
    const formatDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const now = new Date()
    const todayStr = formatDateStr(now)

    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDateStr(tomorrow)

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatDateStr(yesterday)

    // Filter cheques whose cheque_date (or transaction_date fallback) is today, tomorrow, or yesterday
    const filtered = transactions.filter(t => {
        const cDate = t.cheque_date || t.transaction_date
        if (!cDate) return false
        const dateOnly = cDate.split('T')[0]
        return dateOnly === todayStr || dateOnly === tomorrowStr || dateOnly === yesterdayStr
    })

    // Priority sorting: Today first (1), Tomorrow second (2), Yesterday third (3)
    filtered.sort((a, b) => {
        const dateA = (a.cheque_date || a.transaction_date).split('T')[0]
        const dateB = (b.cheque_date || b.transaction_date).split('T')[0]

        const getPriority = (d: string) => {
            if (d === todayStr) return 1
            if (d === tomorrowStr) return 2
            if (d === yesterdayStr) return 3
            return 4
        }

        return getPriority(dateA) - getPriority(dateB)
    })

    return filtered.map(t => {
        const rawDate = (t.cheque_date || t.transaction_date).split('T')[0]
        const supplierName = (t.supplier as any)?.supplier_name || 'Supplier'
        const amountFormatted = Number(t.amount).toLocaleString('en-NP')

        let label = rawDate
        if (rawDate === todayStr) label = `Today (${rawDate})`
        else if (rawDate === tomorrowStr) label = `Tomorrow (${rawDate})`
        else if (rawDate === yesterdayStr) label = `Yesterday (${rawDate})`

        return {
            id: t.id,
            supplier_id: t.supplier_id,
            date: rawDate,
            dateLabel: label,
            isToday: rawDate === todayStr,
            isTomorrow: rawDate === tomorrowStr,
            isYesterday: rawDate === yesterdayStr,
            amount: Number(t.amount),
            supplierName,
            text: `${rawDate}, Cheque Rs ${amountFormatted} to ${supplierName}`
        }
    })
}

