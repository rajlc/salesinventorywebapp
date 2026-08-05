'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CompanyDetails {
    id: string
    company_name: string
    pan_vat_details: string | null
    address: string | null
    remarks: string | null
    created_at: string
    updated_at: string
    created_by: string | null
    is_deleted: boolean
}

export interface CreateCompanyDetailsParams {
    company_name: string
    pan_vat_details?: string | null
    address?: string | null
    remarks?: string | null
}

export interface UpdateCompanyDetailsParams extends CreateCompanyDetailsParams {
    id: string
}

// Get all company details
export async function getCompanyDetails() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('company_details')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching company details:', error)
        throw error
    }

    return data as CompanyDetails[]
}

// Create new company details
export async function createCompanyDetails(params: CreateCompanyDetailsParams) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('company_details')
        .insert({
            company_name: params.company_name,
            pan_vat_details: params.pan_vat_details || null,
            address: params.address || null,
            remarks: params.remarks || null,
            created_by: user?.id || null,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating company details:', error)
        throw error
    }

    revalidatePath('/dashboard/settings/stores')
    return data as CompanyDetails
}

// Update company details
export async function updateCompanyDetails(params: UpdateCompanyDetailsParams) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('company_details')
        .update({
            company_name: params.company_name,
            pan_vat_details: params.pan_vat_details || null,
            address: params.address || null,
            remarks: params.remarks || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single()

    if (error) {
        console.error('Error updating company details:', error)
        throw error
    }

    revalidatePath('/dashboard/settings/stores')
    return data as CompanyDetails
}

// Delete company details (soft delete)
export async function deleteCompanyDetails(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('company_details')
        .update({ is_deleted: true })
        .eq('id', id)

    if (error) {
        console.error('Error deleting company details:', error)
        throw error
    }

    revalidatePath('/dashboard/settings/stores')
    return { success: true }
}
