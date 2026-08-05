'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DeliveryLocation {
    id: string
    branch_name: string
    delivery_charge: number
    cover_area: string
    is_active: boolean
    created_at: string
}

export type AddDeliveryLocationInput = Omit<DeliveryLocation, 'id' | 'is_active' | 'created_at'>

export async function getDeliveryLocations() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('delivery_locations')
        .select('*')
        .order('branch_name', { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    return data as DeliveryLocation[]
}

export async function createDeliveryLocation(input: AddDeliveryLocationInput) {
    const supabase = await createClient()
    const { error } = await supabase.from('delivery_locations').insert({
        branch_name: input.branch_name.toUpperCase(),
        delivery_charge: input.delivery_charge,
        cover_area: input.cover_area,
    })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/settings/locations')
}

export async function bulkCreateDeliveryLocations(inputs: AddDeliveryLocationInput[]) {
    const supabase = await createClient()

    // Process in batches of 100
    const batchSize = 100
    for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs.slice(i, i + batchSize).map(item => ({
            ...item,
            branch_name: item.branch_name.toUpperCase()
        }))

        const { error } = await supabase.from('delivery_locations').insert(batch)
        if (error) throw new Error(`Bulk import failed at row ${i}: ${error.message}`)
    }

    revalidatePath('/dashboard/settings/locations')
}

export async function deleteDeliveryLocation(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('delivery_locations').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/settings/locations')
}
