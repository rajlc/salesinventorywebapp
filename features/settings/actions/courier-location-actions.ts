'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CourierLocation {
    id: string
    courier_id: string
    branch_name: string
    delivery_charge: number
    cover_area: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export type AddCourierLocationInput = {
    branch_name: string
    delivery_charge: number
    cover_area?: string
}

export async function getCourierLocations(courierId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('courier_locations')
        .select('*')
        .eq('courier_id', courierId)
        .order('branch_name', { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    return data as CourierLocation[]
}

export async function createCourierLocation(courierId: string, input: AddCourierLocationInput) {
    const supabase = await createClient()
    const { error } = await supabase.from('courier_locations').insert({
        courier_id: courierId,
        branch_name: input.branch_name.toUpperCase(),
        delivery_charge: input.delivery_charge,
        cover_area: input.cover_area || null,
    })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(`/dashboard/settings/couriers/${courierId}`)
}

export async function deleteCourierLocation(id: string, courierId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('courier_locations').delete().eq('id', id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(`/dashboard/settings/couriers/${courierId}`)
}

export async function bulkCreateCourierLocations(courierId: string, locations: AddCourierLocationInput[]) {
    const supabase = await createClient()

    // Process in batches of 100
    const batchSize = 100
    for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize).map(item => ({
            courier_id: courierId,
            branch_name: item.branch_name.toUpperCase(),
            delivery_charge: item.delivery_charge,
            cover_area: item.cover_area || null,
        }))

        const { error } = await supabase.from('courier_locations').insert(batch)
        if (error) throw new Error(`Bulk import failed at row ${i}: ${error.message}`)
    }

    revalidatePath(`/dashboard/settings/couriers/${courierId}`)
}
