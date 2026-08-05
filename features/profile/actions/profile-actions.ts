'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserTask {
    id: string
    user_id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'completed'
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    created_at: string
    updated_at: string
}

export interface UserOrder {
    id: string
    order_date: string
    customer_name: string
    total_amount: number
    status: string
    type: 'Sales' | 'Daraz' | 'Marketplace'
}

// Get current user profile
export async function getProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return {
        ...profile,
        email: user.email,
        phone_number: profile?.phone_number || '',
        address: profile?.address || ''
    }
}

// Update user profile
export async function updateProfile(data: {
    full_name: string
    phone_number: string
    address: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_profiles')
        .update({
            full_name: data.full_name,
            phone_number: data.phone_number,
            address: data.address,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (error) throw new Error(error.message)

    // Log the profile update activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('profile_updated')
    } catch (logError) {
        // Silent fail for logging
        console.error('Failed to log profile update:', logError)
    }

    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/staff-management')
}

// Secure password change
export async function verifyAndChangePassword(currentPass: string, newPass: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) throw new Error('Not authenticated')

    // 1. Verify current password
    const verifyClient = await createClient()
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
        email: user.email,
        password: currentPass
    })

    if (verifyError) {
        throw new Error('Current password does not match')
    }

    // 2. Validate new password criteria
    if (newPass.length < 6) throw new Error('Password must be at least 6 characters')
    if (!/\d/.test(newPass) || !/[a-zA-Z]/.test(newPass)) {
        throw new Error('Password must contain both letters and numbers')
    }

    // 3. Update password
    const { error: updateError } = await supabase.auth.updateUser({
        password: newPass
    })

    if (updateError) throw new Error(updateError.message)

    // Log the password change activity
    try {
        const { logActivity } = await import('@/features/activity/actions/log-activity')
        await logActivity('password_changed')
    } catch (logError) {
        // Silent fail for logging
        console.error('Failed to log password change:', logError)
    }

    // 4. Logout from all devices
    try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

        if (signOutError) {
            console.error('Global sign out error:', signOutError)
        }
    } catch (err) {
        // Ignore logout errors to ensure password change success isn't blocked
        console.error('Global sign out exception:', err)
    }

    return { success: true }
}

// Get user tasks
export async function getUserTasks() {
    const supabase = await createClient()

    const { data: tasks, error } = await supabase
        .from('user_tasks')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return tasks as UserTask[]
}

// Upsert task
export async function upsertTask(task: Partial<UserTask>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_tasks')
        .upsert({
            ...task,
            user_id: user.id,
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
}

// Delete task
export async function deleteTask(taskId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('user_tasks')
        .delete()
        .eq('id', taskId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
}

// Get user activity logs
export async function getActivityLogs() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: logs } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

    return logs || []
}

// Get user orders (placeholder)
export async function getUserOrders() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, invoice_date, customer_name, total_amount, status')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        // Silent fail as sales table might differ
        return []
    }

    return sales.map(s => ({
        id: s.id,
        order_date: s.invoice_date,
        customer_name: s.customer_name,
        total_amount: s.total_amount,
        status: s.status,
        type: 'Sales'
    })) as UserOrder[]
}
