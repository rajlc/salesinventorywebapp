'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function signupAction(email: string, password: string, fullName: string) {
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

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    })

    if (error) {
        return { error: error.message }
    }

    if (!data.user) {
        return { error: 'Signup failed' }
    }

    // Auto-confirm user so they don't get "email not confirmed" error
    try {
        const adminClient = await createAdminClient()
        // Try multiple ways to confirm the user via Admin API
        await adminClient.auth.admin.updateUserById(data.user.id, {
            email_confirm: true,
            user_metadata: { email_confirmed: true } // Extra metadata for safety
        })
    } catch (adminError) {
        console.error('Failed to auto-confirm user:', adminError)
    }

    return { success: true }
}
