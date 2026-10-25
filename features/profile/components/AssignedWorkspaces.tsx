'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { resolvePermittedPage, PermittedPageItem } from '@/lib/permissions/page-permissions'
import {
    Sparkles,
    ArrowRight,
    Shield,
    Lock,
    LayoutDashboard,
    Package,
    ShoppingCart,
    ShoppingBag,
    Users,
    Wallet,
    Settings,
    Store
} from 'lucide-react'

// Default admin launcher tools
const ADMIN_LAUNCH_ITEMS: PermittedPageItem[] = [
    {
        id: 'admin-dashboard',
        mainRole: 'Dashboard',
        subRole: 'Overview',
        title: 'Executive Dashboard',
        href: '/dashboard',
        category: 'Overview',
        icon: <LayoutDashboard size={20} />,
        color: 'text-blue-600 dark:text-blue-400',
        bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
    },
    {
        id: 'admin-order-entry',
        mainRole: 'Daraz',
        subRole: 'Order Entry',
        title: 'Daraz Order Entry',
        href: '/dashboard/sales/daraz/sales-entry',
        category: 'Sales & Orders',
        icon: <ShoppingBag size={20} />,
        color: 'text-orange-600 dark:text-orange-400',
        bgLight: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800'
    },
    {
        id: 'admin-inventory',
        mainRole: 'Inventory',
        subRole: 'Product List',
        title: 'Inventory List',
        href: '/dashboard/inventory/product-list',
        category: 'Inventory',
        icon: <Package size={20} />,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
    },
    {
        id: 'admin-purchase',
        mainRole: 'Purchase',
        subRole: 'Purchase Entry',
        title: 'Purchasing Entry',
        href: '/dashboard/purchase/purchase-entry',
        category: 'Purchasing',
        icon: <ShoppingCart size={20} />,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
    },
    {
        id: 'admin-suppliers',
        mainRole: 'Suppliers',
        subRole: 'Supplier List',
        title: 'Suppliers Management',
        href: '/dashboard/suppliers',
        category: 'Suppliers',
        icon: <Users size={20} />,
        color: 'text-amber-600 dark:text-amber-400',
        bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    },
    {
        id: 'admin-finance',
        mainRole: 'Finance',
        subRole: 'Accounts',
        title: 'Finance & Accounts',
        href: '/dashboard/account',
        category: 'Finance',
        icon: <Wallet size={20} />,
        color: 'text-violet-600 dark:text-violet-400',
        bgLight: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800'
    },
    {
        id: 'admin-staff',
        mainRole: 'Settings',
        subRole: 'Staff Management',
        title: 'Staff Management',
        href: '/dashboard/staff-management',
        category: 'Settings',
        icon: <Users size={20} />,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
    },
    {
        id: 'admin-settings',
        mainRole: 'Settings',
        subRole: 'System Settings',
        title: 'System Settings',
        href: '/dashboard/settings',
        category: 'Settings',
        icon: <Settings size={20} />,
        color: 'text-gray-600 dark:text-gray-400',
        bgLight: 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
    }
]

export function AssignedWorkspaces() {
    const { userRole, permissions, isLoading } = usePermissions()
    const isAdmin = userRole === 'admin'

    // Deduplicate permitted pages by destination URL
    const items: PermittedPageItem[] = React.useMemo(() => {
        if (isAdmin) {
            return ADMIN_LAUNCH_ITEMS
        }

        const seenUrls = new Set<string>()
        const list: PermittedPageItem[] = []

        for (const p of permissions) {
            const resolved = resolvePermittedPage(
                p.main_page_role || '',
                p.sub_page_role,
                p.permission_type
            )

            // Deduplicate same URL destinations
            const key = `${resolved.href}-${resolved.title}`
            if (!seenUrls.has(key)) {
                seenUrls.add(key)
                list.push(resolved)
            }
        }

        return list
    }, [isAdmin, permissions])

    return (
        <Card className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm mb-6 rounded-2xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/70 via-white to-blue-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800/40">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            Assigned Workspaces
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {isAdmin ? 'Admin' : `${items.length} Accessible`}
                            </span>
                        </CardTitle>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                            {isAdmin
                                ? 'Full administrative access to all ERP features and workspaces.'
                                : 'Direct launchpad for your permitted staff pages and assigned workflows.'}
                        </p>
                    </div>
                </div>

                {isAdmin ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shrink-0">
                        <Shield size={13} />
                        Full Access Granted
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 shrink-0">
                        Staff Role: <strong className="capitalize">{userRole || 'User'}</strong>
                    </span>
                )}
            </CardHeader>

            <CardContent className="p-4 md:p-6">
                {isLoading ? (
                    <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                        <div className="h-7 w-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-medium">Checking permitted workspaces...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center max-w-lg mx-auto">
                        <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                            <Lock size={22} />
                        </div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                            No Page Permissions Assigned Yet
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
                            Your account is active, but an administrator has not yet assigned any specific page permissions. Once permissions are granted in Staff Management, your direct access buttons will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                        {items.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className="group relative p-4 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Category Pill & Permission Type */}
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate">
                                            {item.category}
                                        </span>
                                        {item.permissionType && (
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wider border ${
                                                item.permissionType === 'all'
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                                                    : item.permissionType === 'edit'
                                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                            }`}>
                                                {item.permissionType}
                                            </span>
                                        )}
                                    </div>

                                    {/* Main Icon & Title */}
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className={`p-2.5 rounded-xl border ${item.bgLight} ${item.color} shrink-0 group-hover:scale-105 transition-transform`}>
                                            {item.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                                {item.title}
                                            </h3>
                                            <span className="text-[11px] text-slate-400 dark:text-zinc-500 block truncate">
                                                {item.subRole}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Link indicator */}
                                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    <span>Open Page</span>
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
