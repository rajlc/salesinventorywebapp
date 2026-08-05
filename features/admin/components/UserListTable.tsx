"use client"

import React from 'react'
import { useUsers } from '../hooks/useUsers'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { Loader2, Check, X, Shield, MapPin } from 'lucide-react'

export function UserListTable() {
    const { users, isLoading, error, updateUser } = useUsers()

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
    if (error) return <div className="text-red-500">Error loading users.</div>

    const handleApprove = async (id: string) => {
        await updateUser({ id, updates: { is_active: true } })
    }

    const handleDeactivate = async (id: string) => {
        // In a real app, this should confirm
        await updateUser({ id, updates: { is_active: false } })
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Role</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Store</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {users?.map((user: any) => (
                                <tr key={user.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle font-medium">
                                        {user.full_name || 'Unknown'}
                                        <div className="text-xs text-muted-foreground">{user.id.slice(0, 8)}...</div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle">
                                        {user.is_active ? (
                                            <span className="text-green-600 font-bold text-xs flex items-center gap-1"><Check size={12} /> Active</span>
                                        ) : (
                                            <span className="text-yellow-600 font-bold text-xs flex items-center gap-1">Pending</span>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle">
                                        {user.stores?.name || <span className="text-gray-400 italic">Unassigned</span>}
                                    </td>
                                    <td className="p-4 align-middle text-right flex justify-end gap-2">
                                        {!user.is_active && (
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => handleApprove(user.id)}>
                                                Approve
                                            </Button>
                                        )}
                                        {user.is_active && (
                                            <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleDeactivate(user.id)}>
                                                Deactivate
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
