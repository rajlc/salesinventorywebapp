'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function LimitSelector({ currentLimit }: { currentLimit: number }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        // Create new params
        const params = new URLSearchParams(searchParams.toString())
        params.set('limit', val)
        params.set('page', '1') // Reset to page 1 on limit change

        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page</span>
            <select
                value={currentLimit}
                onChange={handleChange}
                className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            >
                {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                        {size}
                    </option>
                ))}
            </select>
        </div>
    )
}
