'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[DashboardError]', error?.digest ?? '', error?.message ?? '')
    }, [error])

    return (
        <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6">
            <div className="max-w-md w-full text-center space-y-5">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40">
                        <AlertTriangle className="w-9 h-9 text-red-600 dark:text-red-400" />
                    </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Page failed to load
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                        An error occurred while loading this section. Your data is safe — please try again.
                    </p>
                    {error?.digest && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-md inline-block">
                            Ref: {error.digest}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                        onClick={() => reset()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </div>

                <p className="text-xs text-slate-400 dark:text-zinc-500">
                    If this keeps happening,{' '}
                    <button
                        onClick={() => window.location.reload()}
                        className="underline hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                        refresh the page
                    </button>
                </p>
            </div>
        </div>
    )
}
