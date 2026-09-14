import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        '[Supabase Client] Critical: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not defined. Requests will fail.'
    )
}

export const supabase = createBrowserClient(
    supabaseUrl || 'https://missing-env-supabase-url.supabase.co',
    supabaseAnonKey || 'missing-anon-key'
)
