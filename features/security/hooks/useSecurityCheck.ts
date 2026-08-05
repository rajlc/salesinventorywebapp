"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function useSecurityCheck() {
    const router = useRouter()

    useEffect(() => {
        const checkSecurity = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) return

            // 1. Check Session Age (12 hours)
            // Supabase tokens usually have their own expiry, but we enforce a hard UX logout here too
            const lastLogin = new Date(session.user.last_sign_in_at || '').getTime()
            const now = new Date().getTime()
            const hoursDiff = (now - lastLogin) / (1000 * 60 * 60)

            if (hoursDiff > 12) {
                await supabase.auth.signOut()
                router.push('/login?reason=session_expired')
            }

            // 2. Log Activity (Optional - Fire and forget)
            // logActivity(session.user.id, 'active_ping')
        }

        // Run on mount and every 5 minutes
        checkSecurity()
        const interval = setInterval(checkSecurity, 5 * 60 * 1000)

        return () => clearInterval(interval)
    }, [router])
}
