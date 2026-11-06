'use client'

import StockAdjustmentClient from "@/features/inventory/components/stock-adjustment/StockAdjustmentClient"
import { usePermissions } from "@/lib/permissions/PermissionContext"

export default function StockAdjustmentPage() {
    const { userRole, hasPermission, isLoading } = usePermissions()

    if (isLoading) {
        return <StockAdjustmentClient />
    }

    const hasAccess = userRole === 'admin' || hasPermission('Inventory', 'Stock Adjustment')

    if (!hasAccess) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p className="text-gray-600">You do not have permission to view this page.</p>
                <p className="text-sm text-gray-500">Required: Inventory &gt; Stock Adjustment</p>
            </div>
        )
    }

    return <StockAdjustmentClient />
}
