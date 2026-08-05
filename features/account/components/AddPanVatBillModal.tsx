'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Search, AlertTriangle, Calendar } from 'lucide-react'
import { createPanVatBill, updatePanVatBill, type CreatePanVatBillParams, type PanVatBillItem, type PanVatBill } from '@/features/account/actions/pan-vat-bill-actions'
import { getPanVatCompanies } from '@/features/account/actions/pan-vat-company-actions'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getBillingUnits } from '@/features/settings/actions/billing-unit-actions'
import { adToBS, bsToAD, formatNepaliCurrency } from '@/lib/utils/date-converter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboard } from '@/app/dashboard/context'

interface AddPanVatBillModalProps {
    onClose: () => void
    bill?: PanVatBill | null
}

export function AddPanVatBillModal({ onClose, bill }: AddPanVatBillModalProps) {
    const queryClient = useQueryClient()
    const { isCollapsed } = useDashboard()
    const isEditMode = !!bill

    // Form state
    const [formData, setFormData] = useState({
        issue_bill_date_ad: '',
        issue_bill_date_bs: '',
        supplier_company_id: '',
        supplier_pan_vat: '',
        invoice_no: '',
        buyer_company_id: '',
        buyer_pan_vat: '',
    })

    // Fetch units
    const { data: units = [] } = useQuery({
        queryKey: ['billing-units'],
        queryFn: getBillingUnits,
    })

    const primaryUnit = units.find(u => u.is_primary)?.name || 'Pcs'

    // Form states for discount and excise duty
    const [discount, setDiscount] = useState<number>(0)
    const [exciseDuty, setExciseDuty] = useState<number>(0)

    // Line items state
    const [lineItems, setLineItems] = useState<Omit<PanVatBillItem, 'id'>[]>([
        { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, unit: '', line_order: 0 }
    ])

    // Refs for custom tab order
    const supplierRef = useRef<HTMLInputElement>(null)
    const invoiceRef = useRef<HTMLInputElement>(null)
    const buyerRef = useRef<HTMLInputElement>(null)
    const hsCodeRefs = useRef<(HTMLInputElement | null)[]>([])
    const particularsRefs = useRef<(HTMLInputElement | null)[]>([])
    const quantityRefs = useRef<(HTMLInputElement | null)[]>([])
    const rateRefs = useRef<(HTMLInputElement | null)[]>([])
    const addRowRef = useRef<HTMLButtonElement>(null)
    const saveRef = useRef<HTMLButtonElement>(null)

    // Initialize form with bill data if editing
    useEffect(() => {
        if (bill) {
            setFormData({
                issue_bill_date_ad: bill.issue_bill_date_ad,
                issue_bill_date_bs: bill.issue_bill_date_bs,
                supplier_company_id: bill.supplier_company_id || '',
                supplier_pan_vat: bill.supplier_pan_vat || '',
                invoice_no: bill.invoice_no,
                buyer_company_id: bill.buyer_company_id || '',
                buyer_pan_vat: bill.buyer_pan_vat || '',
            })
            setSupplierSearch(bill.supplier_company_name || '')
            setBuyerSearch(bill.buyer_company_name || '')
            setDiscount(bill.discount || 0)
            setExciseDuty(bill.excise_duty || 0)
            if (bill.items && bill.items.length > 0) {
                setLineItems(bill.items.map(item => ({
                    hs_code: item.hs_code || '',
                    particulars: item.particulars,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    unit: item.unit || primaryUnit,
                    line_order: item.line_order
                })))
            }
        }
    }, [bill, primaryUnit])

    // Dropdown search states
    const [supplierSearch, setSupplierSearch] = useState('')
    const [buyerSearch, setBuyerSearch] = useState('')
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
    const [showBuyerDropdown, setShowBuyerDropdown] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Fetch suppliers
    const { data: suppliers = [] } = useQuery({
        queryKey: ['pan-vat-companies'],
        queryFn: getPanVatCompanies,
    })

    // Fetch buyers
    const { data: buyers = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Set default buyer to "Bagmati Traders & Suppliers" if exists (only in add mode)
    useEffect(() => {
        if (!isEditMode && buyers.length > 0 && !buyerSearch) {
            const defaultBuyer = buyers.find(
                b => b.company_name === 'Bagmati Traders & Suppliers'
            )
            if (defaultBuyer) {
                selectBuyer(defaultBuyer)
            }
        }
    }, [buyers, isEditMode])

    // Filter suppliers based on search
    const filteredSuppliers = suppliers.filter(s =>
        s.company_name.toLowerCase().includes(supplierSearch.toLowerCase())
    )

    // Filter buyers based on search
    const filteredBuyers = buyers.filter(b =>
        b.company_name.toLowerCase().includes(buyerSearch.toLowerCase())
    )

    // Calculate totals
    const subTotalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxableAmount = Math.max(0, subTotalAmount - discount + exciseDuty)
    const vat13Percent = taxableAmount * 0.13
    const totalAmount = taxableAmount + vat13Percent

    // Handle AD date change
    const handleADDateChange = (date: string) => {
        setFormData({
            ...formData,
            issue_bill_date_ad: date,
            issue_bill_date_bs: date ? adToBS(date) : '',
        })
    }

    // Handle BS date change
    const handleBSDateChange = (date: string) => {
        setFormData({
            ...formData,
            issue_bill_date_bs: date,
            issue_bill_date_ad: date ? bsToAD(date) : '',
        })
    }

    // Select supplier
    const selectSupplier = (supplier: any) => {
        setFormData({
            ...formData,
            supplier_company_id: supplier.id,
            supplier_pan_vat: supplier.pan_vat_no || '',
        })
        setSupplierSearch(supplier.company_name)
        setShowSupplierDropdown(false)
    }

    // Select buyer
    const selectBuyer = (buyer: any) => {
        setFormData({
            ...formData,
            buyer_company_id: buyer.id,
            buyer_pan_vat: buyer.pan_vat_details || '',
        })
        setBuyerSearch(buyer.company_name)
        setShowBuyerDropdown(false)
    }

    // Handle Enter key for supplier dropdown
    const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && showSupplierDropdown && filteredSuppliers.length > 0) {
            e.preventDefault()
            selectSupplier(filteredSuppliers[0])
        }
    }

    // Handle Enter key for buyer dropdown
    const handleBuyerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && showBuyerDropdown && filteredBuyers.length > 0) {
            e.preventDefault()
            selectBuyer(filteredBuyers[0])
        }
    }

    // Handle line item change
    const handleLineItemChange = (index: number, field: keyof PanVatBillItem, value: any) => {
        const newItems = [...lineItems]
        if (field === 'quantity') {
            newItems[index] = { ...newItems[index], [field]: parseInt(value, 10) || 0 }
        } else {
            newItems[index] = { ...newItems[index], [field]: value }
        }

        // Calculate amount if quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate
        }

        setLineItems(newItems)
    }

    // Add new line item
    const addLineItem = (focusNewRow: boolean = false) => {
        const newIndex = lineItems.length
        setLineItems([
            ...lineItems,
            { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, unit: primaryUnit, line_order: newIndex }
        ])
        if (focusNewRow) {
            // Focus the new row's H.S Code field after state update
            setTimeout(() => {
                hsCodeRefs.current[newIndex]?.focus()
            }, 50)
        }
    }

    // Handle Enter key on Add Row button
    const handleAddRowKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addLineItem(true)
        }
    }

    // Handle Tab on Rate field (last item) to go to Add Row button
    const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Tab' && !e.shiftKey && index === lineItems.length - 1) {
            e.preventDefault()
            addRowRef.current?.focus()
        }
    }

    // Handle Tab on Add Row to go to Save Bill
    const handleAddRowTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            saveRef.current?.focus()
        } else if (e.key === 'Enter') {
            e.preventDefault()
            addLineItem(true)
        }
    }

    // Remove line item
    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index))
        }
    }

    // Handle submit

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.issue_bill_date_ad) {
            setError('Issue Bill Date is required')
            return
        }
        if (!formData.invoice_no.trim()) {
            setError('Invoice No is required')
            return
        }
        if (lineItems.some(item => !item.particulars.trim())) {
            setError('All line items must have Particulars')
            return
        }

        setIsSubmitting(true)
        try {
            const billData = {
                issue_bill_date_ad: formData.issue_bill_date_ad,
                issue_bill_date_bs: formData.issue_bill_date_bs,
                supplier_company_id: formData.supplier_company_id || null,
                supplier_company_name: supplierSearch || null,
                supplier_pan_vat: formData.supplier_pan_vat || null,
                invoice_no: formData.invoice_no,
                buyer_company_id: formData.buyer_company_id || null,
                buyer_company_name: buyerSearch || null,
                buyer_pan_vat: formData.buyer_pan_vat || null,
                sub_total_amount: subTotalAmount,
                taxable_amount: taxableAmount,
                vat_13_percent: vat13Percent,
                total_amount: totalAmount,
                discount: discount,
                excise_duty: exciseDuty,
                items: lineItems.map((item, index) => ({
                    ...item,
                    unit: item.unit || primaryUnit,
                    line_order: index
                })),
            }

            if (isEditMode && bill) {
                await updatePanVatBill(bill.id, billData)
            } else {
                await createPanVatBill(billData)
            }

            queryClient.invalidateQueries({ queryKey: ['pan-vat-bills'] })
            onClose()
        } catch (err: any) {
            setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} bill`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className={`fixed inset-0 z-[100] overflow-y-auto bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'} font-sans`}>
            <div className="min-h-screen flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                        <h2 className="text-[18px] font-bold text-slate-800 dark:text-zinc-100">
                            {isEditMode ? 'Edit Pan/Vat Purchase Bill' : 'Add Pan/Vat Purchase Bill'}
                        </h2>
                        <p className="text-[12px] text-slate-400 dark:text-zinc-500 mt-0.5">Enter details of the purchase invoice</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-xl transition-all"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 bg-slate-50/30 dark:bg-zinc-950/20">
                    {error && (
                        <div className="flex items-start gap-2.5 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-400 text-[13px] font-medium animate-fade-in">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Row 1: Bill Dates */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/85 p-5 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                                    Issue Bill Date (A.D) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <Calendar className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="date"
                                        value={formData.issue_bill_date_ad}
                                        onChange={(e) => handleADDateChange(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                                    Issue Bill Date (B.S) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                                        <Calendar className="h-4 w-4" />
                                    </span>
                                    <input
                                        type="text"
                                        value={formData.issue_bill_date_bs}
                                        onChange={(e) => handleBSDateChange(e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 pl-1">Auto-converts from AD date</p>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Supplier & Invoice */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/85 p-5 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Supplier Company */}
                            <div className="relative">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Supplier Company</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                                    <input
                                        type="text"
                                        ref={supplierRef}
                                        tabIndex={1}
                                        value={supplierSearch}
                                        onChange={(e) => {
                                            setSupplierSearch(e.target.value)
                                            setShowSupplierDropdown(true)
                                        }}
                                        onFocus={() => setShowSupplierDropdown(true)}
                                        onKeyDown={handleSupplierKeyDown}
                                        placeholder="Search supplier..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                    />
                                </div>
                                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80 animate-fade-in">
                                        {filteredSuppliers.map((supplier) => (
                                            <button
                                                key={supplier.id}
                                                type="button"
                                                onClick={() => selectSupplier(supplier)}
                                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                                            >
                                                {supplier.company_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Supplier Pan/Vat */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Supplier Pan/Vat</label>
                                <input
                                    type="text"
                                    value={formData.supplier_pan_vat}
                                    readOnly
                                    tabIndex={-1}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-850/40 border border-slate-150 dark:border-zinc-800 rounded-xl text-sm text-slate-400 dark:text-zinc-500 cursor-not-allowed font-medium font-mono"
                                    placeholder="Auto-filled"
                                />
                            </div>

                            {/* Invoice No */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                                    Invoice No <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    ref={invoiceRef}
                                    tabIndex={2}
                                    value={formData.invoice_no}
                                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Buyer */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/85 p-5 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Buyer Name */}
                            <div className="relative">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Buyer Name</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                                    <input
                                        type="text"
                                        ref={buyerRef}
                                        tabIndex={3}
                                        value={buyerSearch}
                                        onChange={(e) => {
                                            setBuyerSearch(e.target.value)
                                            setShowBuyerDropdown(true)
                                        }}
                                        onFocus={() => setShowBuyerDropdown(true)}
                                        onKeyDown={handleBuyerKeyDown}
                                        placeholder="Search buyer..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                    />
                                </div>
                                {showBuyerDropdown && filteredBuyers.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80 animate-fade-in">
                                        {filteredBuyers.map((buyer) => (
                                            <button
                                                key={buyer.id}
                                                type="button"
                                                onClick={() => selectBuyer(buyer)}
                                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                                            >
                                                {buyer.company_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Buyer Pan/Vat */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Buyer Pan/Vat</label>
                                <input
                                    type="text"
                                    value={formData.buyer_pan_vat}
                                    readOnly
                                    tabIndex={-1}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-850/40 border border-slate-150 dark:border-zinc-800 rounded-xl text-sm text-slate-400 dark:text-zinc-500 cursor-not-allowed font-medium font-mono"
                                    placeholder="Auto-filled"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/85 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">Line Items</h3>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Specify HS codes, particulars, and cost details</p>
                            </div>
                            <button
                                type="button"
                                ref={addRowRef}
                                tabIndex={100}
                                onClick={() => addLineItem()}
                                onKeyDown={handleAddRowTabKeyDown}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-[13px] font-semibold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Add Row
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/60 dark:bg-zinc-900/50 text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-4 py-3 w-32">H.S Code</th>
                                        <th className="px-4 py-3">Particulars <span className="text-red-500">*</span></th>
                                        <th className="px-4 py-3 w-32 text-right">Quantity <span className="text-red-500">*</span></th>
                                        <th className="px-4 py-3 w-28">Unit</th>
                                        <th className="px-4 py-3 w-36 text-right">Rate <span className="text-red-500">*</span></th>
                                        <th className="px-4 py-3 w-40 text-right">Amount</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                                    {lineItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/40 transition-colors duration-150 align-top">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    ref={el => { hsCodeRefs.current[index] = el }}
                                                    tabIndex={10 + (index * 5)}
                                                    value={item.hs_code || ''}
                                                    onChange={(e) => handleLineItemChange(index, 'hs_code', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    ref={el => { particularsRefs.current[index] = el }}
                                                    tabIndex={11 + (index * 5)}
                                                    value={item.particulars}
                                                    onChange={(e) => handleLineItemChange(index, 'particulars', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-bold"
                                                    required
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="1"
                                                    ref={el => { quantityRefs.current[index] = el }}
                                                    tabIndex={12 + (index * 5)}
                                                    value={item.quantity || ''}
                                                    onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                                            e.preventDefault()
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const roundedQty = Math.round(parseFloat(e.target.value) || 0)
                                                        handleLineItemChange(index, 'quantity', roundedQty)
                                                    }}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium text-right"
                                                    required
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={item.unit || primaryUnit}
                                                    tabIndex={13 + (index * 5)}
                                                    onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                                >
                                                    {units.map((unit: any) => (
                                                        <option key={unit.id} value={unit.name}>
                                                            {unit.name}
                                                        </option>
                                                    ))}
                                                    {units.length === 0 && (
                                                        <>
                                                            <option value="Pcs">Pcs</option>
                                                            <option value="kg">kg</option>
                                                            <option value="Doz">Doz</option>
                                                        </>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    ref={el => { rateRefs.current[index] = el }}
                                                    tabIndex={14 + (index * 5)}
                                                    value={item.rate || ''}
                                                    onChange={(e) => handleLineItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    onKeyDown={(e) => handleRateKeyDown(e, index)}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium text-right"
                                                    required
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="px-3 py-2 text-sm font-bold text-slate-700 dark:text-zinc-300 bg-slate-50/50 dark:bg-zinc-850/20 rounded-xl border border-dashed border-slate-150 dark:border-zinc-800">
                                                    {formatNepaliCurrency(item.amount)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {lineItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLineItem(index)}
                                                        className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors mt-1"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="flex justify-end bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/85 p-5 shadow-sm">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium font-sans">Sub Total Amount</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300 font-sans">{formatNepaliCurrency(subTotalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs gap-3">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium font-sans">Discount</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={discount || ''}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-32 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-zinc-300 text-right font-medium font-mono"
                                />
                            </div>
                            <div className="flex justify-between items-center text-xs gap-3">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium font-sans">Excise Duty (5%)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={exciseDuty || ''}
                                    onChange={(e) => setExciseDuty(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-32 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-zinc-300 text-right font-medium font-mono"
                                />
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium font-sans">Taxable Amount</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300 font-sans">{formatNepaliCurrency(taxableAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium font-sans">VAT 13%</span>
                                <span className="font-semibold text-slate-700 dark:text-zinc-300 font-sans">{formatNepaliCurrency(vat13Percent)}</span>
                            </div>
                            <div className="border-t border-slate-200 dark:border-zinc-850 pt-3 flex justify-between items-center text-sm font-bold">
                                <span className="text-slate-800 dark:text-zinc-200 font-sans">Total Amount</span>
                                <span className="text-base text-indigo-600 dark:text-indigo-400 font-extrabold font-sans">{formatNepaliCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 justify-end sticky bottom-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md py-4 px-6 border-t border-slate-200 dark:border-zinc-800 shadow-md">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 border border-slate-200 dark:border-zinc-850 text-slate-600 dark:text-zinc-400 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-850/60 font-semibold text-sm transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            ref={saveRef}
                            tabIndex={101}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
