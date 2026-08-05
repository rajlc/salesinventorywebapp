'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PanVatCompany {
    id: string
    company_name: string
    pan_vat_no: string
    supplier_id: string | null
    supplier_name: string | null
    remarks: string | null
    created_at: string
    updated_at: string
    created_by: string | null
    is_deleted: boolean
}

export interface CreatePanVatCompanyParams {
    company_name: string
    pan_vat_no: string
    supplier_id?: string | null
    supplier_name?: string | null
    remarks?: string | null
}

export interface UpdatePanVatCompanyParams extends CreatePanVatCompanyParams {
    id: string
}

// Get all PAN/VAT companies
export async function getPanVatCompanies() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('pan_vat_companies')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching PAN/VAT companies:', error)
        throw error
    }

    return data as PanVatCompany[]
}

// Create a new PAN/VAT company
export async function createPanVatCompany(params: CreatePanVatCompanyParams) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('pan_vat_companies')
        .insert({
            company_name: params.company_name,
            pan_vat_no: params.pan_vat_no,
            supplier_id: params.supplier_id || null,
            supplier_name: params.supplier_name || null,
            remarks: params.remarks || null,
            created_by: user?.id || null,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating PAN/VAT company:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return data as PanVatCompany
}

// Update a PAN/VAT company
export async function updatePanVatCompany(params: UpdatePanVatCompanyParams) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('pan_vat_companies')
        .update({
            company_name: params.company_name,
            pan_vat_no: params.pan_vat_no,
            supplier_id: params.supplier_id || null,
            supplier_name: params.supplier_name || null,
            remarks: params.remarks || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single()

    if (error) {
        console.error('Error updating PAN/VAT company:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return data as PanVatCompany
}

// Delete a PAN/VAT company (soft delete)
export async function deletePanVatCompany(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('pan_vat_companies')
        .update({ is_deleted: true })
        .eq('id', id)

    if (error) {
        console.error('Error deleting PAN/VAT company:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return { success: true }
}
