import React from 'react'
import {
    ShoppingCart,
    Package,
    ShoppingBag,
    Calculator,
    Sliders,
    BookOpen,
    AlertTriangle,
    Tag,
    Camera,
    ClipboardList,
    Calendar,
    List,
    Users,
    BarChart2,
    FileSpreadsheet,
    ArrowLeftRight,
    Wallet,
    Shield,
    RefreshCw,
    Store,
    Globe,
    MapPin,
    CheckCircle,
    Database,
    TrendingUp,
    FileText,
    DollarSign,
    Settings,
    LayoutDashboard
} from 'lucide-react'

export interface PermittedPageItem {
    id: string
    mainRole: string
    subRole: string
    title: string
    href: string
    category: string
    icon: React.ReactNode
    color: string
    bgLight: string
    permissionType?: 'view' | 'edit' | 'all'
}

/**
 * Normalizes mainRole and subRole strings to match even with slight casing or space differences
 */
function normalizeKey(str: string | null | undefined): string {
    return (str || '').toLowerCase().trim().replace(/[-_]/g, ' ')
}

/**
 * Resolves a mainRole + subRole pair to a rich PermittedPageItem
 */
export function resolvePermittedPage(
    mainRole: string,
    subRole: string | null,
    permissionType: 'view' | 'edit' | 'all' = 'view'
): PermittedPageItem {
    const main = normalizeKey(mainRole)
    const sub = normalizeKey(subRole)

    // 1. Daraz
    if (main.includes('daraz')) {
        if (sub.includes('order entry') || sub.includes('entry')) {
            return {
                id: `daraz-order-entry`,
                mainRole,
                subRole: subRole || 'Order Entry',
                title: 'Order Entry',
                href: '/dashboard/sales/daraz/sales-entry',
                category: 'Daraz Sales',
                icon: <ShoppingBag size={18} />,
                color: 'text-orange-600 dark:text-orange-400',
                bgLight: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
                permissionType
            }
        }
        if (sub.includes('update') || sub.includes('status')) {
            return {
                id: `daraz-update-status`,
                mainRole,
                subRole: subRole || 'Update Order Status',
                title: 'Update Order Status',
                href: '/dashboard/sales/daraz/update-status',
                category: 'Daraz Sales',
                icon: <CheckCircle size={18} />,
                color: 'text-purple-600 dark:text-purple-400',
                bgLight: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
                permissionType
            }
        }
        if (sub.includes('average') || sub.includes('price')) {
            return {
                id: `daraz-asp`,
                mainRole,
                subRole: subRole || 'Average Sales Price',
                title: 'Average Sales Price',
                href: '/dashboard/sales/daraz/average-sales-price',
                category: 'Daraz Sales',
                icon: <DollarSign size={18} />,
                color: 'text-emerald-600 dark:text-emerald-400',
                bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
                permissionType
            }
        }
        if (sub.includes('report') || sub.includes('sales report') || sub.includes('daily')) {
            return {
                id: `daraz-report`,
                mainRole,
                subRole: subRole || 'Sales Report',
                title: subRole || 'Daily Sales Report',
                href: '/dashboard/sales/daraz/dashboard',
                category: 'Daraz Sales',
                icon: <FileText size={18} />,
                color: 'text-blue-600 dark:text-blue-400',
                bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
                permissionType
            }
        }
        // General Daraz Dashboard / Order List
        return {
            id: `daraz-${sub || 'dashboard'}`,
            mainRole,
            subRole: subRole || 'Order List',
            title: subRole || 'Daraz Orders',
            href: '/dashboard/sales/daraz/dashboard',
            category: 'Daraz Sales',
            icon: <Package size={18} />,
            color: 'text-amber-600 dark:text-amber-400',
            bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
            permissionType
        }
    }

    // 2. Inventory
    if (main.includes('inventory')) {
        if (sub.includes('adjustment')) {
            return {
                id: `inventory-stock-adjustment`,
                mainRole,
                subRole: subRole || 'Stock Adjustment',
                title: 'Stock Adjustment',
                href: '/dashboard/inventory/stock-adjustment',
                category: 'Inventory',
                icon: <Sliders size={18} />,
                color: 'text-indigo-600 dark:text-indigo-400',
                bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
                permissionType
            }
        }
        if (sub.includes('ledger') || sub.includes('valuation')) {
            return {
                id: `inventory-stock-ledger`,
                mainRole,
                subRole: subRole || 'Stock Ledger',
                title: subRole || 'Stock Ledger',
                href: '/dashboard/inventory/stock-ledger',
                category: 'Inventory',
                icon: <BookOpen size={18} />,
                color: 'text-cyan-600 dark:text-cyan-400',
                bgLight: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
                permissionType
            }
        }
        if (sub.includes('damaged')) {
            return {
                id: `inventory-damaged`,
                mainRole,
                subRole: subRole || 'Damaged Goods',
                title: 'Damaged Goods',
                href: '/dashboard/inventory/damaged-stocks',
                category: 'Inventory',
                icon: <AlertTriangle size={18} />,
                color: 'text-rose-600 dark:text-rose-400',
                bgLight: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
                permissionType
            }
        }
        if (sub.includes('wholesale')) {
            return {
                id: `inventory-wholesale`,
                mainRole,
                subRole: subRole || 'Wholesale Price',
                title: 'Wholesale Price',
                href: '/dashboard/inventory/wholesale-price',
                category: 'Inventory',
                icon: <Tag size={18} />,
                color: 'text-violet-600 dark:text-violet-400',
                bgLight: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
                permissionType
            }
        }
        if (sub.includes('field') || sub.includes('upload')) {
            return {
                id: `inventory-field-data`,
                mainRole,
                subRole: subRole || 'Field Data Entry',
                title: 'Field Data Entry',
                href: '/dashboard/mobile-uploads',
                category: 'Inventory',
                icon: <Camera size={18} />,
                color: 'text-sky-600 dark:text-sky-400',
                bgLight: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
                permissionType
            }
        }
        // Default Inventory Product List
        return {
            id: `inventory-product-list`,
            mainRole,
            subRole: subRole || 'Inventory List',
            title: subRole || 'Inventory List',
            href: '/dashboard/inventory/product-list',
            category: 'Inventory',
            icon: <Calculator size={18} />,
            color: 'text-blue-600 dark:text-blue-400',
            bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
            permissionType
        }
    }

    // 3. Purchase
    if (main.includes('purchase')) {
        if (sub.includes('entry')) {
            return {
                id: `purchase-entry`,
                mainRole,
                subRole: subRole || 'Purchase Entry',
                title: 'Purchase Entry',
                href: '/dashboard/purchase/purchase-entry',
                category: 'Purchasing',
                icon: <ShoppingCart size={18} />,
                color: 'text-emerald-600 dark:text-emerald-400',
                bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
                permissionType
            }
        }
        if (sub.includes('daily')) {
            return {
                id: `purchase-daily`,
                mainRole,
                subRole: subRole || 'Daily Report',
                title: 'Daily Purchase List',
                href: '/dashboard/purchase/daily-purchase-list',
                category: 'Purchasing',
                icon: <Calendar size={18} />,
                color: 'text-blue-600 dark:text-blue-400',
                bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
                permissionType
            }
        }
        if (sub.includes('buy') || sub.includes('sell')) {
            return {
                id: `purchase-buy-sell`,
                mainRole,
                subRole: subRole || 'Buy/Sell (Suppliers)',
                title: 'Buy/Sell (Suppliers)',
                href: '/dashboard/purchase/buy-sell-suppliers',
                category: 'Purchasing',
                icon: <Users size={18} />,
                color: 'text-teal-600 dark:text-teal-400',
                bgLight: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
                permissionType
            }
        }
        if (sub.includes('inventory report') || sub.includes('price report')) {
            return {
                id: `purchase-price-reports`,
                mainRole,
                subRole: subRole || 'Inventory Reports',
                title: 'Inventory Price Reports',
                href: '/dashboard/purchase/inventory-price-reports',
                category: 'Purchasing',
                icon: <FileSpreadsheet size={18} />,
                color: 'text-amber-600 dark:text-amber-400',
                bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
                permissionType
            }
        }
        // Default All Purchase List / Dashboard
        return {
            id: `purchase-${sub || 'dashboard'}`,
            mainRole,
            subRole: subRole || 'All Purchase List',
            title: subRole || 'Purchase List',
            href: '/dashboard/purchase/dashboard',
            category: 'Purchasing',
            icon: <ShoppingBag size={18} />,
            color: 'text-sky-600 dark:text-sky-400',
            bgLight: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
            permissionType
        }
    }

    // 4. Store Sales
    if (main.includes('store') || (main.includes('sales') && sub.includes('store'))) {
        return {
            id: `sales-store`,
            mainRole,
            subRole: subRole || 'Store Post',
            title: 'Store Sales',
            href: '/dashboard/sales/store-sales',
            category: 'Sales',
            icon: <Store size={18} />,
            color: 'text-emerald-600 dark:text-emerald-400',
            bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
            permissionType
        }
    }

    // 5. Sales Analytics
    if (main.includes('analytics') || sub.includes('analytics')) {
        return {
            id: `sales-analytics`,
            mainRole,
            subRole: subRole || 'Sales Analytics',
            title: 'Sales Analytics',
            href: '/dashboard/sales/analytics',
            category: 'Sales',
            icon: <TrendingUp size={18} />,
            color: 'text-purple-600 dark:text-purple-400',
            bgLight: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
            permissionType
        }
    }

    // 6. Website
    if (main.includes('website')) {
        return {
            id: `sales-website`,
            mainRole,
            subRole: subRole || 'Website Orders',
            title: 'Website Orders',
            href: '/dashboard/sales/website-orders',
            category: 'Sales',
            icon: <Globe size={18} />,
            color: 'text-indigo-600 dark:text-indigo-400',
            bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
            permissionType
        }
    }

    // 7. Suppliers
    if (main.includes('supplier')) {
        if (sub.includes('transaction')) {
            return {
                id: `suppliers-trans`,
                mainRole,
                subRole: subRole || 'Suppliers Transaction',
                title: 'Suppliers Transaction',
                href: '/dashboard/suppliers/suppliers-transaction',
                category: 'Suppliers',
                icon: <ArrowLeftRight size={18} />,
                color: 'text-violet-600 dark:text-violet-400',
                bgLight: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
                permissionType
            }
        }
        return {
            id: `suppliers-list`,
            mainRole,
            subRole: subRole || 'Supplier List',
            title: subRole || 'Suppliers',
            href: '/dashboard/suppliers',
            category: 'Suppliers',
            icon: <Users size={18} />,
            color: 'text-amber-600 dark:text-amber-400',
            bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
            permissionType
        }
    }

    // 8. Finance / Accounts
    if (main.includes('finance') || main.includes('account')) {
        return {
            id: `finance-accounts`,
            mainRole,
            subRole: subRole || 'Finance',
            title: subRole || 'Finance & Accounts',
            href: '/dashboard/account',
            category: 'Finance',
            icon: <Wallet size={18} />,
            color: 'text-violet-600 dark:text-violet-400',
            bgLight: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
            permissionType
        }
    }

    // 9. Settings
    if (main.includes('setting')) {
        if (sub.includes('staff')) {
            return {
                id: `settings-staff`,
                mainRole,
                subRole: subRole || 'Staff Management',
                title: 'Staff Management',
                href: '/dashboard/staff-management',
                category: 'Settings',
                icon: <Users size={18} />,
                color: 'text-indigo-600 dark:text-indigo-400',
                bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
                permissionType
            }
        }
        if (sub.includes('role')) {
            return {
                id: `settings-roles`,
                mainRole,
                subRole: subRole || 'Role Management',
                title: 'Role Management',
                href: '/dashboard/settings/roles',
                category: 'Settings',
                icon: <Shield size={18} />,
                color: 'text-pink-600 dark:text-pink-400',
                bgLight: 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-800',
                permissionType
            }
        }
        if (sub.includes('sync')) {
            return {
                id: `settings-sync`,
                mainRole,
                subRole: subRole || 'Sync Settings',
                title: 'Sync Settings',
                href: '/dashboard/settings/sync-settings',
                category: 'Settings',
                icon: <RefreshCw size={18} />,
                color: 'text-teal-600 dark:text-teal-400',
                bgLight: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
                permissionType
            }
        }
        if (sub.includes('store')) {
            return {
                id: `settings-stores`,
                mainRole,
                subRole: subRole || 'Stores Management',
                title: 'Stores Management',
                href: '/dashboard/settings/stores',
                category: 'Settings',
                icon: <Store size={18} />,
                color: 'text-blue-600 dark:text-blue-400',
                bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
                permissionType
            }
        }
        if (sub.includes('fiscal')) {
            return {
                id: `settings-fiscal`,
                mainRole,
                subRole: subRole || 'Fiscal Years',
                title: 'Fiscal Years',
                href: '/dashboard/settings/fiscal-years',
                category: 'Settings',
                icon: <Calendar size={18} />,
                color: 'text-green-600 dark:text-green-400',
                bgLight: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
                permissionType
            }
        }
        if (sub.includes('logistics')) {
            return {
                id: `settings-logistics`,
                mainRole,
                subRole: subRole || 'Logistics Management',
                title: 'Logistics Management',
                href: '/dashboard/settings/logistics-api',
                category: 'Settings',
                icon: <MapPin size={18} />,
                color: 'text-purple-600 dark:text-purple-400',
                bgLight: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
                permissionType
            }
        }
        if (sub.includes('approval')) {
            return {
                id: `settings-approvals`,
                mainRole,
                subRole: subRole || 'Approval Center',
                title: 'Approval Center',
                href: '/dashboard/settings/approvals',
                category: 'Settings',
                icon: <CheckCircle size={18} />,
                color: 'text-orange-600 dark:text-orange-400',
                bgLight: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
                permissionType
            }
        }
        if (sub.includes('backup')) {
            return {
                id: `settings-backup`,
                mainRole,
                subRole: subRole || 'Restore Backup',
                title: 'Restore Backup',
                href: '/dashboard/settings/backup',
                category: 'Settings',
                icon: <Database size={18} />,
                color: 'text-red-600 dark:text-red-400',
                bgLight: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
                permissionType
            }
        }
        return {
            id: `settings-general`,
            mainRole,
            subRole: subRole || 'Settings',
            title: 'Settings',
            href: '/dashboard/settings',
            category: 'Settings',
            icon: <Settings size={18} />,
            color: 'text-gray-600 dark:text-gray-400',
            bgLight: 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700',
            permissionType
        }
    }

    // Chat & Review
    if (main.includes('chat') || main.includes('review')) {
        if (sub.includes('ai') || sub.includes('automation')) {
            return {
                id: 'chat-ai-automation',
                mainRole,
                subRole: subRole || 'AI & Automation',
                title: 'AI & Automation',
                href: '/dashboard/chat-ai?tab=settings',
                category: 'Chat & Review',
                icon: <Sliders size={18} />,
                color: 'text-violet-600 dark:text-violet-400',
                bgLight: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
                permissionType
            }
        }
        if (sub.includes('product') || sub.includes('q&a') || sub.includes('qa')) {
            return {
                id: 'chat-product-qa',
                mainRole,
                subRole: subRole || 'Product Q&A',
                title: 'Product Q&A',
                href: '/dashboard/chat-ai/products',
                category: 'Chat & Review',
                icon: <BookOpen size={18} />,
                color: 'text-emerald-600 dark:text-emerald-400',
                bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
                permissionType
            }
        }
        if (sub.includes('review')) {
            return {
                id: 'chat-reviews',
                mainRole,
                subRole: subRole || 'Reviews',
                title: 'Reviews',
                href: '/dashboard/chat-ai/reviews',
                category: 'Chat & Review',
                icon: <AlertTriangle size={18} />,
                color: 'text-amber-600 dark:text-amber-400',
                bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
                permissionType
            }
        }
        // General chat / Chat & Review top-level
        return {
            id: 'chat-ai-main',
            mainRole,
            subRole: subRole || 'Chat',
            title: 'Chat & AI',
            href: '/dashboard/chat-ai?tab=chat',
            category: 'Chat & Review',
            icon: <Globe size={18} />,
            color: 'text-blue-600 dark:text-blue-400',
            bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
            permissionType
        }
    }


    return {
        id: `${main}-${sub || 'page'}`,
        mainRole,
        subRole: subRole || mainRole,
        title: subRole || mainRole,
        href: '/dashboard',
        category: mainRole,
        icon: <LayoutDashboard size={18} />,
        color: 'text-blue-600 dark:text-blue-400',
        bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        permissionType
    }
}
