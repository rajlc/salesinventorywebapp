
import { Metadata } from "next"
import { getUserProfile, getUserPermissions } from "@/features/user-management/actions/user-actions"
import { createClient } from "@/lib/supabase/server"
import StockAdjustmentClient from "@/features/inventory/components/stock-adjustment/StockAdjustmentClient"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
    title: "Stock Adjustment | Bagmati ERP",
    description: "Manage stock adjustments, opening stock, and transfers",
}

export default async function StockAdjustmentPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Access Control
    const profile = await getUserProfile(user.id)

    let hasAccess = false
    if (profile.role === 'admin') {
        hasAccess = true
    } else {
        const permissions = await getUserPermissions(user.id)
        hasAccess = permissions.some(p =>
            p.main_page_role === 'Inventory' &&
            p.sub_page_role === 'Stock Adjustment' &&
            (p.permission_type === 'view' || p.permission_type === 'all')
        )
    }

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
