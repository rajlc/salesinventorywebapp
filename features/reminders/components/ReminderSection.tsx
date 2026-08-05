'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { ReminderForm } from './ReminderForm'
import { ReminderTable } from './ReminderTable'
import type { Reminder } from '../actions/reminder-actions'

interface ReminderSectionProps {
    initialReminders: Reminder[]
    initialTotalPages: number
}

export function ReminderSection({ initialReminders, initialTotalPages }: ReminderSectionProps) {
    const [currentPage, setCurrentPage] = useState(1)

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Reminders</CardTitle>
                    <ReminderForm mode="create" />
                </div>
            </CardHeader>
            <CardContent>
                <ReminderTable
                    reminders={initialReminders}
                    currentPage={currentPage}
                    totalPages={initialTotalPages}
                    onPageChange={setCurrentPage}
                />
            </CardContent>
        </Card>
    )
}
