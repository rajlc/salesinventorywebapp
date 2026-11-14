'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { usePermissions } from '@/lib/permissions/PermissionContext'

export function ConnectorTokenCard() {
    const { userRole, hasPermission } = usePermissions()
    const canUseConnector = userRole === 'admin' || hasPermission('Daraz Listing')
    const [busy, setBusy] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['my-connector-tokens'],
        enabled: canUseConnector,
        queryFn: async () => {
            const res = await fetch('/api/connector-tokens')
            if (!res.ok) return { tokens: [], scope: null }
            return await res.json()
        }
    })

    if (!canUseConnector) return null

    const tokens = data?.tokens || []
    const scope = data?.scope || null
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

    const handleGenerate = async () => {
        setBusy(true)
        try {
            const res = await fetch('/api/connector-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'Personal AI Connector' })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to generate token')
            await refetch()
        } catch (err: any) {
            alert(err.message || 'Failed to generate token')
        } finally {
            setBusy(false)
        }
    }

    const handleRevoke = async (id: string) => {
        if (!window.confirm('Revoke this AI Connector token? Connected ChatGPT/Claude/Gemini sessions using it will stop working.')) return
        setBusy(true)
        try {
            await fetch(`/api/connector-tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
            await refetch()
        } finally {
            setBusy(false)
        }
    }

    const copyText = (value: string, key: string) => {
        navigator.clipboard.writeText(value)
        setCopiedKey(key)
        setTimeout(() => setCopiedKey(null), 2000)
    }

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-5 mb-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                        <KeyRound size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            AI Connector Token (ChatGPT / Claude / Gemini)
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Personal token scoped strictly to your permitted Daraz store(s).
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={busy}
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors self-start sm:self-auto"
                >
                    {tokens.length > 0 ? <RefreshCw size={13} /> : <Plus size={13} />}
                    {busy ? 'Generating...' : tokens.length > 0 ? 'Generate New Token' : 'Generate Token'}
                </button>
            </div>

            {scope && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 font-medium">
                        <ShieldCheck size={12} />
                        Allowed Stores: {scope.allowAllStores ? 'All Active Stores' : (scope.allowedStoreNames?.length ? scope.allowedStoreNames.join(', ') : 'None')}
                    </span>
                </div>
            )}

            {isLoading ? (
                <p className="text-xs text-gray-500">Loading connector tokens...</p>
            ) : tokens.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    No personal connector token yet. Click &ldquo;Generate Token&rdquo; to connect ChatGPT, Claude, or Gemini with your account&apos;s store permissions.
                </p>
            ) : (
                <div className="space-y-2">
                    {tokens.map((tok: any) => (
                        <div
                            key={tok.id}
                            className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 space-y-2 text-xs"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                    {tok.label} <span className="font-normal text-gray-400">({tok.token_preview})</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleRevoke(tok.id)}
                                    className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 font-medium"
                                >
                                    <Trash2 size={12} />
                                    Revoke
                                </button>
                            </div>

                            {tok.raw_token && (
                                <>
                                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 px-2.5 py-1.5 rounded border dark:border-zinc-700">
                                        <div className="truncate">
                                            <span className="text-gray-400 mr-1.5">Bearer Token:</span>
                                            <code className="font-mono text-indigo-600 dark:text-indigo-400">{tok.raw_token}</code>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(tok.raw_token, `tok-${tok.id}`)}
                                            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-1 shrink-0"
                                        >
                                            {copiedKey === `tok-${tok.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                                            {copiedKey === `tok-${tok.id}` ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 px-2.5 py-1.5 rounded border dark:border-zinc-700">
                                        <div className="truncate">
                                            <span className="text-gray-400 mr-1.5">MCP / Action URL:</span>
                                            <code className="font-mono text-emerald-600 dark:text-emerald-400">
                                                {`${appOrigin}/api/claude-connector?key=${tok.raw_token}`}
                                            </code>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(`${appOrigin}/api/claude-connector?key=${tok.raw_token}`, `url-${tok.id}`)}
                                            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-1 shrink-0"
                                        >
                                            {copiedKey === `url-${tok.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                                            {copiedKey === `url-${tok.id}` ? 'Copied' : 'Copy URL'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

