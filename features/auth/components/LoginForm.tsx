"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { loginAction } from "../actions/loginAction"

const formSchema = z.object({
    email: z.string().min(1, { message: "Email is required" }).email({ message: "Invalid email address format" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    rememberMe: z.boolean().optional(),
})

type FormData = z.infer<typeof formSchema>

export function LoginForm() {
    const [isLoading, setIsLoading] = React.useState(false)
    const [isSuccess, setIsSuccess] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    })

    async function onSubmit(values: FormData) {
        setIsLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("email", values.email.trim())
            formData.append("password", values.password)

            const result = await loginAction(formData)

            if (result?.error) {
                setError(result.error)
                setIsLoading(false)
                return
            }

            if (result?.success) {
                setIsSuccess(true)
                const targetUrl = result.redirectTo || "/dashboard"
                // Immediate full-page navigation ensures all Supabase auth cookies are synchronously loaded
                setTimeout(() => {
                    window.location.href = targetUrl
                }, 400)
            }
        } catch (err: any) {
            // Check if Next.js internal redirect error was caught
            const message = err?.message || String(err || "")
            const isRedirect =
                message.includes("NEXT_REDIRECT") ||
                err?.digest?.includes("NEXT_REDIRECT") ||
                message.toLowerCase().includes("redirect")

            if (isRedirect) {
                setIsSuccess(true)
                window.location.href = "/dashboard"
                return
            }

            console.error("Login caught error:", err)
            setError(message || "An unexpected error occurred. Please try again.")
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full max-w-[440px] transition-all duration-300">
            <div className="relative rounded-3xl bg-white/90 dark:bg-zinc-900/90 p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-2xl">
                {/* Decorative subtle ambient accent */}
                <div className="absolute -top-10 -right-10 -z-10 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 -z-10 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl" />

                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-4">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        Welcome Back
                    </h2>
                    <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        Sign in to access your Bagmati Traders workspace
                    </p>
                </div>

                {/* Success Banner */}
                {isSuccess && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 text-emerald-800 dark:text-emerald-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <CheckCircle2 className="h-5 w-5 animate-pulse" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold">Login Successful</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Redirecting to Dashboard...</p>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && !isSuccess && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-50/90 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-top-2 duration-200">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="text-xs sm:text-sm font-medium leading-relaxed">
                            {error}
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Email Input */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        >
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <Mail className="h-4 w-4" />
                            </div>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="name@bagmatitraders.com"
                                disabled={isLoading || isSuccess}
                                {...register("email")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.email
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-blue-500 focus:ring-blue-500/20"
                                }`}
                            />
                        </div>
                        {errors.email && (
                            <p className="text-xs text-red-500 font-medium pl-1">{errors.email.message}</p>
                        )}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="password"
                                className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                            >
                                Password
                            </label>
                            <Link
                                href="/request-access"
                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                                Need Help?
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <Lock className="h-4 w-4" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="••••••••••••"
                                disabled={isLoading || isSuccess}
                                {...register("password")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-10 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.password
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-blue-500 focus:ring-blue-500/20"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-xs text-red-500 font-medium pl-1">{errors.password.message}</p>
                        )}
                    </div>

                    {/* Remember me option */}
                    <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                {...register("rememberMe")}
                                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20"
                            />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">Remember on this device</span>
                        </label>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Session Encrypted
                        </span>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading || isSuccess}
                        className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Verifying credentials...</span>
                            </>
                        ) : isSuccess ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Authenticated</span>
                            </>
                        ) : (
                            <>
                                <span>Sign In to ERP</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </>
                        )}
                    </button>

                    {/* Footer Links */}
                    <div className="pt-2 text-center">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Don&apos;t have an active account?{" "}
                            <Link
                                href="/signup"
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                            >
                                Create Staff Account
                            </Link>
                        </p>
                    </div>
                </form>

                {/* Bottom Enterprise Badge */}
                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Enterprise Grade Security • 256-bit SSL Protected</span>
                    </p>
                </div>
            </div>
        </div>
    )
}
