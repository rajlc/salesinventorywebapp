"use client"

import * as React from "react"
import { Loader2, ArrowLeft, ShieldCheck, MailQuestion } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"

export function SignupRequestForm() {
    const [isLoading, setIsLoading] = React.useState(false)

    async function onGoogleLogin() {
        setIsLoading(true)
        try {
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${location.origin}/auth/callback?type=request_access`,
                },
            })
        } catch (error) {
            console.error("Google OAuth error:", error)
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full max-w-[440px] transition-all duration-300">
            <div className="relative rounded-3xl bg-white/90 dark:bg-zinc-900/90 p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-2xl text-center">
                {/* Decorative subtle ambient accent */}
                <div className="absolute -top-10 -right-10 -z-10 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 -z-10 h-36 w-36 rounded-full bg-purple-500/15 blur-3xl" />

                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25 mb-5">
                    <MailQuestion className="h-7 w-7" />
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    Request Staff Access
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Are you a team member needing ERP access? Authenticate via Google to register a staff approval request.
                </p>

                <div className="mt-8 space-y-4">
                    <button
                        type="button"
                        onClick={onGoogleLogin}
                        disabled={isLoading}
                        className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 py-3 px-4 text-sm font-semibold text-zinc-800 dark:text-zinc-100 shadow-sm transition-all disabled:opacity-60"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-600 dark:text-zinc-300" />
                        ) : (
                            <svg className="h-5 w-5 shrink-0" viewBox="0 0 488 512">
                                <path
                                    fill="#4285F4"
                                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                                />
                            </svg>
                        )}
                        <span>Continue with Google</span>
                    </button>

                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed px-2">
                        Upon signing in with Google, your account profile will be created and submitted to the administrator for assignment.
                    </p>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                    <Link
                        href="/login"
                        className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back to Login</span>
                    </Link>

                    <Link
                        href="/signup"
                        className="font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                        Register with Email
                    </Link>
                </div>
            </div>
        </div>
    )
}
