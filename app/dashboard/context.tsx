"use client"

import { createContext, useContext } from "react"

export interface DashboardContextType {
    isMobileMenuOpen: boolean
    setIsMobileMenuOpen: (isOpen: boolean) => void
    isCollapsed: boolean
    setHeaderTitle?: (title: string | React.ReactNode | null) => void
    setHeaderAction?: (action: React.ReactNode | null) => void
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function useDashboard() {
    const context = useContext(DashboardContext)
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardLayout')
    }
    return context
}
