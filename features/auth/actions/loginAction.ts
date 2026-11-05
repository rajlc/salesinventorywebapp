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

    let authData: { user: any } | null = null
    let signInError: any = null

    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        authData = res.data
        signInError = res.error

        if (!signInError) break

        const rawMsg = String(signInError?.message || '').trim()
        const errMsg = rawMsg.toLowerCase()
        const errName = String(signInError?.name || '').toLowerCase()
        const isTransient =
            rawMsg === '{}' ||
            rawMsg === '' ||
            errName.includes('retryable') ||
            signInError?.status === 0 ||
            signInError?.status === 522 ||
            signInError?.status === 502 ||
            signInError?.status === 503 ||
            signInError?.status === 504 ||
            errMsg.includes('fetch failed') ||
            errMsg.includes('timeout') ||
            errMsg.includes('network') ||
            errMsg.includes('522') ||
            errMsg.includes('503') ||
            errMsg.includes('504')

        if (!isTransient || attempt === 2) break
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)))
    }

    if (signInError) {
        const rawMsg = String(signInError?.message || '').trim()
        if (rawMsg === '{}' || !rawMsg || String(signInError?.name || '').includes('Retryable')) {
            return {
                error: 'Database server is waking up or temporarily busy. Please wait 3 seconds and click Sign In again.'
            }
        }
        return { error: rawMsg }
    }

    const user = authData?.user
    if (!user) {
        return { error: 'Login failed. Please verify your credentials.' }
    }

    // Check user status in user_profiles (prefer fast admin client to avoid extra RLS overhead)
    let profile: { status: string; role?: string } | null = null

    try {
        const admin = await createAdminClient()
        const { data: adminProfile } = await admin
            .from('user_profiles')
            .select('status, role')
            .eq('id', user.id)
            .maybeSingle()

        if (adminProfile) {
            profile = adminProfile
        }
    } catch (adminErr) {
        console.error('Failed to fetch profile via admin client:', adminErr)
    }

    if (!profile) {
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('status, role')
            .eq('id', user.id)
            .maybeSingle()
        if (userProfile) {
            profile = userProfile
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

    // Fire-and-forget login activity log so it never blocks or delays sign-in
    supabase
        .from('user_activity_logs')
        .insert({
            user_id: user.id,
            action: 'login',
            browser: null,
            ip_address: null,
        })
        .then(() => {}, () => {})

    return {
        success: true,
        redirectTo: '/dashboard',
        userId: user.id,
        role: profile?.role || (user.user_metadata?.role as string) || 'user'
    }
}
