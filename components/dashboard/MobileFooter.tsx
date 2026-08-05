"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Home, MoreHorizontal } from "lucide-react"

export function MobileFooter() {
    const searchParams = useSearchParams()
    const view = searchParams.get('view')
    const isMoreActive = view === 'more'

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] flex justify-around p-2 z-50 safe-area-bottom md:hidden">
            <Link
                href="/dashboard"
                className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-colors ${!isMoreActive
                    ? 'text-blue-600 dark:text-white bg-blue-50 dark:bg-zinc-800'
                    : 'text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
            >
                <Home size={24} strokeWidth={!isMoreActive ? 2.5 : 2} />
                <span className="text-xs font-medium mt-1">Home</span>
            </Link>
            <div className="w-px bg-gray-200 dark:bg-zinc-800 mx-2 my-1"></div>
            <Link
                href="/dashboard?view=more"
                className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-colors ${isMoreActive
                    ? 'text-blue-600 dark:text-white bg-blue-50 dark:bg-zinc-800'
                    : 'text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
            >
                <MoreHorizontal size={24} strokeWidth={isMoreActive ? 2.5 : 2} />
                <span className="text-xs font-medium mt-1">More</span>
            </Link>
        </div>
    )
}
