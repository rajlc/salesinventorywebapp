"use client"

import * as React from "react"
import Link from "next/link"
import { Package, Moon, Sun, ArrowLeft } from "lucide-react"
import { useTheme } from "@/lib/theme/ThemeProvider"

export function AuthNavbar() {
    const { theme, toggleTheme } = useTheme()

    return (
        <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/40 dark:bg-zinc-950/40 border-b border-zinc-200/50 dark:border-zinc-800/50 transition-colors">
            {/* Left: Brand Identity */}
            <Link
                href="/"
                className="group flex items-center gap-3 transition-opacity hover:opacity-90"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <Package className="h-5 w-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
                            Bagmati Traders
                        </span>
                        <span className="rounded-md bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            ERP
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Inventory &amp; Operations</p>
                </div>
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                {/* Location & Status Badge */}
                <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px]">System Online</span>
                </div>

                {/* Back to Home Link */}
                <Link
                    href="/"
                    className="hidden md:flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Home Portal</span>
                </Link>

                {/* Dark / Light Mode Toggle */}
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                >
                    {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                        <Moon className="h-4 w-4 text-zinc-700" />
                    )}
                </button>
            </div>
        </header>
    )
}
