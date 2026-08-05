'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createPurchase, updatePurchase } from '@/features/purchase/actions/purchase-actions'
import { getAllProductOptions } from '@/features/inventory/actions/product-actions'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { getLatestMrpByProductName, addMrpPrice, MrpPriceItem } from '@/features/purchase/actions/mrp-actions'
import Select from 'react-select'
import { X, Save, Loader2 } from 'lucide-react'
import { ComboComponentSelectModal } from '@/features/inventory/components/ComboComponentSelectModal'
import { toast } from 'sonner'

// PurchaseFormProps
interface PurchaseFormProps {
    onClose: () => void
    onSuccess: () => void
    editMode?: boolean
    purchaseData?: any
    initialData?: {
        productId?: string
        productName?: string
        quantity?: number
        remarks?: string
    }
    showExtraFields?: boolean
    fixedPurchaseName?: string // New prop
}

export default function PurchaseForm({ onClose, onSuccess, editMode = false, purchaseData, initialData, showExtraFields = false, fixedPurchaseName }: PurchaseFormProps) {
    const queryClient = useQueryClient()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Combo Resolving State
    const [comboResolving, setComboResolving] = useState<{ id: string, name: string } | null>(null)

    // MRP State
    const [latestMrp, setLatestMrp] = useState<MrpPriceItem | null>(null)
    const [mrpDecision, setMrpDecision] = useState<'Yes' | 'No' | ''>('')
    const [newMrpPrice, setNewMrpPrice] = useState('')
    const [checkingMrp, setCheckingMrp] = useState(false)

    // Select Options State
    const [productOptions, setProductOptions] = useState<any[]>([])
    const [supplierOptions, setSupplierOptions] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [loadingSuppliers, setLoadingSuppliers] = useState(false)

    // Init Data Loading
    useEffect(() => {
        // Load Products
        setLoadingProducts(true)
        getAllProductOptions()
            .then(products => {
                const options = products.map((p: any) => ({
                    value: p.id,
                    label: `${p.product_name} ${p.seller_sku1 ? `(${p.seller_sku1})` : ''}`,
                    name: p.product_name,
                    product_type: p.product_type
                }))
                setProductOptions(options)
            })
            .catch(err => {
                console.error("Failed to load products", err)
                toast.error("Failed to load products")
            })
            .finally(() => setLoadingProducts(false))

        // Load Suppliers (Limit 1000 for "all")
        setLoadingSuppliers(true)
        getSuppliers({ limit: 1000 })
            .then(({ suppliers }) => {
                const options = suppliers.map((s: any) => ({
                    value: s.id,
                    label: s.supplier_name,
                    price_requirement: s.price_requirement !== false
                }))
                setSupplierOptions(options)
            })
            .catch(err => {
                console.error("Failed to load suppliers", err)
                toast.error("Failed to load suppliers")
            })
            .finally(() => setLoadingSuppliers(false))
    }, [])

    // Form State
    const [formData, setFormData] = useState({
        purchase_date: editMode && purchaseData ? purchaseData.purchase_date : new Date().toISOString().split('T')[0],
        product_id: editMode && purchaseData ? purchaseData.product_id : (initialData?.productId || ''),
        product_name: editMode && purchaseData ? purchaseData.product?.product_name : (initialData?.productName || ''),
        quantity: editMode && purchaseData ? purchaseData.quantity.toString() : (initialData?.quantity ? initialData.quantity.toString() : ''),
        unit_amount: editMode && purchaseData ? purchaseData.unit_amount.toString() : ('' as any),
        total_amount: editMode && purchaseData ? purchaseData.total_amount : 0,
        supplier_id: editMode && purchaseData ? purchaseData.supplier_id : '',
        supplier_name: editMode && purchaseData ? purchaseData.supplier?.supplier_name : '',
        supplier_price_requirement: editMode && purchaseData ? (purchaseData.supplier?.price_requirement !== false) : true,
        payment_type: editMode && purchaseData ? purchaseData.payment_type : 'Cash',
        purchase_name: editMode && purchaseData ? (purchaseData.purchase_name || '') : (fixedPurchaseName || ''),
        purchase_type: editMode && purchaseData ? (purchaseData.purchase_type || 'Buy') : 'Buy', // Default to Buy if showing extra fields
        remarks: editMode && purchaseData ? (purchaseData.remarks || '') : (initialData?.remarks || '')
    })

    // Calculate Total Amount
    useEffect(() => {
        const qty = parseFloat(formData.quantity) || 0
        const rate = parseFloat(formData.unit_amount) || 0
        setFormData(prev => ({ ...prev, total_amount: qty * rate }))
    }, [formData.quantity, formData.unit_amount])

    // Handle Product Change
    const handleProductChange = (opt: any) => {
        if (opt?.product_type === 'combo') {
            setComboResolving({
                id: opt.value,
                name: opt.name
            })
            // Clear selection temporarily
            setFormData({ ...formData, product_id: '', product_name: '' })
            return
        }

        setFormData({
            ...formData,
            product_id: opt?.value || '',
            product_name: opt?.name || opt?.label || ''
        })
        
        // Fetch MRP when product changes
        if (opt?.name || opt?.label) {
            setCheckingMrp(true)
            getLatestMrpByProductName(opt.name || opt.label)
                .then(res => {
                    setLatestMrp(res.data)
                    setMrpDecision(res.data ? 'Yes' : 'No')
                    setNewMrpPrice('')
                })
                .finally(() => setCheckingMrp(false))
        } else {
            setLatestMrp(null)
            setMrpDecision('')
            setNewMrpPrice('')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const isPriceRequired = formData.supplier_price_requirement

        if (!formData.product_id || !formData.quantity || (isPriceRequired && !formData.unit_amount) || !formData.supplier_id || !formData.payment_type) {
            toast.warning(`Please fill in all required fields${isPriceRequired ? ' (including Unit Amount)' : ''}`)
            return
        }

        try {
            setIsSubmitting(true)

            const purchasePayload = {
                purchase_date: formData.purchase_date,
                product_id: formData.product_id,
                quantity: parseFloat(formData.quantity),
                unit_amount: formData.unit_amount ? parseFloat(formData.unit_amount) : 0,
                total_amount: formData.total_amount,
                supplier_id: formData.supplier_id,
                payment_type: formData.payment_type,
                purchase_name: formData.purchase_name,
                purchase_type: formData.purchase_type,
                remarks: formData.remarks
            }

            if (editMode && purchaseData) {
                await updatePurchase(purchaseData.id, purchasePayload)
                toast.success("Purchase updated successfully")
            } else {
                await createPurchase(purchasePayload)
                toast.success("Purchase added successfully")
            }

            // Handle MRP saving
            if ((latestMrp && mrpDecision === 'No' && newMrpPrice) || (!latestMrp && mrpDecision === 'Yes' && newMrpPrice)) {
                await addMrpPrice({
                    product_name: formData.product_name,
                    inventory_id: formData.product_id,
                    mrp_price: parseFloat(newMrpPrice),
                    applied_date: formData.purchase_date
                })
                queryClient.invalidateQueries({ queryKey: ['mrp-prices'] })
            }

            // Invalidate Queries
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['today-purchases'] }),
                queryClient.invalidateQueries({ queryKey: ['buy-sell-transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['today-purchases-for-plan'] }),
                queryClient.invalidateQueries({ queryKey: ['purchase-details-today'] })
            ])

            onSuccess()
            onClose()
        } catch (error: any) {
            toast.error(`Error: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const customSelectStyles = {
        control: (base: any) => ({
            ...base,
            minHeight: '42px',
            borderColor: '#e5e7eb', // gray-200
            borderRadius: '0.375rem',
            backgroundColor: 'white'
        }),
        menu: (base: any) => ({
            ...base,
            zIndex: 9999,
            color: 'black'
        }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
            color: 'black'
        }),
        menuPortal: (base: any) => ({ ...base, zIndex: 99999 })
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800 shrink-0">
                <h2 className="text-lg font-semibold">{editMode ? 'Edit Purchase' : 'Add Purchase'}</h2>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                    <X size={20} />
                </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
                <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">

                    {/* Custom Layout for Buy/Sell Mode (showExtraFields=true) */}
                    {showExtraFields ? (
                        <>
                            {/* Row 1: Date, Purchase Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Date</label>
                                    <input
                                        type="date"
                                        value={formData.purchase_date}
                                        onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Purchase Type</label>
                                    <select
                                        value={formData.purchase_type}
                                        onChange={(e) => setFormData({ ...formData, purchase_type: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    >
                                        <option value="Buy">Buy</option>
                                        <option value="Sell">Sell</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Product Name */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Product Name <span className="text-red-500">*</span></label>
                                <Select
                                    options={productOptions}
                                    isLoading={loadingProducts}
                                    value={formData.product_id ? { label: formData.product_name, value: formData.product_id } : null}
                                    onChange={handleProductChange}
                                    className="text-sm"
                                    placeholder={loadingProducts ? "Loading products..." : "Search product..."}
                                    styles={customSelectStyles}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                />
                            </div>

                            {/* Row 3: Quantity, Unit Amount */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Quantity <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder="Qty"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">
                                        Unit Amount {formData.supplier_price_requirement && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.unit_amount}
                                        onChange={(e) => setFormData({ ...formData, unit_amount: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder={formData.supplier_price_requirement ? "Amount (Required)" : "Amount (Optional)"}
                                    />
                                </div>
                            </div>

                            {/* Row 4: Total Amount */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Total Amount</label>
                                <div className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-medium">
                                    Rs {formData.total_amount.toFixed(2)}
                                </div>
                            </div>

                            {/* Row 5: Suppliers, Payment Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Supplier <span className="text-red-500">*</span></label>
                                    <Select
                                        options={supplierOptions}
                                        isLoading={loadingSuppliers}
                                        value={formData.supplier_id ? { label: formData.supplier_name, value: formData.supplier_id } : null}
                                        onChange={(opt: any) => setFormData({ 
                                            ...formData, 
                                            supplier_id: opt?.value || '', 
                                            supplier_name: opt?.label || '',
                                            supplier_price_requirement: opt?.price_requirement ?? true
                                        })}
                                        className="text-sm"
                                        placeholder={loadingSuppliers ? "Loading..." : "Select supplier..."}
                                        styles={customSelectStyles}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Payment Type <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.payment_type}
                                        onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Due">Due</option>
                                        <option value="Online">Online</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 6: Remarks */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Remarks</label>
                                <textarea
                                    rows={3}
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    placeholder="Optional remarks..."
                                />
                            </div>

                            {/* Hidden Purchase Name (Auto-submitted) */}
                            <input type="hidden" value={formData.purchase_name} />
                        </>
                    ) : (
                        // Standard Layout
                        <>
                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Date</label>
                                <input
                                    type="date"
                                    value={formData.purchase_date}
                                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                />
                            </div>

                            {/* Product */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Product Name <span className="text-red-500">*</span></label>
                                <Select
                                    options={productOptions}
                                    isLoading={loadingProducts}
                                    value={formData.product_id ? { label: formData.product_name, value: formData.product_id } : null}
                                    onChange={handleProductChange}
                                    className="text-sm"
                                    placeholder={loadingProducts ? "Loading products..." : "Search product..."}
                                    styles={customSelectStyles}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                />
                            </div>

                            {/* Quantity & Unit Amount */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">Quantity <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder="Qty"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 text-black dark:text-white">
                                        Unit Amount {formData.supplier_price_requirement && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.unit_amount}
                                        onChange={(e) => setFormData({ ...formData, unit_amount: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder={formData.supplier_price_requirement ? "Amount (Required)" : "Amount (Optional)"}
                                    />
                                </div>
                            </div>

                            {/* Total Amount */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Total Amount</label>
                                <div className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-medium">
                                    Rs {formData.total_amount.toFixed(2)}
                                </div>
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Supplier <span className="text-red-500">*</span></label>
                                <Select
                                    options={supplierOptions}
                                    isLoading={loadingSuppliers}
                                    value={formData.supplier_id ? { label: formData.supplier_name, value: formData.supplier_id } : null}
                                    onChange={(opt: any) => setFormData({ 
                                        ...formData, 
                                        supplier_id: opt?.value || '', 
                                        supplier_name: opt?.label || '',
                                        supplier_price_requirement: opt?.price_requirement ?? true
                                    })}
                                    className="text-sm"
                                    placeholder={loadingSuppliers ? "Loading..." : "Select supplier..."}
                                    styles={customSelectStyles}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                />
                            </div>

                            {/* Payment Type */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Payment Type <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.payment_type}
                                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Due">Due</option>
                                    <option value="Online">Online</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-xs font-bold mb-1 text-black dark:text-white">Remarks</label>
                                <textarea
                                    rows={3}
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    placeholder="Optional remarks..."
                                />
                            </div>
                        </>
                    )}

                    {/* MRP Section (Shown in both layouts if product is selected) */}
                    {formData.product_name && !editMode && (
                        <div className="mt-4 p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30">
                            {checkingMrp ? (
                                <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Checking MRP...</div>
                            ) : latestMrp ? (
                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                        This Product has set MRP Rs. {latestMrp.mrp_price.toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-gray-600 dark:text-gray-300">Keep this MRP?</span>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="mrp_decision" checked={mrpDecision === 'Yes'} onChange={() => setMrpDecision('Yes')} className="accent-emerald-600" /> Yes
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="mrp_decision" checked={mrpDecision === 'No'} onChange={() => setMrpDecision('No')} className="accent-emerald-600" /> No
                                        </label>
                                    </div>
                                    {mrpDecision === 'No' && (
                                        <div className="pt-2">
                                            <label className="block text-xs font-bold mb-1 text-emerald-800 dark:text-emerald-300">New MRP Price</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                value={newMrpPrice}
                                                onChange={e => setNewMrpPrice(e.target.value)}
                                                className="w-full md:w-1/2 px-3 py-2 text-sm border-2 border-emerald-300 dark:border-emerald-700 rounded-md bg-white dark:bg-zinc-800 focus:ring-emerald-500"
                                                placeholder="Enter new MRP..."
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                        Does this product have an MRP?
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="mrp_decision" checked={mrpDecision === 'Yes'} onChange={() => {
                                                setMrpDecision('Yes');
                                                if (!newMrpPrice && formData.unit_amount) {
                                                    setNewMrpPrice(formData.unit_amount.toString());
                                                }
                                            }} className="accent-emerald-600" /> Yes
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="mrp_decision" checked={mrpDecision === 'No'} onChange={() => setMrpDecision('No')} className="accent-emerald-600" /> No
                                        </label>
                                    </div>
                                    {mrpDecision === 'Yes' && (
                                        <div className="pt-2">
                                            <label className="block text-xs font-bold mb-1 text-emerald-800 dark:text-emerald-300">MRP Price</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                value={newMrpPrice}
                                                onChange={e => setNewMrpPrice(e.target.value)}
                                                className="w-full md:w-1/2 px-3 py-2 text-sm border-2 border-emerald-300 dark:border-emerald-700 rounded-md bg-white dark:bg-zinc-800 focus:ring-emerald-500"
                                                placeholder="Suggest amount..."
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </form>
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end gap-2 fixed bottom-[60px] md:bottom-0 left-0 right-0 md:static shrink-0 z-[101] w-full md:w-auto">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-zinc-700 rounded"
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="purchase-form"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            {editMode ? 'Update Purchase' : 'Save And Close'}
                        </>
                    )}
                </button>
            </div>

            {/* Combo Resolver Modal */}
            {comboResolving && (
                <ComboComponentSelectModal
                    comboProductId={comboResolving.id}
                    comboProductName={comboResolving.name}
                    onClose={() => setComboResolving(null)}
                    onSelectComponent={(component) => {
                        setComboResolving(null)
                        setFormData({
                            ...formData,
                            product_id: component.id,
                            product_name: component.product_name,
                            remarks: `${formData.remarks ? formData.remarks + '. ' : ''}Resolved from ${comboResolving.name}`
                        })
                    }}
                />
            )}
        </div>
    )
}
