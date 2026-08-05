'use client'

import { useState, useEffect } from 'react'
import { getDailySalesReport } from '../actions/marketplace-report-actions'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export function DailySalesReport() {
    const [reportData, setReportData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadReport()
    }, [])

    const loadReport = async () => {
        try {
            const data = await getDailySalesReport()
            setReportData(data)
        } catch (error) {
            console.error('Failed to load report:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(reportData.map((item, index) => ({
            'S.N': index + 1,
            'Date': item.date,
            'Courier': item.courier_name,
            'Shipped Qty': item.shipped_qty,
            'Shipped Amount': item.shipped_amount,
            'Delivered Qty': item.delivered_qty,
            'Returning to Seller': item.returning_to_seller_qty,
            'Failed Delivered': item.failed_delivered_qty,
            'Customer Return': item.customer_return_qty,
            'Return Delivered': item.return_delivered_qty
        })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Daily Sales Report")
        XLSX.writeFile(wb, "Daily_Sales_Report.xlsx")
    }

    if (isLoading) {
        return <div className="p-4 text-center">Loading report...</div>
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
                                <th className="px-4 py-3 font-medium">Date</th>
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
                                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                        No data found
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2.5">{index + 1}</td>
                                        <td className="px-4 py-2.5 font-medium">{row.date}</td>
                                        <td className="px-4 py-2.5">{row.courier_name}</td>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
