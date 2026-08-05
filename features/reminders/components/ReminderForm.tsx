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
    createReminder,
    updateReminder,
    type ReminderType,
    type ReminderStatus,
    type Reminder
} from '../actions/reminder-actions'
import { toast } from 'sonner'

const reminderSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    type: z.enum(['General', 'Important']),
    reminder: z.string().min(1, 'Reminder is required'),
    reminder_datetime: z.string().optional(),
    status: z.enum(['Open', 'Close']),
}).refine((data) => {
    // If type is Important, reminder_datetime is required
    if (data.type === 'Important' && !data.reminder_datetime) {
        return false
    }
    return true
}, {
    message: 'DateTime is required for Important reminders',
    path: ['reminder_datetime']
})

interface ReminderFormProps {
    reminder?: Reminder
    mode?: 'create' | 'edit'
}

export function ReminderForm({ reminder, mode = 'create' }: ReminderFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof reminderSchema>>({
        resolver: zodResolver(reminderSchema),
        defaultValues: {
            date: reminder?.date || new Date().toISOString().split('T')[0],
            type: reminder?.type || 'General',
            reminder: reminder?.reminder || '',
            reminder_datetime: reminder?.reminder_datetime || '',
            status: reminder?.status || 'Open',
        },
    })

    const watchType = form.watch('type')
    const showDateTime = watchType === 'Important'

    async function onSubmit(values: z.infer<typeof reminderSchema>) {
        setLoading(true)
        try {
            const data = {
                date: values.date,
                type: values.type as ReminderType,
                reminder: values.reminder,
                reminder_datetime: values.type === 'Important' ? values.reminder_datetime : undefined,
                status: values.status as ReminderStatus,
            }

            if (mode === 'edit' && reminder) {
                await updateReminder(reminder.id, data)
                toast.success('Reminder updated successfully')
            } else {
                await createReminder(data)
                toast.success('Reminder added successfully')
            }

            setOpen(false)
            form.reset()
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to save reminder')
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
                        Add Reminder
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
                        {mode === 'create' ? 'Add Reminder' : 'Edit Reminder'}
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
                            name="type"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <FormControl>
                                        <select
                                            {...field}
                                            className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                        >
                                            <option value="General">General</option>
                                            <option value="Important">Important</option>
                                        </select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {showDateTime && (
                            <FormField
                                control={form.control}
                                name="reminder_datetime"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Reminder Date & Time</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="reminder"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Reminder</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter reminder..."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <FormControl>
                                        <select
                                            {...field}
                                            className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                        >
                                            <option value="Open">Open</option>
                                            <option value="Close">Close</option>
                                        </select>
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
                                {mode === 'create' ? 'Add Reminder' : 'Update Reminder'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
