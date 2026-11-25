import type { ExpenseCategory } from '../actions/expense-actions'

export const OFFICE_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    'Vehicles',
    'Accessories',
    'Packaging Materials',
    'Others',
]

export const VEHICLE_ITEMS = ['Fuel', 'Servicing', 'Parts', 'Others'] as const

/**
 * Get Item options based on category (only Vehicles shows Item dropdown)
 */
export function getExpenseItemOptions(category: ExpenseCategory | string): string[] {
    if (category === 'Vehicles' || category === 'Vehicle Expenses') {
        return [...VEHICLE_ITEMS]
    }
    return []
}

/**
 * Check if remarks is required (required for Personal Expenses)
 */
export function isRemarksRequired(category: ExpenseCategory | string, _expenseItem: string): boolean {
    return category === 'Personal Expenses'
}
