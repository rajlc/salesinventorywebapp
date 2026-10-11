"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, UserPlus, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signupAction } from "../actions/signupAction"

const signupSchema = z
    .object({
        fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
        email: z.string().min(1, { message: "Email is required" }).email({ message: "Invalid email address format" }),
        password: z.string().min(6, { message: "Password must be at least 6 characters" }),
        confirmPassword: z.string().min(6, { message: "Please confirm your password" }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })

type SignUpData = z.infer<typeof signupSchema>

export function SignupForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [isSuccess, setIsSuccess] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<SignUpData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    })

    const passwordVal = watch("password") || ""

    // Calculate password strength rating
    const getStrength = (pass: string) => {
        if (!pass) return { score: 0, label: "", color: "" }
        let score = 0
        if (pass.length >= 6) score += 1
        if (pass.length >= 10) score += 1
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
        if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1

        if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" }
        if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500" }
        if (score === 3) return { score: 3, label: "Good", color: "bg-blue-500" }
        return { score: 4, label: "Strong", color: "bg-emerald-500" }
    }

    const strength = getStrength(passwordVal)

    async function onSubmit(values: SignUpData) {
        setIsLoading(true)
        setError(null)

        try {
            const result = await signupAction(values.email, values.password, values.fullName)

            if (result?.error) {
                setError(result.error)
                setIsLoading(false)
                return
            }

            setIsSuccess(true)
            setIsLoading(false)
        } catch (err: any) {
            console.error("Signup caught error:", err)
            setError(err instanceof Error ? err.message : "Something went wrong while creating your account")
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-300">
                <div className="relative rounded-3xl bg-white/95 dark:bg-zinc-900/95 p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-emerald-500/30 dark:border-emerald-500/20 backdrop-blur-2xl text-center">
                    <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-6 shadow-inner">
                        <CheckCircle2 className="h-9 w-9 animate-bounce" />
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        Account Registered!
                    </h2>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Your staff registration has been submitted successfully.
                    </p>

                    <div className="my-6 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 p-4 text-left">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                    Pending Administrator Approval
                                </h4>
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
                                    For data security, new accounts are held in pending status until reviewed by the Bagmati Traders Admin. Once authorized, you will be able to sign in immediately.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <button
                            type="button"
                            onClick={() => router.push("/login")}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all"
                        >
                            <span>Go to Sign In</span>
                            <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 py-2.5 px-4 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Return to Homepage
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-[480px] transition-all duration-300">
            <div className="relative rounded-3xl bg-white/90 dark:bg-zinc-900/90 p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-2xl">
                {/* Decorative ambient accent */}
                <div className="absolute -top-10 -right-10 -z-10 h-36 w-36 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 -z-10 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" />

                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 mb-4">
                        <UserPlus className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        Create Staff Account
                    </h2>
                    <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        Join Bagmati Traders Inventory &amp; ERP System
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-50/90 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-top-2 duration-200">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="text-xs sm:text-sm font-medium leading-relaxed">
                            {error}
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="fullName"
                            className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        >
                            Full Name
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <User className="h-4 w-4" />
                            </div>
                            <input
                                id="fullName"
                                type="text"
                                autoComplete="name"
                                placeholder="Ramesh Shrestha"
                                disabled={isLoading}
                                {...register("fullName")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.fullName
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:ring-emerald-500/20"
                                }`}
                            />
                        </div>
                        {errors.fullName && (
                            <p className="text-xs text-red-500 font-medium pl-1">{errors.fullName.message}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        >
                            Work Email
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <Mail className="h-4 w-4" />
                            </div>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="staff@bagmatitraders.com"
                                disabled={isLoading}
                                {...register("email")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.email
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:ring-emerald-500/20"
                                }`}
                            />
                        </div>
                        {errors.email && (
                            <p className="text-xs text-red-500 font-medium pl-1">{errors.email.message}</p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="password"
                            className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <Lock className="h-4 w-4" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Minimum 6 characters"
                                disabled={isLoading}
                                {...register("password")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-10 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.password
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:ring-emerald-500/20"
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

                        {/* Password strength meter */}
                        {passwordVal.length > 0 && (
                            <div className="pt-1">
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="text-zinc-500">Security strength:</span>
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{strength.label}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    {[1, 2, 3, 4].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-full transition-all duration-300 ${
                                                strength.score >= level ? strength.color : "bg-transparent"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="confirmPassword"
                            className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        >
                            Confirm Password
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                                <Lock className="h-4 w-4" />
                            </div>
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Re-enter password"
                                disabled={isLoading}
                                {...register("confirmPassword")}
                                className={`w-full rounded-xl border bg-zinc-50/70 dark:bg-zinc-800/60 py-2.5 pl-10 pr-10 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-850 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                    errors.confirmPassword
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-400/20"
                                        : "border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:ring-emerald-500/20"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <p className="text-xs text-red-500 font-medium pl-1">{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Registering account...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create Staff Account</span>
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Navigation Link */}
                    <div className="pt-2 text-center">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Already registered?{" "}
                            <Link
                                href="/login"
                                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors"
                            >
                                Sign In instead
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}
