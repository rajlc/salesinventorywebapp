'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui-shim'
import { ExpenseForm } from './ExpenseForm'
import {
    deleteExpense,
    type Expense
} from '../actions/expense-actions'
import { Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ExpenseTableProps {
    expenses: Expense[]
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
}

export function ExpenseTable({
    expenses,
    currentPage,
    totalPages,
    onPageChange,
}: ExpenseTableProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const router = useRouter()

    // Client-side check if expense can be edited
    const canEdit = (expense: Expense): { canEdit: boolean; reason?: string } => {
        if (expense.edit_count >= 1) {
            return { canEdit: false, reason: 'Already edited once. No more edits allowed.' }
        }

        const createdAt = new Date(expense.created_at)
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreation >= 24) {
            return { canEdit: false, reason: '24-hour edit window has passed.' }
        }

        return { canEdit: true }
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            await deleteExpense(id)
            toast.success('Expense deleted successfully')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete expense')
        } finally {
            setDeletingId(null)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
        }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <div className="space-y-4">
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    No expenses found
                                </TableCell>
                            </TableRow>
                        ) : (
                            expenses.map((expense) => {
                                const editStatus = canEdit(expense)
                                return (
                                    <TableRow key={expense.id}>
                                        <TableCell>{formatDate(expense.date)}</TableCell>
                                        <TableCell>
                                            <span className="text-sm">{expense.category}</span>
                                        </TableCell>
                                        <TableCell>{expense.expense_item}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(expense.amount)}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {expense.remarks || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {expense.creator?.full_name || 'Unknown'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {editStatus.canEdit ? (
                                                    <ExpenseForm expense={expense} mode="edit" />
                                                ) : (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled
                                                                    >
                                                                        <AlertCircle className="h-4 w-4 mr-1" />
                                                                        Edit
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{editStatus.reason || 'Cannot edit'}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={deletingId === expense.id}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Delete Expense
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete this expense?
                                                                This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(expense.id)}
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
