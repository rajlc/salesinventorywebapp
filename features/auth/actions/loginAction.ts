'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(email: string, password: string) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options)
                    } catch (error) {
                        // Handle cookie setting error
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', options)
                    } catch (error) {
                        // Handle cookie removal error
                    }
                },
            },
        }
    )

    const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    if (!user) {
        return { error: 'Login failed' }
    }

    // Check user status
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('id', user.id)
        .single()

    if (profileError) {
        // If no profile exists, user status is pending by default
        return { error: 'Your account is waiting for admin approval. Please check back later.' }
    }

    // Check status and return appropriate message
    if (profile.status === 'pending') {
        // Sign out the user
        await supabase.auth.signOut()
        return { error: 'Your account is waiting for admin approval. Please check back later.' }
    }

    if (profile.status === 'disable') {
        // Sign out the user
        await supabase.auth.signOut()
        return { error: 'Your account has been disabled. Please contact the administrator.' }
    }

    // Only allow active users to proceed
    if (profile.status !== 'active') {
        await supabase.auth.signOut()
        return { error: 'Your account status is not active. Please contact the administrator.' }
    }

    // Log login activity
    try {
        await supabase.from('user_activity_logs').insert({
            user_id: user.id,
            action: 'login',
            browser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            ip_address: null, // Can be populated from headers if needed
        })
    } catch (logError) {
        // Silent fail for logging
        console.error('Failed to log activity:', logError)
    }

    redirect('/dashboard')
}
