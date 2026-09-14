// Dashboard Loading Skeleton — shown via Suspense while server action runs
// This prevents blank screen during server-side data fetching

export default function DashboardLoading() {
    return (
        <div className="space-y-5 max-w-7xl mx-auto pb-6 animate-pulse">
            {/* Header skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="space-y-2">
                    <div className="h-8 w-64 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="h-4 w-96 bg-slate-100 dark:bg-zinc-800/60 rounded" />
                </div>
                <div className="h-7 w-40 bg-slate-200 dark:bg-zinc-800 rounded-full" />
            </div>

            {/* Section title skeleton */}
            <div className="space-y-3">
                <div className="h-5 w-48 bg-slate-200 dark:bg-zinc-800 rounded" />
                {/* 4 card grid skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm h-40 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                                    <div className="w-7 h-7 rounded bg-slate-100 dark:bg-zinc-800" />
                                    <div className="h-4 w-32 bg-slate-100 dark:bg-zinc-800 rounded" />
                                </div>
                                <div className="h-8 w-20 bg-slate-200 dark:bg-zinc-800 rounded mt-3" />
                                <div className="h-4 w-full bg-slate-100 dark:bg-zinc-800 rounded" />
                            </div>
                            <div className="h-4 w-20 bg-slate-100 dark:bg-zinc-800 rounded self-end" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Inventory section skeleton */}
            <div className="space-y-3">
                <div className="h-5 w-48 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm h-28">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-3 w-28 bg-slate-100 dark:bg-zinc-800 rounded" />
                                    <div className="h-7 w-24 bg-slate-200 dark:bg-zinc-800 rounded mt-1" />
                                </div>
                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-800" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Financials skeleton */}
            <div className="space-y-3">
                <div className="h-5 w-56 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm h-28">
                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-800 mb-2" />
                            <div className="h-3 w-24 bg-slate-100 dark:bg-zinc-800 rounded mb-2" />
                            <div className="h-6 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Notifications skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-1">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm h-36">
                        <div className="flex items-center gap-2 pb-2">
                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-800" />
                            <div className="h-4 w-24 bg-slate-100 dark:bg-zinc-800 rounded" />
                        </div>
                        <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 rounded mx-auto mt-3" />
                    </div>
                ))}
            </div>
        </div>
    )
}
