'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// =====================================================
// ORDER DELETION APPROVAL SYSTEM - Server Actions
// =====================================================

// Deletion Request Interfaces
interface DeletionRequest {
    id: string
    order_id: string
    order_number: string
    requested_by: string
    requested_at: string
    reason: string
    status: 'pending' | 'approved' | 'rejected'
    reviewed_by?: string
    reviewed_at?: string
    review_notes?: string
}

interface DeletionStats {
    deletionsIn24h: number
    remainingDeletions: number
    nextDeletionAvailable?: string
    canDelete: boolean
}

interface DeletedOrder {
    id: string
    original_order_id: string
    order_data: any
    deleted_by: string
    deleted_at: string
    permanent_delete_at: string
    restored: boolean
}

// Helper: Get user role from user_profiles
export async function getUserRole(userId?: string): Promise<'admin' | 'user' | null> {
    const supabase = await createClient()
    const uid = userId || (await supabase.auth.getUser()).data.user?.id

    if (!uid) return null

    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', uid)
        .single()

    if (error || !data) return null
    return data.role as 'admin' | 'user'
}

// Helper: Get current user ID
async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
}

// 1. Get user deletion statistics (for 24h limit check)
export async function getUserDeletionStats(userId?: string): Promise<DeletionStats> {
    try {
        const supabase = await createClient()
        const uid = userId || await getCurrentUserId()

        if (!uid) {
            return { deletionsIn24h: 0, remainingDeletions: 5, canDelete: false }
        }

        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        // Count deletion requests created in last 24 hours
        const { data, error } = await supabase
            .from('deletion_requests')
            .select('requested_at')
            .eq('requested_by', uid)
            .gte('requested_at', twentyFourHoursAgo.toISOString())
            .order('requested_at', { ascending: false })

        if (error) {
            console.error('Error fetching deletion stats:', error)
            return { deletionsIn24h: 0, remainingDeletions: 5, canDelete: true }
        }

        const deletionsIn24h = data.length
        const remainingDeletions = Math.max(0, 5 - deletionsIn24h)

        let nextDeletionAvailable: string | undefined
        if (deletionsIn24h >= 5 && data.length > 0) {
            // Find the oldest deletion request
            const oldestRequest = data[data.length - 1]
            const oldestTime = new Date(oldestRequest.requested_at)
            const nextAvailable = new Date(oldestTime.getTime() + 24 * 60 * 60 * 1000)
            nextDeletionAvailable = nextAvailable.toISOString()
        }

        return {
            deletionsIn24h,
            remainingDeletions,
            nextDeletionAvailable,
            canDelete: remainingDeletions > 0
        }
    } catch (error) {
        console.error('getUserDeletionStats error:', error)
        return { deletionsIn24h: 0, remainingDeletions: 5, canDelete: false }
    }
}

// 2. Create deletion request (for regular users)
export async function createDeletionRequest(orderId: string, orderNumber: string, reason: string) {
    try {
        const supabase = await createClient()
        const userId = await getCurrentUserId()

        if (!userId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check user role
        const role = await getUserRole(userId)
        if (role === 'admin') {
            return { success: false, error: 'Admins should delete directly' }
        }

        // Check deletion limit
        const stats = await getUserDeletionStats(userId)
        if (!stats.canDelete) {
            return {
                success: false,
                error: 'Deletion limit reached',
                stats
            }
        }

        // Create deletion request
        const { data, error } = await supabase
            .from('deletion_requests')
            .insert({
                order_id: orderId,
                order_number: orderNumber,
                requested_by: userId,
                reason: reason,
                status: 'pending'
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating deletion request:', error)
            return { success: false, error: error.message }
        }

        // Mark order as pending_deletion
        await supabase
            .from('daraz_orders')
            .update({ pending_deletion: true })
            .eq('id', orderId)

        revalidatePath('/dashboard/sales/daraz')

        return { success: true, data }
    } catch (error: any) {
        console.error('createDeletionRequest error:', error)
        return { success: false, error: error.message }
    }
}

// 3. Get pending deletion requests (for Approval Center)
export async function getPendingDeletionRequests() {
    try {
        const supabase = await createClient()

        // Check if current user is admin
        const role = await getUserRole()
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can view deletion requests' }
        }

        const { data, error } = await supabase
            .from('deletion_requests')
            .select('*')
            .eq('status', 'pending')
            .order('requested_at', { ascending: false })

        if (error) {
            console.error('Error fetching pending requests:', error)
            return { success: false, error: error.message }
        }

        // Fetch user profiles for requested_by
        if (data && data.length > 0) {
            const userIds = data.map(req => req.requested_by)
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, full_name')
                .in('id', userIds)

            // Attach user info to requests
            const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
            data.forEach(req => {
                const profile = profileMap.get(req.requested_by)
                req.requester = {
                    email: profile?.full_name || 'Unknown',
                    raw_user_meta_data: { full_name: profile?.full_name || 'Unknown' }
                }
            })
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('getPendingDeletionRequests error:', error)
        return { success: false, error: error.message }
    }
}

// 4. Approve deletion request
export async function approveDeletionRequest(requestId: string) {
    try {
        const supabase = await createClient()
        const adminId = await getCurrentUserId()

        if (!adminId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check if admin
        const role = await getUserRole(adminId)
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can approve deletions' }
        }

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('deletion_requests')
            .select('*')
            .eq('id', requestId)
            .single()

        if (fetchError || !request) {
            return { success: false, error: 'Request not found' }
        }

        // Update request status
        const { error: updateError } = await supabase
            .from('deletion_requests')
            .update({
                status: 'approved',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('Error updating request:', updateError)
            return { success: false, error: updateError.message }
        }

        // Soft delete the order
        const deleteResult = await softDeleteOrder(request.order_id, adminId)
        if (!deleteResult.success) {
            return { success: false, error: 'Failed to delete order' }
        }

        revalidatePath('/dashboard/sales/daraz')
        revalidatePath('/dashboard/settings/approval-center')

        return { success: true }
    } catch (error: any) {
        console.error('approveDeletionRequest error:', error)
        return { success: false, error: error.message }
    }
}

// 5. Reject deletion request
export async function rejectDeletionRequest(requestId: string, notes?: string) {
    try {
        const supabase = await createClient()
        const adminId = await getCurrentUserId()

        if (!adminId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check if admin
        const role = await getUserRole(adminId)
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can reject deletions' }
        }

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('deletion_requests')
            .select('*')
            .eq('id', requestId)
            .single()

        if (fetchError || !request) {
            return { success: false, error: 'Request not found' }
        }

        // Update request status
        const { error: updateError } = await supabase
            .from('deletion_requests')
            .update({
                status: 'rejected',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('Error updating request:', updateError)
            return { success: false, error: updateError.message }
        }

        // Remove pending_deletion flag
        await supabase
            .from('daraz_orders')
            .update({ pending_deletion: false })
            .eq('id', request.order_id)

        revalidatePath('/dashboard/sales/daraz')
        revalidatePath('/dashboard/settings/approval-center')

        return { success: true }
    } catch (error: any) {
        console.error('rejectDeletionRequest error:', error)
        return { success: false, error: error.message }
    }
}

// 6. Soft delete order (creates backup)
export async function softDeleteOrder(orderId: string, deletedBy?: string) {
    try {
        const supabase = await createClient()
        const userId = deletedBy || await getCurrentUserId()

        if (!userId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Fetch full order data with items
        const { data: order, error: orderError } = await supabase
            .from('daraz_orders')
            .select(`
                *,
                items:daraz_order_items(*)
            `)
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            console.error('Error fetching order:', orderError)
            return { success: false, error: 'Order not found' }
        }

        // Create backup in deleted_orders
        const { error: backupError } = await supabase
            .from('deleted_orders')
            .insert({
                original_order_id: orderId,
                order_data: order,
                deleted_by: userId
            })

        if (backupError) {
            console.error('Error creating backup:', backupError)
            return { success: false, error: 'Failed to create backup' }
        }

        // Soft delete the order
        const { error: deleteError } = await supabase
            .from('daraz_orders')
            .update({
                deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: userId,
                pending_deletion: false
            })
            .eq('id', orderId)

        if (deleteError) {
            console.error('Error soft deleting order:', deleteError)
            return { success: false, error: deleteError.message }
        }

        revalidatePath('/dashboard/sales/daraz')

        return { success: true }
    } catch (error: any) {
        console.error('softDeleteOrder error:', error)
        return { success: false, error: error.message }
    }
}

// 7. Get deleted orders (for Restore Backup page)
export async function getDeletedOrders() {
    try {
        const supabase = await createClient()

        // Check if admin
        const role = await getUserRole()
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can view deleted orders' }
        }

        const { data, error } = await supabase
            .from('deleted_orders')
            .select('*')
            .eq('restored', false)
            .order('deleted_at', { ascending: false })

        if (error) {
            console.error('Error fetching deleted orders:', error)
            return { success: false, error: error.message }
        }

        // Fetch user profiles for deleted_by
        if (data && data.length > 0) {
            const userIds = data.map(order => order.deleted_by)
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, full_name')
                .in('id', userIds)

            // Attach user info to orders
            const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
            data.forEach(order => {
                const profile = profileMap.get(order.deleted_by)
                order.deleter = {
                    email: profile?.full_name || 'Unknown',
                    raw_user_meta_data: { full_name: profile?.full_name || 'Unknown' }
                }
            })
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('getDeletedOrders error:', error)
        return { success: false, error: error.message }
    }
}

// 8. Restore deleted order
export async function restoreOrder(deletedOrderId: string) {
    try {
        const supabase = await createClient()
        const adminId = await getCurrentUserId()

        if (!adminId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check if admin
        const role = await getUserRole(adminId)
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can restore orders' }
        }

        // Get deleted order backup
        const { data: backup, error: fetchError } = await supabase
            .from('deleted_orders')
            .select('*')
            .eq('id', deletedOrderId)
            .single()

        if (fetchError || !backup) {
            return { success: false, error: 'Backup not found' }
        }

        // Check for duplicates BEFORE restoring
        const orderData = backup.order_data
        const { data: existingOrders } = await supabase
            .from('daraz_orders')
            .select('id, order_number, tracking_number, invoice_number')
            .or(`order_number.eq.${orderData.order_number},tracking_number.eq.${orderData.tracking_number},invoice_number.eq.${orderData.invoice_number}`)
            .neq('deleted', true)

        if (existingOrders && existingOrders.length > 0) {
            const conflicts: string[] = []
            existingOrders.forEach(order => {
                if (order.order_number === orderData.order_number) conflicts.push('Order Number')
                if (order.tracking_number === orderData.tracking_number) conflicts.push('Tracking Number')
                if (order.invoice_number === orderData.invoice_number) conflicts.push('Invoice Number')
            })
            return {
                success: false,
                error: `Cannot restore: ${conflicts.join(', ')} already exists in active orders. This order cannot be restored to prevent duplicates.`
            }
        }

        // Restore the order (un-soft-delete)
        const { error: restoreError } = await supabase
            .from('daraz_orders')
            .update({
                deleted: false,
                deleted_at: null,
                deleted_by: null
            })
            .eq('id', backup.original_order_id)

        if (restoreError) {
            console.error('Error restoring order:', restoreError)
            return { success: false, error: restoreError.message }
        }

        // Mark backup as restored
        await supabase
            .from('deleted_orders')
            .update({
                restored: true,
                restored_by: adminId,
                restored_at: new Date().toISOString()
            })
            .eq('id', deletedOrderId)

        revalidatePath('/dashboard/sales/daraz')
        revalidatePath('/dashboard/settings/restore-backup')

        return { success: true }
    } catch (error: any) {
        console.error('restoreOrder error:', error)
        return { success: false, error: error.message }
    }
}

// 9. Permanently delete order from backup (admin only)
export async function permanentlyDeleteOrder(deletedOrderId: string) {
    try {
        const supabase = await createClient()
        const adminId = await getCurrentUserId()

        if (!adminId) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check if admin
        const role = await getUserRole(adminId)
        if (role !== 'admin') {
            return { success: false, error: 'Only admins can permanently delete orders' }
        }

        // Get the backup to find original order ID
        const { data: backup, error: fetchError } = await supabase
            .from('deleted_orders')
            .select('original_order_id')
            .eq('id', deletedOrderId)
            .single()

        if (fetchError || !backup) {
            return { success: false, error: 'Backup not found' }
        }

        // Permanently delete from deleted_orders backup
        const { error: deleteBackupError } = await supabase
            .from('deleted_orders')
            .delete()
            .eq('id', deletedOrderId)

        if (deleteBackupError) {
            console.error('Error deleting backup:', deleteBackupError)
            return { success: false, error: deleteBackupError.message }
        }

        // Also permanently delete from daraz_orders if still exists
        await supabase
            .from('daraz_orders')
            .delete()
            .eq('id', backup.original_order_id)

        revalidatePath('/dashboard/settings/restore-backup')

        return { success: true }
    } catch (error: any) {
        console.error('permanentlyDeleteOrder error:', error)
        return { success: false, error: error.message }
    }
}
