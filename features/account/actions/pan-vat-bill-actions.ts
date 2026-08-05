'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PanVatBillItem {
    id?: string
    hs_code?: string | null
    particulars: string
    quantity: number
    rate: number
    amount: number
    unit?: string | null
    line_order: number
}

export interface PanVatBill {
    id: string
    issue_bill_date_ad: string
    issue_bill_date_bs: string
    supplier_company_id: string | null
    supplier_company_name: string | null
    supplier_pan_vat: string | null
    invoice_no: string
    buyer_company_id: string | null
    buyer_company_name: string | null
    buyer_pan_vat: string | null
    sub_total_amount: number
    taxable_amount: number
    vat_13_percent: number
    total_amount: number
    discount?: number
    excise_duty?: number
    fiscal_year_id: string | null
    created_at: string
    updated_at: string
    items?: PanVatBillItem[]
}

export interface CreatePanVatBillParams {
    issue_bill_date_ad: string
    issue_bill_date_bs: string
    supplier_company_id?: string | null
    supplier_company_name?: string | null
    supplier_pan_vat?: string | null
    invoice_no: string
    buyer_company_id?: string | null
    buyer_company_name?: string | null
    buyer_pan_vat?: string | null
    sub_total_amount: number
    taxable_amount: number
    vat_13_percent: number
    total_amount: number
    discount?: number
    excise_duty?: number
    fiscal_year_id?: string | null
    items: Omit<PanVatBillItem, 'id'>[]
}

// Get all Pan/Vat bills with filters
export async function getPanVatBills(filters?: {
    fiscalYearId?: string
    startDate?: string
    endDate?: string
    search?: string
}) {
    const supabase = await createClient()

    let query = supabase
        .from('pan_vat_bills')
        .select('*')
        .eq('is_deleted', false)
        .order('issue_bill_date_ad', { ascending: false })

    // Filter by fiscal year date range
    if (filters?.startDate && filters?.endDate) {
        query = query
            .gte('issue_bill_date_ad', filters.startDate)
            .lte('issue_bill_date_ad', filters.endDate)
    }

    // Search filter
    if (filters?.search) {
        query = query.or(
            `supplier_company_name.ilike.%${filters.search}%,buyer_company_name.ilike.%${filters.search}%,invoice_no.ilike.%${filters.search}%`
        )
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Pan/Vat bills:', error)
        throw error
    }

    return data as PanVatBill[]
}

// Get single bill with items
export async function getPanVatBillById(id: string) {
    const supabase = await createClient()

    const { data: bill, error: billError } = await supabase
        .from('pan_vat_bills')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

    if (billError) throw billError

    const { data: items, error: itemsError } = await supabase
        .from('pan_vat_bill_items')
        .select('*')
        .eq('bill_id', id)
        .order('line_order', { ascending: true })

    if (itemsError) throw itemsError

    return { ...bill, items } as PanVatBill
}

// Create new Pan/Vat bill
export async function createPanVatBill(params: CreatePanVatBillParams) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Insert bill
    const { data: bill, error: billError } = await supabase
        .from('pan_vat_bills')
        .insert({
            issue_bill_date_ad: params.issue_bill_date_ad,
            issue_bill_date_bs: params.issue_bill_date_bs,
            supplier_company_id: params.supplier_company_id || null,
            supplier_company_name: params.supplier_company_name || null,
            supplier_pan_vat: params.supplier_pan_vat || null,
            invoice_no: params.invoice_no,
            buyer_company_id: params.buyer_company_id || null,
            buyer_company_name: params.buyer_company_name || null,
            buyer_pan_vat: params.buyer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            taxable_amount: params.taxable_amount,
            vat_13_percent: params.vat_13_percent,
            total_amount: params.total_amount,
            discount: params.discount || 0,
            excise_duty: params.excise_duty || 0,
            fiscal_year_id: params.fiscal_year_id || null,
            created_by: user?.id || null,
        })
        .select()
        .single()

    if (billError) throw billError

    // Insert items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item) => ({
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
            .from('pan_vat_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return bill as PanVatBill
}

// Update Pan/Vat bill
export async function updatePanVatBill(id: string, params: CreatePanVatBillParams) {
    const supabase = await createClient()

    // Update bill
    const { data: bill, error: billError } = await supabase
        .from('pan_vat_bills')
        .update({
            issue_bill_date_ad: params.issue_bill_date_ad,
            issue_bill_date_bs: params.issue_bill_date_bs,
            supplier_company_id: params.supplier_company_id || null,
            supplier_company_name: params.supplier_company_name || null,
            supplier_pan_vat: params.supplier_pan_vat || null,
            invoice_no: params.invoice_no,
            buyer_company_id: params.buyer_company_id || null,
            buyer_company_name: params.buyer_company_name || null,
            buyer_pan_vat: params.buyer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            taxable_amount: params.taxable_amount,
            vat_13_percent: params.vat_13_percent,
            total_amount: params.total_amount,
            discount: params.discount || 0,
            excise_duty: params.excise_duty || 0,
            fiscal_year_id: params.fiscal_year_id || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

    if (billError) throw billError

    // Delete existing items
    await supabase.from('pan_vat_bill_items').delete().eq('bill_id', id)

    // Insert new items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item) => ({
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
            .from('pan_vat_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return bill as PanVatBill
}

// Delete Pan/Vat bill (soft delete)
export async function deletePanVatBill(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('pan_vat_bills')
        .update({ is_deleted: true })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return { success: true }
}
