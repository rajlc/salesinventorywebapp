"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getUsers } from "../actions/staff-actions"
import { getPageRoles } from "@/features/settings/actions/role-actions"
import { StaffListItem } from "./StaffListItem"
import { Loader2 } from "lucide-react"

export default function StaffList() {
    const { data: users, isLoading: usersLoading, refetch } = useQuery({
        queryKey: ['staff-users'],
        queryFn: async () => await getUsers()
    })

    const { data: roles } = useQuery({
        queryKey: ['page-roles'],
        queryFn: async () => await getPageRoles()
    })

    if (usersLoading) {
        return (
            <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading staff...
            </div>
        )
    }

    if (!users?.length) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-lg text-gray-500">
                No staff members found.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="px-4 py-3 font-medium">S.N.</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Page View</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-700">
                    {users.map((user, index) => (
                        <StaffListItem
                            key={user.id}
                            user={user}
                            serialNumber={index + 1}
                            pageRoles={roles || []}
                            onUpdate={refetch}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}
