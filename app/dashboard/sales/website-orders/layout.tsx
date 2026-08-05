'use client'

import { usePermissions } from '@/lib/permissions/PermissionContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

export default function WebsiteOrdersLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const { hasPermission } = usePermissions()

    const tabs = [
        { name: 'Orders', href: '/dashboard/sales/website-orders/orders' },
        { name: 'Report', href: '/dashboard/sales/website-orders/report' },
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 overflow-hidden">
            {/* Tab Navigation */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 pt-3 flex-shrink-0">
                <div className="flex space-x-1 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => {
                        const isActive = pathname?.startsWith(tab.href)
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={`px-4 py-2 text-[14px] font-medium transition-colors whitespace-nowrap border-b-2 ${
                                    isActive
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700'
                                }`}
                            >
                                {tab.name}
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    )
}
