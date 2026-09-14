// Inventory pages loading skeleton
export default function InventoryLoading() {
    return (
        <div className="space-y-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="h-7 w-48 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
                <div className="h-9 w-32 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
            </div>

            {/* Search bar skeleton */}
            <div className="h-10 w-full bg-slate-100 dark:bg-zinc-800 rounded-lg" />

            {/* Table skeleton */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                {/* Table header */}
                <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-4 bg-slate-200 dark:bg-zinc-700 rounded" />
                    ))}
                </div>
                {/* Table rows */}
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800/60">
                        {[...Array(5)].map((_, j) => (
                            <div
                                key={j}
                                className="h-4 bg-slate-100 dark:bg-zinc-800 rounded"
                                style={{ width: j === 0 ? '80%' : `${60 + Math.random() * 30}%` }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
