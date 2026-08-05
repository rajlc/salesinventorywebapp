'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TYPES
// ============================================================================

export type ReminderType = 'General' | 'Important'
export type ReminderStatus = 'Open' | 'Close'

export interface Reminder {
    id: string
    date: string
    type: ReminderType
    reminder: string
    reminder_datetime: string | null
    status: ReminderStatus
    created_by: string
    created_at: string
    creator?: {
        full_name: string
    }
}

export interface CreateReminderData {
    date: string
    type: ReminderType
    reminder: string
    reminder_datetime?: string
    status?: ReminderStatus
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get reminders with pagination, role-based filtering, and status sorting
 */
export async function getReminders(params: {
    page?: number
    limit?: number
}) {
    const { page = 1, limit = 10 } = params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Get user role
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('reminders')
        .select('*', { count: 'exact' })

    // Role-based filtering - Users see only their own, Admins see all
    if (profile?.role !== 'admin') {
        query = query.eq('created_by', user.id)
    }

    // Sort: Open first, then by date descending
    query = query
        .order('status', { ascending: true }) // 'Open' comes before 'Close'
        .order('date', { ascending: false })
        .range(from, to)

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    // Fetch creator names separately
    const reminders = (data || []) as Reminder[]
    if (reminders.length > 0) {
        const creatorIds = [...new Set(reminders.map(r => r.created_by))]
        const { data: creators } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', creatorIds)

        const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]) || [])

        reminders.forEach(reminder => {
            reminder.creator = { full_name: creatorMap.get(reminder.created_by) || 'Unknown' }
        })
    }

    return {
        reminders,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

/**
 * Get single reminder by ID
 */
export async function getReminderById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw new Error(error.message)
    return data as Reminder
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create new reminder
 */
export async function createReminder(data: CreateReminderData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data: reminder, error } = await supabase
        .from('reminders')
        .insert({
            date: data.date,
            type: data.type,
            reminder: data.reminder,
            reminder_datetime: data.reminder_datetime || null,
            status: data.status || 'Open',
            created_by: user.id
        })
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return reminder as Reminder
}

/**
 * Update existing reminder
 */
export async function updateReminder(id: string, data: Partial<CreateReminderData>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data: reminder, error } = await supabase
        .from('reminders')
        .update({
            ...data,
            reminder_datetime: data.reminder_datetime || null
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return reminder as Reminder
}

/**
 * Update reminder status
 */
export async function updateReminderStatus(id: string, status: ReminderStatus) {
    return updateReminder(id, { status })
}

/**
 * Delete reminder
 */
export async function deleteReminder(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return { success: true }
}
