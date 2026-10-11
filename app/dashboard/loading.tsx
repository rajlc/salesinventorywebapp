// Universal Dashboard Loading — subtle top progress shimmer and clean layout placeholder
// Prevents full-screen layout thrashing and avoids flashing the home dashboard skeleton on subpages

export default function DashboardLoading() {
    return (
        <div className="w-full space-y-4 max-w-7xl mx-auto pb-6 animate-fade-in">
            {/* Top Slim Progress Bar */}
            <div className="fixed top-0 left-0 right-0 h-0.5 bg-blue-100 dark:bg-blue-950/50 z-[9999] overflow-hidden">
                <div className="h-full bg-blue-600 dark:bg-blue-500 animate-pulse w-full" />
            </div>

            {/* Universal Page Header Skeleton */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-zinc-800 animate-pulse">
                <div className="space-y-1.5">
                    <div className="h-7 w-48 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="h-3.5 w-64 bg-slate-100 dark:bg-zinc-800/60 rounded" />
                </div>
                <div className="h-8 w-24 bg-slate-200/80 dark:bg-zinc-800 rounded-lg" />
            </div>

            {/* Clean Grid Cards Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="h-24 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 flex flex-col justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800" />
                            <div className="h-3.5 w-24 bg-slate-100 dark:bg-zinc-800 rounded" />
                        </div>
                        <div className="h-6 w-16 bg-slate-200 dark:bg-zinc-800 rounded" />
                    </div>
                ))}
            </div>

            {/* Content Area Skeleton */}
            <div className="h-64 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-6 flex flex-col justify-center items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <div className="h-3.5 w-32 bg-slate-100 dark:bg-zinc-800 rounded" />
            </div>
        </div>
    )
}
