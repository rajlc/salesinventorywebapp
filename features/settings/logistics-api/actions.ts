'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPathaoSettings() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('courier_api_settings')
        .select('*')
        .eq('provider', 'pathao')
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Pathao settings:', error)
    }

    return data
}

export async function savePathaoSettings(formData: FormData) {
    const supabase = await createClient()

    const client_id = formData.get('client_id') as string
    const client_secret = formData.get('client_secret') as string
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const base_url = formData.get('base_url') as string

    // Simple validation
    if (!client_id || !client_secret || !username || !password || !base_url) {
        return { error: 'All fields are required' }
    }

    const dataToUpsert = {
        provider: 'pathao',
        client_id,
        client_secret,
        username,
        password,
        base_url,
        updated_at: new Date().toISOString()
    }

    const { error } = await supabase
        .from('courier_api_settings')
        .upsert(dataToUpsert, { onConflict: 'provider' })

    if (error) {
        console.error('Error saving Pathao settings:', error)
        return { error: 'Failed to save settings' }
    }

    revalidatePath('/dashboard/settings/logistics-api/pathao')
    return { success: 'Settings saved successfully' }
}
