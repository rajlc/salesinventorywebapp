'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, Lock } from "lucide-react"

interface AuditTrailHoverProps {
    children: React.ReactNode
    order: any
}

export function AuditTrailHover({ children, order }: AuditTrailHoverProps) {
    const [isVisible, setIsVisible] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsVisible(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false)
        }, 300)
    }

    // Helper to format timestamp
    const formatTime = (isoString: string | null) => {
        if (!isoString) return null
        return new Date(isoString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        })
    }

    // Identify who performed the action
    const formatUser = (name: string | null, email: string | null, source: string | null) => {
        if (!name && !email) {
            return "Daraz Sync"
        }
        return name || email || "Unknown"
    }

    const events = [
        {
            status: 'Created',
            date: order.created_at,
            user: formatUser(order.created_by_name, order.created_by_email, order.import_source),
            color: 'text-gray-500'
        },
        {
            status: 'Shipped',
            date: order.shipped_at,
            user: formatUser(order.shipped_by_name, order.shipped_by_email, null),
            color: 'text-blue-600'
        },
        {
            status: 'Delivered',
            date: order.delivered_at,
            user: formatUser(order.delivered_by_name, order.delivered_by_email, null),
            color: 'text-green-600'
        },
        {
            status: 'Failed Delivered',
            date: order.fail_delivered_at,
            user: formatUser(order.fail_delivered_by_name, order.fail_delivered_by_email, null),
            color: 'text-red-600'
        },
        {
            status: 'Delivery Failed',
            date: order.delivery_failed_at,
            user: formatUser(order.delivery_failed_by_name, order.delivery_failed_by_email, null),
            color: 'text-red-600'
        },
        {
            status: 'Returning to Seller',
            date: order.returning_to_seller_at,
            user: formatUser(order.returning_to_seller_by_name, order.returning_to_seller_by_email, null),
            color: 'text-orange-600'
        },
        {
            status: 'Customer Return Delivered',
            date: order.customer_return_delivered_at,
            user: formatUser(order.customer_return_delivered_by_name, order.customer_return_delivered_by_email, null),
            color: 'text-orange-800'
        },
        {
            status: 'Returned Delivered',
            date: order.returned_delivered_at,
            user: formatUser(order.returned_delivered_by_name, order.returned_delivered_by_email, null),
            color: 'text-green-700'
        },
        {
            status: 'Cancelled',
            date: order.cancelled_at,
            user: formatUser(order.cancelled_by_name, order.cancelled_by_email, null),
            color: 'text-red-700'
        }
    ].filter(e => e.date)

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="cursor-help inline-block">
                {children}
            </div>

            {isVisible && (
                <div className="absolute left-0 bottom-full mb-2 w-80 z-50 bg-white dark:bg-zinc-900 border dark:border-zinc-800 shadow-xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
                    <div className="bg-gray-50 dark:bg-zinc-800 p-3 border-b dark:border-zinc-700 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Audit Trail</h4>
                        <div title="Timestamps are immutable">
                            <Lock size={12} className="text-gray-400" />
                        </div>
                    </div>
                    <div className="p-3 space-y-3 relative">
                        {/* Vertical Line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-zinc-800 z-0"></div>

                        {events.map((event, idx) => (
                            <div key={idx} className="relative z-10 flex gap-3 text-sm">
                                <div className="mt-0.5 min-w-[14px] h-[14px] rounded-full border-2 border-white dark:border-zinc-900 bg-gray-300 dark:bg-zinc-700 flex items-center justify-center shadow-sm">
                                    <div className={`w-1.5 h-1.5 rounded-full ${event.status === 'Shipped' ? 'bg-blue-500' :
                                        event.status === 'Delivered' ? 'bg-green-500' :
                                            event.status === 'Failed' ? 'bg-red-500' :
                                                event.status === 'Returned' ? 'bg-orange-500' :
                                                    'bg-gray-500'
                                        }`}></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <span className={`font-medium ${event.color}`}>{event.status}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums text-right ml-2 leading-tight">
                                            {formatTime(event.date)}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        by <span className="font-medium text-gray-700 dark:text-gray-300">{event.user}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {events.length === 0 && (
                            <div className="text-xs text-gray-400 text-center py-2">
                                No history recorded.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
