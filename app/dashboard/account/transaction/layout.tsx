'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    ArrowLeft,
    ArrowLeftRight,
    Landmark,
    CheckCircle2,
    TrendingUp,
    BellRing,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const SUBPAGES = [
    {
        name: 'CashFlow',
        href: '/dashboard/account/transaction/cash-flow',
        icon: ArrowLeftRight,
    },
    {
        name: 'Bank Statement',
        href: '/dashboard/account/transaction/bank-statement',
        icon: Landmark,
    },
    {
        name: 'Daraz & Courier Settlement',
        href: '/dashboard/account/transaction/settlements',
        icon: CheckCircle2,
    },
    {
        name: 'Net Worth',
        href: '/dashboard/account/transaction/net-worth',
        icon: TrendingUp,
    },
]

export default function TransactionLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [pendingSmsCount, setPendingSmsCount] = useState(0)
    const [latestToast, setLatestToast] = useState<string | null>(null)

    useEffect(() => {
        const fetchPendingCount = async () => {
            const { count } = await supabase
                .from('pending_bank_sms_alerts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')
            setPendingSmsCount(count || 0)
        }

        fetchPendingCount()

        const channel = supabase
            .channel('pending-bank-sms-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'pending_bank_sms_alerts' },
                (payload: any) => {
                    const row = payload?.new
                    fetchPendingCount()
                    if (row) {
                        const dir = row.direction === 'credit' ? 'Credited' : 'Debited'
                        setLatestToast(
                            `New Bank SMS (${row.sender_id}): ${dir} Rs ${Number(row.amount || 0).toLocaleString()} — Review in Bank Statement`
                        )
                        setTimeout(() => setLatestToast(null), 9000)
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pending_bank_sms_alerts' },
                () => {
                    fetchPendingCount()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <div className="flex flex-col min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header + Subpage Tabs */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 shadow-sm">
                <div className="px-4 md:px-6 pt-3 pb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/account"
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300"
                            title="Back to Finance & Accounts"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                                Finance &amp; Accounts — Transaction
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                CashFlow, Bank Statement, Daraz &amp; Courier Settlements, and Real-Time Net Worth
                            </p>
                        </div>
                    </div>

                    {pendingSmsCount > 0 && (
                        <Link
                            href="/dashboard/account/transaction/bank-statement#sms-alerts"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold hover:bg-amber-200 transition-colors"
                        >
                            <BellRing className="h-4 w-4 animate-pulse" />
                            <span>{pendingSmsCount} Bank SMS Pending Approval</span>
                        </Link>
                    )}
                </div>

                {/* 4 Subpages Navigation Bar */}
                <div className="px-4 md:px-6 flex gap-1 overflow-x-auto">
                    {SUBPAGES.map((tab) => {
                        const Icon = tab.icon
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{tab.name}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Live Realtime Toast for Incoming Bank SMS */}
            {latestToast && (
                <div className="mx-4 md:mx-6 mt-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100 font-medium">
                        <BellRing className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>{latestToast}</span>
                    </div>
                    <Link
                        href="/dashboard/account/transaction/bank-statement#sms-alerts"
                        className="text-xs font-semibold px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 shrink-0"
                    >
                        Review Now
                    </Link>
                </div>
            )}

            <div className="flex-1 p-4 md:p-6">{children}</div>
        </div>
    )
}
