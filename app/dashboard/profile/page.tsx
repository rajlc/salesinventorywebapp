import {
    getProfile,
    getUserTasks,
    getActivityLogs,
    getUserOrders
} from '@/features/profile/actions/profile-actions'
import { getExpenses } from '@/features/expenses/actions/expense-actions'
import { getReminders } from '@/features/reminders/actions/reminder-actions'

import { ProfileHeader } from '@/features/profile/components/ProfileHeader'
import { ProfileDetails } from '@/features/profile/components/ProfileDetails'
import { TaskList } from '@/features/profile/components/TaskList'
import { ActivityLog } from '@/features/profile/components/ActivityLog'
import { UserOrderList } from '@/features/profile/components/UserOrderList'
import { ExpenseSection } from '@/features/expenses/components/ExpenseSection'
import { ReminderSection } from '@/features/reminders/components/ReminderSection'
import { User } from 'lucide-react'

export default async function ProfilePage() {
    // Fetch all data in parallel
    const [profile, tasks, logs, orders, expensesData, remindersData] = await Promise.all([
        getProfile(),
        getUserTasks(),
        getActivityLogs(),
        getUserOrders(),
        getExpenses({ page: 1, limit: 10 }),
        getReminders({ page: 1, limit: 10 })
    ])

    if (!profile) {
        return <div className="p-8 text-center">User not found</div>
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 dark:bg-zinc-900 min-h-screen space-y-6">
            <div className="max-w-7xl mx-auto">
                <div className="hidden md:flex items-center gap-2 mb-6">
                    <User className="h-6 w-6 text-gray-500" />
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">My Profile</h1>
                </div>

                <ProfileHeader user={profile} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Left Column: Personal Info & Security */}
                    <div className="lg:col-span-1 space-y-6">
                        <ProfileDetails user={profile} />
                    </div>

                    {/* Middle Column: Tasks */}
                    <div className="lg:col-span-1">
                        <TaskList tasks={tasks} />
                    </div>

                    {/* Right Column: Activity Log */}
                    <div className="lg:col-span-1">
                        <ActivityLog logs={logs} />
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="grid grid-cols-1 gap-6 mb-6">
                    <UserOrderList orders={orders} />
                </div>

                {/* Expenses & Reminders Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Reminders */}
                    <div>
                        <ReminderSection
                            initialReminders={remindersData.reminders}
                            initialTotalPages={remindersData.totalPages}
                        />
                    </div>

                    {/* Right: Expenses */}
                    <div>
                        <ExpenseSection
                            initialExpenses={expensesData.expenses}
                            initialTotalPages={expensesData.totalPages}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
