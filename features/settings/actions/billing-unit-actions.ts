'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BillingUnit {
    id: string
    name: string
    is_primary: boolean
    created_at?: string
    updated_at?: string
}

/**
 * Get all billing units ordered by name
 */
export async function getBillingUnits() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('billing_units')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching billing units:', error)
        throw error
    }

    return (data || []) as BillingUnit[]
}

/**
 * Create a new billing unit. If it is the first unit, make it primary.
 */
export async function createBillingUnit(name: string) {
    const supabase = await createClient()

    // Get current units to check if this is the first one
    const existingUnits = await getBillingUnits()
    const isPrimary = existingUnits.length === 0

    const { data, error } = await supabase
        .from('billing_units')
        .insert({
            name,
            is_primary: isPrimary,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating billing unit:', error)
        throw error
    }

    revalidatePath('/dashboard/settings/finance-accounts')
    return data as BillingUnit
}

/**
 * Delete a billing unit. If it was primary, designate another unit as primary.
 */
export async function deleteBillingUnit(id: string) {
    const supabase = await createClient()

    // Fetch the unit being deleted
    const { data: deletedUnit } = await supabase
        .from('billing_units')
        .select('*')
        .eq('id', id)
        .single()

    const { error } = await supabase
        .from('billing_units')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting billing unit:', error)
        throw error
    }

    // If we deleted the primary unit, make the first remaining unit primary
    if (deletedUnit?.is_primary) {
        const { data: remainingUnits } = await supabase
            .from('billing_units')
            .select('*')
            .order('name', { ascending: true })
            .limit(1)

        if (remainingUnits && remainingUnits.length > 0) {
            await supabase
                .from('billing_units')
                .update({ is_primary: true })
                .eq('id', remainingUnits[0].id)
        }
    }

    revalidatePath('/dashboard/settings/finance-accounts')
    return { success: true }
}

/**
 * Set a specific billing unit as primary, resetting all other units.
 */
export async function setPrimaryBillingUnit(id: string) {
    const supabase = await createClient()

    // Reset all other units to not primary
    const { error: resetError } = await supabase
        .from('billing_units')
        .update({ is_primary: false })
        .neq('id', id)

    if (resetError) {
        console.error('Error resetting primary billing units:', resetError)
        throw resetError
    }

    // Set the chosen unit as primary
    const { data, error: setPrimaryError } = await supabase
        .from('billing_units')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single()

    if (setPrimaryError) {
        console.error('Error setting primary billing unit:', setPrimaryError)
        throw setPrimaryError
    }

    revalidatePath('/dashboard/settings/finance-accounts')
    return data as BillingUnit
}
