'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
interface CreateSupplierData {
    supplier_name: string
    contact_details?: string
    remarks?: string
    price_requirement?: boolean
}

interface GetSuppliersParams {
    page?: number
    limit?: number
    search?: string
}

// Create new supplier
export async function createSupplier(data: CreateSupplierData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        const { data: supplier, error } = await supabase
            .from('suppliers')
            .insert({
                supplier_name: data.supplier_name,
                contact_details: data.contact_details,
                remarks: data.remarks,
                price_requirement: data.price_requirement ?? true,
                created_by: user.id
            })
            .select()
            .single()

        if (error) throw error

        revalidatePath('/dashboard/suppliers/suppliers-list')
        return { success: true, supplier }
    } catch (error: any) {
        console.error('Error creating supplier:', error)
        throw new Error(error.message || 'Failed to create supplier')
    }
}

// Get all suppliers with pagination and search
export async function getSuppliers(params: GetSuppliersParams) {
    const supabase = await createClient()
    const { page = 1, limit = 50, search } = params

    let query = supabase
        .from('suppliers')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)

    // Search by supplier name
    if (search) {
        query = query.ilike('supplier_name', `%${search}%`)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order('supplier_name', { ascending: true }) // Alphabetical order
        .range(from, to)

    if (error) throw error

    return {
        suppliers: data || [],
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get single supplier by ID
export async function getSupplierById(supplierId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .eq('is_deleted', false)
        .single()

    if (error) throw error

    return data
}

// Update supplier
export async function updateSupplier(supplierId: string, data: Partial<CreateSupplierData>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        const { error } = await supabase
            .from('suppliers')
            .update({
                supplier_name: data.supplier_name,
                contact_details: data.contact_details,
                remarks: data.remarks,
                price_requirement: data.price_requirement,
                updated_by: user.id
            })
            .eq('id', supplierId)

        if (error) throw error

        revalidatePath('/dashboard/suppliers/suppliers-list')
        return { success: true }
    } catch (error: any) {
        console.error('Error updating supplier:', error)
        throw new Error(error.message || 'Failed to update supplier')
    }
}

// Soft delete supplier
export async function deleteSupplier(supplierId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        const { error } = await supabase
            .from('suppliers')
            .update({
                is_deleted: true,
                updated_by: user.id
            })
            .eq('id', supplierId)

        if (error) throw error

        revalidatePath('/dashboard/suppliers/suppliers-list')
        revalidatePath('/dashboard/suppliers/suppliers-account')
        revalidatePath('/dashboard/suppliers/suppliers-transaction')
        revalidatePath('/dashboard/suppliers/dashboard')
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting supplier:', error)
        throw new Error(error.message || 'Failed to delete supplier')
    }
}
