'use client'

import { Package, ShoppingCart, TrendingUp, Store, Menu } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useDashboard } from '../context'
import { usePermissions } from '@/lib/permissions/PermissionContext'

// Daraz sub-roles that count as "Daraz access"
const DARAZ_SUB_ROLES = [
    'Order Entry', 'Order List', 'Daily Sales Report', 'Account Summary',
    'Order Status Sync', 'Order Sync', 'Profit Tracker', 'Sales Report',
    'Update Order Status', 'Average Sales Price'
]

const ALL_SALES_MODULES = [
    {
        name: 'E-commerce Sales & Orders',
        icon: Package,
        href: '/dashboard/sales/daraz',
        color: 'bg-orange-500',
        label: 'DARAZ',
        // Show if user has ANY Daraz sub-role permission
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            DARAZ_SUB_ROLES.some(sub => hasPermission('Daraz', sub)),
    },

    {
        name: 'Website Sales & Orders',
        icon: Store, // You can change the icon later
        href: '/dashboard/sales/website-orders',
        color: 'bg-indigo-500',
        label: 'WEBSITE',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Website', 'Website Orders'),
    },
    {
        name: 'Physical Outlets Sales & Orders',
        icon: Store,
        href: '/dashboard/sales/store-sales',
        color: 'bg-green-500',
        label: null,
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Store Sales', 'Store Post'),
    },
    {
        name: 'Sales Analytics',
        icon: TrendingUp,
        href: '/dashboard/sales/analytics',
        color: 'bg-purple-500',
        label: null,
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Sales Analytics', 'Sales Analytics'),
    },
]

export default function SalesPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const { userRole, hasPermission, isLoading } = usePermissions()

    const visibleModules = ALL_SALES_MODULES.filter((module) => {
        if (userRole === 'admin') return true
        return module.check(hasPermission)
    })

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md fixed md:sticky top-0 left-0 right-0 z-50 flex items-center justify-between md:justify-end gap-4">
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md relative z-20"
                >
                    <Menu size={24} />
                </button>
                <h1 className="text-xl font-bold w-full text-center md:text-left md:hidden block -ml-10">Sales Management</h1>
                <h1 className="text-xl font-bold hidden md:block w-full">Sales Management</h1>
                <div className="w-8 md:hidden"></div>
            </div>

            <div className="px-4 space-y-2 md:space-y-4 pt-3 md:pt-0">
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                        ))}
                    </div>
                ) : visibleModules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                        <ShoppingCart size={48} className="mb-3 opacity-30" />
                        <p className="text-lg font-semibold">No Access</p>
                        <p className="text-sm mt-1">You don&apos;t have permission to view any sales pages.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {visibleModules.map((module) => {
                            const Icon = module.icon
                            return (
                                <Link key={module.name} href={module.href}>
                                    <Card className="p-3 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                                        <div className={`${module.color} p-2 rounded-md shadow-sm`}>
                                            <Icon size={18} className="text-white" />
                                        </div>
                                        <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">{module.name}</h3>
                                        {module.label && (
                                            <span className="text-[10px] font-bold text-gray-400 tracking-wider">{module.label}</span>
                                        )}
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Total Orders Today</p>
                        <p className="text-xl font-bold">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Pending Orders</p>
                        <p className="text-xl font-bold text-yellow-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Shipped Today</p>
                        <p className="text-xl font-bold text-blue-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Today&apos;s Revenue</p>
                        <p className="text-xl font-bold text-green-600">Rs. 0</p>
                    </Card>
                </div>
            </div>
        </div>
    )
}
