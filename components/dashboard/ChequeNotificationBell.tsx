'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, X, Calendar, CheckCircle2, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getChequeNotifications, ChequeNotification } from '@/features/suppliers/actions/supplier-transaction-actions'

export default function ChequeNotificationBell() {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const { data: notifications = [], refetch, isFetching } = useQuery<ChequeNotification[]>({
        queryKey: ['cheque-notifications'],
        queryFn: () => getChequeNotifications(),
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    })

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const count = notifications.length

    const handleItemClick = (supplierId: string) => {
        setIsOpen(false)
        router.push(`/dashboard/suppliers/suppliers-account/${supplierId}`)
    }

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                onClick={() => {
                    setIsOpen(!isOpen)
                    refetch()
                }}
                className="relative p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-zinc-800 focus:outline-none transition-colors"
                title="Cheque Notifications"
                aria-label="Cheque Notifications"
            >
                <Bell size={20} className={count > 0 ? "text-slate-700 dark:text-slate-200" : "text-gray-500"} />

                {/* Notification Badge Counter */}
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full shadow-xs animate-pulse">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-[999] overflow-hidden animate-in fade-in duration-150">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-blue-600 dark:text-blue-400" />
                            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                Cheque Reminders
                            </h3>
                            {count > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 rounded-full font-bold">
                                    {count} {count === 1 ? 'due' : 'dues'}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center gap-2">
                                <CheckCircle2 size={24} className="text-emerald-500 opacity-80" />
                                <span>No pending cheques due today or tomorrow.</span>
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item.supplier_id)}
                                    className={`p-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                                        item.isToday ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                                    }`}
                                >
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            {item.isToday ? (
                                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                                    Today
                                                </span>
                                            ) : item.isTomorrow ? (
                                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                    Tomorrow
                                                </span>
                                            ) : (
                                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300">
                                                    Yesterday
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {item.date}
                                            </span>
                                        </div>

                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                                            {item.text}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400 shrink-0 self-center" />
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 text-center">
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                router.push('/dashboard/suppliers/suppliers-transaction')
                            }}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                        >
                            View All Transactions &rarr;
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
