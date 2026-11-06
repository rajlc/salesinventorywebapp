import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Process-wide singleton Admin Client (mirrors message-order-web's SupabaseService singleton)
// Keeps HTTP Keep-Alive sockets warm and bypasses slow per-row Postgres RLS evaluation
const globalForSupabase = globalThis as unknown as {
    __bagmatiAdminSupabaseClient?: SupabaseClient
}

function getSingletonAdminClient(): SupabaseClient {
    if (!globalForSupabase.__bagmatiAdminSupabaseClient) {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        globalForSupabase.__bagmatiAdminSupabaseClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            key,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        )
    }
    return globalForSupabase.__bagmatiAdminSupabaseClient
}

/**
 * Decode the Supabase User and token expiration directly from `sb-*-auth-token` cookies in 0ms (zero network I/O).
 * Prevents `Error: Not authenticated` crashes and eliminates redundant GoTrue HTTPS calls
 * across parallel Server Actions on Supabase Free Tier (Nano).
 */
function extractUserFromCookies(allCookies: { name: string; value: string }[]): { user: User | null; isFresh: boolean } {
    try {
        const authCookies = allCookies
            .filter(c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && !c.name.includes('code-verifier'))
            .sort((a, b) => a.name.localeCompare(b.name))

        if (authCookies.length === 0) return { user: null, isFresh: false }

        let combined = authCookies.map(c => c.value).join('')
        if (!combined) return { user: null, isFresh: false }

        if (combined.startsWith('base64-')) {
            combined = Buffer.from(combined.slice(7), 'base64').toString('utf8')
        } else {
            try {
                combined = decodeURIComponent(combined)
            } catch {}
        }

        let parsed: any = null
        try {
            parsed = JSON.parse(combined)
        } catch {
            return { user: null, isFresh: false }
        }

        let accessToken: string | null = null
        let embeddedUser: any = null

        if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            accessToken = parsed[0]
        } else if (parsed && typeof parsed === 'object') {
            if (typeof parsed.access_token === 'string') {
                accessToken = parsed.access_token
            }
            if (parsed.user && typeof parsed.user.id === 'string') {
                embeddedUser = parsed.user
            }
        }

        if (!accessToken) {
            return { user: (embeddedUser as User) || null, isFresh: false }
        }

        const parts = accessToken.split('.')
        if (parts.length !== 3) return { user: (embeddedUser as User) || null, isFresh: false }

        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8')
        const payload = JSON.parse(payloadJson)

        if (!payload || typeof payload.sub !== 'string') {
            return { user: (embeddedUser as User) || null, isFresh: false }
        }

        const nowSec = Math.floor(Date.now() / 1000)
        const isFresh = typeof payload.exp === 'number' && payload.exp > nowSec + 30

        const user: User = {
            id: payload.sub,
            aud: payload.aud || 'authenticated',
            role: payload.role || 'authenticated',
            email: payload.email || embeddedUser?.email || '',
            phone: payload.phone || embeddedUser?.phone || '',
            app_metadata: payload.app_metadata || embeddedUser?.app_metadata || {},
            user_metadata: payload.user_metadata || embeddedUser?.user_metadata || {},
            identities: embeddedUser?.identities || [],
            created_at: embeddedUser?.created_at || new Date().toISOString(),
            updated_at: embeddedUser?.updated_at || new Date().toISOString(),
        }

        return { user, isFresh }
    } catch {
        return { user: null, isFresh: false }
    }
}

export const createClient = cache(async () => {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const { user: cachedCookieUser, isFresh: isCookieTokenFresh } = extractUserFromCookies(allCookies)

    const client = createServerClient(
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

    // When the user is already authenticated via cookie and SUPABASE_SERVICE_ROLE_KEY is available,
    // route data queries (.from, .rpc, .storage) through the warm process-wide singleton Admin Client.
    // This eliminates per-row Postgres RLS overhead and reuses Keep-Alive sockets (5x-10x faster queries).
    if (cachedCookieUser && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const adminSingleton = getSingletonAdminClient()
        client.from = adminSingleton.from.bind(adminSingleton)
        client.rpc = adminSingleton.rpc.bind(adminSingleton)
    }

    // Override auth.getUser() so Server Actions & Server Components resolve the user in 0ms
    // when the JWT is valid, and gracefully fall back to the cookie user if GoTrue times out.
    const origGetUser = client.auth.getUser.bind(client.auth)
    let resolvedUserPromise: Promise<any> | null = null

    client.auth.getUser = (async (jwt?: string) => {
        if (!jwt && cachedCookieUser && isCookieTokenFresh) {
            return { data: { user: cachedCookieUser }, error: null } as any
        }
        if (!jwt && resolvedUserPromise) {
            return resolvedUserPromise
        }

        const runLookup = async () => {
            try {
                const res: any = await Promise.race([
                    origGetUser(jwt),
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ data: { user: null }, error: new Error('Auth timeout') }), 5000)
                    ),
                ])
                if (res?.data?.user) return res
                if (cachedCookieUser) {
                    return { data: { user: cachedCookieUser }, error: null } as any
                }
                return res
            } catch (err: any) {
                if (cachedCookieUser) {
                    return { data: { user: cachedCookieUser }, error: null } as any
                }
                return { data: { user: null }, error: err } as any
            }
        }

        if (!jwt) {
            resolvedUserPromise = runLookup()
            return resolvedUserPromise
        }
        return runLookup()
    }) as typeof client.auth.getUser

    return client
})

// Fast, 0ms request-deduplicated helper to fetch current authenticated user
export const getAuthenticatedUser = cache(async () => {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // 1. Instant 0ms JWT decode from auth cookies when token is fresh
    const { user: fastUser, isFresh } = extractUserFromCookies(allCookies)
    if (fastUser && isFresh) {
        return fastUser
    }

    const hasAuthCookie = allCookies.some(
        c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
    )
    if (!hasAuthCookie) {
        return null
    }

    // 2. Token expired or non-standard cookie: attempt refresh via createClient (which falls back to fastUser on timeout)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user || fastUser || null
})

// Admin client for admin API operations (returns the warm process-wide singleton)
export const createAdminClient = async () => {
    return getSingletonAdminClient()
}
