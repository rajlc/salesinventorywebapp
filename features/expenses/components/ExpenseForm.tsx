'use client'

import { useState } from 'react'
import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@/components/ui-shim'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    createExpense,
    updateExpense,
    type ExpenseCategory,
    type Expense
} from '../actions/expense-actions'
import { getExpenseItemOptions, isRemarksRequired } from '../utils/expense-utils'
import { toast } from 'sonner'

const expenseCategories: ExpenseCategory[] = [
    'Vehicle Expenses',
    'Office Expenses',
    'Rent',
    'Personal Expenses',
    'Others'
]

// Dynamic schema that validates based on category and item
const createExpenseSchema = (category: ExpenseCategory, expenseItem: string) =>
    z.object({
        date: z.string().min(1, 'Date is required'),
        category: z.string().min(1, 'Category is required'),
        expense_item: z.string().min(1, 'Expense item is required'),
        amount: z.string().min(1, 'Amount is required'),
        remarks: isRemarksRequired(category, expenseItem)
            ? z.string().min(1, 'Remarks is required for this selection')
            : z.string().optional(),
    })

interface ExpenseFormProps {
    expense?: Expense
    mode?: 'create' | 'edit'
}

export function ExpenseForm({ expense, mode = 'create' }: ExpenseFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | ''>(expense?.category || '')
    const [selectedItem, setSelectedItem] = useState(expense?.expense_item || '')
    const router = useRouter()

    // Determine if we show dropdown or text input for expense_item
    const itemOptions = selectedCategory ? getExpenseItemOptions(selectedCategory as ExpenseCategory) : []
    const showItemDropdown = itemOptions.length > 0

    const form = useForm<z.infer<ReturnType<typeof createExpenseSchema>>>({
        resolver: zodResolver(
            createExpenseSchema(
                selectedCategory as ExpenseCategory,
                selectedItem
            )
        ),
        defaultValues: {
            date: expense?.date || new Date().toISOString().split('T')[0],
            category: expense?.category || '',
            expense_item: expense?.expense_item || '',
            amount: expense?.amount?.toString() || '',
            remarks: expense?.remarks || '',
        },
    })

    // Watch for category and item changes to update validation
    const watchCategory = form.watch('category')
    const watchItem = form.watch('expense_item')

    async function onSubmit(values: z.infer<ReturnType<typeof createExpenseSchema>>) {
        setLoading(true)
        try {
            const data = {
                date: values.date,
                category: values.category as ExpenseCategory,
                expense_item: values.expense_item,
                amount: parseFloat(values.amount),
                remarks: values.remarks,
            }

            if (mode === 'edit' && expense) {
                await updateExpense(expense.id, data)
                toast.success('Expense updated successfully')
            } else {
                await createExpense(data)
                toast.success('Expense added successfully')
            }

            setOpen(false)
            form.reset()
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to save expense')
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
                    <DialogTitle>
                        {mode === 'create' ? 'Add Expense' : 'Edit Expense'}
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <FormControl>
                                        <select
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e)
                                                setSelectedCategory(e.target.value as ExpenseCategory)
                                                form.setValue('expense_item', '')
                                                setSelectedItem('')
                                            }}
                                            className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                        >
                                            <option value="">Select category</option>
                                            {expenseCategories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expense_item"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Expense Item</FormLabel>
                                    <FormControl>
                                        {showItemDropdown ? (
                                            <select
                                                {...field}
                                                onChange={(e) => {
                                                    field.onChange(e)
                                                    setSelectedItem(e.target.value)
                                                }}
                                                className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                            >
                                                <option value="">Select item</option>
                                                {itemOptions.map((item) => (
                                                    <option key={item} value={item}>
                                                        {item}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                placeholder="Enter expense item"
                                                {...field}
                                                onChange={(e) => {
                                                    field.onChange(e)
                                                    setSelectedItem(e.target.value)
                                                }}
                                            />
                                        )}
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="remarks"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>
                                        Remarks
                                        {isRemarksRequired(
                                            watchCategory as ExpenseCategory,
                                            watchItem
                                        ) && <span className="text-red-500">*</span>}
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add remarks..."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {mode === 'create' ? 'Add Expense' : 'Update Expense'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
