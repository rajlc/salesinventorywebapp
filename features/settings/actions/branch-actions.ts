'use server'

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export interface Branch {
    id: string
    branch_name: string
    delivery_charge: number
    location?: string
    contact?: string
    created_at?: string
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all branches
 */
export async function getBranches() {
    const supabase = await createClient()

    const { data: branches, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name')

    if (error) throw error

    return branches || []
}

/**
 * Get single branch by ID
 */
export async function getBranchById(id: string) {
    const supabase = await createClient()

    const { data: branch, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error

    return branch
}

/**
 * Get branch delivery charge
 */
export async function getBranchDeliveryCharge(branchId: string): Promise<number> {
    const branch = await getBranchById(branchId)
    return branch?.delivery_charge || 0
}
