"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPageRoles, seedDefaultRoles } from "../actions/role-actions"
import { Search, RefreshCw, CheckCircle2 } from "lucide-react"

export default function RoleList() {
    const [search, setSearch] = useState("")
    const [seeded, setSeeded] = useState(false)
    const queryClient = useQueryClient()

    const { data: roles, isLoading } = useQuery({
        queryKey: ['page-roles'],
        queryFn: async () => await getPageRoles()
    })

    const seedMutation = useMutation({
        mutationFn: async () => await seedDefaultRoles(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['page-roles'] })
            setSeeded(true)
            setTimeout(() => setSeeded(false), 3000)
        }
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading permissions...
            </div>
        )
    }

    // Filter and group roles
    const filteredRoles = (roles || []).filter(role =>
        role.main_role.toLowerCase().includes(search.toLowerCase()) ||
        (role.sub_role && role.sub_role.toLowerCase().includes(search.toLowerCase())) ||
        (role.page_url && role.page_url.toLowerCase().includes(search.toLowerCase()))
    )

    const groupedRoles = filteredRoles.reduce((acc, role) => {
        if (!acc[role.main_role]) {
            acc[role.main_role] = []
        }
        acc[role.main_role].push(role)
        return acc
    }, {} as Record<string, typeof filteredRoles>)

    let globalIndex = 1

    return (
        <div className="flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10 rounded-t-lg flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search roles or routes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                    />
                </div>

                <button
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium transition-all ${
                        seeded
                            ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                    }`}
                >
                    {seedMutation.isPending ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : seeded ? (
                        <CheckCircle2 size={14} />
                    ) : (
                        <RefreshCw size={14} />
                    )}
                    {seedMutation.isPending ? 'Seeding...' : seeded ? 'All Permissions Loaded!' : 'Seed All Permissions'}
                </button>

                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {(roles || []).length} total permissions
                </span>
            </div>

            {/* Empty state */}
            {!roles?.length && (
                <div className="p-12 text-center border-2 border-dashed rounded-b-lg text-gray-500 dark:border-zinc-700">
                    <p className="font-medium mb-2">No permissions found in database.</p>
                    <p className="text-sm mb-4">Click <strong>&quot;Seed All Permissions&quot;</strong> above to populate all 37 system permissions.</p>
                </div>
            )}

            {/* Table */}
            {(roles?.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase text-xs sticky top-[73px] z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 font-medium w-16">S.N.</th>
                                <th className="px-6 py-3 font-medium w-40">Main Page</th>
                                <th className="px-6 py-3 font-medium">Sub Page / Permission</th>
                                <th className="px-6 py-3 font-medium">Route Path</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {Object.entries(groupedRoles).map(([mainRole, subRoles]) => (
                                <React.Fragment key={mainRole}>
                                    {/* Main Role Header Row */}
                                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-t-2 border-blue-100 dark:border-blue-900/30">
                                        <td colSpan={4} className="px-6 py-2 font-bold text-blue-700 dark:text-blue-400">
                                            {mainRole}{' '}
                                            <span className="text-xs font-normal text-gray-500 ml-2">
                                                ({subRoles.length} permission{subRoles.length !== 1 ? 's' : ''})
                                            </span>
                                        </td>
                                    </tr>
                                    {/* Sub Roles Rows */}
                                    {subRoles.map((role) => (
                                        <tr
                                            key={role.id}
                                            className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
                                        >
                                            <td className="px-6 py-3 font-medium text-gray-400 dark:text-gray-500 text-xs">
                                                {globalIndex++}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                                {role.main_role}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">
                                                {role.sub_role || '—'}
                                            </td>
                                            <td className="px-6 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                                                {role.page_url || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    {Object.keys(groupedRoles).length === 0 && search && (
                        <div className="p-8 text-center text-gray-500">
                            No permissions match your search &quot;{search}&quot;.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
