'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[RootError]', error?.digest ?? '', error?.message ?? '')
    }, [error])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/50">
                        <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                    </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Something went wrong
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    {error?.digest && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono mt-1">
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => reset()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
