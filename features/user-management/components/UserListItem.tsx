"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit, Plus } from "lucide-react"
import { updateUserRole, updateUserStatus, addUserPermission, getUserPermissions } from "../actions/user-actions"
import type { UserProfile } from "../actions/user-actions"
import type { PageRole } from "@/features/settings/actions/role-actions"
import { useQuery } from "@tanstack/react-query"

interface UserListItemProps {
    user: UserProfile
    serialNumber: number
    pageRoles: PageRole[]
    onUpdate: () => void
}

export function UserListItem({ user, serialNumber, pageRoles, onUpdate }: UserListItemProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [role, setRole] = useState(user.role)
    const [status, setStatus] = useState(user.status)

    // Permission selector state
    const [selectedMainRole, setSelectedMainRole] = useState<string>("")
    const [selectedSubRole, setSelectedSubRole] = useState<string>("")
    const [selectedType, setSelectedType] = useState<'view' | 'edit' | 'all'>('view')

    // Get user's current permissions
    const { data: permissions } = useQuery({
        queryKey: ['user-permissions', user.id],
        queryFn: async () => await getUserPermissions(user.id),
        enabled: isEditing
    })

    // Get unique main roles from pageRoles
    const mainRoles = Array.from(new Set(pageRoles.map(r => r.main_role)))

    // Get sub roles for selected main role
    const subRoles = pageRoles
        .filter(r => r.main_role === selectedMainRole && r.sub_role !== null)
        .map(r => r.sub_role as string)

    const handleRoleChange = async (newRole: 'admin' | 'user') => {
        try {
            await updateUserRole(user.id, newRole)
            setRole(newRole)
            onUpdate()
        } catch (error) {
            console.error('Failed to update role:', error)
            alert('Failed to update role')
        }
    }

    const handleStatusChange = async (newStatus: 'pending' | 'active' | 'disable') => {
        try {
            await updateUserStatus(user.id, newStatus)
            setStatus(newStatus)
            onUpdate()
        } catch (error) {
            console.error('Failed to update status:', error)
            alert('Failed to update status')
        }
    }

    const handleAddPermission = async () => {
        if (!selectedMainRole) {
            alert('Please select a Main Page Role')
            return
        }

        try {
            await addUserPermission(
                user.id,
                selectedMainRole,
                selectedSubRole || null,
                selectedType
            )
            // Reset selectors
            setSelectedMainRole("")
            setSelectedSubRole("")
            setSelectedType('view')
            onUpdate()
        } catch (error) {
            console.error('Failed to add permission:', error)
            alert('Failed to add permission')
        }
    }

    const displayName = user.full_name || user.email

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
            case 'disable': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    return (
        <tr className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            {/* S.N. */}
            <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">
                {serialNumber}
            </td>

            {/* Name (clickable) */}
            <td className="px-4 py-4">
                <button
                    onClick={() => router.push(`/dashboard/user-management/${user.id}`)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    {displayName}
                </button>
                {user.full_name && (
                    <div className="text-xs text-gray-500">{user.email}</div>
                )}
            </td>

            {/* Role */}
            <td className="px-4 py-4">
                {isEditing ? (
                    <select
                        value={role}
                        onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'user')}
                        className="px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                    >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 capitalize">
                        {role}
                    </span>
                )}
            </td>

            {/* Page View */}
            <td className="px-4 py-4">
                {isEditing ? (
                    <div className="space-y-2">
                        <div className="flex gap-2 items-end">
                            {/* Main Page Role Dropdown */}
                            <div className="flex-1">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Main Page</label>
                                <select
                                    value={selectedMainRole}
                                    onChange={(e) => {
                                        setSelectedMainRole(e.target.value)
                                        setSelectedSubRole("") // Reset sub role when main changes
                                    }}
                                    className="w-full px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                >
                                    <option value="">Select Main Role</option>
                                    {mainRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sub Page Role Dropdown */}
                            <div className="flex-1">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Sub Page</label>
                                <select
                                    value={selectedSubRole}
                                    onChange={(e) => setSelectedSubRole(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                    disabled={!selectedMainRole || subRoles.length === 0}
                                >
                                    <option value="">Select Sub Role</option>
                                    {subRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Type Dropdown */}
                            <div className="w-24">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Type</label>
                                <select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value as 'view' | 'edit' | 'all')}
                                    className="w-full px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                >
                                    <option value="view">View</option>
                                    <option value="edit">Edit</option>
                                    <option value="all">All</option>
                                </select>
                            </div>

                            {/* Add Button */}
                            <button
                                onClick={handleAddPermission}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
                            >
                                <Plus size={14} />
                                Add
                            </button>
                        </div>

                        {/* Show current permissions */}
                        {permissions && permissions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {permissions.map(perm => (
                                    <span
                                        key={perm.id}
                                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-zinc-700 rounded border dark:border-zinc-600"
                                    >
                                        {perm.main_page_role}
                                        {perm.sub_page_role && ` → ${perm.sub_page_role}`}
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">({perm.permission_type})</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {permissions && permissions.length > 0 ? (
                            <span>{permissions.length} permission(s)</span>
                        ) : (
                            <span className="text-gray-400">No permissions</span>
                        )}
                    </div>
                )}
            </td>

            {/* Status */}
            <td className="px-4 py-4">
                {isEditing ? (
                    <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value as 'pending' | 'active' | 'disable')}
                        className="px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                    >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="disable">Disable</option>
                    </select>
                ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded border capitalize ${getStatusColor(status)}`}>
                        {status}
                    </span>
                )}
            </td>

            {/* Action */}
            <td className="px-4 py-4 text-right">
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-2 rounded-md transition-colors ${isEditing
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'
                        }`}
                    title={isEditing ? "Save" : "Edit"}
                >
                    <Edit size={16} />
                </button>
            </td>
        </tr>
    )
}
