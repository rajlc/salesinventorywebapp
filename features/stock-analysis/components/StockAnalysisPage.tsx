'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, RefreshCw } from 'lucide-react'
import { StockAnalysisTable } from './StockAnalysisTable'
import { Card } from '@/components/ui-shim'
import { getStockAnalysisData } from '../actions/stock-analysis-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { useEffect } from 'react'

export function StockAnalysisPage() {
    // defaults
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [companyId, setCompanyId] = useState<string>('all')
    const [search, setSearch] = useState('')

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFy } = useActiveFiscalYear()

    // Fetch company details
    const { data: companies = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Initialize with active FY
    useEffect(() => {
        if (activeFy && fiscalYearId === 'all') {
            setFiscalYearId(activeFy.id)
        }
    }, [activeFy])

    // Data query
    const { data: stockData = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['stock-analysis', fiscalYearId, companyId, search],
        queryFn: () => getStockAnalysisData({
            fiscalYearId,
            companyId: companyId !== 'all' ? companyId : undefined,
            search: search || undefined
        }),
    })

    const handleClearFilters = () => {
        if (activeFy) {
            setFiscalYearId(activeFy.id)
        } else {
            setFiscalYearId('all') // fallback
        }
        setCompanyId('all')
        setSearch('')
    }

    return (
        <Card className="overflow-hidden">
            {/* Filters */}
            <div className="p-3 border-b dark:border-zinc-800">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Company Name Dropdown */}
                    <div className="flex-1">
                        <select
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        >
                            <option value="all">All Companies</option>
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                    {company.company_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fiscal Year Filter */}
                    <div className="flex-1">
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        >
                            <option value="all">All Time (Since 2000)</option>
                            {fiscalYears.map((fy) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search Filter */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by product name..."
                            className="w-full pl-9 pr-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {(companyId !== 'all' || fiscalYearId !== 'all' || search) && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear Filters
                            </button>
                        )}
                        <button
                            onClick={() => refetch()}
                            disabled={isLoading || isRefetching}
                            className="p-1.5 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <StockAnalysisTable
                data={stockData}
                isLoading={isLoading}
            />
        </Card>
    )
}
