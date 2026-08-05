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
    Badge,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui-shim'
import { ReminderForm } from './ReminderForm'
import {
    deleteReminder,
    updateReminderStatus,
    type Reminder
} from '../actions/reminder-actions'
import { Trash2, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ReminderTableProps {
    reminders: Reminder[]
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
}

export function ReminderTable({
    reminders,
    currentPage,
    totalPages,
    onPageChange,
}: ReminderTableProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const router = useRouter()

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            await deleteReminder(id)
            toast.success('Reminder deleted successfully')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete reminder')
        } finally {
            setDeletingId(null)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: 'Open' | 'Close') => {
        setTogglingId(id)
        try {
            const newStatus = currentStatus === 'Open' ? 'Close' : 'Open'
            await updateReminderStatus(id, newStatus)
            toast.success(`Reminder marked as ${newStatus}`)
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status')
        } finally {
            setTogglingId(null)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const formatDateTime = (datetimeString: string | null) => {
        if (!datetimeString) return '-'
        return new Date(datetimeString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <div className="space-y-4">
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reminder</TableHead>
                            <TableHead>DateTime</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reminders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    No reminders found
                                </TableCell>
                            </TableRow>
                        ) : (
                            reminders.map((reminder) => (
                                <TableRow key={reminder.id}>
                                    <TableCell>{formatDate(reminder.date)}</TableCell>
                                    <TableCell>
                                        <Badge variant={reminder.type === 'Important' ? 'destructive' : 'secondary'}>
                                            {reminder.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[250px]">
                                        {reminder.reminder}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDateTime(reminder.reminder_datetime)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleStatus(reminder.id, reminder.status)}
                                            disabled={togglingId === reminder.id}
                                            className="flex items-center gap-1"
                                        >
                                            {reminder.status === 'Open' ? (
                                                <>
                                                    <Circle className="h-4 w-4 text-blue-500" />
                                                    <span>Open</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    <span>Close</span>
                                                </>
                                            )}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        {reminder.creator?.full_name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <ReminderForm reminder={reminder} mode="edit" />
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={deletingId === reminder.id}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            Delete Reminder
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete this reminder?
                                                            This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(reminder.id)}
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
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
