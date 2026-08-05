'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PageRole {
    id: string
    main_role: string
    sub_role: string | null
    page_url: string | null
    created_at: string
}

export type AddPageRoleInput = Omit<PageRole, 'id' | 'created_at'>

// Get all page roles
export async function getPageRoles() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('page_roles')
        .select('*')
        .order('main_role', { ascending: true })
        .order('sub_role', { ascending: true, nullsFirst: false })

    if (error) throw new Error(error.message)

    return data as PageRole[]
}

// Create new page role
export async function createPageRole(input: AddPageRoleInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can create roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .insert({
            main_role: input.main_role,
            sub_role: input.sub_role,
        })

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}

// Update page role
export async function updatePageRole(id: string, input: AddPageRoleInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can update roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .update({
            main_role: input.main_role,
            sub_role: input.sub_role,
        })
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}

// Delete page role
export async function deletePageRole(id: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can delete roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}

// Seed default roles
export async function seedDefaultRoles() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can seed roles')
    }

    const defaultRoles = [
        // Inventory
        { main_role: 'Inventory', sub_role: 'Inventory List',      page_url: '/dashboard/inventory/product-list' },
        { main_role: 'Inventory', sub_role: 'Stock Adjustment',    page_url: '/dashboard/inventory/stock-adjustment' },
        { main_role: 'Inventory', sub_role: 'Stock Ledger',        page_url: '/dashboard/inventory/stock-ledger' },
        { main_role: 'Inventory', sub_role: 'Stock Valuation',     page_url: '/dashboard/inventory/stock-ledger' },
        { main_role: 'Inventory', sub_role: 'Damaged Goods',       page_url: '/dashboard/inventory/damaged-stocks' },
        { main_role: 'Inventory', sub_role: 'Wholesale Price',     page_url: '/dashboard/inventory/wholesale-price' },
        { main_role: 'Inventory', sub_role: 'Field Data Entry',    page_url: '/dashboard/mobile-uploads' },
        // Daraz
        { main_role: 'Daraz', sub_role: 'Order Entry',             page_url: '/dashboard/sales/daraz/sales-entry' },
        { main_role: 'Daraz', sub_role: 'Order List',              page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Daily Sales Report',      page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Account Summary',         page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Order Status Sync',       page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Order Sync',              page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Profit Tracker',          page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Sales Report',            page_url: '/dashboard/sales/daraz/dashboard' },
        { main_role: 'Daraz', sub_role: 'Update Order Status',     page_url: '/dashboard/sales/daraz/update-status' },
        { main_role: 'Daraz', sub_role: 'Average Sales Price',     page_url: '/dashboard/sales/daraz/average-sales-price' },

        // Website
        { main_role: 'Website', sub_role: 'Website Orders', page_url: '/dashboard/sales/website-orders' },
        // Store Sales
        { main_role: 'Store Sales', sub_role: 'Store Post',        page_url: '/dashboard/sales/store-sales' },
        // Sales Analytics
        { main_role: 'Sales Analytics', sub_role: 'Sales Analytics', page_url: '/dashboard/sales/analytics' },
        // Purchase
        { main_role: 'Purchase', sub_role: 'Purchase Entry',       page_url: '/dashboard/purchase/purchase-entry' },
        { main_role: 'Purchase', sub_role: 'All Purchase List',    page_url: '/dashboard/purchase/dashboard' },
        { main_role: 'Purchase', sub_role: 'Daily Report',         page_url: '/dashboard/purchase/dashboard' },
        { main_role: 'Purchase', sub_role: 'Purchase List',        page_url: '/dashboard/purchase/dashboard' },
        { main_role: 'Purchase', sub_role: 'Buy/sell (Suppliers)', page_url: '/dashboard/purchase/dashboard' },
        { main_role: 'Purchase', sub_role: 'Purchase Reports',     page_url: '/dashboard/purchase/dashboard' },
        { main_role: 'Purchase', sub_role: 'Inventory Reports',    page_url: '/dashboard/purchase/inventory-price-reports' },
        // Suppliers
        { main_role: 'Suppliers', sub_role: 'Supplier List',        page_url: '/dashboard/suppliers' },
        { main_role: 'Suppliers', sub_role: 'Suppliers Transaction', page_url: '/dashboard/suppliers' },
        { main_role: 'Suppliers', sub_role: 'Suppliers Ledger',      page_url: '/dashboard/suppliers' },
        // Finance
        { main_role: 'Finance', sub_role: 'Finance',               page_url: '/dashboard/account' },
        // Settings
        { main_role: 'Settings', sub_role: 'Stores Management',    page_url: '/dashboard/settings/stores' },
        { main_role: 'Settings', sub_role: 'Fiscal Years',         page_url: '/dashboard/settings/fiscal-years' },
        { main_role: 'Settings', sub_role: 'Logistics Management', page_url: '/dashboard/settings/logistics-api' },
        { main_role: 'Settings', sub_role: 'Approval Center',      page_url: '/dashboard/settings/approvals' },
        { main_role: 'Settings', sub_role: 'Restore Backup',       page_url: '/dashboard/settings/backup' },
        { main_role: 'Settings', sub_role: 'Staff Management',     page_url: '/dashboard/staff-management' },
        { main_role: 'Settings', sub_role: 'Role Management',      page_url: '/dashboard/settings/roles' },
        { main_role: 'Settings', sub_role: 'Sync Settings',        page_url: '/dashboard/settings/sync-settings' },
    ]

    // Delete all existing roles first to ensure a clean slate
    const { error: deleteError } = await supabase.from('page_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) throw new Error(`Failed to clear roles: ${deleteError.message}`)

    const { error } = await supabase
        .from('page_roles')
        .insert(defaultRoles)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}
