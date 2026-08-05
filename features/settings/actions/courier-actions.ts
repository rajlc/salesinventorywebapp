'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Courier {
    id: string
    courier_id: string
    courier_name: string
    additional_details: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export type AddCourierInput = {
    courier_id: string
    courier_name: string
    additional_details?: string
}

export async function getCouriers() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .order('courier_name', { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    return data as Courier[]
}

export async function createCourier(input: AddCourierInput) {
    const supabase = await createClient()
    const { error } = await supabase.from('couriers').insert({
        courier_id: input.courier_id.toUpperCase(),
        courier_name: input.courier_name,
        additional_details: input.additional_details || null,
    })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/settings/couriers')
}

export async function updateCourierStatus(id: string, is_active: boolean) {
    const supabase = await createClient()

    // If deactivating, check if this is the only active courier
    if (!is_active) {
        // Count active couriers
        const { data: activeCouriers, error: countError } = await supabase
            .from('couriers')
            .select('id')
            .eq('is_active', true)

        if (countError) {
            throw new Error(countError.message)
        }

        // If only one active courier and it's this one, prevent deactivation
        if (activeCouriers && activeCouriers.length === 1 && activeCouriers[0].id === id) {
            throw new Error('Cannot deactivate: Need one to active')
        }
    }

    // If activating a courier, first deactivate all others
    if (is_active) {
        // Deactivate all couriers first
        const { error: deactivateError } = await supabase
            .from('couriers')
            .update({ is_active: false })
            .neq('id', id)

        if (deactivateError) {
            throw new Error(deactivateError.message)
        }
    }

    // Then update the target courier
    const { error } = await supabase
        .from('couriers')
        .update({ is_active })
        .eq('id', id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/settings/couriers')
}

export async function deleteCourier(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('couriers').delete().eq('id', id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/settings/couriers')
}
// ... existing code ...

export async function getCourierLocations(courierId: string, search: string = '') {
    const supabase = await createClient()

    let query = supabase
        .from('courier_locations')
        .select('id, branch_name, delivery_charge')
        .eq('courier_id', courierId)
        .eq('is_active', true)
        .order('branch_name', { ascending: true })
        .limit(50) // Limit results for performance

    if (search) {
        query = query.ilike('branch_name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching courier locations:', error)
        return []
    }

    return data
}
