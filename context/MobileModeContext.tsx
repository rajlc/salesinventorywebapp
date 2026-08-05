"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface MobileModeContextType {
    isMobileMode: boolean
    toggleMobileMode: () => void
    setMobileMode: (value: boolean) => void
}

const MobileModeContext = createContext<MobileModeContextType | undefined>(undefined)

export function MobileModeProvider({ children }: { children: React.ReactNode }) {
    const [isMobileMode, setIsMobileMode] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem('isMobileMode')
        if (stored) {
            setIsMobileMode(JSON.parse(stored))
        }
    }, [])

    const toggleMobileMode = () => {
        setIsMobileMode(prev => {
            const newValue = !prev
            localStorage.setItem('isMobileMode', JSON.stringify(newValue))
            return newValue
        })
    }

    const setMobileMode = (value: boolean) => {
        setIsMobileMode(value)
        localStorage.setItem('isMobileMode', JSON.stringify(value))
    }

    return (
        <MobileModeContext.Provider value={{ isMobileMode, toggleMobileMode, setMobileMode }}>
            {children}
        </MobileModeContext.Provider>
    )
}

export function useMobileMode() {
    const context = useContext(MobileModeContext)
    if (context === undefined) {
        throw new Error('useMobileMode must be used within a MobileModeProvider')
    }
    return context
}
