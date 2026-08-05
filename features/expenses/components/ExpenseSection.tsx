'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseTable } from './ExpenseTable'
import type { Expense } from '../actions/expense-actions'

interface ExpenseSectionProps {
    initialExpenses: Expense[]
    initialTotalPages: number
}

export function ExpenseSection({ initialExpenses, initialTotalPages }: ExpenseSectionProps) {
    const [currentPage, setCurrentPage] = useState(1)

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Expenses</CardTitle>
                    <ExpenseForm mode="create" />
                </div>
            </CardHeader>
            <CardContent>
                <ExpenseTable
                    expenses={initialExpenses}
                    currentPage={currentPage}
                    totalPages={initialTotalPages}
                    onPageChange={setCurrentPage}
                />
            </CardContent>
        </Card>
    )
}
