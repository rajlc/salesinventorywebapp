"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Edit, KeyRound, Plus, RefreshCw, Save, Store, Trash2, X } from "lucide-react"
import { updateUserRole, updateUserStatus, bulkUpdateUserPermissions, getUserPermissions, deleteUser } from "../actions/staff-actions"
import type { UserProfile } from "../actions/staff-actions"
import type { PageRole } from "@/features/settings/actions/role-actions"
import { useQuery } from "@tanstack/react-query"

const DARAZ_LISTING_MAIN = "Daraz Listing"

type StagedPermission = {
    main_page_role: string
    sub_page_role: string | null
    permission_type: 'view' | 'edit' | 'all'
}

interface OnlineStoreOption {
    id: string
    seller_account: string
    seller_id?: string
    is_active?: boolean
}

interface StaffListItemProps {
    user: UserProfile
    serialNumber: number
    pageRoles: PageRole[]
    onlineStores?: OnlineStoreOption[]
    onUpdate: () => void
}

export function StaffListItem({ user, serialNumber, pageRoles, onlineStores = [], onUpdate }: StaffListItemProps) {
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
    const [selectedMultiStores, setSelectedMultiStores] = useState<string[]>([])
    const [selectedType, setSelectedType] = useState<'view' | 'edit' | 'all'>('view')

    // Per-staff AI Connector Token state
    const [showTokenPanel, setShowTokenPanel] = useState(false)
    const [tokenBusy, setTokenBusy] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    // Get user's current permissions
    const { data: serverPermissions, refetch: refetchPermissions } = useQuery({
        queryKey: ['user-permissions', user.id],
        queryFn: async () => await getUserPermissions(user.id)
    })

    // Get user's connector tokens
    const { data: tokenData, refetch: refetchTokens } = useQuery({
        queryKey: ['staff-connector-tokens', user.id],
        queryFn: async () => {
            const res = await fetch(`/api/connector-tokens?userId=${encodeURIComponent(user.id)}`)
            if (!res.ok) return { tokens: [] }
            return await res.json()
        }
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

    const storeAccountNames = onlineStores
        .map(s => (s.seller_account || '').trim())
        .filter(Boolean)

    // Always include "Daraz Listing" in Main Page Role options
    const mainRoles = Array.from(new Set([DARAZ_LISTING_MAIN, ...pageRoles.map(r => r.main_role)]))

    const isDarazListingSelected = selectedMainRole === DARAZ_LISTING_MAIN

    // Dynamic Sub Page options: if "Daraz Listing", list ["All", ...live stores]
    const subRoles = isDarazListingSelected
        ? ["All", ...storeAccountNames]
        : pageRoles
            .filter(r => r.main_role === selectedMainRole && r.sub_role !== null)
            .map(r => r.sub_role as string)

    const toggleMultiStoreSelection = (storeName: string) => {
        if (storeName === "All") {
            if (selectedMultiStores.includes("All")) {
                setSelectedMultiStores([])
                setSelectedSubRole("")
            } else {
                setSelectedMultiStores(["All"])
                setSelectedSubRole("All")
            }
            return
        }

        const withoutAll = selectedMultiStores.filter(s => s !== "All")
        const next = withoutAll.includes(storeName)
            ? withoutAll.filter(s => s !== storeName)
            : [...withoutAll, storeName]
        setSelectedMultiStores(next)
        setSelectedSubRole(next[0] || "")
    }

    const computeNextPermissions = (
        current: StagedPermission[],
        options: { silent?: boolean } = {}
    ): { next: StagedPermission[]; added: boolean; error?: string } => {
        if (!selectedMainRole) {
            return { next: current, added: false, error: options.silent ? undefined : '⚠️ Please select a Main Page Role' }
        }

        if (isDarazListingSelected) {
            const targets = selectedMultiStores.length > 0
                ? selectedMultiStores
                : (selectedSubRole ? [selectedSubRole] : [])

            if (targets.length === 0) {
                return {
                    next: current,
                    added: false,
                    error: '⚠️ Please select "All" or at least one Seller Account store under Daraz Listing.'
                }
            }

            let updated = [...current]

            if (targets.includes("All")) {
                // "All" replaces specific store rows under Daraz Listing
                updated = updated.filter(p => p.main_page_role !== DARAZ_LISTING_MAIN)
                updated.push({
                    main_page_role: DARAZ_LISTING_MAIN,
                    sub_page_role: "All",
                    permission_type: selectedType
                })
            } else {
                // Remove "All" if specific stores are being added
                updated = updated.filter(p => !(p.main_page_role === DARAZ_LISTING_MAIN && p.sub_page_role === "All"))
                for (const storeName of targets) {
                    const existsIdx = updated.findIndex(
                        p => p.main_page_role === DARAZ_LISTING_MAIN && p.sub_page_role === storeName
                    )
                    if (existsIdx >= 0) {
                        updated[existsIdx] = {
                            main_page_role: DARAZ_LISTING_MAIN,
                            sub_page_role: storeName,
                            permission_type: selectedType
                        }
                    } else {
                        updated.push({
                            main_page_role: DARAZ_LISTING_MAIN,
                            sub_page_role: storeName,
                            permission_type: selectedType
                        })
                    }
                }
            }

            return { next: updated, added: true }
        }

        // Check for duplicate permission
        const isDuplicate = current.some(perm =>
            perm.main_page_role === selectedMainRole &&
            perm.sub_page_role === (selectedSubRole || null)
        )

        if (isDuplicate) {
            return {
                next: current,
                added: false,
                error: options.silent ? undefined : '⚠️ This page permission already exists!'
            }
        }

        return {
            next: [...current, {
                main_page_role: selectedMainRole,
                sub_page_role: selectedSubRole || null,
                permission_type: selectedType
            }],
            added: true
        }
    }

    const handleAddStagedPermission = () => {
        const result = computeNextPermissions(stagedPermissions)
        if (result.error) {
            alert(result.error)
            return
        }
        if (result.added) {
            setStagedPermissions(result.next)
        }
        setSelectedMainRole("")
        setSelectedSubRole("")
        setSelectedMultiStores([])
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
        let finalPermissions = stagedPermissions

        if (
            (stagedRole === 'user' || stagedRole === 'new_user' || stagedRole === 'editor') &&
            selectedMainRole
        ) {
            const pendingResult = computeNextPermissions(stagedPermissions, { silent: true })
            if (pendingResult.error) {
                alert(pendingResult.error)
                return
            }
            if (pendingResult.added) {
                finalPermissions = pendingResult.next
                setStagedPermissions(finalPermissions)
                setSelectedMainRole("")
                setSelectedSubRole("")
                setSelectedMultiStores([])
                setSelectedType('view')
            }
        }

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
                await bulkUpdateUserPermissions(user.id, finalPermissions)
            }

            await refetchPermissions()
            await refetchTokens()
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

    const handleGenerateToken = async () => {
        setTokenBusy(true)
        try {
            const res = await fetch('/api/connector-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    label: `${displayName} Connector`
                })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to generate token')
            await refetchTokens()
            setShowTokenPanel(true)
        } catch (e: any) {
            alert(`❌ ${e.message}`)
        } finally {
            setTokenBusy(false)
        }
    }

    const handleRevokeToken = async (tokenId: string) => {
        if (!window.confirm('Revoke this AI Connector token? ChatGPT/Claude/Gemini using this token will lose access immediately.')) return
        setTokenBusy(true)
        try {
            await fetch(`/api/connector-tokens?id=${encodeURIComponent(tokenId)}`, { method: 'DELETE' })
            await refetchTokens()
        } finally {
            setTokenBusy(false)
        }
    }

    const copyText = (text: string, fieldKey: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(fieldKey)
        setTimeout(() => setCopiedField(null), 2000)
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

    const hasDarazListingPerm = user.role === 'admin' || displayPermissions.some(p => (p.main_page_role || '').toLowerCase() === 'daraz listing')
    const activeTokens = tokenData?.tokens || []
    const primaryToken = activeTokens[0] || null
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

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
                        {(user.role || 'user').replace('_', ' ')}
                    </span>
                )}
            </td>

            {/* Page View & AI Connector */}
            <td className="px-4 py-4 align-top min-w-[340px]">
                {(isEditing ? stagedRole : user.role) === 'admin' ? (
                    <div className="text-sm">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400">
                                ✨ All Pages & Stores (Admin)
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Admins have full access to all pages and Daraz stores automatically</p>
                    </div>
                ) : isEditing ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 items-end">
                            {/* Main Page Role Dropdown */}
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Main Page</label>
                                <select
                                    value={selectedMainRole}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setSelectedMainRole(val)
                                        setSelectedSubRole("")
                                        setSelectedMultiStores([])
                                        if (val === DARAZ_LISTING_MAIN) {
                                            setSelectedType('edit')
                                        }
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
                            <div className="flex-1 min-w-[150px]">
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                                    {isDarazListingSelected ? "Sub Page (Store)" : "Sub Page"}
                                </label>
                                <select
                                    value={selectedSubRole}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setSelectedSubRole(val)
                                        if (isDarazListingSelected) {
                                            setSelectedMultiStores(val ? [val] : [])
                                        }
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                                    disabled={!selectedMainRole || subRoles.length === 0}
                                >
                                    <option value="">{isDarazListingSelected ? "Select Store or All" : "Select Sub Role"}</option>
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

                        {/* Multi-Store Quick Selector when "Daraz Listing" is selected */}
                        {isDarazListingSelected && (
                            <div className="p-2.5 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                                        <Store size={13} />
                                        Choose Seller Account(s) (Multi-select or All):
                                    </span>
                                    <span className="text-[11px] text-orange-600 dark:text-orange-400">
                                        Click &ldquo;+ Add&rdquo; after selecting
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleMultiStoreSelection("All")}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                                            selectedMultiStores.includes("All")
                                                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                                : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700 hover:border-orange-400"
                                        }`}
                                    >
                                        All Stores ({storeAccountNames.length})
                                    </button>
                                    {storeAccountNames.map(storeName => {
                                        const checked = selectedMultiStores.includes(storeName) || selectedMultiStores.includes("All")
                                        return (
                                            <button
                                                key={storeName}
                                                type="button"
                                                onClick={() => toggleMultiStoreSelection(storeName)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1 ${
                                                    checked
                                                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                                        : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700 hover:border-orange-400"
                                                }`}
                                            >
                                                {checked && <Check size={11} />}
                                                {storeName}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

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
                                {displayPermissions.map((perm, idx) => {
                                    const isListing = (perm.main_page_role || '').toLowerCase() === 'daraz listing'
                                    return (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 text-xs rounded border ${
                                                isListing
                                                    ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800'
                                                    : 'bg-gray-100 dark:bg-zinc-700/50 dark:border-zinc-700'
                                            }`}
                                        >
                                            {perm.main_page_role}
                                            {perm.sub_page_role && ` → ${perm.sub_page_role}`}
                                            <span className="ml-1 text-[10px] opacity-75 uppercase">({perm.permission_type})</span>
                                        </span>
                                    )
                                })}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic">No page permissions assigned</span>
                        )}
                    </div>
                )}

                {/* Per-Staff AI Connector Token Box (for ChatGPT / Claude / Gemini) */}
                {hasDarazListingPerm && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-700/60">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setShowTokenPanel(!showTokenPanel)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
                            >
                                <KeyRound size={12} />
                                {primaryToken ? `AI Connector Token (${primaryToken.token_preview})` : 'AI Connector Token (ChatGPT / Claude / Gemini)'}
                            </button>
                            {!primaryToken && (
                                <button
                                    type="button"
                                    disabled={tokenBusy}
                                    onClick={handleGenerateToken}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    <Plus size={12} />
                                    {tokenBusy ? 'Generating...' : 'Generate Staff Token'}
                                </button>
                            )}
                        </div>

                        {showTokenPanel && (
                            <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        Scoped AI Connector Credentials ({displayName})
                                    </span>
                                    <button
                                        type="button"
                                        disabled={tokenBusy}
                                        onClick={handleGenerateToken}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-[11px]"
                                    >
                                        <RefreshCw size={10} />
                                        {primaryToken ? 'New Token' : 'Generate Token'}
                                    </button>
                                </div>
                                {primaryToken?.raw_token ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 px-2.5 py-1.5 rounded border dark:border-zinc-700">
                                            <div className="truncate">
                                                <span className="text-gray-400 mr-1.5">Bearer Token:</span>
                                                <code className="font-mono text-indigo-600 dark:text-indigo-400">{primaryToken.raw_token}</code>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => copyText(primaryToken.raw_token, `tok-${primaryToken.id}`)}
                                                    className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-1"
                                                >
                                                    {copiedField === `tok-${primaryToken.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                                                    {copiedField === `tok-${primaryToken.id}` ? 'Copied' : 'Copy Token'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevokeToken(primaryToken.id)}
                                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                                                    title="Revoke Token"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 px-2.5 py-1.5 rounded border dark:border-zinc-700">
                                            <div className="truncate">
                                                <span className="text-gray-400 mr-1.5">MCP / Action URL:</span>
                                                <code className="font-mono text-emerald-600 dark:text-emerald-400">
                                                    {`${appOrigin}/api/claude-connector?key=${primaryToken.raw_token}`}
                                                </code>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => copyText(`${appOrigin}/api/claude-connector?key=${primaryToken.raw_token}`, `url-${primaryToken.id}`)}
                                                className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-1 shrink-0"
                                            >
                                                {copiedField === `url-${primaryToken.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                                                {copiedField === `url-${primaryToken.id}` ? 'Copied' : 'Copy URL'}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-gray-500">
                                            Use this token as Bearer API Key in ChatGPT Actions / Gemini or paste the MCP URL in Claude. It only allows listing, editing, and pushing to this staff member&apos;s permitted store(s).
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500">
                                        No active personal connector token yet. Click &ldquo;Generate Token&rdquo; to create a store-scoped token for ChatGPT, Claude, or Gemini.
                                    </p>
                                )}
                            </div>
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
