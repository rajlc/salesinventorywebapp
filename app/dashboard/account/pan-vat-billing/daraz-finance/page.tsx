'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { DarazFinanceCard } from '../daraz-finance-card'

export default function DarazAccountFinancePage() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 space-y-4 pb-8 overflow-y-auto font-sans">
            {/* Single Clean Consolidated Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 md:px-6 py-3.5 shadow-xs sticky top-0 z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-gray-600 dark:text-gray-400"
                        title="Back to PAN/VAT Billing"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                Daraz Account & Finance
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Live Sync Enabled
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Comprehensive financial breakdown reports, Daraz fee analysis, and order profit tracking
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons & Fiscal Year Filter */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                        href="/dashboard/sales/daraz/profit-tracker"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors"
                    >
                        <ExternalLink size={14} />
                        Profit Tracker Page
                    </Link>

                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fiscal Year:</span>
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Fiscal Years</option>
                            {fiscalYears.map((fy) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name} {fy.is_active ? '(Running)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="px-4 md:px-6">
                <DarazFinanceCard fiscalYearId={fiscalYearId} />
            </div>
        </div>
    )
}
