'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { getLedgerByToken, addLedgerComment } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'
import { Loader2, MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function PublicLedgerPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params)
    const searchParams = useSearchParams()
    const view = searchParams.get('view')
    
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [commentingId, setCommentingId] = useState<string | null>(null)
    const [commentText, setCommentText] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const res = await getLedgerByToken(token)
        if (res.error) {
            setError(res.error)
        } else {
            const validRes = res as any;
            if (view === 'recent' && validRes.ledger) {
                const zeroIndex = validRes.ledger.findIndex((e: any) => Number(e.running_amount) === 0)
                if (zeroIndex !== -1 && zeroIndex > 0) {
                    validRes.ledger = validRes.ledger.slice(0, zeroIndex)
                } else if (zeroIndex === 0) {
                    validRes.ledger = []
                }
            }
            setData(validRes)
        }
        setLoading(false)
    }, [token, view])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleAddComment = async (entryId: string, type: 'purchase' | 'transaction') => {
        if (!commentText.trim()) return
        setSubmitting(true)
        const res = await addLedgerComment({
            supplierId: data.shareInfo.supplier_id,
            purchaseId: type === 'purchase' ? entryId : undefined,
            transactionId: type === 'transaction' ? entryId : undefined,
            content: commentText,
            author: 'Supplier'
        })

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Comment added successfully.')
            setCommentText('')
            setCommentingId(null)
            fetchData()
        }
        setSubmitting(false)
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
            <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
    )

    if (error || !data) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
            <Card className="max-w-md w-full p-8 text-center space-y-4">
                <div className="flex justify-center">
                    <AlertCircle className="text-red-500 w-12 h-12" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{error || 'Ledger Not Found'}</h1>
                <p className="text-gray-500">This share link may have expired or is invalid.</p>
            </Card>
        </div>
    )

    const isWithin15Days = (dateStr: string) => {
        const transDate = new Date(dateStr)
        const now = new Date()
        const diff = Math.abs(now.getTime() - transDate.getTime())
        const days = diff / (1000 * 60 * 60 * 24)
        return days <= 15
    }

    const latestBalance = data.ledger[0]?.running_amount || 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-12">
            {/* Public Header */}
            <header className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-bold text-green-600 uppercase tracking-widest truncate">Verified Merchant Ledger</span>
                        </div>
                        <h1 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{data.supplierName}</h1>
                        <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">Transaction statement generated for your review</p>
                    </div>
                    <div className="shrink-0 text-right bg-blue-50 dark:bg-blue-900/10 p-2 md:p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <div className="text-[9px] md:text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-0.5 md:mb-1">Running Balance</div>
                        <div className={`text-base md:text-2xl font-bold ${latestBalance > 1 ? 'text-red-600' : latestBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            Rs {Math.abs(latestBalance).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                            <span className="text-[10px] md:text-sm font-medium ml-1">
                                {latestBalance > 1 ? '(Payable)' : latestBalance < -1 ? '(Receivable)' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <Card className="overflow-hidden border-none shadow-xl ring-1 ring-black/5 dark:ring-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="hidden md:table-header-group">
                                <tr className="bg-gray-100 dark:bg-zinc-800/50">
                                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b dark:border-zinc-800">Date</th>
                                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b dark:border-zinc-800">Particular</th>
                                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b dark:border-zinc-800 text-right">Debit (In)</th>
                                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b dark:border-zinc-800 text-right">Credit (Out)</th>
                                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b dark:border-zinc-800 text-right">Balance</th>
                                    <th className="px-2 py-4 border-b dark:border-zinc-800"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-800">
                                {data.ledger.map((entry: any) => {
                                    const eligibleForComment = isWithin15Days(entry.date)
                                    const hasComments = entry.comments && entry.comments.length > 0;
                                    const isHighlightRow = entry.debit === 0 && entry.credit === 0 && entry.type === 'purchase';
                                    
                                    return (
                                        <React.Fragment key={entry.id}>
                                            {/* Desktop Row */}
                                            <tr className={`hidden md:table-row group hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors ${isHighlightRow ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                                <td className="px-4 py-4 align-top">
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{new Date(entry.date).toLocaleDateString()}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase mt-1 tracking-tighter">{entry.type}</div>
                                                </td>
                                                <td className="px-4 py-4 align-top">
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
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium text-right align-top text-red-500">
                                                    {entry.debit > 0 ? `Rs ${entry.debit.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium text-right align-top text-green-600">
                                                    {entry.credit > 0 ? `Rs ${entry.credit.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-right align-top dark:text-gray-100">
                                                    Rs {Math.abs(entry.running_amount).toLocaleString()}
                                                </td>
                                                <td className="px-2 py-4 align-top text-right">
                                                    {eligibleForComment ? (
                                                        <button 
                                                            onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                            className={`p-2 transition-colors rounded-lg ${commentingId === entry.id ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                                            title="Add Comment"
                                                        >
                                                            <MessageSquare size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[9px] text-gray-300 font-medium italic select-none">Expired</span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Mobile Row */}
                                            <tr className={`md:hidden ${isHighlightRow ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                                <td colSpan={6} className="px-4 py-4 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{new Date(entry.date).toLocaleDateString()}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium uppercase mt-1 tracking-tighter">{entry.type}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold dark:text-gray-100">Bal: Rs {Math.abs(entry.running_amount).toLocaleString()}</div>
                                                            {eligibleForComment ? (
                                                                <button 
                                                                    onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                                    className={`mt-1 p-1.5 transition-colors rounded-lg ${commentingId === entry.id ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                                                    title="Add Comment"
                                                                >
                                                                    <MessageSquare size={14} />
                                                                </button>
                                                            ) : (
                                                                <div className="text-[9px] text-gray-300 font-medium italic select-none mt-1">Expired</div>
                                                            )}
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
                                                                 : 'text-gray-500 dark:text-gray-400'
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
                                                            <div className="text-[10px] font-bold text-gray-500 uppercase">In (Debit)</div>
                                                            <div className="text-sm font-medium text-red-500">
                                                                {entry.debit > 0 ? `Rs ${entry.debit.toLocaleString()}` : '-'}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 text-right">
                                                            <div className="text-[10px] font-bold text-gray-500 uppercase">Out (Credit)</div>
                                                            <div className="text-sm font-medium text-green-600">
                                                                {entry.credit > 0 ? `Rs ${entry.credit.toLocaleString()}` : '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Comment Section */}
                                            {(commentingId === entry.id || hasComments) && (
                                                <tr className="bg-gray-50/50 dark:bg-zinc-900/30">
                                                    <td colSpan={6} className="px-4 py-3">
                                                        <div className="ml-0 md:ml-8 space-y-3">
                                                            {/* Existing Comments */}
                                                            {entry.comments?.map((c: any) => (
                                                                <div key={c.id} className="flex items-start justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                                                                    <div>
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${c.author === 'Admin' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-400'}`}>
                                                                                {c.author}
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{c.content}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            
                                                            {/* New Comment Input */}
                                                            {commentingId === entry.id && (
                                                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                                                    <input 
                                                                        type="text" 
                                                                        value={commentText}
                                                                        onChange={(e) => setCommentText(e.target.value)}
                                                                        placeholder="Found a mistake? Let us know here..."
                                                                        className="flex-1 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                        autoFocus
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleAddComment(entry.id, entry.type)
                                                                        }}
                                                                    />
                                                                    <button 
                                                                        disabled={submitting || !commentText.trim()}
                                                                        onClick={() => handleAddComment(entry.id, entry.type)}
                                                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
                                                                    >
                                                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                                        <span className="text-xs font-bold uppercase hidden sm:inline">Send</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </main>

            <footer className="max-w-5xl mx-auto px-4 mt-8 pb-8 text-center space-y-4">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-800 to-transparent"></div>
                <p className="text-sm text-gray-400 font-medium">© {new Date().getFullYear()} Bagmati Traders. All rights reserved.</p>
                <div className="flex items-center justify-center gap-4 opacity-30">
                     <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Automated ERP Management System</span>
                </div>
            </footer>
        </div>
    )
}

import React from 'react'
