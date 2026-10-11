'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function signupAction(email: string, password: string, fullName: string) {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = fullName.trim()

    if (!cleanEmail || !password || !cleanName) {
        return { error: 'All fields are required.' }
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
            data: {
                full_name: cleanName,
            },
        },
    })

    if (error) {
        return { error: error.message }
    }

    if (!data.user) {
        return { error: 'Failed to create user account. Please try again.' }
    }

    // Auto-confirm user so they don't get "email not confirmed" error
    try {
        const adminClient = await createAdminClient()
        await adminClient.auth.admin.updateUserById(data.user.id, {
            email_confirm: true,
            user_metadata: { email_confirmed: true, full_name: cleanName }
        })

        // Ensure user profile entry exists with 'pending' status
        await adminClient.from('user_profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            full_name: cleanName,
            role: 'user',
            status: 'pending',
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
    } catch (adminError) {
        console.error('Failed to auto-confirm user or create profile:', adminError)
    }

    return { success: true }
}
