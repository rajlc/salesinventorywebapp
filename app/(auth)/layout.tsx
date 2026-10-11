import { AuthNavbar } from "@/components/auth/AuthNavbar"

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-x-hidden transition-colors selection:bg-blue-500 selection:text-white">
            {/* Top Navigation */}
            <AuthNavbar />

            {/* Ambient Background Glows */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[650px] sm:w-[950px] h-[550px] rounded-full bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-transparent blur-3xl dark:from-blue-600/15 dark:via-indigo-600/15" />
                <div className="absolute bottom-0 right-[10%] w-[450px] h-[350px] rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent blur-3xl dark:from-emerald-600/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
            </div>

            {/* Main Center Content */}
            <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12 sm:px-6 lg:px-8">
                {children}
            </main>

            {/* Minimal Enterprise Footer */}
            <footer className="relative z-10 py-6 border-t border-zinc-200/50 dark:border-zinc-800/50 text-center text-xs text-zinc-400 dark:text-zinc-500">
                <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl">
                    <p>© {new Date().getFullYear()} Bagmati Traders ERP. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            ISO 27001 Aligned Security
                        </span>
                        <span>•</span>
                        <span>Multi-Location Cloud Infrastructure</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
