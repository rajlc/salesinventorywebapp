'use client'

import { useState, useEffect, useMemo } from 'react'
import { getWebsiteOrders } from '@/features/sales/actions/website-orders-actions'
import { CheckCircle2, Truck, ChevronDown, Check, User, Package, Search } from 'lucide-react'
import { Card } from '@/components/ui-shim'

export function WebsiteOrdersList() {
    const [orders, setOrders] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'today' | 'all'>('today')
    const [todaySubTab, setTodaySubTab] = useState<'Confirmed' | 'Packed' | 'Shipped'>('Confirmed')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true)
            try {
                const { orders } = await getWebsiteOrders({ limit: 500 })
                setOrders(orders)
            } catch (error) {
                console.error("Failed to fetch orders", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchOrders()
    }, [])

    const filteredOrders = useMemo(() => {
        let result = orders

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(o => 
                o.sales_id?.toLowerCase().includes(query) ||
                o.customer_name?.toLowerCase().includes(query) ||
                o.phone_number?.includes(query)
            )
        }

        if (activeTab === 'today') {
            const today = new Date().toISOString().split('T')[0]
            result = result.filter(o => o.order_date === today)
            
            if (todaySubTab === 'Confirmed') {
                result = result.filter(o => ['Confirmed', 'Confirmed Order'].includes(o.order_status))
            } else if (todaySubTab === 'Packed') {
                result = result.filter(o => ['Packed', 'Ready to Ship'].includes(o.order_status))
            } else if (todaySubTab === 'Shipped') {
                result = result.filter(o => o.order_status === 'Shipped')
            }
        }

        return result
    }, [orders, activeTab, todaySubTab, searchQuery])

    const getStatusLeftBarColor = (status: string) => {
        const s = status?.toLowerCase() || ''
        if (s.includes('confirm')) return 'bg-[#22C55E]'
        if (s.includes('pack') || s.includes('ready')) return 'bg-[#6366F1]'
        if (s.includes('ship')) return 'bg-[#3B82F6]'
        if (s.includes('cancel')) return 'bg-[#EF4444]'
        return 'bg-[#F59E0B]' // Pending
    }

    const getStatusBadgeStyle = (status: string) => {
        const s = status?.toLowerCase() || ''
        if (s.includes('confirm')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
        if (s.includes('pack') || s.includes('ready')) return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
        if (s.includes('ship')) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
        if (s.includes('cancel')) return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
        return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header / Tabs */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                        <button
                            onClick={() => setActiveTab('today')}
                            className={`px-4 py-1.5 text-[13px] font-semibold rounded-md transition-all ${activeTab === 'today' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                        >
                            Today Orders
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-1.5 text-[13px] font-semibold rounded-md transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                        >
                            All Orders
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search by ID, Name, Phone..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {activeTab === 'today' && (
                    <div className="flex gap-4 mt-3 pl-1">
                        {['Confirmed', 'Packed', 'Shipped'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setTodaySubTab(status as any)}
                                className={`text-[13px] font-bold pb-2 transition-colors border-b-2 ${todaySubTab === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 bg-[#F5F7FA] dark:bg-slate-900 pb-10 pt-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredOrders.length > 0 ? (
                    <div className="flex flex-col gap-[8px]">
                        {filteredOrders.map(order => (
                            <div 
                                key={order.id} 
                                className="relative bg-white dark:bg-slate-800 rounded-[12px] min-h-[140px] p-[12px_16px] flex flex-col md:flex-row md:items-start gap-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-slate-700/50"
                            >
                                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${getStatusLeftBarColor(order.order_status)}`}></div>

                                {/* Section 1: LEFT SIDE (26%) */}
                                <div className="flex flex-col w-full md:w-[26%] pl-2 shrink-0 border-b md:border-b-0 border-gray-100 pb-3 md:pb-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[13px] font-[500] text-[#475467] dark:text-slate-400">Order No. {order.sales_id}</span>
                                        {order.platform === 'Website' && (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">
                                                Website
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-1">
                                        <div className="text-[13px] text-[#667085] dark:text-slate-400">
                                            {new Date(order.order_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div className="text-[14px] font-[500] text-slate-800 dark:text-slate-200">
                                            {order.customer_name}
                                        </div>
                                        <div className="text-[18px] font-[700] text-[#111827] dark:text-white mt-0.5 tracking-tight">
                                            {order.phone_number}
                                            {order.alternative_phone && (
                                                <span className="text-[11px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded ml-2 font-bold align-middle">ALT</span>
                                            )}
                                        </div>
                                        <div className="text-[14px] font-[600] leading-[1.4] text-slate-700 dark:text-slate-300 mt-1 line-clamp-2" title={order.address}>
                                            <span className="opacity-80">📍</span> {order.address} {order.city && `, ${order.city}`}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: PRODUCTS (34%) */}
                                <div className="flex flex-col w-full md:w-[34%] shrink-0 pr-0 md:pr-4">
                                    <div className="grid grid-cols-[1fr_50px_80px] gap-2 mb-2 text-[12px] font-[600] text-[#667085] dark:text-slate-400 uppercase tracking-wide">
                                        <div>Product Name</div>
                                        <div className="text-center">Qty</div>
                                        <div className="text-right">Amount</div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-[4px]">
                                        {order.items && order.items.length > 0 ? (
                                            order.items.map((item: any, idx: number) => (
                                                <div key={idx} className="grid grid-cols-[1fr_50px_80px] gap-2 items-center">
                                                    <div className="text-[14px] font-[500] leading-[1.3] text-slate-800 dark:text-slate-200 break-words line-clamp-2">
                                                        {item.product_name}
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <div className="bg-[#EEF2FF] text-[#4338CA] dark:bg-indigo-900/30 dark:text-indigo-300 h-[28px] min-w-[28px] px-2 rounded-[8px] text-[13px] font-[700] flex items-center justify-center">
                                                            {item.quantity}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <div className="bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-900/30 dark:text-blue-300 py-[6px] px-[10px] rounded-[8px] text-[13px] font-[700] whitespace-nowrap">
                                                            Rs. {item.amount}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-slate-400 italic text-[13px]">No products listed</div>
                                        )}
                                    </div>

                                    {order.remarks && (
                                        <div className="mt-3 bg-[#F8FAFC] dark:bg-slate-700/50 border border-[#E2E8F0] dark:border-slate-600 p-[10px_12px] rounded-[10px]">
                                            <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Remarks</div>
                                            <div className="text-[13px] text-[#475467] dark:text-slate-300">
                                                {order.remarks}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 3: TOTALS (17%) */}
                                <div className="flex flex-col w-full md:w-[17%] shrink-0 border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-700/50 pt-3 md:pt-0 md:pl-4 justify-center md:justify-start">
                                    <div className="text-[12px] text-[#667085] dark:text-slate-400 uppercase font-semibold">Grand Total</div>
                                    <div className="text-[22px] font-[800] tracking-[-0.01em] text-[#111827] dark:text-white leading-none mt-1">
                                        Rs. {order.total_amount}
                                    </div>
                                    
                                    <div className="h-[1px] bg-[#EAECF0] dark:bg-slate-700 my-[14px]"></div>
                                    
                                    <div className="flex flex-col gap-2 text-[14px] font-[600] text-[#344054] dark:text-slate-300">
                                        {order.courier_provider ? (
                                            <>
                                                <div className="flex items-center gap-2"><Truck size={16} className="text-slate-400" /> {order.logistic_name || order.courier_provider}</div>
                                                <div className="flex items-center gap-2"><span className="opacity-70 text-[16px]">📍</span> {order.delivery_branch || order.city || '-'}</div>
                                            </>
                                        ) : (
                                            <div className="text-slate-400 font-normal italic text-[13px]">Unassigned Courier</div>
                                        )}
                                    </div>
                                </div>

                                {/* Section 4: ACTIONS (17%) */}
                                <div className="flex flex-col w-full md:w-[17%] shrink-0 pt-3 md:pt-0 items-start md:items-end justify-start h-full md:pr-2">
                                    <div className={`h-[30px] px-[12px] rounded-full text-[12px] font-[700] flex items-center justify-center whitespace-nowrap self-start md:self-end ${getStatusBadgeStyle(order.order_status)}`}>
                                        <div className="flex items-center gap-1.5">
                                            {(order.order_status === 'Confirmed Order' || order.order_status === 'Confirmed') && <CheckCircle2 size={14} />}
                                            {order.order_status === 'Ready to Ship' ? 'Packed' : order.order_status}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
                        <Package size={48} className="mb-3 opacity-20 text-slate-400" />
                        <p className="text-[15px] font-medium text-slate-600">No orders found</p>
                    </div>
                )}
            </div>
        </div>
    )
}
