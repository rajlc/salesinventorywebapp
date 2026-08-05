"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Edit, Plus, Save, Trash2, X } from "lucide-react"
import { updateUserRole, updateUserStatus, bulkUpdateUserPermissions, getUserPermissions, deleteUser } from "../actions/staff-actions"
import type { UserProfile, UserPermission } from "../actions/staff-actions"
import type { PageRole } from "@/features/settings/actions/role-actions"
import { useQuery } from "@tanstack/react-query"

interface StaffListItemProps {
    user: UserProfile
    serialNumber: number
    pageRoles: PageRole[]
    onUpdate: () => void
}

export function StaffListItem({ user, serialNumber, pageRoles, onUpdate }: StaffListItemProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    
    // Staged State (only applied on save)
    const [stagedRole, setStagedRole] = useState(user.role)
    const [stagedStatus, setStagedStatus] = useState(user.status)
    const [stagedPermissions, setStagedPermissions] = useState<{ main_page_role: string, sub_page_role: string | null, permission_type: 'view' | 'edit' | 'all' }[]>([])

    // Permission selector state
    const [selectedMainRole, setSelectedMainRole] = useState<string>("")
    const [selectedSubRole, setSelectedSubRole] = useState<string>("")
    const [selectedType, setSelectedType] = useState<'view' | 'edit' | 'all'>('view')

    // Get user's current permissions
    const { data: serverPermissions, refetch: refetchPermissions } = useQuery({
        queryKey: ['user-permissions', user.id],
        queryFn: async () => await getUserPermissions(user.id)
    })

    // Sync staged state when entering edit mode or when server data changes
    useEffect(() => {
        if (!isEditing) {
            setStagedRole(user.role)
            setStagedStatus(user.status)
            if (serverPermissions) {
                setStagedPermissions(serverPermissions.map(p => ({
                    main_page_role: p.main_page_role || '',
                    sub_page_role: p.sub_page_role,
                    permission_type: p.permission_type
                })))
            }
        }
    }, [isEditing, user.role, user.status, serverPermissions])

    // Get unique main roles from pageRoles
    const mainRoles = Array.from(new Set(pageRoles.map(r => r.main_role)))

    // Get sub roles for selected main role
    const subRoles = pageRoles
        .filter(r => r.main_role === selectedMainRole && r.sub_role !== null)
        .map(r => r.sub_role as string)

    const handleAddStagedPermission = () => {
        if (!selectedMainRole) {
            alert('⚠️ Please select a Main Page Role')
            return
        }

        // Check for duplicate permission
        const isDuplicate = stagedPermissions.some(perm =>
            perm.main_page_role === selectedMainRole &&
            perm.sub_page_role === (selectedSubRole || null)
        )

        if (isDuplicate) {
            alert('⚠️ This page permission already exists!')
            return
        }

        setStagedPermissions([...stagedPermissions, {
            main_page_role: selectedMainRole,
            sub_page_role: selectedSubRole || null,
            permission_type: selectedType
        }])

        // Reset selectors
        setSelectedMainRole("")
        setSelectedSubRole("")
        setSelectedType('view')
    }

    const handleDelete = async () => {
        if (user.status === 'active') {
            alert('❌ Cannot delete an active user. Please set status to Disable first.')
            return
        }

        const confirmed = window.confirm(
            `⚠️ PERMANENT DELETE\n\nAre you sure you want to permanently delete "${displayName}"?\n\nThis action CANNOT be undone. The user will be removed from the database entirely, but they can sign up again with the same email.`
        )
        if (!confirmed) return

        setIsDeleting(true)
        try {
            await deleteUser(user.id)
            onUpdate()
        } catch (error: unknown) {
            console.error('Failed to delete user:', error)
            alert(`❌ Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleRemoveStagedPermission = (index: number) => {
        const newPerms = [...stagedPermissions]
        newPerms.splice(index, 1)
        setStagedPermissions(newPerms)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            if (stagedRole !== user.role) {
                await updateUserRole(user.id, stagedRole)
            }
            if (stagedStatus !== user.status) {
                await updateUserStatus(user.id, stagedStatus)
            }
            
            // If user is restricted, update permissions
            if (stagedRole === 'user' || stagedRole === 'new_user' || stagedRole === 'editor') {
                await bulkUpdateUserPermissions(user.id, stagedPermissions)
            }

            await refetchPermissions()
            onUpdate()
            setIsEditing(false)
            alert('✅ User updated successfully!')
        } catch (error) {
            console.error('Failed to save user updates:', error)
            alert('❌ Failed to save user updates')
        } finally {
            setIsSaving(false)
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

    // Determine what permissions to show
    const displayPermissions = isEditing ? stagedPermissions : (serverPermissions?.map(p => ({
        main_page_role: p.main_page_role || '',
        sub_page_role: p.sub_page_role,
        permission_type: p.permission_type
    })) || [])

    return (
        <tr className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            {/* S.N. */}
            <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100 align-top">
                {serialNumber}
            </td>

            {/* Name (clickable) */}
            <td className="px-4 py-4 align-top">
                <button
                    onClick={() => router.push(`/dashboard/staff-management/${user.id}`)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    {displayName}
                </button>
                {user.full_name && (
                    <div className="text-xs text-gray-500">{user.email}</div>
                )}
            </td>

            {/* Role */}
            <td className="px-4 py-4 align-top">
                {isEditing ? (
                    <select
                        value={stagedRole}
                        onChange={(e) => setStagedRole(e.target.value as 'admin' | 'editor' | 'user' | 'new_user')}
                        className="px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                    >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="user">User</option>
                        <option value="new_user">New User</option>
                    </select>
                ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 capitalize">
                        {user.role.replace('_', ' ')}
                    </span>
                )}
            </td>

            {/* Page View */}
            <td className="px-4 py-4 align-top min-w-[300px]">
                {(isEditing ? stagedRole : user.role) === 'admin' ? (
                    <div className="text-sm">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400">
                                ✨ All Pages (Admin)
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Admins have full access to all pages automatically</p>
                    </div>
                ) : isEditing ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 items-end">
                            {/* Main Page Role Dropdown */}
                            <div className="flex-1 min-w-[120px]">
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Main Page</label>
                                <select
                                    value={selectedMainRole}
                                    onChange={(e) => {
                                        setSelectedMainRole(e.target.value)
                                        setSelectedSubRole("") // Reset sub role when main changes
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                >
                                    <option value="">Select Main Role</option>
                                    {mainRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sub Page Role Dropdown */}
                            <div className="flex-1 min-w-[120px]">
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Sub Page</label>
                                <select
                                    value={selectedSubRole}
                                    onChange={(e) => setSelectedSubRole(e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
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
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Type</label>
                                <select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value as 'view' | 'edit' | 'all')}
                                    className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                >
                                    <option value="view">View</option>
                                    <option value="edit">Edit</option>
                                    <option value="all">All</option>
                                </select>
                            </div>

                            {/* Add Button */}
                            <button
                                onClick={handleAddStagedPermission}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} />
                                Add
                            </button>
                        </div>

                        {/* Show current permissions */}
                        {displayPermissions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 p-2 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-dashed dark:border-zinc-700">
                                {displayPermissions.map((perm, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white dark:bg-zinc-800 rounded-md border shadow-sm dark:border-zinc-600"
                                    >
                                        <span className="font-medium">{perm.main_page_role}</span>
                                        {perm.sub_page_role && <span className="text-gray-500">→ {perm.sub_page_role}</span>}
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                                            perm.permission_type === 'all' ? 'bg-purple-100 text-purple-700' :
                                            perm.permission_type === 'edit' ? 'bg-green-100 text-green-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {perm.permission_type}
                                        </span>
                                        <button 
                                            onClick={() => handleRemoveStagedPermission(idx)}
                                            className="ml-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full p-0.5 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {displayPermissions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {displayPermissions.map((perm, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-zinc-700/50 rounded border dark:border-zinc-700"
                                    >
                                        {perm.main_page_role}
                                        {perm.sub_page_role && ` → ${perm.sub_page_role}`}
                                        <span className="ml-1 text-[10px] text-gray-500 uppercase">({perm.permission_type})</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic">No page permissions assigned</span>
                        )}
                    </div>
                )}
            </td>

            {/* Status */}
            <td className="px-4 py-4 align-top">
                {isEditing ? (
                    <select
                        value={stagedStatus}
                        onChange={(e) => setStagedStatus(e.target.value as 'pending' | 'active' | 'disable')}
                        className="px-2 py-1 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                    >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="disable">Disable</option>
                    </select>
                ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded border capitalize ${getStatusColor(user.status)}`}>
                        {user.status}
                    </span>
                )}
            </td>

            {/* Action */}
            <td className="px-4 py-4 text-right align-top">
                {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                            <Save size={14} />
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-md transition-colors"
                            title="Edit User Details"
                        >
                            <Edit size={16} />
                        </button>

                        {/* Delete Button — only shown when status is 'disable' */}
                        {user.status === 'disable' && (
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-md transition-colors disabled:opacity-40"
                                title="Permanently Delete User (only for disabled users)"
                            >
                                {isDeleting ? (
                                    <span className="inline-block h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                            </button>
                        )}
                    </div>
                )}
            </td>
        </tr>
    )
}
