'use client'

import React, { useState, useEffect, useRef, Suspense, forwardRef, useImperativeHandle } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
    syncDarazChatSessions,
    sendChatMessage,
    getChatSettings,
    updateChatSettings,
    updateMessageTags,
    getChatRules,
    addChatRule,
    deleteChatRule,
    type ChatSettings
} from '@/features/chat/actions/chat-actions'
import {
    getReviewSettings,
    updateReviewSettings,
    type ReviewSettings
} from '@/features/reviews/actions/review-actions'
import { updateDarazOrderRemarks } from '@/features/sales/actions/daraz-actions'
import {
    MessageSquare,
    Cpu,
    Send,
    Tag,
    Trash2,
    X,
    RefreshCw,
    Store,
    ShoppingBag,
    Clock,
    Search,
    Shield,
    User,
    Copy,
    Star,
    ExternalLink,
    Plus,
    Maximize2,
    Minimize2
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui-shim'
interface Store {
    id: string
    company_name: string
    seller_account: string
}

interface ChatSession {
    session_id: string
    store_id: string
    buyer_id: string
    title: string
    head_url?: string | null
    unread_count: number
    last_message_id?: string | null
    last_message_time?: string | null
    last_message_summary?: string | null
    is_follower?: boolean
    followed_at?: string | null
    updated_at: string
}

interface ChatMessage {
    message_id: string
    session_id: string
    from_account_id: string
    from_account_type: string
    to_account_id: string
    to_account_type: string
    content: string
    template_id: string
    send_time: string
    auto_reply: boolean
    tags: string[]
}

// Parse raw Daraz message content to a human-readable summary for the sidebar
function parseSummaryDisplay(summary: string | null | undefined): string {
    if (!summary) return 'No message history'
    try {
        const parsed = JSON.parse(summary)
        if (typeof parsed === 'object' && parsed !== null) {
            // Follow store invitation (cardType 10010 or sellerId + action key)
            if (parsed.cardType === 10010 || parsed.cardType === '10010' ||
                parsed.action === 'followCard_follow' || parsed.sellerId) {
                return 'Follow Invitation'
            }
            // Order card
            if (parsed.cardType === 10007 || parsed.cardType === '10007' ||
                parsed.orderId || parsed.order_id) {
                return 'Order Card'
            }
            // Product card
            if (parsed.cardType === 10006 || parsed.cardType === '10006' ||
                parsed.itemId || parsed.item_id) {
                return 'Product Card'
            }
            // Voucher card
            if (parsed.cardType === 10008 || parsed.cardType === '10008' ||
                parsed.promotionId || parsed.promotion_id) {
                return 'Voucher Card'
            }
            // Image message
            if (parsed.imgUrl) {
                return 'Image'
            }
            // Template 10015 welcome message with txt field
            if (parsed.txt) {
                const txtVal = parsed.txt
                try {
                    const inner = JSON.parse(txtVal)
                    return inner.en || inner.ne || txtVal
                } catch {
                    return typeof txtVal === 'string' ? txtVal.substring(0, 60) : 'Message'
                }
            }
            return summary
        }
    } catch {
        // Not JSON — return as-is
    }
    return summary
}

interface ChatRule {
    id: string
    store_id: string
    match_type: 'exact' | 'keyword'
    pattern: string
    reply_content: string
}

interface ChatInputBarHandle {
    focus: () => void
}

const ChatInputBar = forwardRef<ChatInputBarHandle, { onSendMessage: (text: string) => Promise<boolean> }>(
    ({ onSendMessage }, ref) => {
        const [text, setText] = useState('')
        const [sending, setSending] = useState(false)
        const inputRef = useRef<HTMLInputElement>(null)

        // Expose focus() so parent components can refocus the input
        useImperativeHandle(ref, () => ({
            focus: () => setTimeout(() => inputRef.current?.focus(), 0)
        }))

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault()
            if (!text.trim() || sending) return

            const textToSend = text
            setSending(true)
            const success = await onSendMessage(textToSend)
            setSending(false)
            if (success) {
                setText('')
            }
            // Defer focus so it fires AFTER React re-enables the input in the DOM
            setTimeout(() => inputRef.current?.focus(), 0)
        }

        return (
            <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 shrink-0">
                {/* Presets suggestions bar */}
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                    <span className="text-[10px] font-bold text-zinc-400 self-center shrink-0 uppercase tracking-wider">Quick:</span>
                    {[
                        'Follow our store to stay updated on new deals and offers.'
                    ].map(template => (
                        <button
                            key={template}
                            type="button"
                            onClick={() => { setText(template); inputRef.current?.focus() }}
                            className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs px-3 py-1.5 rounded-full shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 transition-colors cursor-pointer active:scale-95"
                        >
                            {template}
                        </button>
                    ))}
                </div>

                {/* Message form */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        disabled={sending}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={sending ? "Sending..." : "Write your response..."}
                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={sending}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white shadow px-5 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        )
    }
)

function ChatAiDashboardContent() {
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat')

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab === 'chat' || tab === 'settings') {
            setActiveTab(tab)
        }
    }, [searchParams])

    const [showAccountModal, setShowAccountModal] = useState(false)
    const [connectedChatStores, setConnectedChatStores] = useState<string[]>([])
    const [connectingStoreId, setConnectingStoreId] = useState<string | null>(null)
    const [stores, setStores] = useState<Store[]>([])
    const [activeStoreId, setActiveStoreId] = useState<string>('')
    const [storeSettings, setStoreSettings] = useState<Record<string, ChatSettings>>({})
    const [reviewSettings, setReviewSettings] = useState<Record<string, ReviewSettings>>({})
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const activeSessionRef = useRef<string | null>(null)
    useEffect(() => {
        activeSessionRef.current = activeSessionId
    }, [activeSessionId])

    // Auto-focus message input whenever the active customer changes
    useEffect(() => {
        if (activeSessionId) {
            setTimeout(() => chatInputRef.current?.focus(), 50)
        }
    }, [activeSessionId])

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isZoomed, setIsZoomed] = useState(false)
    
    // UI filters
    const [searchQuery, setSearchQuery] = useState('')
    const [sessionFilter, setSessionFilter] = useState<'all' | 'unread'>('all')
    
    // Settings state
    const [rules, setRules] = useState<ChatRule[]>([])
    const [newRuleType, setNewRuleType] = useState<'exact' | 'keyword'>('keyword')
    const [newRulePattern, setNewRulePattern] = useState('')
    const [newRuleReply, setNewRuleReply] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)
    const [settingsCategoryTab, setSettingsCategoryTab] = useState<'positive' | 'neutral' | 'negative'>('positive')
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    // Loaders
    const [loadingSessions, setLoadingSessions] = useState(false)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Right sidebar (Customer details / context) state
    const [customerOrders, setCustomerOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [ordersSearchQuery, setOrdersSearchQuery] = useState('')
    const [activeRightTab, setActiveRightTab] = useState<'order' | 'product' | 'voucher'>('order')

    // States for order notes / remarks
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
    const [selectedOrderForNote, setSelectedOrderForNote] = useState<any | null>(null)
    const [noteText, setNoteText] = useState('')
    const [isSubmittingNote, setIsSubmittingNote] = useState(false)
    const [ordersRefreshTrigger, setOrdersRefreshTrigger] = useState(0)

    const chatEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const chatInputRef = useRef<ChatInputBarHandle>(null)

    const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior
            })
        }
    }

    const sessionListRef = useRef<HTMLDivElement>(null)
    const sidebarScrollTopRef = useRef<number>(0)

    const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
        sidebarScrollTopRef.current = e.currentTarget.scrollTop
    }

    React.useLayoutEffect(() => {
        if (sessionListRef.current) {
            sessionListRef.current.scrollTop = sidebarScrollTopRef.current
        }
    }, [sessions])

    // Preset tags for customer queries
    const PRESET_TAGS = ['Change Address', 'Change Phone Number', 'Wholesale Inquiry', 'Urgent Return', 'General FAQ']

    // 1. Fetch initial store list & active connections
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
        fetchConnectedChatStores()
    }, [])

    async function fetchConnectedChatStores() {
        const { data, error } = await supabase
            .from('daraz_api_tokens')
            .select('store_id')
            .eq('app_type', 'chat')
        if (!error && data) {
            setConnectedChatStores(data.map(d => d.store_id))
        }
    }

    const handleConnectChat = async (storeId: string) => {
        setConnectingStoreId(storeId)
        try {
            const response = await fetch(`/api/daraz/auth/url?storeId=${storeId}&appType=chat`)
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error(data.error || 'Failed to generate auth URL')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to initiate connection')
            setConnectingStoreId(null)
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('status') === 'success') {
            toast.success('Daraz Chat connected successfully!', {
                description: 'Your assistant can now receive and send messages.'
            })
            // Clean query parameters from URL
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)
            fetchConnectedChatStores()
        }
    }, [])

    // 2. Fetch Settings and Rules when active store changes
    useEffect(() => {
        if (!activeStoreId) return

        async function loadStoreConfig() {
            try {
                // Fetch Settings
                const settings = await getChatSettings(activeStoreId)
                setStoreSettings(prev => ({ ...prev, [activeStoreId]: settings }))

                // Fetch Review Settings
                const revSettings = await getReviewSettings(activeStoreId)
                setReviewSettings(prev => ({ ...prev, [activeStoreId]: revSettings }))

                // Fetch Rules
                const ruleList = await getChatRules(activeStoreId)
                setRules(ruleList)
            } catch (err) {
                console.error('Failed to load store chat configurations:', err)
            }
        }
        loadStoreConfig()
    }, [activeStoreId])

    // 3. Fetch Sessions when active store changes & subscribe to real-time updates
    useEffect(() => {
        if (!activeStoreId) return

        sidebarScrollTopRef.current = 0
        if (sessionListRef.current) {
            sessionListRef.current.scrollTop = 0
        }
        
        async function fetchSessions() {
            setLoadingSessions(true)
            const { data, error } = await supabase
                .from('daraz_chat_sessions')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('last_message_time', { ascending: false })

            if (error) {
                console.error(error)
            } else {
                setSessions(data || [])
                if (data && data.length > 0 && !activeSessionId) {
                    setActiveSessionId(data[0].session_id)
                }
            }
            setLoadingSessions(false)
        }
        fetchSessions()

        // Realtime Subscription for Session List updates
        const channel = supabase
            .channel(`realtime:sessions:${activeStoreId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'daraz_chat_sessions',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setSessions(prev => {
                        if (prev.some(s => s.session_id === payload.new.session_id)) return prev
                        const newSession = payload.new as ChatSession
                        return [newSession, ...prev].sort((a, b) => {
                            const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0
                            const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0
                            return timeB - timeA
                        })
                    })
                } else if (payload.eventType === 'UPDATE') {
                    setSessions(prev => {
                        const updated = prev.map(s => s.session_id === payload.new.session_id ? { ...s, ...payload.new } as ChatSession : s)
                        return updated.sort((a, b) => {
                            const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0
                            const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0
                            return timeB - timeA
                        })
                    })
                } else if (payload.eventType === 'DELETE') {
                    setSessions(prev => prev.filter(s => s.session_id !== payload.old.session_id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeStoreId])

    // 4. Fetch messages for active session & subscribe to real-time additions
    useEffect(() => {
        if (!activeSessionId) {
            setMessages([])
            return
        }

        async function fetchMessages() {
            setLoadingMessages(true)
            const { data, error } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', activeSessionId)
                .order('send_time', { ascending: true })

            if (error) {
                console.error(error)
            } else {
                setMessages(data || [])
                setTimeout(() => scrollToBottom('auto'), 50)
            }
            setLoadingMessages(false)
        }
        fetchMessages()

        // Realtime Subscription
        const channel = supabase
            .channel(`realtime:messages:${activeSessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'daraz_chat_messages',
                filter: `session_id=eq.${activeSessionId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        if (prev.some(m => m.message_id === payload.new.message_id)) return prev
                        return [...prev, payload.new as ChatMessage]
                    })
                    setTimeout(() => scrollToBottom('smooth'), 50)
                    // Real-time follower detection: update session badge instantly
                    const newContent = String((payload.new as ChatMessage).content || '').toLowerCase()
                    if (newContent.includes('store follower') || newContent.includes('now your store')) {
                        setSessions(prev => prev.map(s =>
                            s.session_id === activeSessionId ? { ...s, is_follower: true } : s
                        ))
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m => m.message_id === payload.new.message_id ? payload.new as ChatMessage : m))
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(m => m.message_id !== payload.old.message_id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeSessionId])

    // Helper: Determine if store chat is connected
    const isStoreConnected = (storeId: string) => {
        return storeSettings[storeId]?.messaging_enabled !== false
    }

    // Filter sessions based on search, tags, connection status, and unread filter
    const filteredSessions = sessions.filter(session => {
        // Hide sessions if store is disconnected
        if (!isStoreConnected(session.store_id)) return false

        const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (session.last_message_summary && session.last_message_summary.toLowerCase().includes(searchQuery.toLowerCase()))
        
        if (!matchesSearch) return false

        if (sessionFilter === 'unread') {
            return session.unread_count > 0
        }

        return true
    })

    // Sync chats manual trigger
    const handleSync = async () => {
        if (!activeStoreId) return
        setSyncing(true)
        toast.info('Syncing chat sessions from Daraz...')
        try {
            const result = await syncDarazChatSessions(activeStoreId)
            if (result.success) {
                toast.success(`Successfully synced ${result.count} chats!`)
                
                // Refresh sessions from local DB
                const { data } = await supabase
                    .from('daraz_chat_sessions')
                    .select('*')
                    .eq('store_id', activeStoreId)
                    .order('last_message_time', { ascending: false })
                if (data) setSessions(data)
            } else {
                toast.error(result.reason || 'Failed to sync chats. Check API settings.')
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Sync failed'
            toast.error(errorMsg)
        } finally {
            setSyncing(false)
        }
    }

    // Send chat message
    const handleSendMessage = async (textToSend: string) => {
        if (!textToSend.trim() || !activeSessionId || !activeStoreId) return false

        const sessionSentTo = activeSessionId

        try {
            const result = await sendChatMessage(activeStoreId, sessionSentTo, '1', textToSend)
            if (result.success) {
                // Only load and update messages if the user is still looking at this session
                if (activeSessionRef.current !== sessionSentTo) return true

                // Refresh messages locally
                const { data } = await supabase
                    .from('daraz_chat_messages')
                    .select('*')
                    .eq('session_id', sessionSentTo)
                    .order('send_time', { ascending: true })
                if (data && activeSessionRef.current === sessionSentTo) {
                    setMessages(data)
                    setTimeout(() => scrollToBottom('smooth'), 50)
                }
                return true
            } else {
                toast.error(result.error || 'Failed to send message')
                return false
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
            toast.error(errorMsg)
            return false
        }
    }

    // Toggle Tag on Message
    const handleToggleTag = async (messageId: string, tag: string) => {
        const message = messages.find(m => m.message_id === messageId)
        if (!message) return

        let updatedTags = [...(message.tags || [])]
        if (updatedTags.includes(tag)) {
            updatedTags = updatedTags.filter(t => t !== tag)
        } else {
            updatedTags.push(tag)
        }

        try {
            await updateMessageTags(messageId, updatedTags)
            toast.success(`Message tag updated`)
        } catch {
            toast.error('Failed to update tags')
        }
    }

    // Save Settings
    const handleSaveSettings = async (payload: Partial<ChatSettings>) => {
        if (!activeStoreId) return
        setSavingSettings(true)
        try {
            const res = await updateChatSettings(activeStoreId, payload)
            if (res.success) {
                setStoreSettings(prev => ({
                    ...prev,
                    [activeStoreId]: { ...prev[activeStoreId], ...payload }
                }))
                toast.success('AI Settings updated successfully!')
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update settings'
            toast.error(errorMsg)
        } finally {
            setSavingSettings(false)
        }
    }

    const handleSaveReviewSettings = async (payload: Partial<ReviewSettings>) => {
        if (!activeStoreId) return
        setSavingSettings(true)
        try {
            const res = await updateReviewSettings(activeStoreId, payload)
            if (res.success) {
                setReviewSettings(prev => ({
                    ...prev,
                    [activeStoreId]: { ...prev[activeStoreId], ...payload } as ReviewSettings
                }))
                toast.success('Review Settings updated successfully!')
            } else {
                toast.error(res.error || 'Failed to update review settings')
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update settings'
            toast.error(errorMsg)
        } finally {
            setSavingSettings(false)
        }
    }

    // Add Matching Rule
    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRulePattern.trim() || !newRuleReply.trim() || !activeStoreId) return

        try {
            await addChatRule(activeStoreId, {
                match_type: newRuleType,
                pattern: newRulePattern,
                reply_content: newRuleReply
            })
            toast.success('Automation rule added')
            setNewRulePattern('')
            setNewRuleReply('')
            
            // Refresh rules list
            const ruleList = await getChatRules(activeStoreId)
            setRules(ruleList)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to add rule'
            toast.error(errorMsg)
        }
    }

    // Delete Rule
    const handleDeleteRule = async (id: string) => {
        try {
            await deleteChatRule(id)
            toast.success('Rule deleted')
            setRules(prev => prev.filter(r => r.id !== id))
        } catch {
            toast.error('Failed to delete rule')
        }
    }

    // Fetch orders for the customer in the active session
    useEffect(() => {
        if (!activeSession || !activeStoreId) {
            setCustomerOrders([])
            return
        }

        async function fetchCustomerOrders() {
            setLoadingOrders(true)
            try {
                // Fetch all orders for this store and join items with product image URLs
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        id,
                        order_id,
                        order_number,
                        order_status,
                        price,
                        order_date,
                        daraz_created_at,
                        customer_name,
                        shipping_name,
                        tracking_number,
                        customer_first_name,
                        customer_last_name,
                        items_detail,
                        remarks,
                        daraz_order_items (
                            id,
                            product_name,
                            quantity,
                            amount,
                            seller_sku,
                            item_status,
                            product_id,
                            products (
                                image_url
                            )
                        )
                    `)
                    .eq('store_id', activeStoreId)
                    .order('order_date', { ascending: false })

                if (error) {
                    console.error('Error fetching customer orders:', error)
                } else {
                    setCustomerOrders(data || [])
                }
            } catch (err) {
                console.error('Failed to load customer orders:', err)
            } finally {
                setLoadingOrders(false)
            }
        }

        fetchCustomerOrders()
    }, [activeSessionId, activeStoreId, ordersRefreshTrigger])

    const activeSession = sessions.find(s => s.session_id === activeSessionId)
    const currentStoreSettings = storeSettings[activeStoreId] || {}
    const currentReviewSettings = reviewSettings[activeStoreId] || {}

    // Filter customer orders based on active session's title (username), buyer_id, or manual search query
    const filteredOrders = customerOrders.filter(order => {
        if (!activeSession) return false

        const title = activeSession.title?.toLowerCase() || ''
        const buyerId = activeSession.buyer_id ? String(activeSession.buyer_id) : ''
        
        const custName = order.customer_name?.toLowerCase() || ''
        const shipName = order.shipping_name?.toLowerCase() || ''
        const firstName = order.customer_first_name?.toLowerCase() || ''
        const lastName = order.customer_last_name?.toLowerCase() || ''
        const fullName = `${firstName} ${lastName}`.trim()
        const orderNum = order.order_number?.toLowerCase() || ''
        const orderId = order.order_id?.toLowerCase() || ''

        // Check if buyer_id matches inside the items_detail list of the order
        let matchesBuyerId = false
        let hasBuyerIdInOrder = false
        if (buyerId && Array.isArray(order.items_detail) && order.items_detail.length > 0) {
            hasBuyerIdInOrder = order.items_detail.some((item: any) => 
                item && (item.buyer_id !== undefined && item.buyer_id !== null)
            )
            matchesBuyerId = order.items_detail.some((item: any) => 
                item && String(item.buyer_id) === buyerId
            )
        }

        // If the order has items with a valid buyer_id, we MUST match strictly by buyer_id
        // to prevent false positives for common customer names (like "Shanti").
        let matchesAuto = false
        if (hasBuyerIdInOrder) {
            matchesAuto = matchesBuyerId
        } else {
            // Fallback to name matching ONLY if the order has no buyer_id info
            matchesAuto = !!(title && (
                custName.includes(title) || 
                shipName.includes(title) || 
                title.includes(custName) ||
                firstName.includes(title) ||
                lastName.includes(title) ||
                title.includes(firstName) ||
                fullName.includes(title) ||
                title.includes(fullName)
            ))
        }

        if (ordersSearchQuery.trim() !== '') {
            const query = ordersSearchQuery.toLowerCase().trim()
            return custName.includes(query) || 
                shipName.includes(query) || 
                orderNum.includes(query) || 
                orderId.includes(query) ||
                firstName.includes(query) ||
                lastName.includes(query) ||
                order.daraz_order_items?.some((item: any) => 
                    item.product_name?.toLowerCase().includes(query) || 
                    item.seller_sku?.toLowerCase().includes(query)
                )
        }

        return matchesAuto
    })

    // Handler to send order card to the conversation
    const handleSendOrderCard = async (orderId: string) => {
        if (!activeStoreId || !activeSessionId) return
        const sessionSentTo = activeSessionId
        toast.info('Sending order card...')
        try {
            const result = await sendChatMessage(activeStoreId, sessionSentTo, '10007', undefined, undefined, orderId)
            if (!result.success) {
                throw new Error(result.error || 'Failed to send order card')
            }
            toast.success('Order card sent successfully!')
            
            // Only update messages if user is still looking at this session
            if (activeSessionRef.current !== sessionSentTo) return

            // Refresh messages locally
            const { data } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', sessionSentTo)
                .order('send_time', { ascending: true })
            if (data && activeSessionRef.current === sessionSentTo) {
                setMessages(data)
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send order card')
        } finally {
            // Return focus to message input after order card sent (or failed)
            chatInputRef.current?.focus()
        }
    }

    // Handler to send guide link text summary to the conversation
    const handleSendGuideLink = async (orderNumber: string, status: string, trackingNumber?: string) => {
        if (!activeStoreId || !activeSessionId) return
        const sessionSentTo = activeSessionId
        toast.info('Sending order guide link...')
        try {
            const txt = `Order Status Details:\nOrder Number: ${orderNumber}\nStatus: ${status}\nTracking Number: ${trackingNumber || 'Pending / In Processing'}`
            const result = await sendChatMessage(activeStoreId, sessionSentTo, '1', txt)
            if (!result.success) {
                throw new Error(result.error || 'Failed to send guide link')
            }
            toast.success('Order status details sent!')
            
            // Only update messages if user is still looking at this session
            if (activeSessionRef.current !== sessionSentTo) return

            // Refresh messages locally
            const { data } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', sessionSentTo)
                .order('send_time', { ascending: true })
            if (data && activeSessionRef.current === sessionSentTo) {
                setMessages(data)
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send guide link')
        } finally {
            // Return focus to message input after guide link sent (or failed)
            chatInputRef.current?.focus()
        }
    }

    // Handler to send follow invitation to the conversation
    const handleSendFollowInvitation = async () => {
        if (!activeStoreId || !activeSessionId) return
        const sessionSentTo = activeSessionId
        toast.info('Sending follow invitation...')
        try {
            const result = await sendChatMessage(activeStoreId, sessionSentTo, '10010')
            if (!result.success) {
                throw new Error(result.error || 'Failed to send follow invitation')
            }
            toast.success('Follow invitation sent successfully!')
            
            // Only update messages if user is still looking at this session
            if (activeSessionRef.current !== sessionSentTo) return

            // Refresh messages locally
            const { data } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', sessionSentTo)
                .order('send_time', { ascending: true })
            if (data && activeSessionRef.current === sessionSentTo) {
                setMessages(data)
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send follow invitation')
        } finally {
            // Return focus to message input after invitation sent (or failed)
            chatInputRef.current?.focus()
        }
    }

    const handleOpenNoteModal = (order: any) => {
        setSelectedOrderForNote(order)
        setNoteText(order.remarks || '')
        setIsNoteModalOpen(true)
    }

    const handleSaveNote = async () => {
        if (!selectedOrderForNote) return
        setIsSubmittingNote(true)
        try {
            const res = await updateDarazOrderRemarks(selectedOrderForNote.id, noteText.trim() || null)
            if (res.success) {
                toast.success('Note saved successfully!')
                setIsNoteModalOpen(false)
                setOrdersRefreshTrigger(prev => prev + 1)
            } else {
                toast.error(res.error || 'Failed to save note')
            }
        } catch (err: any) {
            toast.error(err.message || 'An error occurred')
        } finally {
            setIsSubmittingNote(false)
        }
    }

    const handleDeleteNote = async (orderId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return
        try {
            const res = await updateDarazOrderRemarks(orderId, null)
            if (res.success) {
                toast.success('Note deleted successfully!')
                setOrdersRefreshTrigger(prev => prev + 1)
            } else {
                toast.error(res.error || 'Failed to delete note')
            }
        } catch (err: any) {
            toast.error(err.message || 'An error occurred')
        }
    }

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard!')
    }

    // Helper: Parse content string to JSON or keep text
    const parseMsgContent = (content: string) => {
        try {
            const parsed = JSON.parse(content)
            return parsed
        } catch {
            return { txt: content }
        }
    }

    return (
        <div className={`flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-all ${
            isZoomed 
                ? 'fixed inset-0 z-[150] rounded-none h-screen' 
                : 'h-[calc(100vh-5rem)] rounded-2xl'
        }`}>
            {/* Header Area */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    {activeTab === 'chat' ? (
                        <h1 className="text-2xl font-bold text-zinc-850 dark:text-zinc-100">
                            Daraz Chat
                        </h1>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                                AI & Automation
                            </h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Manage customer messaging, configure smart keywords, and deploy Gemini AI auto-replies.
                            </p>
                        </>
                    )}
                </div>
                
                {/* Store selection and Sync buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1.5 border border-zinc-200 dark:border-zinc-700">
                        <Store size={16} className="text-zinc-500 ml-2" />
                        <select
                            value={activeStoreId}
                            onChange={(e) => {
                                setActiveStoreId(e.target.value)
                                setActiveSessionId(null)
                            }}
                            className="bg-transparent border-0 text-sm font-medium focus:ring-0 text-zinc-700 dark:text-zinc-200 cursor-pointer pr-8"
                        >
                            {stores.map((s) => (
                                <option key={s.id} value={s.id} className="dark:bg-zinc-900">
                                    {s.company_name} ({s.seller_account})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowAccountModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all active:scale-95"
                    >
                        <Store size={16} className="text-zinc-500" />
                        Daraz Account
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={syncing || !isStoreConnected(activeStoreId)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all
                            ${syncing || !isStoreConnected(activeStoreId)
                                ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95'
                            }`}
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Daraz'}
                    </button>

                    <button
                        onClick={() => setIsZoomed(!isZoomed)}
                        title={isZoomed ? "Exit Fullscreen" : "Fullscreen Chat"}
                        className="flex items-center justify-center p-2 text-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all active:scale-95"
                    >
                        {isZoomed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>


                </div>
            </div>

            {/* Main Content Workspace */}
            {activeTab === 'chat' ? (
                /* ----------------- CHAT WORKSPACE ----------------- */
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Session Lists */}
                    <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
                        {/* Search and Filters */}
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search buyer name or message..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-700 dark:text-zinc-200"
                                />
                            </div>

                            {/* Filter Pills */}
                            <div className="flex gap-2 text-xs">
                                <button
                                    onClick={() => setSessionFilter('all')}
                                    className={`px-3 py-1 rounded-full font-semibold transition-all ${
                                        sessionFilter === 'all'
                                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    All ({sessions.filter(s => isStoreConnected(s.store_id)).length})
                                </button>
                                <button
                                    onClick={() => setSessionFilter('unread')}
                                    className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                                        sessionFilter === 'unread'
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    Unread ({sessions.filter(s => isStoreConnected(s.store_id) && s.unread_count > 0).length})
                                </button>
                            </div>
                        </div>

                        {/* Session list */}
                        <div 
                            ref={sessionListRef}
                            onScroll={handleSidebarScroll}
                            className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50"
                        >
                            {loadingSessions ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-zinc-400" />
                                    <span className="text-xs">Loading sessions...</span>
                                </div>
                            ) : !isStoreConnected(activeStoreId) ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <Shield size={24} className="mx-auto mb-2 text-zinc-400" />
                                    <p className="text-xs font-semibold">Store Account Disconnected</p>
                                    <p className="text-[10px] text-zinc-400 mt-1">Connect this store in the &quot;AI &amp; Automation&quot; tab to show messages.</p>
                                </div>
                            ) : filteredSessions.length === 0 ? (
                                <div className="p-8 text-center text-zinc-500 text-xs">
                                    No active conversations found.
                                </div>
                            ) : (
                                filteredSessions.map((session) => {
                                    const isActive = session.session_id === activeSessionId
                                    
                                    // Format time like Daraz
                                    const getFormattedSessionTime = (timeStr?: string | null) => {
                                        if (!timeStr) return ''
                                        const date = new Date(timeStr)
                                        const now = new Date()
                                        
                                        // Check if today
                                        if (date.toDateString() === now.toDateString()) {
                                            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        }
                                        
                                        // Check if yesterday
                                        const yesterday = new Date(now)
                                        yesterday.setDate(now.getDate() - 1)
                                        if (date.toDateString() === yesterday.toDateString()) {
                                            return 'yesterday'
                                        }
                                        
                                        // Otherwise DD/MM
                                        const day = String(date.getDate()).padStart(2, '0')
                                        const month = String(date.getMonth() + 1).padStart(2, '0')
                                        return `${day}/${month}`
                                    }

                                    const formattedTime = getFormattedSessionTime(session.last_message_time)

                                    return (
                                        <div
                                            key={session.session_id}
                                            role="button"
                                            onClick={() => setActiveSessionId(session.session_id)}
                                            className={`w-full p-4 flex gap-3 text-left transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer ${
                                                isActive ? 'bg-blue-50/70 dark:bg-blue-955/20 border-l-4 border-blue-600' : ''
                                            }`}
                                        >
                                            {/* Avatar placeholder */}
                                            <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-inner">
                                                {session.title.substring(0, 2).toUpperCase()}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate mb-1">
                                                    {session.title}
                                                </h3>
                                                <p className="text-xs text-zinc-555 truncate">
                                                    {parseSummaryDisplay(session.last_message_summary)}
                                                </p>
                                            </div>

                                            {/* Time & Unread Badges Column */}
                                            <div className="flex flex-col items-end justify-between shrink-0 h-10">
                                                <span className="text-[10px] text-zinc-400">{formattedTime}</span>
                                                {session.unread_count > 0 && (
                                                    <div className="h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                                                        {session.unread_count}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Middle: Active Chat Window */}
                    <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 flex flex-col min-w-0 h-full border-r border-zinc-200 dark:border-zinc-800">
                        {activeSession ? (
                            <>
                                {/* Chat Header */}
                                <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold text-sm">
                                            {activeSession.title.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                                {activeSession.title}
                                            </h2>
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                <span>Active Daraz Session</span>
                                                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                                <span>Buyer ID: {activeSession.buyer_id}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages Viewport */}
                                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center h-full">
                                            <RefreshCw className="animate-spin text-zinc-400 mr-2" />
                                            <span className="text-sm text-zinc-500">Loading chat history...</span>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                                            No messages yet. Send a message to start the conversation!
                                        </div>
                                    ) : (
                                        messages.map((message) => {
                                            const isSelf = String(message.from_account_type) === '2' || message.from_account_id === 'seller'
                                            const parsed = parseMsgContent(message.content)
                                            const formattedTime = new Date(message.send_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                                            // Render product/order card details if templates match
                                            const isProductCard = String(message.template_id) === '10006'
                                            const isOrderCard = String(message.template_id) === '10007'
                                            const isFollowCard = String(message.template_id) === '10010'
                                            // Detect Daraz system "buyer followed" confirmation message
                                            const rawContent = message.content || ''
                                            const isFollowerConfirmation = rawContent.toLowerCase().includes('store follower') || rawContent.toLowerCase().includes('now your store')

                                            return (
                                                <div
                                                    key={message.message_id}
                                                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                                                >
                                                    {/* Message bubble */}
                                                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${
                                                        isSelf 
                                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                                                            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-none'
                                                    }`}>
                                                        {/* Render based on card type */}
                                                         {isProductCard ? (
                                                             <div className="flex flex-col gap-3 p-1 min-w-[250px] max-w-[320px]">
                                                                 <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500 uppercase tracking-wide">
                                                                     <ShoppingBag size={14} className="text-orange-500" />
                                                                     <span>Product Inquiry</span>
                                                                 </div>
                                                                 <div className="flex gap-3 bg-zinc-50/90 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm">
                                                                     {parsed.iconUrl && (
                                                                         <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-zinc-200/60 dark:border-zinc-700/50 flex items-center justify-center">
                                                                             <img 
                                                                                 src={parsed.iconUrl} 
                                                                                 alt={parsed.title || 'Product Image'} 
                                                                                 className="object-cover w-full h-full"
                                                                             />
                                                                         </div>
                                                                     )}
                                                                     <div className="flex flex-col justify-center min-w-0 flex-1">
                                                                         {parsed.title && (
                                                                             <h4 className={`text-xs font-bold line-clamp-2 leading-snug mb-1 ${isSelf ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                                                                 {parsed.title}
                                                                             </h4>
                                                                         )}
                                                                         {parsed.price && (
                                                                             <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400">
                                                                                 {parsed.price}
                                                                             </span>
                                                                         )}
                                                                     </div>
                                                                 </div>
                                                                 {parsed.actionUrl && (
                                                                     <a 
                                                                         href={parsed.actionUrl} 
                                                                         target="_blank" 
                                                                         rel="noopener noreferrer"
                                                                         className="text-center bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                                                     >
                                                                         <span>View Product on Daraz</span>
                                                                         <ExternalLink size={12} />
                                                                     </a>
                                                                 )}
                                                                 <div className="flex items-center justify-between text-[9px] text-zinc-405 dark:text-zinc-500 font-semibold px-0.5">
                                                                     <span>Item ID: {parsed.itemId || parsed.item_id || 'N/A'}</span>
                                                                     {parsed.skuId && <span>SKU: {parsed.skuId}</span>}
                                                                 </div>
                                                             </div>
                                                        ) : isOrderCard ? (
                                                            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase">
                                                                    <ShoppingBag size={12} /> Order Card
                                                                </div>
                                                                <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-350">
                                                                    Order ID: {parsed.orderId || parsed.order_id || 'N/A'}
                                                                </div>
                                                                <p className="text-xs text-zinc-405 mt-1">Order details shared in conversation.</p>
                                                            </div>
                                                        ) : isFollowCard ? (
                                                            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-orange-550 uppercase">
                                                                    <User size={12} /> Store Follow Invitation
                                                                </div>
                                                                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 p-2.5 rounded-lg text-xs font-bold text-orange-600 dark:text-orange-350 flex items-center justify-center gap-1.5 shadow-sm">
                                                                    <Store size={14} className="text-orange-500" /> Follow Our Store
                                                                </div>
                                                                <p className="text-[10px] text-zinc-405 mt-0.5">An invitation to follow our store was shared in conversation.</p>
                                                            </div>
                                                        ) : isFollowerConfirmation ? (
                                                            // Daraz system: buyer followed the store
                                                            <div className="flex items-center gap-2 py-0.5">
                                                                <span className="text-green-400 text-base">✓</span>
                                                                <span className="font-semibold text-green-300 text-xs">The buyer is now your store follower.</span>
                                                            </div>
                                                        ) : parsed.imgUrl ? (
                                                            // Image message from customer
                                                            <div className="p-1">
                                                                <img
                                                                    src={parsed.imgUrl}
                                                                    alt={parsed.o || 'Image'}
                                                                    onClick={() => setLightboxUrl(parsed.imgUrl)}
                                                                    className="max-w-[240px] max-h-[280px] rounded-xl object-cover cursor-zoom-in border border-white/20 shadow-sm hover:opacity-90 transition-opacity"
                                                                />
                                                                {parsed.o && (
                                                                    <p className="text-[10px] mt-1 opacity-60 truncate max-w-[240px]">{parsed.o}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // Regular text
                                                            <p className="whitespace-pre-wrap">{parsed.txt || parsed.content || message.content}</p>
                                                        )}

                                                        {/* Timestamp and AutoReply Tag */}
                                                        <div className={`flex items-center gap-1.5 mt-1.5 text-[9px] ${isSelf ? 'text-blue-200 justify-end' : 'text-zinc-400'}`}>
                                                            <span>{formattedTime}</span>
                                                            {message.auto_reply && (
                                                                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-1 rounded font-semibold text-[8px] uppercase">
                                                                    AI Auto-Reply
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Preset Tag Actions Popover (Hover list for admin) */}
                                                        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-white dark:bg-zinc-900 shadow-md border border-zinc-200 dark:border-zinc-800 rounded-full px-2 py-1 z-10 ${
                                                            isSelf ? 'right-full mr-2' : 'left-full ml-2'
                                                        }`}>
                                                            <span className="text-[10px] font-bold text-zinc-400 mr-1 flex items-center gap-0.5"><Tag size={10} /> Tag:</span>
                                                            {PRESET_TAGS.map(tag => {
                                                                const isTagged = message.tags?.includes(tag)
                                                                return (
                                                                    <button
                                                                        key={tag}
                                                                        onClick={() => handleToggleTag(message.message_id, tag)}
                                                                        title={tag}
                                                                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                                                            isTagged 
                                                                                ? 'bg-orange-500 border-orange-500 text-white' 
                                                                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                                                                        }`}
                                                                    >
                                                                        {tag.charAt(0)}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Active tag pills displayed below message */}
                                                    {message.tags && message.tags.length > 0 && (
                                                        <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                                            {message.tags.map((tag: string) => (
                                                                <span 
                                                                    key={tag} 
                                                                    className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40 rounded-full px-2 py-0.5 text-[9px] font-semibold flex items-center gap-1"
                                                                >
                                                                    <Tag size={8} /> {tag}
                                                                    <button 
                                                                        onClick={() => handleToggleTag(message.message_id, tag)} 
                                                                        className="hover:text-red-500 text-orange-400 transition-colors"
                                                                    >
                                                                        <X size={8} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>                                {/* Quick Replies & Input Bar */}
                                <ChatInputBar ref={chatInputRef} onSendMessage={handleSendMessage} />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm">
                                <MessageSquare size={32} className="text-zinc-400 mb-2" />
                                Select a conversation thread from the sidebar to begin.
                            </div>
                        )}
                    </div>

                    {/* Right Column: Customer Info & Orders Sidebar (Daraz-like) */}
                    {activeSession && (
                        <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 h-full overflow-hidden">
                            {/* Profile details */}
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center space-y-2 shrink-0">
                                <div className="h-16 w-16 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold text-xl shadow-inner border border-blue-200/50 dark:border-blue-800/50">
                                    {activeSession.title.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 justify-center">
                                        <User size={14} className="text-zinc-400" />
                                        {activeSession.title}
                                    </h3>
                                    <p className="text-[10px] text-zinc-400">Buyer ID: {activeSession.buyer_id}</p>
                                </div>
                                
                                {/* Follow Invitation button */}
                                <div className="w-full pt-1.5">
                                    {/* is_follower from DB (persists past message deletion) OR live scan of current messages */}
                                    {(activeSession.is_follower || messages.some(m => (m.content || '').toLowerCase().includes('store follower') || (m.content || '').toLowerCase().includes('now your store'))) ? (
                                        // Buyer already follows — locked state
                                        <div className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-xs font-bold text-white shadow rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 select-none">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            Buyer is Already a Follower
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={handleSendFollowInvitation}
                                            className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 text-xs font-bold text-white shadow rounded-lg transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <User size={14} />
                                            Send Follow Invitation
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-center text-xs font-semibold shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
                                {(['order', 'product', 'voucher'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveRightTab(tab)}
                                        className={`flex-1 py-2.5 border-b-2 capitalize transition-all ${
                                            activeRightTab === tab
                                                ? 'border-orange-500 text-orange-500 font-bold bg-white dark:bg-zinc-900'
                                                : 'border-transparent text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        {tab === 'order' ? `Order (${filteredOrders.length})` : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Scrollable Content Tab Views */}
                            <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20 p-3">
                                {activeRightTab === 'order' && (
                                    <div className="space-y-3">
                                        {/* Order Search bar */}
                                        <div className="relative shrink-0">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-450" />
                                            <input
                                                type="text"
                                                placeholder="Search orders..."
                                                value={ordersSearchQuery}
                                                onChange={(e) => setOrdersSearchQuery(e.target.value)}
                                                className="pl-8 pr-3 py-1.5 w-full text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400"
                                            />
                                        </div>

                                        {/* List of Orders */}
                                        {loadingOrders ? (
                                            <div className="py-8 text-center text-zinc-500 text-xs">
                                                <RefreshCw className="animate-spin h-4 w-4 mx-auto mb-1.5 text-zinc-400" />
                                                Loading orders...
                                            </div>
                                        ) : filteredOrders.length === 0 ? (
                                            <div className="py-8 text-center text-zinc-455 text-[11px] px-4">
                                                {ordersSearchQuery.trim() !== '' 
                                                    ? 'No matching orders found.' 
                                                    : 'No matching orders found automatically. Search by order number or name above.'}
                                            </div>
                                        ) : (
                                            filteredOrders.map((order) => {
                                                const formattedDate = order.order_date 
                                                    ? new Date(order.order_date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                    : ''
                                                
                                                // Map Daraz status to Tailwind/Vanilla CSS badges
                                                const status = order.order_status?.toLowerCase() || 'pending'
                                                let statusColor = 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                                if (['delivered', 'completed'].includes(status)) {
                                                    statusColor = 'bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                                                } else if (['shipped', 'ready_to_ship', 'packed'].includes(status)) {
                                                    statusColor = 'bg-orange-50 text-orange-600 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                                                } else if (['canceled', 'cancelled', 'cancel', 'failed'].includes(status)) {
                                                    statusColor = 'bg-red-50 text-red-650 border-red-200/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30'
                                                }

                                                return (
                                                    <div 
                                                        key={order.id} 
                                                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm p-3 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 animate-fadeIn"
                                                    >
                                                        {/* Header: Status and ID */}
                                                        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColor}`}>
                                                                {order.order_status}
                                                            </span>
                                                            <button 
                                                                onClick={() => handleCopyText(order.order_number)}
                                                                className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-blue-500 font-bold transition-colors"
                                                                title="Copy Order ID"
                                                            >
                                                                <span>ID: {order.order_number}</span>
                                                                <Copy size={10} />
                                                            </button>
                                                        </div>

                                                        {/* Items */}
                                                        <div className="space-y-2">
                                                            {order.daraz_order_items?.map((item: any) => {
                                                                const imgUrl = item.products?.image_url
                                                                return (
                                                                    <div key={item.id} className="flex gap-2">
                                                                        {/* Product image */}
                                                                        <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200/50 dark:border-zinc-750 flex items-center justify-center shrink-0 overflow-hidden">
                                                                            {imgUrl ? (
                                                                                <img 
                                                                                    src={imgUrl} 
                                                                                    alt={item.product_name} 
                                                                                    className="h-full w-full object-cover" 
                                                                                />
                                                                            ) : (
                                                                                <ShoppingBag size={14} className="text-zinc-400" />
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Product details */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="font-medium text-zinc-800 dark:text-zinc-200 text-[11px] leading-tight line-clamp-2" title={item.product_name}>
                                                                                {item.product_name}
                                                                            </h4>
                                                                            <div className="flex justify-between items-center mt-1 text-[10px] text-zinc-400">
                                                                                <span>Qty: {item.quantity}</span>
                                                                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                                                    NPR {item.amount}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>

                                                        {/* Order details summary */}
                                                        <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800/80 space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                                            <div className="flex justify-between">
                                                                <span>Order time:</span>
                                                                <span>{formattedDate}</span>
                                                            </div>
                                                            {order.tracking_number && (
                                                                <div className="flex justify-between">
                                                                    <span>Logistics:</span>
                                                                    <span className="text-blue-500 dark:text-blue-400 font-medium">
                                                                        In Transit ({order.tracking_number.split(',')[0]})
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-baseline pt-1">
                                                                <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Total Price:</span>
                                                                <span className="text-sm font-extrabold text-orange-500 dark:text-orange-400">
                                                                    NPR {order.price}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Note / Remarks section */}
                                                        {(() => {
                                                            const allowedStatuses = ['pending', 'ready to ship', 'ready_to_ship', 'packed']
                                                            const isNoteAllowed = allowedStatuses.includes(order.order_status?.toLowerCase())
                                                            
                                                            if (order.remarks) {
                                                                return (
                                                                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-250 dark:border-yellow-900 rounded text-xs space-y-1 relative group">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-bold text-yellow-800 dark:text-yellow-400">Remarks:</span>
                                                                            <div className="flex gap-2">
                                                                                {isNoteAllowed && (
                                                                                    <>
                                                                                        <button 
                                                                                            onClick={() => handleOpenNoteModal(order)}
                                                                                            className="text-blue-600 dark:text-blue-450 hover:underline font-bold text-[10px]"
                                                                                        >
                                                                                            Edit
                                                                                        </button>
                                                                                        <button 
                                                                                            onClick={() => handleDeleteNote(order.id)}
                                                                                            className="text-red-650 dark:text-red-450 hover:underline font-bold text-[10px]"
                                                                                        >
                                                                                            Delete
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-gray-800 dark:text-gray-200 break-words font-medium italic">{order.remarks}</p>
                                                                    </div>
                                                                )
                                                            } else if (isNoteAllowed) {
                                                                return (
                                                                    <button
                                                                        onClick={() => handleOpenNoteModal(order)}
                                                                        className="mt-2 w-full py-1 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-[10px] font-bold rounded transition-colors text-center flex items-center justify-center gap-1"
                                                                    >
                                                                        <Plus size={10} />
                                                                        Add Note
                                                                    </button>
                                                                )
                                                            }
                                                            return null
                                                        })()}

                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2 pt-1">
                                                            <button 
                                                                onClick={() => handleSendGuideLink(order.order_number, order.order_status, order.tracking_number)}
                                                                className="flex-1 py-1.5 border border-orange-500 text-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 text-[10px] font-bold rounded transition-colors text-center"
                                                            >
                                                                Send Guide Link
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSendOrderCard(order.order_id)}
                                                                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded transition-colors text-center shadow-sm"
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                )}

                                {activeRightTab === 'product' && (
                                    <div className="py-12 text-center text-zinc-400 text-xs">
                                        <ShoppingBag size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                        <span>No products shared yet.</span>
                                    </div>
                                )}

                                {activeRightTab === 'voucher' && (
                                    <div className="py-12 text-center text-zinc-400 text-xs">
                                        <Tag size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                        <span>No vouchers available for this store.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ----------------- SETTINGS & AUTOMATION WORKSPACE ----------------- */
                <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6">
                    {/* Store status connection toggle and AI toggles */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Store configuration cards */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
                            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <Cpu className="text-blue-600" size={20} />
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">AI & Connection Controls</h2>
                            </div>

                            <div className="space-y-4">
                                {/* Connection Toggle */}
                                <div className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-700/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chat Connection Status</h3>
                                        <p className="text-[11px] text-zinc-500">Connect or disconnect this store account from messaging sync entirely.</p>
                                    </div>
                                    <button
                                        onClick={() => handleSaveSettings({ messaging_enabled: !currentStoreSettings.messaging_enabled })}
                                        disabled={savingSettings}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                            currentStoreSettings.messaging_enabled !== false
                                                ? 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20'
                                                : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                                        }`}
                                    >
                                        {currentStoreSettings.messaging_enabled !== false ? 'CONNECTED' : 'DISCONNECTED'}
                                    </button>
                                </div>

                                {/* AI Toggle */}
                                <div className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-700/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">AI Chat Auto-Reply</h3>
                                        <p className="text-[11px] text-zinc-500">Automatically answer buyer FAQs using generative AI database checks.</p>
                                    </div>
                                    <button
                                        onClick={() => handleSaveSettings({ ai_enabled: !currentStoreSettings.ai_enabled })}
                                        disabled={savingSettings || currentStoreSettings.messaging_enabled === false}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                            currentStoreSettings.ai_enabled
                                                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                                        }`}
                                    >
                                        {currentStoreSettings.ai_enabled ? 'AI ACTIVE' : 'AI INACTIVE'}
                                    </button>
                                </div>

                                {/* AI Provider selection */}
                                {currentStoreSettings.ai_enabled && (
                                    <div className="space-y-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-zinc-550 uppercase tracking-wider flex items-center gap-1">AI Model Provider</label>
                                            <select
                                                value={currentStoreSettings.ai_provider || 'gemini'}
                                                onChange={(e) => handleSaveSettings({ ai_provider: e.target.value })}
                                                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="gemini">Google Gemini</option>
                                                <option value="openai">OpenAI GPT</option>
                                            </select>
                                        </div>

                                        {currentStoreSettings.ai_provider === 'openai' && (
                                            <div className="space-y-3 animate-fadeIn">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-550 uppercase tracking-wider">OpenAI API Key</label>
                                                    <input
                                                        type="password"
                                                        placeholder="sk-..."
                                                        value={currentStoreSettings.openai_api_key || ''}
                                                        onChange={(e) => setStoreSettings(prev => ({
                                                            ...prev,
                                                            [activeStoreId]: { ...prev[activeStoreId], openai_api_key: e.target.value } as any
                                                        }))}
                                                        onBlur={() => handleSaveSettings({ openai_api_key: currentStoreSettings.openai_api_key })}
                                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-550 uppercase tracking-wider">OpenAI Model Name</label>
                                                    <select
                                                        value={currentStoreSettings.openai_model || 'gpt-4o-mini'}
                                                        onChange={(e) => handleSaveSettings({ openai_model: e.target.value })}
                                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                                                        <option value="gpt-4o">gpt-4o (Premium)</option>
                                                        <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Automation configuration */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <ShoppingBag className="text-indigo-600" size={20} />
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">New Order Automation</h2>
                            </div>

                            <div className="space-y-4">
                                {/* Toggle switch */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Auto-Message on New Order</h3>
                                        <p className="text-[11px] text-zinc-500">Queue a greeting + follow invitation card when a new order is received.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={currentStoreSettings.auto_reply_on_new_order || false}
                                        onChange={(e) => handleSaveSettings({ auto_reply_on_new_order: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded cursor-pointer"
                                    />
                                </div>

                                {/* Delay Minutes input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} /> Message Delay Time (Minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={currentStoreSettings.new_order_delay_minutes ?? 1}
                                        onChange={(e) => handleSaveSettings({ new_order_delay_minutes: parseInt(e.target.value) || 0 })}
                                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Text Template */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                        Greeting Text Template
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={currentStoreSettings.new_order_template || ''}
                                        onChange={(e) => setStoreSettings(prev => ({
                                            ...prev,
                                            [activeStoreId]: { ...prev[activeStoreId], new_order_template: e.target.value }
                                        }))}
                                        onBlur={() => handleSaveSettings({ new_order_template: currentStoreSettings.new_order_template })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                        placeholder="Enter the template to send to new buyers..."
                                    />
                                    <p className="text-[10px] text-zinc-400">Note: The &quot;Follow Our Store&quot; invitation button will be appended automatically below this message.</p>
                                </div>
                            </div>
                        </div>
                    </div>                    {/* AI Review Automation settings block */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
                        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <Cpu className="text-purple-600" size={20} />
                            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">AI Review Automation Settings</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Toggle switch */}
                            <div className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-700/30">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">AI Review Reply Suggestion</h3>
                                    <p className="text-[11px] text-zinc-500">Automatically generate review reply suggestions (does not post directly). Approve them in the Reviews tab.</p>
                                </div>
                                <button
                                    onClick={() => handleSaveReviewSettings({ ai_reply_enabled: !currentReviewSettings.ai_reply_enabled })}
                                    disabled={savingSettings}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                        currentReviewSettings.ai_reply_enabled
                                            ? 'bg-purple-650 border-purple-650 text-white hover:bg-purple-700'
                                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                                    }`}
                                >
                                    {currentReviewSettings.ai_reply_enabled ? 'AI REVIEW ACTIVE' : 'AI REVIEW INACTIVE'}
                                </button>
                            </div>

                            {/* AI provider and models for reviews */}
                            {currentReviewSettings.ai_reply_enabled && (
                                <div className="space-y-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">AI Model Provider</label>
                                            <select
                                                value={currentReviewSettings.ai_provider || 'gemini'}
                                                onChange={(e) => handleSaveReviewSettings({ ai_provider: e.target.value })}
                                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                            >
                                                <option value="gemini">Google Gemini</option>
                                                <option value="openai">OpenAI GPT</option>
                                            </select>
                                        </div>

                                        {currentReviewSettings.ai_provider === 'openai' && (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">OpenAI API Key</label>
                                                    <input
                                                        type="password"
                                                        placeholder="sk-..."
                                                        value={currentReviewSettings.openai_api_key || ''}
                                                        onChange={(e) => setReviewSettings(prev => ({
                                                            ...prev,
                                                            [activeStoreId]: { ...prev[activeStoreId], openai_api_key: e.target.value } as ReviewSettings
                                                        }))}
                                                        onBlur={() => handleSaveReviewSettings({ openai_api_key: currentReviewSettings.openai_api_key })}
                                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-850 dark:text-zinc-100"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">OpenAI Model Name</label>
                                                    <select
                                                        value={currentReviewSettings.openai_model || 'gpt-4o-mini'}
                                                        onChange={(e) => handleSaveReviewSettings({ openai_model: e.target.value })}
                                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                    >
                                                        <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                                                        <option value="gpt-4o">gpt-4o (Premium)</option>
                                                        <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Cutoff Date Picker */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock size={12} /> Auto-Reply Cutoff Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={currentReviewSettings.cutoff_time ? new Date(currentReviewSettings.cutoff_time).toLocaleString('sv').substring(0, 16).replace(' ', 'T') : ''}
                                    onChange={(e) => handleSaveReviewSettings({ cutoff_time: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-100"
                                />
                                <p className="text-[10px] text-zinc-400">Ignore and immediately skip any customer reviews submitted before this date and time.</p>
                            </div>

                            {/* AI Prompt / Instruction */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                    AI Prompt / Instructions
                                </label>
                                <textarea
                                    rows={3}
                                    value={currentReviewSettings.ai_instruction || ''}
                                    onChange={(e) => setReviewSettings(prev => ({
                                        ...prev,
                                        [activeStoreId]: { ...prev[activeStoreId], ai_instruction: e.target.value } as ReviewSettings
                                    }))}
                                    onBlur={() => handleSaveReviewSettings({ ai_instruction: currentReviewSettings.ai_instruction })}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-100"
                                    placeholder="Enter additional instructions for the AI reviewer (e.g. Always respond in a warm tone, recommend checking our store for more products...)"
                                />
                            </div>

                            {/* Keyword-based templates editor */}
                            <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Keyword-Based Template Settings</h3>
                                    <p className="text-[11px] text-zinc-550 mt-0.5">Define keywords that trigger suggested reply templates for reviews matching that sentiment.</p>
                                </div>

                                {/* Category Tabs */}
                                <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-1 text-xs font-semibold shrink-0">
                                    {(['positive', 'neutral', 'negative'] as const).map((cat) => {
                                        const isActive = settingsCategoryTab === cat
                                        let activeStyles = 'border-purple-500 text-purple-650 dark:text-purple-400 font-bold bg-purple-500/[0.03]'
                                        if (cat === 'neutral') activeStyles = 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-550/[0.03]'
                                        if (cat === 'negative') activeStyles = 'border-red-500 text-red-650 dark:text-red-400 font-bold bg-red-500/[0.03]'
                                        
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setSettingsCategoryTab(cat)}
                                                className={`px-4 py-2 border-b-2 capitalize transition-all rounded-t-lg ${
                                                    isActive
                                                        ? activeStyles
                                                        : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-350'
                                                }`}
                                            >
                                                {cat} Category
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Keywords and Templates Editor for active category */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                                    {/* Keywords Column */}
                                    <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-800/10 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                                Trigger Keywords ({settingsCategoryTab})
                                            </h4>
                                        </div>
                                        
                                        {/* Keywords list */}
                                        <div className="flex flex-wrap gap-1.5 min-h-[4rem] p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg items-start">
                                            {((currentReviewSettings as any)[`${settingsCategoryTab}_keywords`] || []).length === 0 ? (
                                                <span className="text-zinc-400 text-xs italic m-auto self-center">No keywords configured.</span>
                                            ) : (
                                                ((currentReviewSettings as any)[`${settingsCategoryTab}_keywords`] || []).map((keyword: string, idx: number) => (
                                                    <span
                                                        key={`${keyword}-${idx}`}
                                                        className="bg-zinc-100 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-zinc-200/50 dark:border-zinc-800"
                                                    >
                                                        <span>{keyword}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const list = [...((currentReviewSettings as any)[`${settingsCategoryTab}_keywords`] || [])]
                                                                list.splice(idx, 1)
                                                                handleSaveReviewSettings({ [`${settingsCategoryTab}_keywords`]: list })
                                                            }}
                                                            className="text-zinc-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                        </div>

                                        {/* Add Keyword Form */}
                                        <div className="flex gap-2">
                                            <input
                                                id={`new-keyword-input-${settingsCategoryTab}`}
                                                type="text"
                                                placeholder="Type keyword and press Enter..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const target = e.currentTarget
                                                        const val = target.value.trim().toLowerCase()
                                                        if (val) {
                                                            const list = [...((currentReviewSettings as any)[`${settingsCategoryTab}_keywords`] || [])]
                                                            if (!list.includes(val)) {
                                                                list.push(val)
                                                                handleSaveReviewSettings({ [`${settingsCategoryTab}_keywords`]: list })
                                                            }
                                                            target.value = ''
                                                        }
                                                    }
                                                }}
                                                className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const input = document.getElementById(`new-keyword-input-${settingsCategoryTab}`) as HTMLInputElement
                                                    const val = input?.value.trim().toLowerCase()
                                                    if (val) {
                                                        const list = [...((currentReviewSettings as any)[`${settingsCategoryTab}_keywords`] || [])]
                                                        if (!list.includes(val)) {
                                                            list.push(val)
                                                            handleSaveReviewSettings({ [`${settingsCategoryTab}_keywords`]: list })
                                                        }
                                                        input.value = ''
                                                    }
                                                }}
                                                className="px-3.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs rounded-lg transition-all active:scale-95"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Templates Column */}
                                    <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-800/10 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                                        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                            Reply Templates ({settingsCategoryTab})
                                        </h4>

                                        {/* Templates list */}
                                        <div className="space-y-2 max-h-[14rem] overflow-y-auto pr-1">
                                            {((currentReviewSettings as any)[`${settingsCategoryTab}_templates`] || []).length === 0 ? (
                                                <p className="text-zinc-400 text-xs italic text-center py-6">No reply templates configured. Add one below.</p>
                                            ) : (
                                                ((currentReviewSettings as any)[`${settingsCategoryTab}_templates`] || []).map((template: string, idx: number) => (
                                                    <div
                                                        key={`${template}-${idx}`}
                                                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex gap-3 shadow-sm items-start relative group border-zinc-200 dark:border-zinc-800"
                                                    >
                                                        <p className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 whitespace-pre-wrap">{template}</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const list = [...((currentReviewSettings as any)[`${settingsCategoryTab}_templates`] || [])]
                                                                list.splice(idx, 1)
                                                                handleSaveReviewSettings({ [`${settingsCategoryTab}_templates`]: list })
                                                            }}
                                                            className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Template"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add Template Area */}
                                        <div className="space-y-2">
                                            <textarea
                                                id={`new-template-textarea-${settingsCategoryTab}`}
                                                rows={2}
                                                placeholder="Write a new template to add to this category..."
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const textar = document.getElementById(`new-template-textarea-${settingsCategoryTab}`) as HTMLTextAreaElement
                                                    const val = textar?.value.trim()
                                                    if (val) {
                                                        const list = [...((currentReviewSettings as any)[`${settingsCategoryTab}_templates`] || [])]
                                                        if (!list.includes(val)) {
                                                            list.push(val)
                                                            handleSaveReviewSettings({ [`${settingsCategoryTab}_templates`]: list })
                                                        }
                                                        textar.value = ''
                                                    }
                                                }}
                                                className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs rounded-lg transition-all active:scale-95 text-center"
                                            >
                                                Add Template
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Automation Rules match configuration */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Rules list */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Keyword & Exact Match Rules</h2>
                                <p className="text-xs text-zinc-500">View current matching rule triggers that send instant automated template replies.</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                            <th className="pb-3 pr-4">Type</th>
                                            <th className="pb-3 px-4">Pattern (Trigger)</th>
                                            <th className="pb-3 px-4">Reply Content</th>
                                            <th className="pb-3 pl-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                                        {rules.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-zinc-500 text-xs">
                                                    No match rules created yet. Add one on the right to start automating!
                                                </td>
                                            </tr>
                                        ) : (
                                            rules.map((rule) => (
                                                <tr key={rule.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/10">
                                                    <td className="py-3 pr-4 font-semibold text-zinc-800 dark:text-zinc-200">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            rule.match_type === 'exact' 
                                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' 
                                                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                                                        }`}>
                                                            {rule.match_type.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-zinc-700 dark:text-zinc-300">&quot;{rule.pattern}&quot;</td>
                                                    <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">{rule.reply_content}</td>
                                                    <td className="py-3 pl-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                            className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Rule"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Add new rule form */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Add Automation Rule</h2>
                                <p className="text-xs text-zinc-500">Define a new pattern to match and instant reply template.</p>
                            </div>

                            <form onSubmit={handleAddRule} className="space-y-4">
                                {/* Rule Type */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Match Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNewRuleType('keyword')}
                                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                newRuleType === 'keyword'
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            Keyword Match
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewRuleType('exact')}
                                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                newRuleType === 'exact'
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            Exact Match
                                        </button>
                                    </div>
                                </div>

                                {/* Trigger Pattern */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trigger Pattern</label>
                                    <input
                                        type="text"
                                        placeholder={newRuleType === 'exact' ? 'e.g., hello' : 'e.g., return'}
                                        value={newRulePattern}
                                        onChange={(e) => setNewRulePattern(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-zinc-100"
                                    />
                                    <p className="text-[10px] text-zinc-400">
                                        {newRuleType === 'exact' 
                                            ? 'Triggers only if message is exactly equal to this text.' 
                                            : 'Triggers if trigger phrase is found anywhere inside message.'
                                        }
                                    </p>
                                </div>

                                {/* Reply Text */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Response Message</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Write response message here..."
                                        value={newRuleReply}
                                        onChange={(e) => setNewRuleReply(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-zinc-100"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition-all active:scale-[0.98]"
                                >
                                    Add Rule
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox Overlay */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors z-10"
                    >
                        <X size={20} />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Full size"
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain border border-white/10"
                    />
                </div>
            )}

            {/* Daraz Chat Account Connections Modal */}
            <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-lg font-bold">
                            <Store className="text-orange-500" /> Daraz Chat Account
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Authorize each store for the <strong>Bagmati Traders IM Chat</strong> app (AppKey: 505350) to enable automated messaging and AI replies.
                        </p>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-950 max-h-64 overflow-y-auto">
                            {stores.length === 0 ? (
                                <p className="p-4 text-center text-xs text-zinc-500">No stores found.</p>
                            ) : (
                                stores.map(store => {
                                    const isConnected = connectedChatStores.includes(store.id)
                                    const isConnectingThis = connectingStoreId === store.id
                                    return (
                                        <div key={store.id} className="p-4 flex items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200 truncate">{store.company_name}</p>
                                                <p className="text-[11px] text-zinc-500 truncate">{store.seller_account}</p>
                                            </div>
                                            <button
                                                disabled={isConnectingThis}
                                                onClick={() => handleConnectChat(store.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 ${
                                                    isConnected
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                                                }`}
                                            >
                                                {isConnectingThis ? 'Redirecting...' : isConnected ? 'Connected (Re-Auth)' : 'Connect Chat'}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add / Edit Note Modal */}
            <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-lg font-bold">
                            <MessageSquare className="text-orange-500" /> {selectedOrderForNote?.remarks ? 'Edit Note' : 'Add Note'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                            <p>Order Number: <strong>{selectedOrderForNote?.order_number}</strong></p>
                            <p>Status: <span className="uppercase font-bold">{selectedOrderForNote?.order_status}</span></p>
                        </div>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Enter notes / remarks (e.g. Color family, specific design request, packaging request...)"
                            className="w-full h-32 p-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-zinc-100 placeholder:text-zinc-450"
                            maxLength={1000}
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setIsNoteModalOpen(false)}
                                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={isSubmittingNote}
                                onClick={handleSaveNote}
                                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                            >
                                {isSubmittingNote ? 'Saving...' : 'Save Note'}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function ChatAiDashboard() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5rem)] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mb-3" />
                <span className="text-sm text-zinc-605 dark:text-zinc-400 font-semibold">Loading Chat & AI Dashboard...</span>
            </div>
        }>
            <ChatAiDashboardContent />
        </Suspense>
    )
}
