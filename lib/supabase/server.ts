import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

export const createClient = cache(async () => {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
})

// Fast, request-deduplicated helper to fetch current authenticated user
export const getAuthenticatedUser = cache(async () => {
    const cookieStore = await cookies()
    const hasAuthCookie = cookieStore.getAll().some(
        c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
    )
    if (!hasAuthCookie) {
        return null
    }
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
})

// Admin client for admin API operations (uses service role key)
// We use the basic createClient from supabase-js for admin tasks to avoid
// cookie/session handling issues that occur with ssr client
export const createAdminClient = cache(async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
})
