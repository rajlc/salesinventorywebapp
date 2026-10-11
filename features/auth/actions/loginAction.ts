'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function loginAction(
    credentials: FormData | string,
    rawPassword?: string
) {
    let email = ''
    let password = ''

    if (typeof credentials === 'object' && credentials !== null && 'get' in credentials) {
        email = String(credentials.get('email') || '').trim()
        password = String(credentials.get('password') || '')
    } else if (typeof credentials === 'string') {
        email = credentials.trim()
        password = rawPassword || ''
    }

    if (!email || !password) {
        return { error: 'Email and password are required' }
    }

    const supabase = await createClient()

    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (signInError) {
        return { error: signInError.message }
    }

    if (!user) {
        return { error: 'Login failed. Please verify your credentials.' }
    }

    // Check user status in user_profiles
    let profile: { status: string; role?: string } | null = null

    const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('status, role')
        .eq('id', user.id)
        .single()

    if (userProfile) {
        profile = userProfile
    } else {
        // Fallback to admin client to bypass potential RLS restrictions
        try {
            const admin = await createAdminClient()
            const { data: adminProfile } = await admin
                .from('user_profiles')
                .select('status, role')
                .eq('id', user.id)
                .single()

            if (adminProfile) {
                profile = adminProfile
            }
        } catch (adminErr) {
            console.error('Failed to fetch profile via admin client:', adminErr)
        }
    }

    if (profile) {
        if (profile.status === 'pending') {
            await supabase.auth.signOut()
            return { error: 'Your account is pending admin approval. Please contact an administrator.' }
        }

        if (profile.status === 'disable') {
            await supabase.auth.signOut()
            return { error: 'Your account has been disabled. Please contact the administrator.' }
        }

        if (profile.status !== 'active' && profile.role !== 'admin') {
            await supabase.auth.signOut()
            return { error: 'Your account status is inactive. Please contact the administrator.' }
        }
    }

    // Log login activity asynchronously
    try {
        await supabase.from('user_activity_logs').insert({
            user_id: user.id,
            action: 'login',
            browser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            ip_address: null,
        })
    } catch (logError) {
        // Silent fail for logging
        console.error('Failed to log login activity:', logError)
    }

    // Return success to the client instead of throwing Next.js NEXT_REDIRECT
    return { success: true, redirectTo: '/dashboard' }
}
