'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MobileCapture = {
    id: string
    created_at: string
    image_path: string
    image_url: string
    price: number | null
    remarks: string | null
    group_id: string | null
    user_id: string | null
}

export type SaveCaptureParams = {
    image_path: string
    image_url: string
    price?: number
    remarks?: string
    group_id?: string
}

export async function saveMobileCapture(params: SaveCaptureParams) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
        .from('mobile_captures')
        .insert({
            image_path: params.image_path,
            image_url: params.image_url,
            price: params.price || null,
            remarks: params.remarks || null,
            group_id: params.group_id || null,
            user_id: user.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving mobile capture:', error)
        throw new Error('Failed to save capture info')
    }

    revalidatePath('/dashboard/mobile-uploads')
    return data
}

export async function getMobileCaptures() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('mobile_captures')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching mobile captures:', error)
        throw new Error('Failed to fetch captures')
    }

    return data as MobileCapture[]
}
