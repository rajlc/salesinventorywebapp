"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function MobileHeaderAction({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    const [container, setContainer] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setMounted(true)
        setContainer(document.getElementById('mobile-header-actions'))
    }, [])

    if (!mounted || !container) return null

    return createPortal(children, container)
}
