'use client'

import { Card } from '@/components/ui-shim'
import { ArrowLeft } from 'lucide-react'

import { useEffect, useState } from 'react'
import { getStatementDetails } from '@/features/account/actions/daraz-account-actions'
import { syncDarazFinances } from '@/features/sales/actions/daraz-finance-service'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

interface StatementDetailViewProps {
    period: string
    storeId: string // Need storeId to fetch data
    onBack: () => void
}

export function StatementDetailView({ period, storeId, onBack }: StatementDetailViewProps) {
    const [data, setData] = useState({
        productPricePaidByBuyer: 0,
        coFundedVoucherMax: 0,
        shippingFeePaidByBuyer: 0,
        paymentFee: 0,
        darazCoinsDiscount: 0,
        freeShippingMaxFee: 0,
        commissionFee: 0,
        shippingFee: 0,
        shippingFeeDiscount: 0,
        coFundedVoucherMaxReversal: 0,
        productPriceRefunded: 0,
        gstWithholding: 0,
        handlingFeeReturn: 0,
        handlingFee: 0,
        paymentFeeRefunded: 0,
        darazCoinsReversal: 0,
        freeShippingNaxReversal: 0,
        commissionFeeRefunded: 0
     })
    const [isLoading, setIsLoading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    const parsePeriod = () => {
        const [startStr, endStr] = period.split(' - ')
        const startDateObj = new Date(startStr)
        const endDateObj = new Date(endStr)
        
        const startDate = startDateObj.toISOString()
        endDateObj.setHours(23, 59, 59, 999)
        const endDate = endDateObj.toISOString()

        // For API sync, we need YYYY-MM-DD
        const startSyncDate = startDateObj.toISOString().split('T')[0]
        const endSyncDate = endDateObj.toISOString().split('T')[0]

        return { startDate, endDate, startSyncDate, endSyncDate }
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const { startDate, endDate } = parsePeriod()
            // @ts-ignore
            const res = await getStatementDetails(storeId, startDate, endDate)
            setData(res)
        } catch (error) {
            console.error(error)
            toast.error('Failed to load statement details')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [period, storeId])

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const { startSyncDate, endSyncDate } = parsePeriod()
            const result = await syncDarazFinances(storeId, startSyncDate, endSyncDate)
            toast.success(result.message)
            // Re-fetch data after sync
            await fetchData()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || 'Sync failed')
        } finally {
            setIsSyncing(false)
        }
    }

    const formatCurrency = (val: number) => {
        return `NPR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // Calculate Closing Balance (Sum of everything)
    const closingBalance = Object.values(data).reduce((acc, val) => acc + val, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Statement Details</h2>
                    <p className="text-sm text-gray-500">{period}</p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing || isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Data'}
                    </button>
                </div>
            </div>

            {/* Details Table */}
            <Card className={`overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 ${isLoading ? 'opacity-50' : ''}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                            <tr className="border-b border-gray-200 dark:border-zinc-800">
                                <th className="px-6 py-4 w-1/4">Fee Type</th>
                                <th className="px-6 py-4 w-1/2">Fee Name</th>
                                <th className="px-6 py-4 w-1/4 text-right">Fee Amount (NPR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {/* Opening Balance */}
                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50">
                                <td className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">Opening Balance</td>
                                <td className="px-6 py-3"></td>
                                <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-gray-100">NPR 0.00</td>
                            </tr>

                            {/* Delivered Orders */}
                            <SectionRow
                                title="Delivered Orders"
                                items={[
                                    { label: "Co-funded Voucher Max", value: data.coFundedVoucherMax },
                                    { label: "Shipping Fee Paid by Buyer", value: data.shippingFeePaidByBuyer },
                                    { label: "Product Price Paid by Buyer", value: data.productPricePaidByBuyer }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Transaction Fees */}
                            <SectionRow
                                title="Transaction Fees"
                                items={[
                                    { label: "Payment Fee", value: data.paymentFee },
                                    { label: "Daraz Coins Discount Participation Fee", value: data.darazCoinsDiscount },
                                    { label: "Free Shipping Max Fee", value: data.freeShippingMaxFee },
                                    { label: "Commission Fee", value: data.commissionFee },
                                    { label: "Shipping Fee", value: data.shippingFee },
                                    { label: "Shipping Fee Discount", value: data.shippingFeeDiscount }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Returned Orders */}
                            <SectionRow
                                title="Returned Orders"
                                items={[
                                    { label: "Co-funded Voucher Max Reversal", value: data.coFundedVoucherMaxReversal },
                                    { label: "Product Price Refunded to Buyer", value: data.productPriceRefunded }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Withholding */}
                            <SectionRow
                                title="Withholding"
                                items={[
                                    { label: "General Sales Tax Withholding", value: data.gstWithholding },
                                    { label: "General Sales Tax Withholding ", value: 0 } // Kept distinct as requested, though seemingly duplicate
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Logistics & Fulfillment Services */}
                            <SectionRow
                                title="Logistics & Fulfillment Services"
                                items={[
                                    { label: "Handling Fee for Return", value: data.handlingFeeReturn },
                                    { label: "Handling Fee", value: data.handlingFee }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Transaction Fees Refunded */}
                            <SectionRow
                                title="Transaction Fees Refunded"
                                items={[
                                    { label: "Payment Fee Refunded", value: data.paymentFeeRefunded },
                                    { label: "Reversal of DARAZ Coins Discount Participation Fee", value: data.darazCoinsReversal },
                                    { label: "Reversal of Free Shipping Max Fee", value: data.freeShippingNaxReversal },
                                    { label: "Commission Fee Refunded", value: data.commissionFeeRefunded }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Closing Balance */}
                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50 border-t-2 border-gray-200 dark:border-zinc-700">
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">Closing Balance</td>
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4 text-right font-bold font-mono text-gray-900 dark:text-gray-100">
                                    {formatCurrency(closingBalance)}
                                </td>
                            </tr>

                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

function SectionRow({ title, items, formatCurrency }: { title: string, items: { label: string, value: number }[], formatCurrency: (v: number) => string }) {
    // Calculate Subtotal (Sum of values)
    const subtotal = items.reduce((sum, item) => sum + item.value, 0)

    return (
        <>
            {/* First row with Title and Subtotal */}
            <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 group">
                <td className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300 align-top pt-4" rowSpan={items.length + 1}>
                    {title}
                </td>
                <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-gray-50 dark:border-zinc-800/50 pt-4">
                    Subtotal
                </td>
                <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100 border-b border-gray-50 dark:border-zinc-800/50 pt-4">
                    {formatCurrency(subtotal)}
                </td>
            </tr>
            {/* Item rows */}
            {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                    {/* First column is spanned by the parent */}
                    <td className="px-6 py-2 text-gray-500 dark:text-gray-400 pl-6">
                        {item.label}
                    </td>
                    <td className="px-6 py-2 text-right text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {item.value !== 0 ? formatCurrency(item.value) : '-'}
                    </td>
                </tr>
            ))}
        </>
    )
}
