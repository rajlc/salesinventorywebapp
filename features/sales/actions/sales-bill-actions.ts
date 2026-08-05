'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SalesBillItem {
    id?: string
    hs_code?: string | null
    particulars: string
    quantity: number
    rate: number
    amount: number
    unit?: string | null
    line_order: number
}

export interface SalesBill {
    id: string
    bill_date_ad: string
    bill_date_bs: string
    seller_company_id: string | null
    invoice_no: string
    customer_name: string
    customer_address: string | null
    customer_pan_vat: string | null
    sub_total_amount: number
    discount?: number
    taxable_amount?: number
    vat_amount: number
    total_amount: number
    fiscal_year_id: string | null
    created_at: string
    items?: SalesBillItem[]
}

export interface CreateSalesBillParams {
    bill_date_ad: string
    bill_date_bs: string
    seller_company_id?: string | null
    invoice_no: string
    customer_name: string
    customer_address?: string | null
    customer_pan_vat?: string | null
    sub_total_amount: number
    discount?: number
    taxable_amount?: number
    vat_amount: number
    total_amount: number
    fiscal_year_id?: string | null
    items: Omit<SalesBillItem, 'id'>[]
}

// Get all Sales bills
export async function getSalesBills(filters?: {
    fiscalYearId?: string
    startDate?: string
    endDate?: string
    search?: string
}) {
    const supabase = await createClient()

    let query = supabase
        .from('sales_bills')
        .select('*')
        .eq('is_deleted', false)
        .order('bill_date_ad', { ascending: false })

    // Filter by Fiscal Year ID (Get dates first)
    if (filters?.fiscalYearId && filters.fiscalYearId !== 'all') {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', filters.fiscalYearId)
            .single()

        if (fy) {
            query = query
                .gte('bill_date_ad', fy.start_date)
                .lte('bill_date_ad', fy.end_date)
        }
    } else if (filters?.startDate && filters?.endDate) {
        query = query
            .gte('bill_date_ad', filters.startDate)
            .lte('bill_date_ad', filters.endDate)
    }

    if (filters?.search) {
        query = query.or(
            `customer_name.ilike.%${filters.search}%,invoice_no.ilike.%${filters.search}%`
        )
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Sales bills:', error)
        throw error
    }

    return data as SalesBill[]
}

// Create new Sales bill
export async function createSalesBill(params: CreateSalesBillParams) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Enforce duplicate validation
    const isDuplicate = await checkDuplicateInvoice(params.invoice_no, params.bill_date_ad)
    if (isDuplicate) {
        throw new Error('Invoice number Duplicate')
    }

    // Find matching fiscal year
    const { data: fy } = await supabase
        .from('fiscal_years')
        .select('id')
        .lte('start_date', params.bill_date_ad)
        .gte('end_date', params.bill_date_ad)
        .single()

    // Insert bill
    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .insert({
            bill_date_ad: params.bill_date_ad,
            bill_date_bs: params.bill_date_bs,
            seller_company_id: params.seller_company_id || null,
            invoice_no: params.invoice_no.trim(),
            customer_name: params.customer_name,
            customer_address: params.customer_address || null,
            customer_pan_vat: params.customer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            discount: params.discount || 0,
            taxable_amount: params.taxable_amount || params.sub_total_amount,
            vat_amount: params.vat_amount,
            total_amount: params.total_amount,
            fiscal_year_id: fy?.id || params.fiscal_year_id || null,
            created_by: user?.id || null,
        })
        .select()
        .single()

    if (billError) throw billError

    // Insert items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item: any) => ({
            bill_id: bill.id,
            hs_code: item.hs_code || null,
            particulars: item.particulars,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            unit: item.unit || 'Pcs',
            line_order: item.line_order,
        }))

        const { error: itemsError } = await supabase
            .from('sales_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/sales-billing')
    return bill as SalesBill
}

// Get single Sales bill with items
export async function getSalesBillById(id: string) {
    const supabase = await createClient()

    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

    if (billError) throw billError

    const { data: items, error: itemsError } = await supabase
        .from('sales_bill_items')
        .select('*')
        .eq('bill_id', id)
        .order('line_order', { ascending: true })

    if (itemsError) throw itemsError

    return { ...bill, items } as SalesBill
}

// Update Sales bill
export async function updateSalesBill(id: string, params: CreateSalesBillParams) {
    const supabase = await createClient()

    // Enforce duplicate validation (excluding this bill)
    const isDuplicate = await checkDuplicateInvoice(params.invoice_no, params.bill_date_ad, id)
    if (isDuplicate) {
        throw new Error('Invoice number Duplicate')
    }

    // Find matching fiscal year
    const { data: fy } = await supabase
        .from('fiscal_years')
        .select('id')
        .lte('start_date', params.bill_date_ad)
        .gte('end_date', params.bill_date_ad)
        .single()

    // Update bill
    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .update({
            bill_date_ad: params.bill_date_ad,
            bill_date_bs: params.bill_date_bs,
            seller_company_id: params.seller_company_id || null,
            invoice_no: params.invoice_no.trim(),
            customer_name: params.customer_name,
            customer_address: params.customer_address || null,
            customer_pan_vat: params.customer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            discount: params.discount || 0,
            taxable_amount: params.taxable_amount || params.sub_total_amount,
            vat_amount: params.vat_amount,
            total_amount: params.total_amount,
            fiscal_year_id: fy?.id || params.fiscal_year_id || null,
        })
        .eq('id', id)
        .select()
        .single()

    if (billError) throw billError

    // Delete existing items
    const { error: deleteError } = await supabase
        .from('sales_bill_items')
        .delete()
        .eq('bill_id', id)

    if (deleteError) throw deleteError

    // Insert new items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item: any) => ({
            bill_id: id,
            hs_code: item.hs_code || null,
            particulars: item.particulars,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            unit: item.unit || 'Pcs',
            line_order: item.line_order,
        }))

        const { error: itemsError } = await supabase
            .from('sales_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/sales-billing')
    return bill as SalesBill
}

// Get next suggested invoice number for a given date
export async function getNextSuggestedInvoiceNo(date: string): Promise<string> {
    const supabase = await createClient()

    // Get fiscal year date range
    const { data: fy } = await supabase
        .from('fiscal_years')
        .select('start_date, end_date')
        .lte('start_date', date)
        .gte('end_date', date)
        .single()

    if (!fy) return '001'

    const { data, error } = await supabase
        .from('sales_bills')
        .select('invoice_no')
        .eq('is_deleted', false)
        .gte('bill_date_ad', fy.start_date)
        .lte('bill_date_ad', fy.end_date)

    if (error || !data || data.length === 0) {
        return '001'
    }

    let maxNum = 0
    data.forEach(bill => {
        const num = parseInt(bill.invoice_no, 10)
        if (!isNaN(num) && num > maxNum) {
            maxNum = num
        }
    })

    const nextNum = maxNum + 1
    return String(nextNum).padStart(3, '0')
}

// Check for duplicate invoice number in the fiscal year of a given date
export async function checkDuplicateInvoice(invoiceNo: string, date: string, excludeBillId?: string): Promise<boolean> {
    const supabase = await createClient()

    // Get fiscal year date range
    const { data: fy } = await supabase
        .from('fiscal_years')
        .select('start_date, end_date')
        .lte('start_date', date)
        .gte('end_date', date)
        .single()

    if (!fy) return false

    let query = supabase
        .from('sales_bills')
        .select('id')
        .eq('invoice_no', invoiceNo.trim())
        .eq('is_deleted', false)
        .gte('bill_date_ad', fy.start_date)
        .lte('bill_date_ad', fy.end_date)

    if (excludeBillId) {
        query = query.neq('id', excludeBillId)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error checking duplicate invoice:', error)
        return false
    }

    return data.length > 0
}
