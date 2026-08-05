'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import {
    Activity,
    Monitor,
    Globe,
    ShoppingCart,
    Package,
    DollarSign,
    User,
    Lock,
    LogIn,
    LogOut
} from 'lucide-react'

interface ActivityLogProps {
    logs: any[]
}

// Helper function to get relative time
function getRelativeTime(date: string): string {
    const now = new Date()
    const past = new Date(date)
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return past.toLocaleDateString()
}

// Helper function to get activity icon
function getActivityIcon(action: string) {
    switch (action) {
        case 'login':
            return <LogIn className="h-4 w-4 text-green-500" />
        case 'logout':
            return <LogOut className="h-4 w-4 text-gray-500" />
        case 'sale_created':
        case 'sale_updated':
            return <ShoppingCart className="h-4 w-4 text-blue-500" />
        case 'product_created':
        case 'product_updated':
            return <Package className="h-4 w-4 text-purple-500" />
        case 'purchase_created':
            return <DollarSign className="h-4 w-4 text-orange-500" />
        case 'profile_updated':
            return <User className="h-4 w-4 text-indigo-500" />
        case 'password_changed':
            return <Lock className="h-4 w-4 text-red-500" />
        default:
            return <Activity className="h-4 w-4 text-gray-400" />
    }
}

// Helper function to get activity message
function getActivityMessage(action: string, metadata: any): string {
    switch (action) {
        case 'login':
            return 'Logged in'
        case 'logout':
            return 'Logged out'
        case 'sale_created':
            return metadata?.customer_name
                ? `Created sale for ${metadata.customer_name}`
                : 'Created a new sale'
        case 'sale_updated':
            return metadata?.customer_name
                ? `Updated sale for ${metadata.customer_name}`
                : 'Updated a sale'
        case 'product_created':
            return metadata?.product_name
                ? `Added product: ${metadata.product_name}`
                : 'Added a new product'
        case 'product_updated':
            return metadata?.product_name
                ? `Updated product: ${metadata.product_name}`
                : 'Updated a product'
        case 'purchase_created':
            return metadata?.supplier_name
                ? `Recorded purchase from ${metadata.supplier_name}`
                : 'Recorded a new purchase'
        case 'profile_updated':
            return 'Updated profile information'
        case 'password_changed':
            return 'Changed password'
        default:
            return 'Performed an action'
    }
}

// Helper function to get secondary info
function getSecondaryInfo(log: any): string | null {
    const parts: string[] = []

    // Add amount if available
    if (log.metadata?.amount) {
        parts.push(`Rs. ${log.metadata.amount.toLocaleString()}`)
    }

    // Add browser/device info for login/logout
    if ((log.action === 'login' || log.action === 'logout') && log.browser) {
        const deviceInfo = log.browser.includes('Mobile') ? 'Mobile' : 'Desktop'
        parts.push(deviceInfo)
    }

    // Add IP address if available
    if (log.ip_address) {
        parts.push(log.ip_address)
    }

    return parts.length > 0 ? parts.join(' • ') : null
}

export function ActivityLog({ logs }: ActivityLogProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {logs.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No activity logs found</p>
                    ) : (
                        logs.map((log) => {
                            const message = getActivityMessage(log.action, log.metadata)
                            const secondaryInfo = getSecondaryInfo(log)

                            return (
                                <div
                                    key={log.id}
                                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    <div className="mt-0.5">
                                        {getActivityIcon(log.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {message}
                                        </p>
                                        {secondaryInfo && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {secondaryInfo}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                        {getRelativeTime(log.created_at)}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
