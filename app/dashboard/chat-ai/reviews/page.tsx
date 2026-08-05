'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
    syncDarazReviews,
    replyToReview,
    bulkReplyToReviews,
    getReviewSettings,
    generateSingleReviewSuggestion,
    type ReviewSettings
} from '@/features/reviews/actions/review-actions'
import {
    Star,
    RefreshCw,
    ShoppingBag,
    Search,
    CheckSquare,
    Square,
    MessageSquare,
    AlertCircle,
    Store,
    Send,
    ThumbsUp,
    ChevronDown,
    Check,
    Bot
} from 'lucide-react'
import { toast } from 'sonner'

interface OnlineStore {
    id: string
    company_name: string
    seller_account: string
}

interface Review {
    id: string
    review_id: string
    store_id: string
    order_id: string | null
    item_id: string
    product_name: string | null
    product_image: string | null
    rating: number
    review_content: string | null
    buyer_name: string | null
    reply_content: string | null
    reply_status: 'pending' | 'replied' | 'failed'
    replied_at: string | null
    auto_replied: boolean
    suggested_reply: string | null
    suggested_reply_source: string | null
    created_at: string
    synced_at: string
}

export default function ReviewsDashboard() {
    const [stores, setStores] = useState<OnlineStore[]>([])
    const [activeStoreId, setActiveStoreId] = useState<string>('')
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'replied' | 'failed'>('all')

    // Selected review IDs for bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkReplyText, setBulkReplyText] = useState('')
    const [submittingBulk, setSubmittingBulk] = useState(false)

    // Individual reply text fields
    const [individualReplies, setIndividualReplies] = useState<Record<string, string>>({})
    const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({})
    
    // Suggestion settings and state
    const [reviewSettings, setReviewSettings] = useState<ReviewSettings | null>(null)
    const [generatingSuggestion, setGeneratingSuggestion] = useState<Record<string, boolean>>({})

    // 1. Fetch initial store list
    useEffect(() => {
        async function fetchStores() {
            const { data, error } = await supabase
                .from('online_stores')
                .select('*')
                .order('company_name')

            if (error) {
                toast.error('Failed to load stores')
                console.error(error)
            } else {
                setStores(data || [])
                if (data && data.length > 0) {
                    setActiveStoreId(data[0].id)
                }
            }
        }
        fetchStores()
    }, [])

    // 1.5 Load settings for active store
    useEffect(() => {
        if (!activeStoreId) return
        async function loadSettings() {
            try {
                const s = await getReviewSettings(activeStoreId)
                setReviewSettings(s)
            } catch (err) {
                console.error('Failed to load store review settings:', err)
            }
        }
        loadSettings()
    }, [activeStoreId])

    // 2. Fetch reviews and subscribe to Realtime updates for the active store
    useEffect(() => {
        if (!activeStoreId) return

        async function fetchReviews() {
            setLoading(true)
            const { data, error } = await supabase
                .from('daraz_reviews')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching reviews:', error.message)
                toast.error('Failed to load reviews')
            } else {
                setReviews(data || [])
            }
            setLoading(false)
        }
        fetchReviews()

        // Realtime Subscription
        const channel = supabase
            .channel(`realtime:reviews:${activeStoreId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'daraz_reviews',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setReviews(prev => {
                        if (prev.some(r => r.review_id === payload.new.review_id)) return prev
                        return [payload.new as Review, ...prev].sort((a, b) => 
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        )
                    })
                } else if (payload.eventType === 'UPDATE') {
                    setReviews(prev => prev.map(r => r.review_id === payload.new.review_id ? { ...r, ...payload.new } as Review : r))
                } else if (payload.eventType === 'DELETE') {
                    setReviews(prev => prev.filter(r => r.review_id !== payload.old.review_id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeStoreId])

    // Manual reviews sync trigger
    const handleSyncReviews = async () => {
        if (!activeStoreId) return
        setSyncing(true)
        toast.info('Syncing customer reviews from Daraz...')
        try {
            const res = await syncDarazReviews(activeStoreId)
            if (res.success) {
                toast.success(`Successfully synced ${res.count} reviews!`)
            } else {
                toast.error(res.error || 'Failed to sync reviews.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Review sync failed.')
        } finally {
            setSyncing(false)
        }
    }

    // Toggle select item for bulk actions
    const toggleSelectReview = (reviewId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(reviewId)) {
                next.delete(reviewId)
            } else {
                next.add(reviewId)
            }
            return next
        })
    }

    // Toggle select all visible reviews (only actionable ones)
    const toggleSelectAll = (visibleReviews: Review[]) => {
        const actionableIds = visibleReviews
            .filter(r => r.reply_status !== 'replied' && r.review_content && r.review_content.trim())
            .map(r => r.review_id)
        if (actionableIds.length === 0) return

        const allSelected = actionableIds.every(id => selectedIds.has(id))

        setSelectedIds(prev => {
            const next = new Set(prev)
            if (allSelected) {
                actionableIds.forEach(id => next.delete(id))
            } else {
                actionableIds.forEach(id => next.add(id))
            }
            return next
        })
    }

    // Submit single reply
    const handleSubmitSingleReply = async (reviewId: string) => {
        const content = individualReplies[reviewId]?.trim()
        if (!content) return

        setSubmittingReply(prev => ({ ...prev, [reviewId]: true }))
        try {
            const res = await replyToReview(activeStoreId, reviewId, content)
            if (res.success) {
                toast.success('Reply submitted successfully!')
                setIndividualReplies(prev => {
                    const next = { ...prev }
                    delete next[reviewId]
                    return next
                })
            } else {
                toast.error(res.error || 'Failed to submit reply.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error submitting reply.')
        } finally {
            setSubmittingReply(prev => ({ ...prev, [reviewId]: false }))
        }
    }
    // Generate single suggestion
    const handleGenerateSuggestion = async (reviewId: string) => {
        if (!activeStoreId) return
        setGeneratingSuggestion(prev => ({ ...prev, [reviewId]: true }))
        toast.info('Generating AI reply suggestion...')
        try {
            const res = await generateSingleReviewSuggestion(activeStoreId, reviewId)
            if (res.success && res.suggested_reply) {
                toast.success('AI suggestion generated successfully!')
                // Update local reviews state so it renders immediately
                setReviews(prev => prev.map(r => r.review_id === reviewId ? { ...r, suggested_reply: res.suggested_reply, suggested_reply_source: 'ai' } as Review : r))
            } else {
                toast.error(res.error || 'Failed to generate suggestion.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error generating suggestion.')
        } finally {
            setGeneratingSuggestion(prev => ({ ...prev, [reviewId]: false }))
        }
    }

    // Submit suggested reply directly without editing
    const handleSubmitSuggestedReply = async (reviewId: string, suggestedReplyText: string) => {
        if (!suggestedReplyText.trim()) return
        setSubmittingReply(prev => ({ ...prev, [reviewId]: true }))
        toast.info('Sending suggested reply...')
        try {
            const res = await replyToReview(activeStoreId, reviewId, suggestedReplyText)
            if (res.success) {
                toast.success('Reply submitted successfully!')
            } else {
                toast.error(res.error || 'Failed to submit reply.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error submitting reply.')
        } finally {
            setSubmittingReply(prev => ({ ...prev, [reviewId]: false }))
        }
    }

    // Local keyword sentiment templates matcher
    const getTemplateSuggestions = (reviewContent: string | null, settings: ReviewSettings | null) => {
        if (!reviewContent || !settings) return { templates: [], note: '' }
        const content = reviewContent.toLowerCase().trim()
        
        const posKeywords = settings.positive_keywords || []
        const neuKeywords = settings.neutral_keywords || []
        const negKeywords = settings.negative_keywords || []

        const matchesPositive = posKeywords.some((w: string) => content.includes(w))
        const matchesNeutral = neuKeywords.some((w: string) => content.includes(w))
        const matchesNegative = negKeywords.some((w: string) => content.includes(w))

        if (matchesNegative) {
            return {
                templates: settings.negative_templates || [],
                note: '🚨 Negative keyword detected. Suggested apology templates:'
            }
        }
        if (matchesNeutral) {
            return {
                templates: settings.neutral_templates || [],
                note: 'ℹ️ Neutral keyword detected. Suggested neutral templates:'
            }
        }
        if (matchesPositive) {
            return {
                templates: settings.positive_templates || [],
                note: '✨ Positive keyword detected. Suggested thank-you templates:'
            }
        }

        return { templates: [], note: '' }
    }
    // Submit bulk replies
    const handleBulkReply = async () => {
        if (selectedIds.size === 0 || !bulkReplyText.trim()) return

        setSubmittingBulk(true)
        const reviewIds = Array.from(selectedIds)
        toast.info(`Sending bulk reply to ${reviewIds.length} reviews...`)

        try {
            const res = await bulkReplyToReviews(activeStoreId, reviewIds, bulkReplyText)
            if (res.success) {
                toast.success(`Bulk reply processed. Check individual logs if any failed.`)
                setSelectedIds(new Set())
                setBulkReplyText('')
            } else {
                toast.error(res.error || 'Bulk reply submission failed.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error processing bulk reply.')
        } finally {
            setSubmittingBulk(false)
        }
    }

    // Filter reviews
    const filteredReviews = reviews.filter(rev => {
        // Search filter
        const textToSearch = `${rev.buyer_name || ''} ${rev.order_id || ''} ${rev.product_name || ''} ${rev.review_content || ''}`.toLowerCase()
        const matchesSearch = textToSearch.includes(searchQuery.toLowerCase())

        // Rating filter
        const matchesRating = ratingFilter === 'all' || rev.rating === ratingFilter

        // Status filter
        let matchesStatus = false
        if (statusFilter === 'all') {
            matchesStatus = true
        } else if (statusFilter === 'pending') {
            matchesStatus = rev.reply_status === 'pending' && !!(rev.review_content && rev.review_content.trim())
        } else {
            matchesStatus = rev.reply_status === statusFilter
        }

        return matchesSearch && matchesRating && matchesStatus
    })

    const activeStore = stores.find(s => s.id === activeStoreId)

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-50 dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Header section */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400">
                        Product Reviews
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Track, analyze, and reply to Daraz product ratings and comments.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Store Selector */}
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1.5 border border-zinc-200 dark:border-zinc-700">
                        <Store size={16} className="text-zinc-500 ml-2" />
                        <select
                            value={activeStoreId}
                            onChange={(e) => {
                                setActiveStoreId(e.target.value)
                                setSelectedIds(new Set())
                            }}
                            className="bg-transparent border-0 text-sm font-medium focus:ring-0 text-zinc-700 dark:text-zinc-200 cursor-pointer pr-8 focus:outline-none"
                        >
                            {stores.map((s) => (
                                <option key={s.id} value={s.id} className="dark:bg-zinc-900">
                                    {s.company_name} ({s.seller_account})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sync Trigger */}
                    <button
                        onClick={handleSyncReviews}
                        disabled={syncing || !activeStoreId}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-lg shadow transition-all active:scale-95
                            ${syncing || !activeStoreId
                                ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                            }`}
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Reviews'}
                    </button>
                </div>
            </div>

            {/* Filter and search utilities */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-4 flex flex-col md:flex-row gap-3 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search buyer name, order number, product name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full text-sm bg-zinc-55 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-700 dark:text-zinc-200"
                    />
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap">
                    {/* Rating filter select */}
                    <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        <option value="all">All Ratings</option>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                    </select>

                    {/* Status filter select */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Reply</option>
                        <option value="replied">Replied</option>
                        <option value="failed">Failed Reply</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions Panel (Visible only when reviews are selected) */}
            {selectedIds.size > 0 && (
                <div className="bg-purple-50/50 dark:bg-purple-950/10 border-b border-purple-100 dark:border-purple-900/30 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 transition-all animate-slideDown">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-purple-600 text-white rounded-full px-2.5 py-0.5 shadow-sm">
                            {selectedIds.size} SELECTED
                        </span>
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                            Apply bulk action to selected reviews
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Enter bulk response content..."
                            value={bulkReplyText}
                            onChange={(e) => setBulkReplyText(e.target.value)}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs flex-1 md:w-80 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                        />
                        <button
                            onClick={handleBulkReply}
                            disabled={submittingBulk || !bulkReplyText.trim()}
                            className="px-4 py-1.5 bg-purple-650 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1 shrink-0 disabled:opacity-50 transition-all"
                        >
                            <Send size={12} />
                            {submittingBulk ? 'Sending...' : 'Bulk Reply'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main scrollable reviews workspace list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-xs">
                        <RefreshCw size={24} className="animate-spin mb-2 text-zinc-450" />
                        <span>Loading reviews...</span>
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                        <ShoppingBag size={32} className="text-zinc-400 mb-2" />
                        <span>No reviews match the current filters.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Select All Checkbox */}
                        {filteredReviews.some(r => r.reply_status !== 'replied' && r.review_content && r.review_content.trim()) && (
                            <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-zinc-500">
                                <button
                                    onClick={() => toggleSelectAll(filteredReviews)}
                                    className="flex items-center gap-1.5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    {filteredReviews
                                        .filter(r => r.reply_status !== 'replied' && r.review_content && r.review_content.trim())
                                        .every(r => selectedIds.has(r.review_id)) ? (
                                            <CheckSquare size={16} className="text-purple-600" />
                                        ) : (
                                            <Square size={16} />
                                        )}
                                    <span>Select All Actionable ({filteredReviews.filter(r => r.reply_status !== 'replied' && r.review_content && r.review_content.trim()).length})</span>
                                </button>
                            </div>
                        )}

                        {/* List cards */}
                        {filteredReviews.map((rev) => {
                            const isSelected = selectedIds.has(rev.review_id)
                            const replyContentInput = individualReplies[rev.review_id] || ''
                            const isIndividualSubmitting = submittingReply[rev.review_id] || false

                            return (
                                <div
                                    key={rev.review_id}
                                    className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm transition-all flex flex-col md:flex-row gap-4 ${
                                        isSelected 
                                            ? 'border-purple-500/50 bg-purple-500/[0.02] dark:bg-purple-500/[0.01]' 
                                            : 'border-zinc-250 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                    }`}
                                >
                                    {/* Select Box / Bullet */}
                                    <div className="shrink-0 w-[26px]">
                                        {rev.reply_status !== 'replied' && rev.review_content && rev.review_content.trim() ? (
                                            <button
                                                onClick={() => toggleSelectReview(rev.review_id)}
                                                className="p-1 text-zinc-450 hover:text-purple-600 transition-colors"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare size={18} className="text-purple-600" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        ) : (
                                            <div className="w-[26px] h-6" />
                                        )}
                                    </div>

                                    {/* Product Details Section */}
                                    <div className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-3">
                                        <div className="h-14 w-14 md:h-20 md:w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                            {rev.product_image ? (
                                                <img
                                                    src={rev.product_image}
                                                    alt={rev.product_name || 'Product'}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <ShoppingBag size={20} className="text-zinc-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 md:space-y-1">
                                            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 line-clamp-2 md:line-clamp-3 hover:text-purple-600 cursor-default" title={rev.product_name || ''}>
                                                {rev.product_name || 'Unknown Product'}
                                            </h3>
                                            <p className="text-[10px] text-zinc-450">Item ID: {rev.item_id}</p>
                                        </div>
                                    </div>

                                    {/* Comment & Feedback Details Section */}
                                    <div className="flex-1 space-y-3">
                                        {/* Review Header Metadata */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex">
                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                        <Star
                                                            key={s}
                                                            size={13}
                                                            className={`${
                                                                s <= rev.rating
                                                                    ? 'fill-amber-400 text-amber-400'
                                                                    : 'text-zinc-200 dark:text-zinc-800'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>

                                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                                    {rev.buyer_name || 'Buyer'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                {rev.order_id && (
                                                    <span>Order: <strong className="font-semibold text-zinc-500">{rev.order_id}</strong></span>
                                                )}
                                                <span>•</span>
                                                <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {/* Customer Review text */}
                                        {rev.review_content && rev.review_content.trim() && (
                                            <div className="space-y-1">
                                                <div className="text-xs text-zinc-700 dark:text-zinc-300 italic p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 min-h-[3rem]">
                                                    "{rev.review_content}"
                                                </div>
                                            </div>
                                        )}

                                        {/* Replied state or Input field */}
                                        {rev.reply_status === 'replied' ? (
                                            <div className="bg-green-500/[0.03] border border-green-500/20 rounded-lg p-3 space-y-1.5 animate-fadeIn">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold tracking-wider text-green-600 dark:text-green-400 uppercase flex items-center gap-1">
                                                        <ThumbsUp size={10} /> REPLIED TO REVIEW
                                                    </span>
                                                    {rev.auto_replied && (
                                                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                            <Bot size={10} /> AI Auto
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-650 dark:text-zinc-350">
                                                    {rev.reply_content}
                                                </p>
                                                {rev.replied_at && (
                                                    <p className="text-[9px] text-zinc-405 text-right">
                                                        Replied at: {new Date(rev.replied_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            // Only show the write option if there is review content
                                            rev.review_content && rev.review_content.trim() ? (
                                                <div className="space-y-3.5">
                                                    {/* Keyword matching templates (Own Intelligence) */}
                                                    {(() => {
                                                        const match = getTemplateSuggestions(rev.review_content, reviewSettings)
                                                        if (match.templates.length === 0) return null
                                                        return (
                                                            <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/10 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 animate-fadeIn">
                                                                <div className="text-[10px] font-bold text-zinc-500">
                                                                    <span>{match.note}</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                    {match.templates.map((tpl: string, i: number) => (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setIndividualReplies(prev => ({
                                                                                    ...prev,
                                                                                    [rev.review_id]: tpl
                                                                                }))
                                                                            }}
                                                                            className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 text-left text-zinc-750 dark:text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm max-w-full"
                                                                        >
                                                                            {tpl}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}

                                                    {/* AI Suggestion Box */}
                                                    {rev.suggested_reply ? (
                                                        <div className="bg-purple-500/[0.02] border border-purple-500/15 rounded-lg p-3 space-y-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 animate-fadeIn">
                                                            <div className="flex-1 space-y-0.5">
                                                                <span className="text-[9px] font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
                                                                    <Bot size={10} /> Suggested Reply
                                                                </span>
                                                                <p 
                                                                    onClick={() => {
                                                                        setIndividualReplies(prev => ({
                                                                            ...prev,
                                                                            [rev.review_id]: rev.suggested_reply || ''
                                                                        }))
                                                                    }}
                                                                    className="text-xs text-zinc-650 dark:text-zinc-350 italic cursor-pointer hover:underline whitespace-pre-wrap"
                                                                    title="Click to copy and edit this suggestion"
                                                                >
                                                                    "{rev.suggested_reply}"
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleSubmitSuggestedReply(rev.review_id, rev.suggested_reply || '')}
                                                                disabled={isIndividualSubmitting}
                                                                className="px-3 py-1.5 bg-purple-650 hover:bg-purple-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shadow-sm shrink-0 active:scale-95"
                                                            >
                                                                <Send size={10} /> Send Suggested
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        reviewSettings?.ai_reply_enabled && (
                                                            <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/10 p-2 px-3 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                                                                <span>No AI suggestion available for this review.</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleGenerateSuggestion(rev.review_id)}
                                                                    disabled={generatingSuggestion[rev.review_id]}
                                                                    className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    {generatingSuggestion[rev.review_id] ? (
                                                                        <RefreshCw size={11} className="animate-spin" />
                                                                    ) : (
                                                                        <Bot size={11} />
                                                                    )}
                                                                    Generate Suggestion
                                                                </button>
                                                            </div>
                                                        )
                                                    )}

                                                    <div className="flex gap-2">
                                                        <textarea
                                                            rows={2}
                                                            placeholder="Write reply for this customer review..."
                                                            value={replyContentInput}
                                                            onChange={(e) => {
                                                                const text = e.target.value
                                                                setIndividualReplies(prev => ({
                                                                    ...prev,
                                                                    [rev.review_id]: text
                                                                }))
                                                            }}
                                                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-100"
                                                        />
                                                        <div className="flex flex-col gap-2 shrink-0">
                                                            <button
                                                                onClick={() => handleSubmitSingleReply(rev.review_id)}
                                                                disabled={isIndividualSubmitting || !replyContentInput.trim()}
                                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white shadow rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-50 h-1/2"
                                                                title="Send reply"
                                                            >
                                                                {isIndividualSubmitting ? (
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Send size={14} />
                                                                )}
                                                            </button>
                                                            
                                                            {reviewSettings?.ai_reply_enabled && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleGenerateSuggestion(rev.review_id)}
                                                                    disabled={generatingSuggestion[rev.review_id]}
                                                                    className="px-4 py-2 bg-zinc-105 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-50 h-1/2"
                                                                    title="Generate/Regenerate AI Suggestion"
                                                                >
                                                                    {generatingSuggestion[rev.review_id] ? (
                                                                        <RefreshCw size={14} className="animate-spin" />
                                                                    ) : (
                                                                        <Bot size={14} className="text-purple-600" />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Error State display */}
                                                    {rev.reply_status === 'failed' && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-semibold animate-pulse">
                                                            <AlertCircle size={12} />
                                                            <span>Previous reply failed to submit. Please try again.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
