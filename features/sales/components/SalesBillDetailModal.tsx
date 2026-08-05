'use client'

import { X, Edit, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { SalesBill, SalesBillItem, getSalesBillById } from '@/features/sales/actions/sales-bill-actions'
import { useQuery } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

interface SalesBillDetailModalProps {
    billId: string
    galleryBillIds?: string[]
    onClose: () => void
    onEdit: (bill: SalesBill) => void
    onNavigateBill?: (billId: string) => void
}

export function SalesBillDetailModal({ billId, galleryBillIds, onClose, onEdit, onNavigateBill }: SalesBillDetailModalProps) {
    // Fetch Bill Details (with items)
    const { data: bill, isLoading } = useQuery({
        queryKey: ['sales-bill', billId],
        queryFn: () => getSalesBillById(billId),
    })

    // Fetch Seller Details to get PAN/VAT
    const { data: companies = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
        enabled: !!bill?.seller_company_id, // Only fetch if we have seller id
        staleTime: 1000 * 60 * 5
    })

    const hasMultipleBills = galleryBillIds && galleryBillIds.length > 1
    const currentIndex = galleryBillIds ? galleryBillIds.indexOf(billId) : -1

    const handlePrev = () => {
        if (!hasMultipleBills || currentIndex === -1) return
        const prevIndex = (currentIndex - 1 + galleryBillIds.length) % galleryBillIds.length
        onNavigateBill?.(galleryBillIds[prevIndex])
    }

    const handleNext = () => {
        if (!hasMultipleBills || currentIndex === -1) return
        const nextIndex = (currentIndex + 1) % galleryBillIds.length
        onNavigateBill?.(galleryBillIds[nextIndex])
    }

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                handlePrev()
            } else if (e.key === 'ArrowRight') {
                handleNext()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentIndex, galleryBillIds])

    if (isLoading || !bill) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
                <div className="bg-white p-4 rounded-md">Loading details...</div>
            </div>
        )
    }

    const seller = companies.find((c: any) => c.id === bill.seller_company_id)

    // Render PAN/VAT numbers in 9 boxes
    const renderPanVatBoxes = (numStr: string | null | undefined) => {
        const clean = (numStr || '').replace(/\D/g, '')
        const digits = clean.split('').slice(0, 9)
        while (digits.length < 9) digits.push('')
        return (
            <div className="flex gap-0.5 inline-flex border border-slate-700">
                {digits.map((digit, idx) => (
                    <span
                        key={idx}
                        className={`w-6 h-6 flex items-center justify-center font-bold text-xs bg-white text-slate-900 ${
                            idx < 8 ? 'border-r border-slate-700' : ''
                        }`}
                    >
                        {digit}
                    </span>
                ))}
            </div>
        )
    }

    // Convert numbers to words (Lakh / Crore scale)
    const numberToWords = (num: number): string => {
        const ones = [
            '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
        ]
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

        const cleanNum = Math.floor(num)
        if (cleanNum === 0) return 'Zero'

        const convertLessThanThousand = (n: number): string => {
            if (n < 20) return ones[n]
            const digit = n % 10
            if (n < 100) return tens[Math.floor(n / 10)] + (digit ? ' ' + ones[digit] : '')
            return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 === 0 ? '' : ' and ' + convertLessThanThousand(n % 100))
        }

        const convert = (n: number): string => {
            if (n < 1000) return convertLessThanThousand(n)
            if (n < 100000) return convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 === 0 ? '' : ' ' + convert(n % 1000))
            if (n < 10000000) return convertLessThanThousand(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 === 0 ? '' : ' ' + convert(n % 100000))
            return convertLessThanThousand(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 === 0 ? '' : ' ' + convert(n % 10000000))
        }

        return convert(cleanNum)
    }

    const amountToWords = (amount: number): string => {
        const paise = Math.round((amount - Math.floor(amount)) * 100)
        const rupeesPart = numberToWords(Math.floor(amount))
        const paisePart = paise > 0 ? ` and Paise ${numberToWords(paise)}` : ''
        return `${rupeesPart} Rupees${paisePart} Only`
    }

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Left and Right navigation buttons for desktop */}
            {hasMultipleBills && (
                <>
                    <button
                        onClick={handlePrev}
                        className="fixed left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full border border-white/20 transition-all shadow-lg hidden md:flex items-center justify-center"
                        title="Previous Invoice (Left Arrow)"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="fixed right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full border border-white/20 transition-all shadow-lg hidden md:flex items-center justify-center"
                        title="Next Invoice (Right Arrow)"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </>
            )}

            <div className="bg-white text-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col relative">
                {/* Header Actions */}
                <div className="flex justify-end items-center gap-4 py-2 px-4 border-b border-slate-100 bg-slate-50/50">
                    {hasMultipleBills && (
                        <div className="flex items-center gap-2 mr-auto text-xs font-semibold text-slate-500">
                            <button
                                onClick={handlePrev}
                                className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-colors"
                                title="Previous Invoice (Left Arrow)"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="font-mono">{currentIndex + 1} / {galleryBillIds.length}</span>
                            <button
                                onClick={handleNext}
                                className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-colors"
                                title="Next Invoice (Right Arrow)"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 bg-white text-slate-900 rounded-b-2xl overflow-y-auto flex-1">
                    {/* Invoice Paper Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-900 pb-3 gap-4">
                        <div className="space-y-1 flex-1">
                            <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase block">Tax Invoice</span>
                            <h2 className="text-2xl font-extrabold uppercase tracking-wide text-slate-800 leading-tight">
                                {seller?.company_name || 'Bagmati Traders & Suppliers'}
                            </h2>
                            <p className="text-[11px] font-medium text-slate-500">
                                {seller?.address || 'KMC-16, BID, Balaju, Kathmandu'}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                                Mobile: 9849080842
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">VAT No:</span>
                                {renderPanVatBoxes(seller?.pan_vat_details || '612072255')}
                            </div>
                        </div>

                        <div className="text-left md:text-right space-y-1 min-w-[200px]">
                            <div>
                                <span className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase block">Invoice Number</span>
                                <span className="text-2xl font-mono font-bold text-red-600 tracking-tight">{bill.invoice_no}</span>
                            </div>
                            <div className="pt-1 text-[11px] text-slate-500 space-y-1 border-t border-slate-100 md:border-t-0 md:pt-0">
                                <div><span className="font-bold text-slate-700">Transaction Date:</span> <span className="font-medium">{bill.bill_date_ad} A.D. ({bill.bill_date_bs} B.S.)</span></div>
                                <div><span className="font-bold text-slate-700">Invoice Date:</span> <span className="font-medium">{bill.bill_date_ad} A.D. ({bill.bill_date_bs} B.S.)</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Buyer / Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-300 pb-3 text-xs">
                        <div className="space-y-1.5">
                            <div className="flex gap-2 items-center">
                                <span className="text-slate-500 font-bold w-24 shrink-0">Buyer's Name:</span>
                                <span className="font-extrabold text-slate-800 border-b border-dashed border-slate-300 flex-1 pb-0.5">{bill.customer_name}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-slate-500 font-bold w-24 shrink-0">Address:</span>
                                <span className="text-slate-700 font-medium border-b border-dashed border-slate-300 flex-1 pb-0.5">{bill.customer_address || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5 md:pl-6">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold w-24 shrink-0">Buyer's VAT No:</span>
                                {renderPanVatBoxes(bill.customer_pan_vat)}
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-slate-500 font-bold w-24 shrink-0">Mode of Payment:</span>
                                <span className="text-slate-700 font-medium border-b border-dashed border-slate-300 flex-1 pb-0.5">Cash / Credit / Cheque</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-left border-b border-slate-300 text-[10px]">
                                <tr>
                                    <th className="px-3 py-2 w-12 border-r border-slate-300 text-center">S.N.</th>
                                    <th className="px-3 py-2 w-28 border-r border-slate-300">H.S. Code</th>
                                    <th className="px-3 py-2 border-r border-slate-300">Particulars</th>
                                    <th className="px-3 py-2 w-20 text-right border-r border-slate-300">Qty.</th>
                                    <th className="px-3 py-2 w-24 text-right border-r border-slate-300">Rate</th>
                                    <th className="px-3 py-2 w-28 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300">
                                {bill.items?.map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-3 py-1.5 border-r border-slate-300 font-bold text-center text-slate-400">{index + 1}</td>
                                        <td className="px-3 py-1.5 border-r border-slate-300 font-mono text-slate-900 text-[11px] font-semibold">{item.hs_code || '-'}</td>
                                        <td className="px-3 py-1.5 border-r border-slate-300 font-semibold text-slate-800">{item.particulars}</td>
                                        <td className="px-3 py-1.5 border-r border-slate-300 text-right font-bold text-slate-700">{item.quantity} {item.unit || 'Pcs'}</td>
                                        <td className="px-3 py-1.5 border-r border-slate-300 text-right font-medium text-slate-600 text-[11px]">{formatNepaliCurrency(item.rate)}</td>
                                        <td className="px-3 py-1.5 text-right font-extrabold text-slate-900">{formatNepaliCurrency(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Summary / Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-3">
                            <div className="text-[11px] italic text-slate-500 leading-relaxed bg-slate-50/50 p-3 border border-dashed border-slate-200 rounded-xl">
                                <span className="font-extrabold text-slate-700 block mb-0.5 uppercase tracking-wide text-[9px]">In Words:</span>
                                <span className="border-b border-dashed border-slate-300 pb-0.5 block text-slate-800 font-semibold">{amountToWords(bill.total_amount)}</span>
                            </div>
                            <div className="text-[9px] font-extrabold text-slate-400 tracking-wider">E. & O.E.</div>
                        </div>

                        <div className="flex flex-col items-end space-y-4">
                            {/* Totals Summary */}
                            <div className="w-64 border border-slate-300 rounded-xl overflow-hidden text-[11px] divide-y divide-slate-300 shadow-sm">
                                <div className="flex justify-between px-3 py-1.5 bg-slate-50/50">
                                    <span className="text-slate-500 font-semibold">Sub Total</span>
                                    <span className="font-bold text-slate-800">{formatNepaliCurrency(bill.sub_total_amount)}</span>
                                </div>
                                {bill.discount && bill.discount > 0 ? (
                                    <div className="flex justify-between px-3 py-1.5">
                                        <span className="text-slate-500 font-semibold">Discount</span>
                                        <span className="font-bold text-slate-800">-{formatNepaliCurrency(bill.discount)}</span>
                                    </div>
                                ) : null}
                                <div className="flex justify-between px-3 py-1.5">
                                    <span className="text-slate-500 font-semibold">Taxable Amount</span>
                                    <span className="font-bold text-slate-800">
                                        {formatNepaliCurrency((bill.taxable_amount && bill.taxable_amount > 0) ? bill.taxable_amount : (bill.sub_total_amount - (bill.discount || 0)))}
                                    </span>
                                </div>
                                <div className="flex justify-between px-3 py-1.5">
                                    <span className="text-slate-500 font-semibold">13% VAT</span>
                                    <span className="font-bold text-slate-800">{formatNepaliCurrency(bill.vat_amount)}</span>
                                </div>
                                <div className="flex justify-between px-3 py-2 bg-slate-50 font-extrabold text-xs">
                                    <span className="text-slate-800">Grand Total</span>
                                    <span className="text-indigo-700">{formatNepaliCurrency(bill.total_amount)}</span>
                                </div>
                            </div>

                            {/* Authorized Sign Box */}
                            <div className="pt-1 pr-4 text-center w-full max-w-[200px]">
                                <span className="text-[11px] font-bold text-slate-500 block mb-8">For: {seller?.company_name || 'Bagmati Traders & Suppliers'}</span>
                                <span className="border-t border-dashed border-slate-400 px-3 pt-1 text-slate-400 text-[8px] font-extrabold uppercase tracking-widest block">Authorized Signature</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Action buttons */}
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => onEdit(bill)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs font-bold text-slate-600 shadow-sm active:scale-[0.98]"
                        >
                            <Edit className="h-3.5 w-3.5" /> Edit Bill
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-xs font-bold shadow-sm shadow-indigo-500/10 active:scale-[0.98]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
