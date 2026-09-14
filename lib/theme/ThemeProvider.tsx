"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    toggleTheme: () => { },
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light")
    const [mounted, setMounted] = useState(false)

    // Initialize theme from localStorage or system preference.
    // This runs client-side only — the server always renders with "light" class.
    // suppressHydrationWarning on <html> in layout.tsx handles the mismatch.
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as Theme | null
        const resolved = savedTheme
            ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")

        setTheme(resolved)
        // Apply immediately — this runs before paint in most browsers
        if (resolved === "dark") {
            document.documentElement.classList.add("dark")
        } else {
            document.documentElement.classList.remove("dark")
        }
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light"
        setTheme(newTheme)
        localStorage.setItem("theme", newTheme)
        document.documentElement.classList.toggle("dark", newTheme === "dark")
    }

    // While not yet mounted (SSR / first paint), we still render children
    // but provide a stable "light" context so no hydration mismatch on text/structure.
    // suppressHydrationWarning on <html> and <body> handles the class attribute difference.
    return (
        <ThemeContext.Provider value={{ theme: mounted ? theme : "light", toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}

