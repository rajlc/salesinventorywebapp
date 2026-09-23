"use client"

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function useSecurityCheck() {
    const router = useRouter()
    // Store router in a ref so it never appears in the dependency array.
    // This prevents the interval from being torn down/re-created on every navigation.
    const routerRef = useRef(router)
    useEffect(() => {
        routerRef.current = router
    }, [router])

    useEffect(() => {
        const checkSecurity = async () => {
            try {
                // Use getSession() — reads from client storage in 0ms without firing an HTTPS network roundtrip on every page mount.
                const { data: { session }, error } = await supabase.auth.getSession()
                const user = session?.user

                if (error || !user) return

                // Check Session Age (12 hours)
                const lastLogin = new Date(user.last_sign_in_at || '').getTime()
                const now = Date.now()
                const hoursDiff = (now - lastLogin) / (1000 * 60 * 60)

                if (hoursDiff > 12) {
                    await supabase.auth.signOut()
                    routerRef.current.push('/login?reason=session_expired')
                }
            } catch {
                // Network error — do not force logout, just skip this check
            }
        }

        // Run on mount and every 10 minutes (halved from 5 to reduce DB load)
        checkSecurity()
        const interval = setInterval(checkSecurity, 10 * 60 * 1000)

        return () => clearInterval(interval)
    // Empty deps: runs once on mount. routerRef is stable via useRef above.
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
