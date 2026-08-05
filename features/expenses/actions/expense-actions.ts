'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TYPES
// ============================================================================

export type ExpenseCategory = 'Vehicle Expenses' | 'Office Expenses' | 'Rent' | 'Personal Expenses' | 'Others'

export interface Expense {
    id: string
    date: string
    category: ExpenseCategory
    expense_item: string
    amount: number
    remarks: string | null
    created_by: string
    created_at: string
    updated_by: string | null
    updated_at: string
    edit_count: number
    last_edited_at: string | null
    creator?: {
        full_name: string
    }
}

export interface CreateExpenseData {
    date: string
    category: ExpenseCategory
    expense_item: string
    amount: number
    remarks?: string
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get expenses with pagination and role-based filtering
 */
export async function getExpenses(params: {
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
        .from('expenses')
        .select('*', { count: 'exact' })

    // Role-based filtering - Users see only their own, Admins see all
    if (profile?.role !== 'admin') {
        query = query.eq('created_by', user.id)
    }

    query = query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    // Fetch creator names separately
    const expenses = (data || []) as Expense[]
    if (expenses.length > 0) {
        const creatorIds = [...new Set(expenses.map(e => e.created_by))]
        const { data: creators } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', creatorIds)

        const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]) || [])

        expenses.forEach(expense => {
            expense.creator = { full_name: creatorMap.get(expense.created_by) || 'Unknown' }
        })
    }

    return {
        expenses,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

/**
 * Get single expense by ID
 */
export async function getExpenseById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw new Error(error.message)
    return data as Expense
}

/**
 * Check if expense can be edited
 */
export async function canEditExpense(expenseId: string): Promise<{
    canEdit: boolean
    reason?: string
}> {
    const expense = await getExpenseById(expenseId)

    // Check edit count (only 1 edit allowed)
    if (expense.edit_count >= 1) {
        return { canEdit: false, reason: 'Already edited once. No more edits allowed.' }
    }

    // Check 24-hour window
    const createdAt = new Date(expense.created_at)
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceCreation >= 24) {
        return { canEdit: false, reason: '24-hour edit window has passed.' }
    }

    return { canEdit: true }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create new expense
 */
export async function createExpense(data: CreateExpenseData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
            date: data.date,
            category: data.category,
            expense_item: data.expense_item,
            amount: data.amount,
            remarks: data.remarks || null,
            created_by: user.id,
            updated_by: user.id
        })
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return expense as Expense
}

/**
 * Update existing expense (with edit restrictions)
 */
export async function updateExpense(id: string, data: CreateExpenseData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Check if can edit
    const editCheck = await canEditExpense(id)
    if (!editCheck.canEdit) {
        throw new Error(editCheck.reason)
    }

    // Get current expense to increment edit_count
    const currentExpense = await getExpenseById(id)

    const { data: expense, error } = await supabase
        .from('expenses')
        .update({
            date: data.date,
            category: data.category,
            expense_item: data.expense_item,
            amount: data.amount,
            remarks: data.remarks || null,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
            edit_count: currentExpense.edit_count + 1,
            last_edited_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return expense as Expense
}

/**
 * Delete expense
 */
export async function deleteExpense(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/profile')
    return { success: true }
}
