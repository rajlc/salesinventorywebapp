'use client'

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { getUserProfile, getUserActivityLogs, UserPermission } from "@/features/staff-management/actions/staff-actions"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-shim"
import { ArrowLeft, User, Shield, Activity, MapPin, TrendingUp } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { LocationMapPicker } from "@/features/staff-management/components/LocationMapPicker"

export default function StaffDetailsPage() {
    const params = useParams()
    const userId = params.userId as string

    const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
        queryKey: ['staff-profile', userId],
        queryFn: async () => await getUserProfile(userId)
    })

    const { data: activityLogs, isLoading: logsLoading } = useQuery({
        queryKey: ['activity-logs', userId],
        queryFn: async () => await getUserActivityLogs(userId, 20)
    })

    if (profileLoading) {
        return (
            <div className="p-8 text-center text-gray-500">
                Loading staff details...
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="p-8 text-center text-red-500">
                Staff member not found
            </div>
        )
    }

    const displayName = profile.full_name || profile.email
    const createdDate = new Date(profile.created_at)
    const activeDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200'
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'disable': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/staff-management"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{displayName}</h1>
                        <p className="text-sm text-gray-500">Staff Details</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded border capitalize ${getStatusColor(profile.status)}`}>
                    {profile.status}
                </span>
            </div>

            {/* User Information Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User size={20} />
                        User Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-500">Email</label>
                        <p className="font-medium">{profile.email}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Full Name</label>
                        <p className="font-medium">{profile.full_name || 'Not provided'}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Role</label>
                        <p className="font-medium capitalize">
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200">
                                {profile.role}
                            </span>
                        </p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Status</label>
                        <p className="font-medium capitalize">{profile.status}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Account Created</label>
                        <p className="font-medium">{format(createdDate, 'PPP')}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Active Days</label>
                        <p className="font-medium">{activeDays} days</p>
                    </div>
                </CardContent>
            </Card>

            {/* Page Permissions Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield size={20} />
                        Page Permissions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {profile.permissions && profile.permissions.length > 0 ? (
                        <div className="space-y-2">
                            {profile.permissions.map((perm: UserPermission) => (
                                <div
                                    key={perm.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border dark:border-zinc-700"
                                >
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <p className="font-medium text-sm">
                                                {perm.main_page_role}
                                                {perm.sub_page_role && (
                                                    <span className="text-gray-500"> → {perm.sub_page_role}</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Added {format(new Date(perm.created_at), 'PP')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-200 capitalize">
                                        {perm.permission_type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                            No permissions assigned yet
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Activity Logs Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity size={20} />
                        Activity Logs
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <p className="text-center py-8 text-gray-500">Loading activity logs...</p>
                    ) : activityLogs && activityLogs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Date/Time</th>
                                        <th className="px-4 py-3 text-left font-medium">Action</th>
                                        <th className="px-4 py-3 text-left font-medium">Browser</th>
                                        <th className="px-4 py-3 text-left font-medium">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-700">
                                    {activityLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-3">
                                                {format(new Date(log.created_at), 'PPp')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${log.action === 'login'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">
                                                {log.browser || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                {log.ip_address || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                            No activity logs yet
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Location Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin size={20} />
                        Location Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <LocationMapPicker
                        userId={userId}
                        currentLocation={profile.location}
                        onUpdate={() => refetchProfile()}
                    />
                </CardContent>
            </Card>

            {/* Progress Report Card (Placeholder) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp size={20} />
                        Progress Report
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 text-center py-8">
                        Coming soon...
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
