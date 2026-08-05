import type { ExpenseCategory } from '../actions/expense-actions'

/**
 * Get expense item options based on category
 */
export function getExpenseItemOptions(category: ExpenseCategory): string[] {
    switch (category) {
        case 'Vehicle Expenses':
            return ['Fuel', 'Servicing', 'Others']
        case 'Office Expenses':
            return ['Packaging Item', 'Furniture', 'Accessories', 'Others']
        case 'Rent':
            return ['Home Rent', 'Office Rent']
        case 'Personal Expenses':
        case 'Others':
            return [] // Free text input
        default:
            return []
    }
}

/**
 * Check if remarks is required based on category and item
 */
export function isRemarksRequired(category: ExpenseCategory, expenseItem: string): boolean {
    if (category === 'Vehicle Expenses' && expenseItem === 'Others') {
        return true
    }
    if (category === 'Office Expenses' && (expenseItem === 'Accessories' || expenseItem === 'Others')) {
        return true
    }
    return false
}
