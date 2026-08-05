'use client'

import React, { useState, use, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Share2, Trash2, Copy, Check, MessageSquare, Send } from 'lucide-react'
import { getSupplierFullLedger, createLedgerShare, deleteLedgerComment, addLedgerComment } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'
import { useDashboard } from '@/app/dashboard/context'
import { toast } from 'sonner'

export default function SupplierLedgerPage({ params }: { params: Promise<{ supplierId: string }> }) {
    const { supplierId } = use(params)
    const searchParams = useSearchParams()
    const fiscalYearId = searchParams.get('fiscalYearId') || undefined
    const paramSupplierName = searchParams.get('supplierName') ? decodeURIComponent(searchParams.get('supplierName')!) : null
    const { setHeaderTitle } = useDashboard()
    const queryClient = useQueryClient()

    // State
    const [isSharing, setIsSharing] = useState(false)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const [copiedFull, setCopiedFull] = useState(false)
    const [copiedRecent, setCopiedRecent] = useState(false)
    const [commentingId, setCommentingId] = useState<string | null>(null)
    const [commentText, setCommentText] = useState('')

    // Set Global Header Title
    useEffect(() => {
        if (setHeaderTitle && paramSupplierName) {
            setHeaderTitle(`${paramSupplierName} - Ledger`)
        }
        return () => {
            if (setHeaderTitle) setHeaderTitle(null)
        }
    }, [setHeaderTitle, paramSupplierName])

    // Fetch Ledger Data
    const { data: ledgerData, isLoading } = useQuery({
        queryKey: ['supplier-full-ledger', supplierId, fiscalYearId],
        queryFn: () => getSupplierFullLedger({ supplierId, fiscalYearId })
    })

    // Mutations
    const shareMutation = useMutation({
        mutationFn: () => createLedgerShare({ supplierId, fiscalYearId }),
        onSuccess: (res) => {
            if (res.share) {
                const url = `${window.location.hostname === 'localhost' ? 'http://' : 'https://'}${window.location.host}/share/ledger/${res.share.token}`
                setShareUrl(url)
                setIsSharing(true)
            } else {
                toast.error(res.error)
            }
        }
    })

    const deleteCommentMutation = useMutation({
        mutationFn: (id: string) => deleteLedgerComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier-full-ledger'] })
            toast.success('Comment removed.')
        }
    })

    const addCommentMutation = useMutation({
        mutationFn: (data: any) => addLedgerComment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier-full-ledger'] })
            setCommentingId(null)
            setCommentText('')
            toast.success('Comment added.')
        }
    })

    const ledger = ledgerData?.ledger || []
    const supplierName = ledgerData?.supplierName || paramSupplierName || 'Loading...'
    const runningBalance = ledger.length > 0 ? ledger[0].running_amount : 0

    const copyUrl = (url: string, type: 'full' | 'recent') => {
        if (url) {
            navigator.clipboard.writeText(url)
            if (type === 'full') {
                setCopiedFull(true)
                setTimeout(() => setCopiedFull(false), 2000)
            } else {
                setCopiedRecent(true)
                setTimeout(() => setCopiedRecent(false), 2000)
            }
            toast.success('Link copied to clipboard.')
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/suppliers/suppliers-account/${supplierId}?fiscalYearId=${fiscalYearId || ''}`}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{supplierName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Complete Ledger History</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={() => shareMutation.mutate()}
                        disabled={shareMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                        {shareMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                        Share Ledger
                    </button>

                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                        <div className={`text-xl font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-2 z-10">
                <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                    <div className={`text-lg font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className="p-4 flex-1 overflow-auto">
                {/* Ledger Table */}
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : ledger.length === 0 ? (
                    <div className="h-64 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border">
                        <p className="text-gray-500">No transactions found</p>
                    </div>
                ) : (
                    <Card className="overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="hidden md:table-header-group bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Particular</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Debit</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Credit</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Running Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {ledger.map((entry: any) => {
                                        const isZeroAmount = entry.type === 'purchase' && Number(entry.debit) === 0 && Number(entry.credit) === 0;
                                        return (
                                            <React.Fragment key={entry.id}>
                                                {/* Desktop Row */}
                                                <tr className={`hidden md:table-row hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${isZeroAmount ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap align-top">
                                                        {new Date(entry.date).toLocaleDateString('en-GB')}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm align-top">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                                {entry.particular}
                                                                {entry.quantity !== undefined && entry.quantity > 0 && (
                                                                    <span className="ml-2 text-xs text-blue-500 dark:text-blue-400 font-bold uppercase">
                                                                        ({entry.quantity} × {entry.unit_amount})
                                                                    </span>
                                                                )}
                                                                {entry.particular_detail && (
                                                                    <div className={`text-[11px] px-1.5 py-0.5 rounded font-semibold block w-fit mt-1 ${
                                                                        entry.particular_detail.toLowerCase().includes('sell')
                                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                            : entry.particular_detail.toLowerCase().includes('buy')
                                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                            : 'text-gray-500 dark:text-gray-400'
                                                                    }`}>
                                                                        {entry.particular_detail}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${commentingId === entry.id ? 'text-blue-600' : 'text-gray-400'}`}
                                                            >
                                                                <MessageSquare size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600 align-top">
                                                        {entry.debit > 0 ? `Rs ${Number(entry.debit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600 align-top">
                                                        {entry.credit > 0 ? `Rs ${Number(entry.credit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className={`px-4 py-3 text-sm text-right font-bold align-top ${entry.running_amount > 1 ? 'text-red-600' : entry.running_amount < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                                                        Rs {Number(entry.running_amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>

                                                {/* Mobile Row */}
                                                <tr className={`md:hidden ${isZeroAmount ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                    <td colSpan={5} className="px-4 py-4 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{new Date(entry.date).toLocaleDateString('en-GB')}</div>
                                                                <div className="text-[10px] text-gray-500 font-medium uppercase mt-1 tracking-tighter">{entry.type}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-sm font-bold ${entry.running_amount > 1 ? 'text-red-600' : entry.running_amount < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                                                                    Rs {Number(entry.running_amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                                </div>
                                                                <button
                                                                    onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                                    className={`mt-1 p-1.5 transition-colors rounded-lg inline-block ${commentingId === entry.id ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                                                >
                                                                    <MessageSquare size={14} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">{entry.particular}</div>
                                                            {entry.particular_detail && (
                                                                <div className={`text-[11px] px-1.5 py-0.5 rounded font-semibold block w-fit mt-1 ${
                                                                    entry.particular_detail.toLowerCase().includes('sell')
                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                        : entry.particular_detail.toLowerCase().includes('buy')
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                        : 'text-gray-500'
                                                                }`}>
                                                                    {entry.particular_detail}
                                                                </div>
                                                            )}
                                                            {entry.quantity !== undefined && entry.quantity > 0 && (
                                                                <div className="text-[10px] font-bold text-blue-500 mt-1 uppercase">
                                                                    Qty: {entry.quantity} × {entry.unit_amount}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-4 pt-2 border-t dark:border-zinc-800/50">
                                                            <div className="flex-1">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase">Debit</div>
                                                                <div className="text-sm font-medium text-red-500">
                                                                    {entry.debit > 0 ? `Rs ${Number(entry.debit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 text-right">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase">Credit</div>
                                                                <div className="text-sm font-medium text-green-600">
                                                                    {entry.credit > 0 ? `Rs ${Number(entry.credit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Comments Section */}
                                                {(commentingId === entry.id || (entry.comments && entry.comments.length > 0)) && (
                                                    <tr className="bg-gray-50/30 dark:bg-zinc-800/20">
                                                        <td colSpan={5} className="px-4 py-3">
                                                            <div className="ml-8 space-y-3">
                                                                {entry.comments?.map((c: any) => (
                                                                    <div key={c.id} className="flex items-start justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                                                                        <div>
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${c.author === 'Admin' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-400'}`}>
                                                                                    {c.author}
                                                                                </span>
                                                                                <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                                                                            </div>
                                                                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{c.content}</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => deleteCommentMutation.mutate(c.id)}
                                                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                                            title="Delete Comment"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                {commentingId === entry.id && (
                                                                    <div className="flex gap-2 items-center">
                                                                        <input
                                                                            type="text"
                                                                            value={commentText}
                                                                            onChange={(e) => setCommentText(e.target.value)}
                                                                            placeholder="Reply to supplier or add a note..."
                                                                            className="flex-1 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                            autoFocus
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    addCommentMutation.mutate({
                                                                                        supplierId,
                                                                                        purchaseId: entry.type === 'purchase' ? entry.id : undefined,
                                                                                        transactionId: entry.type === 'transaction' ? entry.id : undefined,
                                                                                        content: commentText,
                                                                                        author: 'Admin'
                                                                                    })
                                                                                }
                                                                            }}
                                                                        />
                                                                        <button
                                                                            disabled={addCommentMutation.isPending || !commentText.trim()}
                                                                            onClick={() => addCommentMutation.mutate({
                                                                                supplierId,
                                                                                purchaseId: entry.type === 'purchase' ? entry.id : undefined,
                                                                                transactionId: entry.type === 'transaction' ? entry.id : undefined,
                                                                                content: commentText,
                                                                                author: 'Admin'
                                                                            })}
                                                                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-md transition-colors"
                                                                        >
                                                                            {addCommentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>

            {/* Share Modal */}
            {isSharing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                    <Card className="w-full max-w-md p-6 bg-white dark:bg-zinc-900 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shareable Ledger Link</h2>
                            <button onClick={() => setIsSharing(false)} className="text-gray-400 hover:text-gray-500">×</button>
                        </div>

                        <div className="space-y-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Copy a link below and send it to <strong>{supplierName}</strong>. They will be able to view their ledger.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">1. Full Ledger Link</h3>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-md text-sm text-gray-600 dark:text-gray-400 truncate">
                                            {shareUrl}
                                        </div>
                                        <button
                                            onClick={() => copyUrl(shareUrl as string, 'full')}
                                            className={`px-3 py-2 rounded-md border flex items-center justify-center transition-all ${copiedFull ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700'}`}
                                        >
                                            {copiedFull ? <Check size={18} /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Shows the entire history.</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">2. Unsettled Transactions Link</h3>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-md text-sm text-gray-600 dark:text-gray-400 truncate">
                                            {shareUrl}?view=recent
                                        </div>
                                        <button
                                            onClick={() => copyUrl(`${shareUrl}?view=recent`, 'recent')}
                                            className={`px-3 py-2 rounded-md border flex items-center justify-center transition-all ${copiedRecent ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700'}`}
                                        >
                                            {copiedRecent ? <Check size={18} /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Filters out past settled transactions (starts after the last 0 balance).</p>
                                </div>
                            </div>

                            <p className="text-[10px] text-zinc-400 font-medium">
                                * Links will expire in 30 days for security. Anyone with the link can view the ledger.
                            </p>
                        </div>

                        <button
                            onClick={() => setIsSharing(false)}
                            className="w-full py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-bold rounded-md transition-colors"
                        >
                            Done
                        </button>
                    </Card>
                </div>
            )}
        </div>
    )
}
