'use client'

import { useState, useEffect } from 'react'
import { getOrderSummaryReport } from '../actions/marketplace-report-actions'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export function OrderSummaryReport() {
    const [reportData, setReportData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadReport()
    }, [])

    const loadReport = async () => {
        try {
            const data = await getOrderSummaryReport()
            setReportData(data)
        } catch (error) {
            console.error('Failed to load summary report:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Calculate totals
    const totals = reportData.reduce((acc, row) => ({
        shipped_qty: acc.shipped_qty + row.shipped_qty,
        shipped_amount: acc.shipped_amount + row.shipped_amount,
        delivered_qty: acc.delivered_qty + row.delivered_qty,
        returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
        failed_delivered_qty: acc.failed_delivered_qty + row.failed_delivered_qty,
        customer_return_qty: acc.customer_return_qty + row.customer_return_qty,
        return_delivered_qty: acc.return_delivered_qty + row.return_delivered_qty
    }), {
        shipped_qty: 0,
        shipped_amount: 0,
        delivered_qty: 0,
        returning_to_seller_qty: 0,
        failed_delivered_qty: 0,
        customer_return_qty: 0,
        return_delivered_qty: 0
    })

    const handleExport = () => {
        const dataToExport = [
            ...reportData.map((item, index) => ({
                'S.N': index + 1,
                'Courier': item.courier_name,
                'Shipped Qty': item.shipped_qty,
                'Shipped Amount': item.shipped_amount,
                'Delivered Qty': item.delivered_qty,
                'Returning to Seller': item.returning_to_seller_qty,
                'Failed Delivered': item.failed_delivered_qty,
                'Customer Return': item.customer_return_qty,
                'Return Delivered': item.return_delivered_qty
            })),
            // Total Row
            {
                'S.N': '',
                'Courier': 'Total',
                'Shipped Qty': totals.shipped_qty,
                'Shipped Amount': totals.shipped_amount,
                'Delivered Qty': totals.delivered_qty,
                'Returning to Seller': totals.returning_to_seller_qty,
                'Failed Delivered': totals.failed_delivered_qty,
                'Customer Return': totals.customer_return_qty,
                'Return Delivered': totals.return_delivered_qty
            }
        ]

        const ws = XLSX.utils.json_to_sheet(dataToExport)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Order Summary")
        XLSX.writeFile(wb, "Order_Summary_Report.xlsx")
    }

    if (isLoading) {
        return <div className="p-4 text-center">Loading summary...</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                >
                    <Download size={16} />
                    Export to Excel
                </button>
            </div>

            <div className="border dark:border-zinc-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">S.N</th>
                                <th className="px-4 py-3 font-medium">Courier</th>
                                <th className="px-4 py-3 font-medium text-center">Shipped Qty</th>
                                <th className="px-4 py-3 font-medium text-right">Shipped Amount</th>
                                <th className="px-4 py-3 font-medium text-center">Delivered Qty</th>
                                <th className="px-4 py-3 font-medium text-center">Returning to Seller</th>
                                <th className="px-4 py-3 font-medium text-center">Failed Delivered</th>
                                <th className="px-4 py-3 font-medium text-center">Customer Return</th>
                                <th className="px-4 py-3 font-medium text-center">Return Delivered</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                        No data found
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {reportData.map((row, index) => (
                                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-2.5">{index + 1}</td>
                                            <td className="px-4 py-2.5 font-medium">{row.courier_name}</td>
                                            <td className="px-4 py-2.5 text-center">{row.shipped_qty || '-'}</td>
                                            <td className="px-4 py-2.5 text-right font-medium text-green-600">
                                                {row.shipped_amount ? `Rs ${row.shipped_amount.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">{row.delivered_qty || '-'}</td>
                                            <td className="px-4 py-2.5 text-center">{row.returning_to_seller_qty || '-'}</td>
                                            <td className="px-4 py-2.5 text-center">{row.failed_delivered_qty || '-'}</td>
                                            <td className="px-4 py-2.5 text-center">{row.customer_return_qty || '-'}</td>
                                            <td className="px-4 py-2.5 text-center">{row.return_delivered_qty || '-'}</td>
                                        </tr>
                                    ))}
                                    {/* Total Values Row */}
                                    <tr className="bg-gray-100 dark:bg-zinc-800 font-bold border-t-2 border-gray-200 dark:border-zinc-700">
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3">Total</td>
                                        <td className="px-4 py-3 text-center">{totals.shipped_qty}</td>
                                        <td className="px-4 py-3 text-right">Rs {totals.shipped_amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">{totals.delivered_qty}</td>
                                        <td className="px-4 py-3 text-center">{totals.returning_to_seller_qty}</td>
                                        <td className="px-4 py-3 text-center">{totals.failed_delivered_qty}</td>
                                        <td className="px-4 py-3 text-center">{totals.customer_return_qty}</td>
                                        <td className="px-4 py-3 text-center">{totals.return_delivered_qty}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
