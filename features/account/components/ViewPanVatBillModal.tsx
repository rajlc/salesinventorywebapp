'use client'

import { useState, useEffect } from 'react'
import { X, Edit } from 'lucide-react'
import { getPanVatBillById, type PanVatBill } from '@/features/account/actions/pan-vat-bill-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { AddPanVatBillModal } from './AddPanVatBillModal'

interface ViewPanVatBillModalProps {
    billId: string
    onClose: () => void
}

export function ViewPanVatBillModal({ billId, onClose }: ViewPanVatBillModalProps) {
    const [bill, setBill] = useState<PanVatBill | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEditMode, setIsEditMode] = useState(false)

    useEffect(() => {
        const fetchBill = async () => {
            try {
                const data = await getPanVatBillById(billId)
                setBill(data)
            } catch (error) {
                console.error('Error fetching bill:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchBill()
    }, [billId])

    if (isEditMode && bill) {
        return (
            <AddPanVatBillModal
                onClose={() => {
                    setIsEditMode(false)
                    onClose()
                }}
                bill={bill}
            />
        )
    }

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg">
                    <p>Loading bill details...</p>
                </div>
            </div>
        )
    }

    if (!bill) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg">
                    <p>Bill not found</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">
                        Close
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Purchase Bill</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Bill Content */}
                <div className="p-8">
                    {/* Row 1: Supplier Company Name - Center */}
                    <div className="text-center mb-4">
                        <h3 className="text-2xl font-bold">{bill.supplier_company_name || 'N/A'}</h3>
                    </div>

                    {/* Row 2: Supplier PAN/VAT (left) | Issue Date AD (right) */}
                    <div className="flex justify-between mb-2">
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Supplier PAN/VAT: </span>
                            <span className="font-medium">{bill.supplier_pan_vat || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Issue Date (A.D): </span>
                            <span className="font-medium">{new Date(bill.issue_bill_date_ad).toLocaleDateString('en-GB')}</span>
                        </div>
                    </div>

                    {/* Row 3: Buyer Company Name (left) | Issue Date BS (right) */}
                    <div className="flex justify-between mb-2">
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Buyer: </span>
                            <span className="font-medium">{bill.buyer_company_name || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Issue Date (B.S): </span>
                            <span className="font-medium">{bill.issue_bill_date_bs}</span>
                        </div>
                    </div>

                    {/* Row 4: Buyer PAN/VAT (left) | Invoice No (right) */}
                    <div className="flex justify-between mb-6">
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Buyer PAN/VAT: </span>
                            <span className="font-medium">{bill.buyer_pan_vat || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Invoice No: </span>
                            <span className="font-medium">{bill.invoice_no}</span>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border dark:border-zinc-700 rounded-lg overflow-hidden mb-4">
                        <table className="w-full">
                            <thead className="bg-gray-100 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">S.N</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">H.S Code</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Particulars</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Quantity</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Rate</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {bill.items?.map((item, index) => (
                                    <tr key={item.id || index}>
                                        <td className="px-4 py-3 text-sm">{index + 1}</td>
                                        <td className="px-4 py-3 text-sm">{item.hs_code || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{item.particulars}</td>
                                        <td className="px-4 py-3 text-sm text-right">{item.quantity} {item.unit || 'Pcs'}</td>
                                        <td className="px-4 py-3 text-sm text-right">{formatNepaliCurrency(item.rate)}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">{formatNepaliCurrency(item.amount)}</td>
                                    </tr>
                                ))}

                                {/* Sub Total Row */}
                                <tr className="bg-gray-50 dark:bg-zinc-800/50">
                                    <td colSpan={4} className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">Sub Total Amount</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">{formatNepaliCurrency(bill.sub_total_amount)}</td>
                                </tr>

                                {/* Discount Row */}
                                {bill.discount && bill.discount > 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-sm font-semibold text-right">Discount</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-right">-{formatNepaliCurrency(bill.discount)}</td>
                                    </tr>
                                ) : null}

                                {/* Excise Duty Row */}
                                {bill.excise_duty && bill.excise_duty > 0 ? (
                                    <tr className="bg-gray-50 dark:bg-zinc-800/50">
                                        <td colSpan={4} className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-sm font-semibold text-right">Excise Duty</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-right">{formatNepaliCurrency(bill.excise_duty)}</td>
                                    </tr>
                                ) : null}

                                {/* Taxable Amount Row */}
                                <tr>
                                    <td colSpan={4} className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">Taxable Amount</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">
                                        {formatNepaliCurrency((bill.taxable_amount && bill.taxable_amount > 0) ? bill.taxable_amount : (bill.sub_total_amount - (bill.discount || 0) + (bill.excise_duty || 0)))}
                                    </td>
                                </tr>

                                {/* VAT 13% Row */}
                                <tr className="bg-gray-50 dark:bg-zinc-800/50">
                                    <td colSpan={4} className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">VAT 13%</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">{formatNepaliCurrency(bill.vat_13_percent)}</td>
                                </tr>

                                {/* Total Amount Row */}
                                <tr className="bg-blue-50 dark:bg-blue-900/20">
                                    <td colSpan={4} className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-base font-bold text-right text-blue-600 dark:text-blue-400">Total Amount</td>
                                    <td className="px-4 py-3 text-base font-bold text-right text-blue-600 dark:text-blue-400">{formatNepaliCurrency(bill.total_amount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <Edit className="h-4 w-4" />
                            Edit
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
