import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

    let user = null
    try {
        const { data } = await supabase.auth.getUser()
        user = data?.user || null
    } catch (e) {
        console.error('[Middleware] Auth parsing failed (possible malformed cookie):', e)
    }

    // Protected Routes Logic
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // Auth Routes Logic (Don't let logged in users see login page)
    // EXCEPT for the pending page which should be accessible after successful OAuth
    if (['/login', '/request-access'].includes(request.nextUrl.pathname)) {
        if (user) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
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
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
