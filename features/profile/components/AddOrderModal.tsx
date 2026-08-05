'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Trash2, Loader2, Calendar } from 'lucide-react'
import { createMarketplaceOrder } from '@/features/sales/actions/marketplace-actions'
import { getDeliveryLocations, DeliveryLocation } from '@/features/settings/actions/delivery-actions'
import { getProducts, Product } from '@/features/inventory/actions/product-actions'
import { toast } from 'sonner'
import { generateSalesId } from '@/features/sales/actions/marketplace-actions'

interface OrderItemRow {
    product_id: string
    product_name: string
    quantity: number
    amount: number
}

export function AddOrderModal({ onOrderAdded }: { onOrderAdded: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(false)

    // Data sources
    const [branches, setBranches] = useState<DeliveryLocation[]>([])
    const [products, setProducts] = useState<Product[]>([])

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [salesId, setSalesId] = useState('Generating...')
    const [customerName, setCustomerName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [address, setAddress] = useState('')
    const [selectedBranchId, setSelectedBranchId] = useState('')
    const [branchCharge, setBranchCharge] = useState(0)
    const [deliveryCharge, setDeliveryCharge] = useState(0)
    const [status, setStatus] = useState('Pending')
    const [remarks, setRemarks] = useState('')

    // Items
    const [items, setItems] = useState<OrderItemRow[]>([
        { product_id: '', product_name: '', quantity: 1, amount: 0 }
    ])

    // Load data on open
    useEffect(() => {
        if (open) {
            setInitializing(true)
            Promise.all([
                getDeliveryLocations(),
                getProducts({ limit: 1000 }),
                generateSalesId(date)
            ]).then(([branchData, productData, newSalesId]) => {
                setBranches(branchData)
                setProducts(productData.products)
                setSalesId(newSalesId)
            }).catch(err => {
                console.error("Failed to load form data", err)
                toast.error("Failed to load data")
            }).finally(() => {
                setInitializing(false)
            })
        }
    }, [open, date]) // adding date dependency to regen sales ID if date changes? Maybe excessive but safe.

    const handleBranchChange = (branchId: string) => {
        setSelectedBranchId(branchId)
        const branch = branches.find(b => b.id === branchId)
        if (branch) {
            setBranchCharge(branch.delivery_charge)
            setDeliveryCharge(branch.delivery_charge)
        }
    }

    const handleItemChange = (index: number, field: keyof OrderItemRow, value: any) => {
        const newItems = [...items]

        if (field === 'product_id') {
            const product = products.find(p => p.id === value)
            newItems[index].product_id = value
            newItems[index].product_name = product?.product_name || ''
        } else {
            (newItems[index] as any)[field] = value
        }
        setItems(newItems)
    }

    const addItem = () => {
        setItems([...items, { product_id: '', product_name: '', quantity: 1, amount: 0 }])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.amount), 0) + Number(deliveryCharge)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (!customerName) {
            toast.error("Customer Name is required")
            setLoading(false)
            return
        }

        try {
            await createMarketplaceOrder({
                order_date: date,
                customer_name: customerName,
                phone_number: phoneNumber,
                address: address,
                delivery_branch_id: selectedBranchId,
                branch_charge: branchCharge,
                delivery_charge: Number(deliveryCharge),
                order_status: status,
                remarks: remarks,
                items: items.map(item => ({
                    ...item,
                    product_id: item.product_id || undefined
                }))
            })

            toast.success("Order created successfully")
            setOpen(false)
            onOrderAdded()

            // Reset
            setCustomerName('')
            setPhoneNumber('')
            setAddress('')
            setItems([{ product_id: '', product_name: '', quantity: 1, amount: 0 }])
        } catch (error: any) {
            toast.error(error.message || "Failed to create order")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-9 px-3 gap-2"
            >
                <Plus className="h-4 w-4" />
                Add Order
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

                    <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-700">
                            <h2 className="text-lg font-bold">Add New Order</h2>
                            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                <X size={20} />
                            </button>
                        </div>

                        {initializing ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-6 flex-1">
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Date</label>
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Customer Name *</label>
                                        <input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Required" className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Phone Number</label>
                                        <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digits" className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                </div>

                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Sales ID</label>
                                        <input value={salesId} disabled className="w-full p-2 border rounded-md bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700 opacity-70" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Address</label>
                                        <input value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Delivery Branch</label>
                                        <select value={selectedBranchId} onChange={e => handleBranchChange(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700">
                                            <option value="">Select Branch</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Branch Charge</label>
                                        <input type="number" value={branchCharge} disabled className="w-full p-2 border rounded-md bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700 opacity-70" />
                                    </div>
                                </div>

                                {/* Row 3: Items */}
                                <div className="space-y-3 border rounded-lg p-3 bg-gray-50/50 dark:bg-zinc-800/50">
                                    <label className="text-sm font-medium">Order Items</label>
                                    {items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                            <div className="md:col-span-4 space-y-1">
                                                <label className="text-xs">Product</label>
                                                <select
                                                    className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm"
                                                    value={item.product_id}
                                                    onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                                                >
                                                    <option value="">Select Product...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.product_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-xs">Qty</label>
                                                <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs">Amount</label>
                                                <input type="number" min="0" value={item.amount} onChange={e => handleItemChange(index, 'amount', Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm" />
                                            </div>
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-xs">Total</label>
                                                <div className="p-2 border rounded-md bg-gray-100 dark:bg-zinc-800 text-sm opacity-70">
                                                    {(item.quantity * item.amount).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="md:col-span-1">
                                                <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addItem} className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 p-2 rounded-md text-sm text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex justify-center items-center gap-2">
                                        <Plus className="h-4 w-4" /> Add Item
                                    </button>
                                </div>

                                {/* Row 4 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Delivery Charge</label>
                                        <input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-sm font-medium">Total Amount</label>
                                        <div className="text-2xl font-bold text-green-600">
                                            Rs {totalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 5 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Order Status</label>
                                        <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700">
                                            <option value="Pending">Pending</option>
                                            <option value="Shipped">Shipped</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Fail Delivered">Fail Delivered</option>
                                            <option value="Cancel">Cancel</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Remarks</label>
                                        <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="flex justify-end gap-3 p-4 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-gray-100 dark:bg-zinc-800 dark:border-zinc-600 dark:hover:bg-zinc-700">Cancel</button>
                            <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {loading ? 'Saving...' : 'Add Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
