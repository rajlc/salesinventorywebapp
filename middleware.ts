import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const pathname = request.nextUrl.pathname

    // ── Claude Custom Connector & Remote MCP OAuth Discovery Handlers ──────
    if (pathname.startsWith('/.well-known/oauth-protected-resource')) {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
        const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
        const baseUrl = `${proto}://${host}`

        return new NextResponse(JSON.stringify({
            resource: `${baseUrl}/api/claude-connector`,
            authorization_servers: [baseUrl],
            scopes_supported: ['tools']
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, OPTIONS',
                'access-control-allow-headers': '*'
            }
        })
    }

    if (pathname.startsWith('/.well-known/oauth-authorization-server')) {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
        const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
        const baseUrl = `${proto}://${host}`

        return new NextResponse(JSON.stringify({
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
            token_endpoint: `${baseUrl}/api/oauth/token`,
            registration_endpoint: `${baseUrl}/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256', 'plain'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
            scopes_supported: ['tools']
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, OPTIONS',
                'access-control-allow-headers': '*'
            }
        })
    }

    if (pathname === '/register') {
        const client_id = 'claude_daraz_client_' + Math.random().toString(36).substring(2, 10)
        const client_secret = 'claude_daraz_secret_' + Math.random().toString(36).substring(2, 14)

        return new NextResponse(JSON.stringify({
            client_id,
            client_secret,
            client_name: 'Claude Custom Connector',
            redirect_uris: ['https://claude.ai/api/auth/callback'],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            client_id_issued_at: Math.floor(Date.now() / 1000)
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': '*'
            }
        })
    }

    if (pathname === '/api/oauth/authorize') {
        const redirectUri = request.nextUrl.searchParams.get('redirect_uri') || 'https://claude.ai/api/auth/callback'
        const state = request.nextUrl.searchParams.get('state') || ''
        const code = 'auth_code_' + Math.random().toString(36).substring(2, 12)

        const targetUrl = new URL(redirectUri)
        targetUrl.searchParams.set('code', code)
        if (state) targetUrl.searchParams.set('state', state)

        return NextResponse.redirect(targetUrl, 302)
    }

    if (pathname === '/api/oauth/token') {
        return new NextResponse(JSON.stringify({
            access_token: 'claude_daraz_bearer_token_' + Date.now(),
            token_type: 'Bearer',
            expires_in: 315360000,
            refresh_token: 'claude_daraz_refresh_token_' + Date.now(),
            scope: 'tools'
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': '*'
            }
        })
    }

    // ── Early exit for routes that do NOT need Supabase auth ──────────────
    // These are background jobs, webhooks, and internal API routes.
    const noAuthPrefixes = [
        '/api/',
        '/public/',
    ]
    if (noAuthPrefixes.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next({ request: { headers: request.headers } })
    }

    // ── Bypass prefetch requests ──────────────────────────────────────────
    // Next.js Link prefetching sends 'next-router-prefetch' or 'purpose: prefetch'.
    // Bypassing remote auth roundtrips for prefetch prevents dozens of duplicate
    // calls from flooding Supabase Auth and stalling real user navigations.
    const isPrefetch =
        request.headers.get('next-router-prefetch') === '1' ||
        request.headers.get('purpose') === 'prefetch' ||
        request.headers.get('sec-purpose') === 'prefetch' ||
        request.nextUrl.searchParams.has('_rsc')

    if (isPrefetch) {
        return response
    }

    // Only /dashboard and login/auth routes need Supabase auth checks
    const isDashboardRoute = pathname.startsWith('/dashboard')
    const isAuthRoute = ['/login', '/request-access'].includes(pathname)

    if (!isDashboardRoute && !isAuthRoute) {
        return response
    }

    // Fast-path: If accessing /dashboard with NO Supabase session cookies at all,
    // redirect to /login immediately without wasting seconds on a remote network call.
    const hasAuthCookie = request.cookies.getAll().some(
        c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
    )

    if (isDashboardRoute && !hasAuthCookie) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Fast-path for Server Actions: Next.js internal action POSTs already validate
    // auth in the server action handler. Bypassing remote middleware auth check here
    // saves 200ms - 1,000ms on every single server action call.
    if (request.headers.has('next-action') && hasAuthCookie) {
        return response
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
        return new NextResponse(
            JSON.stringify({ error: 'Missing Supabase Environment Variables', message: 'Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel Environment Variables.' }),
            { status: 500, headers: { 'content-type': 'application/json' } }
        )
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Helper to create redirect response while preserving all cookies set on response
    const createRedirect = (urlPath: string) => {
        const redirectUrl = new URL(urlPath, request.url)
        const redirectResponse = NextResponse.redirect(redirectUrl)
        response.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
        })
        return redirectResponse
    }

    // Helper to wipe all Supabase auth cookies from response and request
    const clearAuthCookies = (res: NextResponse) => {
        request.cookies.getAll().forEach(cookie => {
            if (cookie.name.startsWith('sb-') || cookie.name.includes('auth-token')) {
                res.cookies.delete(cookie.name)
                res.cookies.set(cookie.name, '', {
                    path: '/',
                    maxAge: 0,
                    expires: new Date(0)
                })
            }
        })
    }

    let user = null
    let isTokenInvalid = false

    try {
        // Race against an 8-second timeout so that a slow/unavailable Supabase
        // cannot hang every page request indefinitely.
        const authResult = await Promise.race([
            supabase.auth.getUser().catch((err: any) => ({ data: { user: null }, error: err })),
            new Promise<{ data: { user: null }; error?: any }>((resolve) =>
                setTimeout(() => resolve({ data: { user: null }, error: new Error('Auth timeout') }), 8000)
            )
        ])

        user = authResult.data?.user || null
        const error = (authResult as any).error

        if (error) {
            const errCode = (error as any).code || ''
            const errMsg = ((error as any).message || '').toLowerCase()
            const errStatus = (error as any).status || 0

            if (
                errCode === 'refresh_token_not_found' ||
                errCode === 'bad_jwt' ||
                errStatus === 400 ||
                errMsg.includes('refresh token') ||
                errMsg.includes('invalid token')
            ) {
                isTokenInvalid = true
                console.warn('[Middleware] Stale/invalid auth token detected. Cleaning session cookies.')
                clearAuthCookies(response)
            } else if (errMsg !== 'auth timeout') {
                console.warn('[Middleware] Auth check notice:', error.message || error)
            }
        }
    } catch (e: any) {
        console.warn('[Middleware] Auth check exception:', e?.message || e)
        isTokenInvalid = true
        clearAuthCookies(response)
    }

    // Protected Routes Logic
    if (pathname.startsWith('/dashboard')) {
        if (!user) {
            const redirectResponse = createRedirect('/login')
            if (isTokenInvalid) {
                clearAuthCookies(redirectResponse)
            }
            return redirectResponse
        }
    }

    // Auth Routes Logic (Don't let logged-in users see login page)
    if (['/login', '/request-access'].includes(pathname)) {
        if (user) {
            return createRedirect('/dashboard')
        }
        if (isTokenInvalid) {
            clearAuthCookies(response)
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
