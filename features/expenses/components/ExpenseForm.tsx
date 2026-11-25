'use client'

import { useEffect, useState } from 'react'
import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Input,
    Textarea,
} from '@/components/ui-shim'
import { Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    createExpense,
    updateExpense,
    type ExpenseCategory,
    type Expense,
} from '../actions/expense-actions'
import { OFFICE_EXPENSE_CATEGORIES, VEHICLE_ITEMS } from '../utils/expense-utils'
import { getFinancialAccounts, getCurrentUserProfile } from '@/features/transaction/actions/account-actions'
import type { FinancialAccount } from '@/features/transaction/types'
import { toast } from 'sonner'

type ExpenseType = 'Office Expenses' | 'Personal Expenses'

interface ExpenseFormProps {
    expense?: Expense
    mode?: 'create' | 'edit'
}

export function ExpenseForm({ expense, mode = 'create' }: ExpenseFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const initialType: ExpenseType =
        expense?.category === 'Personal Expenses' ? 'Personal Expenses' : 'Office Expenses'

    const [date, setDate] = useState(expense?.date || new Date().toISOString().split('T')[0])
    const [expenseType, setExpenseType] = useState<ExpenseType>(initialType)
    const [category, setCategory] = useState<ExpenseCategory>(
        expense?.category && expense.category !== 'Personal Expenses' ? expense.category : 'Vehicles'
    )
    const [item, setItem] = useState(expense?.expense_item || 'Fuel')
    const [amount, setAmount] = useState(expense?.amount?.toString() || '')
    const [accountId, setAccountId] = useState<string>((expense as any)?.account_id || '')
    const [remarks, setRemarks] = useState(expense?.remarks || '')

    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null)

    useEffect(() => {
        if (!open) return
        Promise.all([getFinancialAccounts(), getCurrentUserProfile()])
            .then(([accs, me]) => {
                setAccounts(accs)
                setCurrentUser(me)
            })
            .catch(() => {})
    }, [open])

    // Filter Payment Type accounts by Expense Type:
    // - Personal Expenses: ONLY logged-in user's own personal banks, wallets, or own cash in hand (NO company/shared accounts!)
    // - Office Expenses: ALL active accounts (company, shared, and user's own personal/cash)
    const availableAccounts =
        expenseType === 'Personal Expenses'
            ? accounts.filter((a) => a.owner_user_id === currentUser?.id)
            : accounts.filter(
                  (a) => a.owner_scope === 'business' || !a.owner_user_id || a.owner_user_id === currentUser?.id
              )

    // Auto-pick first valid account whenever expenseType or accounts change
    useEffect(() => {
        if (availableAccounts.length === 0) {
            setAccountId('')
            return
        }
        const stillValid = availableAccounts.some((a) => a.id === accountId)
        if (!stillValid) {
            const preferredCash = availableAccounts.find((a) => a.account_type === 'cash')
            setAccountId(preferredCash?.id || availableAccounts[0].id)
        }
    }, [expenseType, accounts, currentUser, accountId])

    const showItemField = expenseType === 'Office Expenses' && category === 'Vehicles'

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0])
        setExpenseType('Office Expenses')
        setCategory('Vehicles')
        setItem('Fuel')
        setAmount('')
        setRemarks('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const amountNum = parseFloat(amount)
        if (!amountNum || amountNum <= 0) {
            toast.error('Please enter a valid amount')
            return
        }
        if (expenseType === 'Personal Expenses' && !remarks.trim()) {
            toast.error('Remarks is required for Personal Expenses')
            return
        }
        if (showItemField && !item) {
            toast.error('Please select a Vehicle item')
            return
        }

        const finalCategory: ExpenseCategory =
            expenseType === 'Personal Expenses' ? 'Personal Expenses' : category
        const finalItem =
            expenseType === 'Personal Expenses'
                ? 'Personal Expenses'
                : category === 'Vehicles'
                ? item
                : category

        setLoading(true)
        try {
            const payload = {
                date,
                category: finalCategory,
                expense_item: finalItem,
                amount: amountNum,
                remarks: remarks.trim() || undefined,
                account_id: accountId || null,
            }

            if (mode === 'edit' && expense) {
                await updateExpense(expense.id, payload)
                toast.success('Expense updated successfully')
            } else {
                await createExpense(payload)
                toast.success('Expense added and Bank Statement updated!')
            }

            setOpen(false)
            resetForm()
            router.refresh()
        } catch (error: any) {
            toast.error(error?.message || 'Failed to save expense')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {mode === 'create' ? (
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Expense
                    </Button>
                ) : (
                    <Button variant="outline" size="sm">
                        Edit
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Add Expense' : 'Edit Expense'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Date */}
                    <div>
                        <label className="block text-xs font-semibold mb-1">Date</label>
                        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    {/* Expenses Type */}
                    <div>
                        <label className="block text-xs font-semibold mb-1">
                            Expenses Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={expenseType}
                            onChange={(e) => {
                                const nextType = e.target.value as ExpenseType
                                setExpenseType(nextType)
                                if (nextType === 'Office Expenses') {
                                    setCategory('Vehicles')
                                    setItem('Fuel')
                                }
                            }}
                            className="w-full p-2 text-sm border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                        >
                            <option value="Office Expenses">Office Expenses</option>
                            <option value="Personal Expenses">Personal Expenses</option>
                        </select>
                    </div>

                    {/* Category (Office Expenses Only) */}
                    {expenseType === 'Office Expenses' && (
                        <div>
                            <label className="block text-xs font-semibold mb-1">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={category}
                                onChange={(e) => {
                                    const nextCat = e.target.value as ExpenseCategory
                                    setCategory(nextCat)
                                    setItem(nextCat === 'Vehicles' ? 'Fuel' : '')
                                }}
                                className="w-full p-2 text-sm border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                {OFFICE_EXPENSE_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Item (ONLY when Office Expenses -> Vehicles) */}
                    {showItemField && (
                        <div>
                            <label className="block text-xs font-semibold mb-1">
                                Item <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={item}
                                onChange={(e) => setItem(e.target.value)}
                                className="w-full p-2 text-sm border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                {VEHICLE_ITEMS.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-semibold mb-1">
                            Amount <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    {/* Payment Type (Below Amount, Clean Dropdown without Balances) */}
                    <div>
                        <label className="block text-xs font-semibold mb-1">
                            Payment Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="w-full p-2 text-sm border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                        >
                            {availableAccounts.length === 0 ? (
                                <option value="">
                                    {expenseType === 'Personal Expenses'
                                        ? 'No personal bank/wallet/cash assigned to your account'
                                        : 'No bank/wallet/cash accounts found'}
                                </option>
                            ) : (
                                availableAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.account_type === 'cash' ? `Cash (${acc.name})` : acc.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Remarks (Required for Personal Expenses, Optional for Office Expenses) */}
                    <div>
                        <label className="block text-xs font-semibold mb-1">
                            Remarks{' '}
                            {expenseType === 'Personal Expenses' ? (
                                <span className="text-red-500">* (Required)</span>
                            ) : (
                                <span className="text-gray-400 font-normal">(Optional)</span>
                            )}
                        </label>
                        <Textarea
                            required={expenseType === 'Personal Expenses'}
                            placeholder={
                                expenseType === 'Personal Expenses'
                                    ? 'Enter details for personal expense (required)...'
                                    : 'Add remarks if needed...'
                            }
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'create' ? 'Save Expense' : 'Update Expense'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
