'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Search, AlertTriangle, Calendar, Hash, User, MapPin, CreditCard, CheckCircle2, FileText } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboard } from '@/app/dashboard/context'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getStockAnalysisData } from '@/features/stock-analysis/actions/stock-analysis-actions'
import { updateSalesBill, createSalesBill, getNextSuggestedInvoiceNo, checkDuplicateInvoice, type SalesBillItem, type SalesBill } from '@/features/sales/actions/sales-bill-actions'
import { adToBS, bsToAD, formatNepaliCurrency } from '@/lib/utils/date-converter'

interface AddSalesBillModalProps {
    onClose: () => void
    billToEdit?: SalesBill
}

export function AddSalesBillModal({ onClose, billToEdit }: AddSalesBillModalProps) {
    const queryClient = useQueryClient()
    const { isCollapsed } = useDashboard()
    const isEditing = !!billToEdit

    // Form state
    const [formData, setFormData] = useState({
        bill_date_ad: new Date().toISOString().split('T')[0],
        bill_date_bs: '',
        invoice_no: '',
        seller_company_id: '',
        customer_name: '',
        customer_address: '',
        customer_pan_vat: '',
    })

    const [lineItems, setLineItems] = useState<Omit<SalesBillItem, 'id'>[]>([
        { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, unit: '', line_order: 0 }
    ])

    // Initialize Data
    useEffect(() => {
        if (billToEdit) {
            setFormData({
                bill_date_ad: billToEdit.bill_date_ad,
                bill_date_bs: billToEdit.bill_date_bs,
                invoice_no: billToEdit.invoice_no,
                seller_company_id: billToEdit.seller_company_id || '',
                customer_name: billToEdit.customer_name,
                customer_address: billToEdit.customer_address || '',
                customer_pan_vat: billToEdit.customer_pan_vat || '',
            })
            setDiscount(billToEdit.discount || 0)
            // Map items if available (requires getSalesBillById to fetch items with the bill)
            if (billToEdit.items) {
                setLineItems(billToEdit.items.map(item => ({
                    hs_code: item.hs_code || '',
                    particulars: item.particulars,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    unit: item.unit || 'Pcs',
                    line_order: item.line_order
                })))
            }
        } else if (formData.bill_date_ad) {
            // Only set BS date if not editing (or if editing but empty, which shouldn't happen)
            // Actually, safely re-calc BS if not set
            if (!formData.bill_date_bs) {
                setFormData(prev => ({ ...prev, bill_date_bs: adToBS(formData.bill_date_ad) }))
            }
        }
    }, [billToEdit])

    const [discount, setDiscount] = useState<number>(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [shouldCloseOnSave, setShouldCloseOnSave] = useState(true)
    const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('')
    const [fetchTrigger, setFetchTrigger] = useState(0)

    // Fetch suggested invoice number
    useEffect(() => {
        if (!isEditing && formData.bill_date_ad) {
            getNextSuggestedInvoiceNo(formData.bill_date_ad)
                .then((suggested) => {
                    setSuggestedInvoiceNo(suggested)
                })
                .catch((err) => console.error(err))
        }
    }, [formData.bill_date_ad, isEditing, fetchTrigger])

    // Fetch Sellers (Our Companies)
    const { data: sellers = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Fetch Stock Data for Particulars Search
    const { data: stockData = [] } = useQuery({
        queryKey: ['stock-analysis-all'],
        queryFn: () => getStockAnalysisData({ fiscalYearId: 'all' }), // Fetch all to search
    })

    // Helper for particulars dropdown
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)
    const [particularSearch, setParticularSearch] = useState('')

    // Filtered particulars based on search
    const filteredStock = stockData.filter(item =>
        item.particulars.toLowerCase().includes(particularSearch.toLowerCase())
    )

    // Calculate totals
    const subTotalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxableAmount = Math.max(0, subTotalAmount - discount)
    const vatAmount = taxableAmount * 0.13
    const totalAmount = taxableAmount + vatAmount

    // Handlers
    const handleADDateChange = (date: string) => {
        setFormData({
            ...formData,
            bill_date_ad: date,
            bill_date_bs: date ? adToBS(date) : '',
        })
    }

    const handleBSDateChange = (date: string) => {
        setFormData({
            ...formData,
            bill_date_bs: date,
            bill_date_ad: date ? bsToAD(date) : '',
        })
    }

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, unit: '', line_order: lineItems.length }
        ])
    }

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index))
        }
    }

    const handleItemChange = (index: number, field: keyof SalesBillItem, value: any) => {
        const newItems = [...lineItems]
        const currentItem = { ...newItems[index] }

        // Special handling for Quantity validation
        if (field === 'quantity') {
            const qty = parseInt(value, 10) || 0
            // Find stock item to check running stock
            const stockItem = stockData.find(s => s.particulars === currentItem.particulars)

            if (stockItem && qty > stockItem.running_stock) {
                // Warning is handled in UI rendering, here we just set value but prevent submit later?
                // Or we can just cap it? User asked for warning and "didnot save data".
            }
            currentItem.quantity = qty
        } else if (field === 'rate') {
            currentItem.rate = parseFloat(value) || 0
        } else {
            (currentItem as any)[field] = value
        }

        // Auto-calculate amount
        if (field === 'quantity' || field === 'rate') {
            currentItem.amount = currentItem.quantity * currentItem.rate
        }

        newItems[index] = currentItem
        setLineItems(newItems)
    }

    const selectParticular = (index: number, stockItem: any) => {
        const newItems = [...lineItems]

        // Auto-fill H.S Code
        const hsCode = stockItem.hs_code || ''

        // Auto-calculate Rate: Purchase Rate * 10% markup (nearest integer)
        const suggestedRate = Math.round((stockItem.weighted_average_rate || 0) * 1.1)

        newItems[index] = {
            ...newItems[index],
            particulars: stockItem.particulars,
            hs_code: hsCode,
            rate: suggestedRate,
            quantity: 0, // Reset qty
            amount: 0,
            unit: stockItem.unit || 'Pcs'
        }
        setLineItems(newItems)
        setActiveRowIndex(null)
        setParticularSearch('')
    }

    // Get Running Stock for a row
    const getRunningStock = (particulars: string) => {
        const item = stockData.find(s => s.particulars === particulars)
        return item?.running_stock || 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validations
        if (!formData.seller_company_id) {
            setError('Seller (Company) is required')
            return
        }
        if (!formData.customer_name) {
            setError('Customer Name is required')
            return
        }
        /* 
           Note: Invoice No is also required by the database schema (NOT NULL), 
           so we implicitly require it or it will fail on insert. 
           However, user didn't explicitly list it in 'Required fields'. 
           I will keep the check to prevent DB errors.
        */
        if (!formData.invoice_no) {
            setError('Invoice No is required')
            return
        }

        // Check duplicate invoice number
        const isDuplicate = await checkDuplicateInvoice(formData.invoice_no, formData.bill_date_ad, billToEdit?.id)
        if (isDuplicate) {
            setError('Invoice number Duplicate')
            return
        }

        // Stock & Item Validation
        if (lineItems.length === 0) {
            setError('At least one item is required')
            return
        }

        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i]

            if (!item.particulars) {
                setError(`Row ${i + 1}: Particulars is required`)
                return
            }
            if (item.quantity <= 0) {
                setError(`Row ${i + 1}: Quantity must be greater than 0`)
                return
            }

            const runningStock = getRunningStock(item.particulars)
            if (item.quantity > runningStock) {
                setError(`Row ${i + 1}: Quantity (${item.quantity}) exceeds running stock (${runningStock}) for ${item.particulars}`)
                return
            }
        }

        setIsSubmitting(true)
        try {
            if (isEditing && billToEdit) {
                await updateSalesBill(billToEdit.id, {
                    ...formData,
                    sub_total_amount: subTotalAmount,
                    discount: discount,
                    taxable_amount: taxableAmount,
                    vat_amount: vatAmount,
                    total_amount: totalAmount,
                    items: lineItems.map((item, i) => ({ ...item, line_order: i }))
                })
                alert('Sales Bill Updated Successfully')
            } else {
                await createSalesBill({
                    ...formData,
                    sub_total_amount: subTotalAmount,
                    discount: discount,
                    taxable_amount: taxableAmount,
                    vat_amount: vatAmount,
                    total_amount: totalAmount,
                    items: lineItems.map((item, i) => ({ ...item, line_order: i }))
                })
                alert('Sales Bill Added Successfully')
            }

            queryClient.invalidateQueries({ queryKey: ['sales-bills'] })
            
            if (shouldCloseOnSave) {
                onClose()
            } else {
                setFormData(prev => ({
                    ...prev,
                    invoice_no: '',
                    customer_name: '',
                    customer_address: '',
                    customer_pan_vat: '',
                }))
                setDiscount(0)
                setLineItems([
                    { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, unit: '', line_order: 0 }
                ])
                setActiveRowIndex(null)
                setParticularSearch('')
                setFetchTrigger(prev => prev + 1)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save sales bill')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className={`fixed inset-0 z-[100] overflow-y-auto bg-slate-50/98 dark:bg-zinc-950/98 backdrop-blur-md transition-all duration-300 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
            <div className="min-h-screen flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{isEditing ? 'Edit Sales Bill' : 'Create Sales Invoice'}</h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Fill in the details below to generate a VAT / PAN sales bill</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl transition-all duration-200 hover:rotate-90"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 pb-10">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2.5 shadow-sm">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    {/* Section 1: Billing Info */}
                    <div className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                        <div className="flex items-center gap-2 mb-5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">1</span>
                            <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-zinc-300 uppercase">Billing Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            {/* Dates */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Date (AD)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <Calendar className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="date"
                                        value={formData.bill_date_ad}
                                        onChange={(e) => handleADDateChange(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                    />
                                </div>
                            </div>

                            {/* Date (BS) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Date (BS)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <Calendar className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="YYYY-MM-DD"
                                        value={formData.bill_date_bs}
                                        onChange={(e) => handleBSDateChange(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">Auto-converts from AD date</span>
                            </div>

                            {/* Invoice No */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Invoice Number</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <Hash className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Enter Invoice No"
                                        value={formData.invoice_no}
                                        onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                    />
                                </div>
                                {!isEditing && suggestedInvoiceNo && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, invoice_no: suggestedInvoiceNo }))}
                                        className="mt-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                                    >
                                        <span>Suggest:</span>
                                        <span className="bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded font-bold border border-indigo-100/50 dark:border-indigo-950/80">{suggestedInvoiceNo}</span>
                                    </button>
                                )}
                            </div>

                            {/* Seller (Supplier/Company) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Seller (Our Company) <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.seller_company_id}
                                    onChange={(e) => setFormData({ ...formData, seller_company_id: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                >
                                    <option value="">Select Company</option>
                                    {sellers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.company_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Customer Details */}
                    <div className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                        <div className="flex items-center gap-2 mb-5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">2</span>
                            <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-zinc-300 uppercase">Customer Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Customer Name <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <User className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Walk-in Customer / Client Name"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Address</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <MapPin className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="City, Country"
                                        value={formData.customer_address}
                                        onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">PAN / VAT Number</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <CreditCard className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="number"
                                        placeholder="9-digit PAN/VAT"
                                        value={formData.customer_pan_vat}
                                        onChange={(e) => setFormData({ ...formData, customer_pan_vat: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Line Items */}
                    <div className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500"></div>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-50 dark:bg-violet-950/50 text-[11px] font-bold text-violet-600 dark:text-violet-400">3</span>
                                <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-zinc-300 uppercase">Line Items</h3>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                            <table className="w-full border-collapse">
                                <thead className="bg-slate-50 dark:bg-zinc-850/60 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-left border-b border-slate-100 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3.5 w-28 text-[11px]">H.S Code</th>
                                        <th className="px-4 py-3.5 min-w-[240px] text-[11px]">Particulars <span className="text-red-500">*</span></th>
                                        <th className="px-4 py-3.5 w-36 text-[11px]">Qty <span className="text-red-500">*</span></th>
                                        <th className="px-4 py-3.5 w-28 text-[11px]">Unit</th>
                                        <th className="px-4 py-3.5 w-36 text-[11px]">Rate (Rs)</th>
                                        <th className="px-4 py-3.5 w-40 text-[11px]">Amount</th>
                                        <th className="px-4 py-3.5 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                                    {lineItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/40 transition-colors duration-150 align-top">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.hs_code || ''}
                                                    readOnly
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-850/40 border border-slate-150 dark:border-zinc-800 rounded-xl text-sm text-slate-400 dark:text-zinc-500 font-mono"
                                                />
                                            </td>
                                            <td className="px-4 py-3 relative">
                                                <div
                                                    className="relative"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                                            <Search className="h-4 w-4" />
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={activeRowIndex === index ? particularSearch : item.particulars}
                                                            onChange={(e) => {
                                                                setParticularSearch(e.target.value)
                                                                if (activeRowIndex !== index) setActiveRowIndex(index)
                                                            }}
                                                            onFocus={() => {
                                                                setActiveRowIndex(index)
                                                                setParticularSearch(item.particulars)
                                                            }}
                                                            placeholder="Search stock item..."
                                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                                        />
                                                    </div>

                                                    {/* Dropdown */}
                                                    {activeRowIndex === index && (
                                                        <div className="absolute top-full left-0 z-50 w-full mt-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80">
                                                            {filteredStock.length > 0 ? (
                                                                filteredStock.map((stockItem, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        onClick={() => selectParticular(index, stockItem)}
                                                                        className="px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/80 cursor-pointer flex justify-between items-center transition-colors duration-150"
                                                                    >
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-slate-800 dark:text-zinc-200">{stockItem.particulars}</span>
                                                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">HS: {stockItem.hs_code || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full">
                                                                                Stock: {stockItem.running_stock}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="px-4 py-3 text-sm text-slate-400 dark:text-zinc-500 text-center">No matching stock items</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                                                e.preventDefault()
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            const roundedQty = Math.round(parseFloat(e.target.value) || 0)
                                                            handleItemChange(index, 'quantity', roundedQty)
                                                        }}
                                                        className={`w-full px-3 py-2 border rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 transition-all duration-200 ${item.quantity > getRunningStock(item.particulars)
                                                            ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500'
                                                            : 'border-slate-200 dark:border-zinc-800 focus:ring-indigo-500/10 focus:border-indigo-500'
                                                            }`}
                                                    />
                                                    <span className={`text-[10px] mt-1.5 px-2 py-0.5 rounded-md w-fit font-medium ${item.quantity > getRunningStock(item.particulars) 
                                                        ? 'bg-red-50 dark:bg-red-950/20 text-red-500' 
                                                        : 'bg-slate-50 dark:bg-zinc-850 text-slate-500'
                                                        }`}>
                                                        Available: {getRunningStock(item.particulars)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.unit || 'Pcs'}
                                                    readOnly
                                                    tabIndex={-1}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-850/40 border border-slate-150 dark:border-zinc-800 rounded-xl text-sm text-slate-400 dark:text-zinc-500 cursor-not-allowed font-medium"
                                                    placeholder="Auto"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={item.rate || ''}
                                                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                    onBlur={(e) => {
                                                        const roundedRate = Math.round(parseFloat(e.target.value) || 0)
                                                        handleItemChange(index, 'rate', roundedRate)
                                                    }}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-zinc-300 bg-slate-50/50 dark:bg-zinc-850/20 rounded-xl border border-dashed border-slate-150 dark:border-zinc-800">
                                                    {formatNepaliCurrency(item.amount)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {lineItems.length > 1 && (
                                                    <button type="button" onClick={() => removeLineItem(index)} className="mt-2 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="px-4 py-3 bg-slate-50/30 dark:bg-zinc-850/10 border-t border-slate-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={addLineItem}
                                    className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-semibold px-3 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all duration-200"
                                >
                                    <Plus className="h-4 w-4" /> Add Item Row
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Totals & Actions Footer */}
                    <div className="flex justify-end bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm">
                        <div className="w-80 space-y-3.5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-zinc-400">Sub Total Amount</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatNepaliCurrency(subTotalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-zinc-400">Discount</span>
                                <input
                                    type="number"
                                    value={discount || ''}
                                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                    placeholder="0.00"
                                    className="w-32 px-2.5 py-1 text-right border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300"
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-zinc-400">Taxable Amount</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatNepaliCurrency(taxableAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-zinc-400">13% VAT</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatNepaliCurrency(vatAmount)}</span>
                            </div>
                            <div className="border-t border-slate-100 dark:border-zinc-800 pt-3.5 flex justify-between items-center text-base font-bold">
                                <span className="text-slate-800 dark:text-zinc-200">Total Amount</span>
                                <span className="text-xl bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">{formatNepaliCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md py-4 px-6 border-t border-slate-100 dark:border-zinc-800/85 flex justify-end items-center gap-3 animate-fade-in-up">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-850/60 font-semibold text-sm transition-all duration-200 animate-slide-in"
                        >
                            Cancel
                        </button>
                        {!isEditing && (
                            <button
                                type="submit"
                                onClick={() => setShouldCloseOnSave(false)}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-sm shadow-sm shadow-emerald-500/10 hover:shadow-md hover:shadow-emerald-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 animate-slide-in"
                            >
                                {isSubmitting && !shouldCloseOnSave ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Save & Continue
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            type="submit"
                            onClick={() => setShouldCloseOnSave(true)}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-semibold text-sm shadow-sm shadow-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 animate-slide-in"
                        >
                            {isSubmitting && shouldCloseOnSave ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {isEditing ? 'Update & Close' : 'Save & Close'}
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Close Dropdown on outside click */}
                {activeRowIndex !== null && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setActiveRowIndex(null)}
                    ></div>
                )}
            </div>
        </div>
    )
}
