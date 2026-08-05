'use client'

import { FileText, Package, BarChart2, TrendingUp, ArrowLeft, RefreshCw, ShoppingCart, User } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { usePermissions } from '@/lib/permissions/PermissionContext'

// "Order Summary" dashboard card links to /dashboard/sales/daraz/dashboard
// It should appear if user has ANY of these sub-roles (they all live on that one page)
const DASHBOARD_SUB_ROLES = [
    'Order List', 'Daily Sales Report', 'Account Summary',
    'Order Status Sync', 'Order Sync', 'Profit Tracker', 'Sales Report'
]

const ALL_DARAZ_MODULES = [
    {
        name: 'Order Entry',
        icon: Package,
        href: '/dashboard/sales/daraz/sales-entry',
        color: 'bg-orange-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Daraz', 'Order Entry'),
    },
    {
        name: 'Order Summary',
        icon: BarChart2,
        href: '/dashboard/sales/daraz/dashboard',
        color: 'bg-green-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            DASHBOARD_SUB_ROLES.some(sub => hasPermission('Daraz', sub)),
    },
    {
        name: 'Update Order Status',
        icon: FileText,
        href: '/dashboard/sales/daraz/update-status',
        color: 'bg-blue-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Daraz', 'Update Order Status'),
    },
    {
        name: 'Average Sales Price',
        icon: TrendingUp,
        href: '/dashboard/sales/daraz/average-sales-price',
        color: 'bg-purple-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Daraz', 'Average Sales Price'),
    },
    {
        name: 'Daraz Order Report',
        icon: FileText,
        href: '/dashboard/sales/daraz/order-report',
        color: 'bg-indigo-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Daraz', 'Order List'), // Reusing Order List permission for now
    },
    {
        name: 'Daraz Customer Details',
        icon: User,
        href: '/dashboard/sales/daraz/customer-details',
        color: 'bg-teal-500',
        check: (hasPermission: (m: string, s?: string) => boolean) =>
            hasPermission('Daraz', 'Order List'), // Reusing Order List permission
    },
]


export default function DarazSalesMenuPage() {
    const { userRole, hasPermission, isLoading } = usePermissions()

    const visibleModules = ALL_DARAZ_MODULES.filter((module) => {
        if (userRole === 'admin') return true
        return module.check(hasPermission)
    })

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            <div className="hidden md:flex bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10 items-center justify-between">
                <h1 className="text-xl font-bold">Daraz Sales</h1>
                <Link
                    href="/dashboard/sales"
                    className="flex items-center gap-1.5 px-3 py-1 text-[15px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-gray-200 dark:border-zinc-700"
                >
                    <ArrowLeft size={14} />
                    Back to Sales
                </Link>
            </div>

            <div className="px-4">
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                        ))}
                    </div>
                ) : visibleModules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                        <ShoppingCart size={48} className="mb-3 opacity-30" />
                        <p className="text-lg font-semibold">No Access</p>
                        <p className="text-sm mt-1">You don&apos;t have permission to view any Daraz pages.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {visibleModules.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.name} href={item.href}>
                                    <Card className="p-3 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                                        <div className={`${item.color} p-2 rounded-full shadow-sm`}>
                                            <Icon size={18} className="text-white" />
                                        </div>
                                        <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">{item.name}</h3>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
