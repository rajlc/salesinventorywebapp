'use client'

import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export function SearchInput() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')

    useEffect(() => {
        const handler = setTimeout(() => {
            const params = new URLSearchParams(searchParams)
            if (searchTerm) {
                params.set('q', searchTerm)
            } else {
                params.delete('q')
            }

            // Only replace if query actually changed to avoid infinite loop
            if (params.toString() !== searchParams.toString()) {
                replace(`${pathname}?${params.toString()}`)
            }
        }, 300)

        return () => clearTimeout(handler)
    }, [searchTerm, pathname, replace, searchParams])

    return (
        <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
                type="search"
                placeholder="Search Product Name..."
                className="pl-9 pr-9 w-full bg-white dark:bg-zinc-800 border rounded-md h-9 text-sm dark:border-zinc-700"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded"
                >
                    <X className="h-3 w-3" /> Clear
                </button>
            )}
        </div>
    )
}
