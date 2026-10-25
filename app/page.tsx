import Link from "next/link"
import { getAuthenticatedUser } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import {
    LogIn,
    UserPlus,
    ArrowRight,
    Boxes,
    RefreshCw,
    Receipt,
    Lock,
    Sparkles
} from "lucide-react"

export default async function Home() {
    const user = await getAuthenticatedUser()

    if (user) {
        redirect("/dashboard")
    }

    return (
        <div className="relative min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-x-hidden transition-colors selection:bg-blue-500 selection:text-white">
            {/* Top Navigation Bar */}
            <HomeNavbar />

            {/* Ambient Background Glows */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[700px] lg:w-[1100px] h-[600px] rounded-full bg-gradient-to-b from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl dark:from-blue-600/20 dark:via-indigo-600/15" />
                <div className="absolute top-1/3 -left-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent blur-3xl dark:from-emerald-600/10" />
                <div className="absolute bottom-10 right-0 w-[500px] h-[400px] rounded-full bg-gradient-to-l from-purple-500/10 to-transparent blur-3xl dark:from-purple-600/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
            </div>

            {/* Hero & Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-28 pb-16 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
                {/* Version Pill */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-50/80 dark:bg-blue-950/40 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                    <span>Inventory System v2.4</span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">Enterprise Edition</span>
                </div>

                {/* Hero Title */}
                <div className="text-center max-w-3xl mb-12">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.15]">
                        Bagmati Traders <br />
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                            Next Gen ERP System
                        </span>
                    </h1>
                    <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
                        Unified enterprise platform powering real-time stock control, automated Daraz marketplace synchronization, billing accounts, and multi-location logistics.
                    </p>
                </div>

                {/* Primary Interactive Action Cards */}
                <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-16">
                    {/* Card 1: Login */}
                    <Link
                        href="/login"
                        className="group relative flex flex-col justify-between rounded-3xl bg-white/80 dark:bg-zinc-900/80 p-8 sm:p-9 shadow-lg shadow-zinc-200/50 dark:shadow-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500/50 dark:hover:border-blue-500/50"
                    >
                        <div className="absolute top-0 right-0 -mr-px -mt-px h-32 w-32 rounded-tr-3xl bg-gradient-to-bl from-blue-500/10 to-transparent pointer-events-none group-hover:from-blue-500/20 transition-all" />
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform">
                                    <LogIn className="h-7 w-7" />
                                </div>
                                <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300">
                                    Portal
                                </span>
                            </div>

                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                <span>Login</span>
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </h2>

                            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Access the Dashboard to oversee operations, record purchases, dispatch courier orders, and review analytics.
                            </p>
                        </div>

                        <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-sm font-semibold text-blue-600 dark:text-blue-400">
                            <span>Open Session</span>
                            <span className="text-zinc-400 group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </Link>

                    {/* Card 2: Sign Up */}
                    <Link
                        href="/signup"
                        className="group relative flex flex-col justify-between rounded-3xl bg-white/80 dark:bg-zinc-900/80 p-8 sm:p-9 shadow-lg shadow-zinc-200/50 dark:shadow-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50"
                    >
                        <div className="absolute top-0 right-0 -mr-px -mt-px h-32 w-32 rounded-tr-3xl bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none group-hover:from-emerald-500/20 transition-all" />
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                                    <UserPlus className="h-7 w-7" />
                                </div>
                                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                    Onboarding
                                </span>
                            </div>

                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                                <span>Sign Up</span>
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </h2>

                            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Create a new account. Register your staff credentials for administrator authorization and store assignment.
                            </p>
                        </div>

                        <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>Register Staff</span>
                            <span className="text-zinc-400 group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </Link>
                </div>

                {/* Key ERP Capabilities Bento */}
                <div className="w-full">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                Core System Capabilities
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Built for high-volume trade, multi-channel distribution, and auditing</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/60 p-5 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-md">
                            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                                <Boxes className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Smart Inventory</h4>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Accurate stock ledgers, damage resolutions, batch valuation, and live item audits.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/60 p-5 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-md">
                            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                                <RefreshCw className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Daraz Auto-Sync</h4>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Real-time marketplace orders, order fulfillment, status tracking, and financial reconciliation.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/60 p-5 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-md">
                            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                                <Receipt className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">PAN/VAT Billing</h4>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Tax-compliant sales invoices, supplier purchase statements, and daily accounting reports.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-white/60 dark:bg-zinc-900/60 p-5 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-md">
                            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
                                <Lock className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Role Governance</h4>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Granular permissions for admins, inventory clerks, billing operators, and sales staff.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Enterprise Portal Footer */}
            <footer className="relative z-10 border-t border-zinc-200/60 dark:border-zinc-800/60 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-6xl">
                    <p>© {new Date().getFullYear()} Bagmati Traders ERP. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span>Version 2.4-enterprise</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cloud Database Operational</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
