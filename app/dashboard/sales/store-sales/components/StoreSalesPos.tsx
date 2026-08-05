'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
// import { getProducts } from '@/features/inventory/actions/product-actions' // Unused
import { createStoreSale, getStoreSales, updateStoreSale } from '@/features/sales/actions/store-sales-actions'

import { Search, ShoppingCart, Trash2, Save, RotateCcw, User, CreditCard, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface SaleItem {
    product_id: string
    product_name: string
    product_code: string
    qty: number
    amount: number
}

interface Props {
    onSwitchToList: () => void
    initialData?: any
    onCancelEdit?: () => void
}

export default function StoreSalesPos({ onSwitchToList, initialData, onCancelEdit }: Props) {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')

    // Grid Pagination
    const [page, setPage] = useState(1)

    // Cart State
    const [cart, setCart] = useState<SaleItem[]>([])

    // Form State
    const [customerName, setCustomerName] = useState('')
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
    const [paymentType, setPaymentType] = useState('Cash')
    const [remarks, setRemarks] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Initialize with data if editing
    useEffect(() => {
        if (initialData) {
            setCustomerName(initialData.customer_name || '')
            setSaleDate(initialData.sale_date.split('T')[0])
            setPaymentType(initialData.payment_type || 'Cash')
            setRemarks(initialData.remarks || '')

            // Map items
            const items = initialData.items.map((item: any) => ({
                product_id: item.product_id || '',
                product_name: item.product_name,
                product_code: item.product_code || '',
                qty: item.qty,
                amount: item.amount
            }))
            setCart(items)
        }
    }, [initialData])

    // For editing cancel
    const handleCancel = () => {
        if (onCancelEdit) {
            onCancelEdit()
        } else {
            // Reset form
            setCart([])
            setCustomerName('')
            setRemarks('')
        }
    }

    // Fetch Products (Client-side cache for instant search)
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = useState(true)

    useEffect(() => {
        const loadProducts = async () => {
            try {
                // We use the same strategy as OpeningStock: load all active products
                // But we use a specialized action that strictly fetches needed fields (image, price, etc.)
                // To avoid "getAllPosProducts" import error, make sure to export it from product-actions
                // If it's not available yet, we might need to cast or use getAllProductOptions temporarily
                // But assuming we just added it:
                const { getAllPosProducts } = await import('@/features/inventory/actions/product-actions')
                const data = await getAllPosProducts()
                setAllProducts(data)
            } catch (error) {
                console.error("Failed to load POS products", error)
                toast.error("Failed to load products")
            } finally {
                setIsLoadingProducts(false)
            }
        }
        loadProducts()
    }, [])

    // Filter & Paginate Client-Side
    const filteredProducts = useMemo(() => {
        if (!search.trim()) return allProducts

        const lowerSearch = search.toLowerCase()
        return allProducts.filter(p =>
            p.product_name.toLowerCase().includes(lowerSearch) ||
            p.seller_sku1?.toLowerCase().includes(lowerSearch) ||
            p.product_id?.toString().includes(lowerSearch)
        )
    }, [search, allProducts])

    const ITEMS_PER_PAGE = 10
    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
    const paginatedProducts = filteredProducts.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    ) // Slice for current page

    // Reset page when search changes
    useEffect(() => {
        setPage(1)
    }, [search])

    // Fetch Recent Sales
    const { data: recentSalesData } = useQuery({
        queryKey: ['store-sales-recent'],
        queryFn: () => getStoreSales({ page: 1, limit: 5 })
    })
    const recentSales = (recentSalesData as any)?.sales || []

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id)
            if (existing) {
                return prev.map(item =>
                    item.product_id === product.id
                        ? { ...item, qty: item.qty + 1 }
                        : item
                )
            }
            return [...prev, {
                product_id: product.id,
                product_name: product.product_name,
                product_code: product.product_id,
                qty: 1,
                amount: product.est_price || 0 // Default to estimated price
            }]
        })
        toast.success(`Added ${product.product_name}`)
    }

    const updateCartItem = (index: number, field: keyof SaleItem, value: number) => {
        setCart(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ))
    }

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index))
    }

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.qty * item.amount), 0)
    }

    const handleSaveSale = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty')
            return
        }


        // Validate prices
        const invalidItems = cart.filter(item => item.amount <= 0)
        if (invalidItems.length > 0) {
            toast.error(`Please enter price for: ${invalidItems.map(i => i.product_name).join(', ')}`)
            return
        }

        setIsSubmitting(true)

        try {
            let result;

            if (initialData) {
                // Update existing
                result = await updateStoreSale(initialData.id, {
                    sale_date: saleDate,
                    customer_name: customerName || undefined,
                    payment_type: paymentType,
                    remarks: remarks || undefined,
                    items: cart
                })
            } else {
                // Create new
                result = await createStoreSale({
                    sale_date: saleDate,
                    customer_name: customerName || undefined,
                    payment_type: paymentType,
                    remarks: remarks || undefined,
                    items: cart
                })
            }

            if ((result as any).error) {
                toast.error((result as any).error)
            } else {
                toast.success(initialData ? 'Sale updated successfully!' : 'Sale saved successfully!')

                if (initialData && onSwitchToList) {
                    onSwitchToList() // Go back to list after edit
                } else {
                    setCart([])
                    setCustomerName('')
                    setRemarks('')
                }

                // Refresh queries
                queryClient.invalidateQueries({ queryKey: ['store-sales-recent'] })
                queryClient.invalidateQueries({ queryKey: ['store-sales'] })
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-zinc-950 p-3 gap-3">
            <div className="flex flex-1 gap-3 overflow-hidden">

                {/* LEFT: Product Grid */}
                <div className="flex-[2] flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden border dark:border-zinc-800">
                    {/* Search Header */}
                    <div className="p-3 border-b dark:border-zinc-800 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value)
                                }}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {isLoadingProducts ? (
                            <div className="flex items-center justify-center h-full text-gray-400">Loading products...</div>
                        ) : paginatedProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400">No products found</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
                                {paginatedProducts.map((product: any) => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="group relative flex flex-col bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md hover:border-blue-500 transition-all cursor-pointer overflow-hidden"
                                    >
                                        <div className="aspect-square bg-gray-100 dark:bg-zinc-800 relative">
                                            {product.image_url ? (
                                                <Image
                                                    src={product.image_url}
                                                    alt={product.product_name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-300">
                                                    <ShoppingCart size={20} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <h3 className="text-xs font-medium line-clamp-2 min-h-[32px] leading-tight mb-1">
                                                {product.product_name}
                                            </h3>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500 font-mono">{product.product_id}</span>
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    Rs. {product.est_price || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-2 border-t dark:border-zinc-800 flex justify-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1 text-sm bg-gray-100 dark:bg-zinc-800 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span className="flex items-center text-sm font-medium">Page {page} of {totalPages}</span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 text-sm bg-gray-100 dark:bg-zinc-800 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: Cart & Checkout */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden border dark:border-zinc-800 max-w-[400px]">
                    {/* Customer Details */}
                    <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-b dark:border-zinc-800 space-y-3">
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Customer Name (Optional)"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="flex-1 bg-transparent border-b border-gray-300 dark:border-zinc-600 focus:border-blue-500 outline-none text-sm py-1"
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1 flex items-center gap-2">
                                <Calendar size={16} className="text-gray-400" />
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={e => setSaleDate(e.target.value)}
                                    className="flex-1 bg-transparent border-b border-gray-300 dark:border-zinc-600 focus:border-blue-500 outline-none text-sm py-1"
                                />
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                                <CreditCard size={16} className="text-gray-400" />
                                <select
                                    value={paymentType}
                                    onChange={e => setPaymentType(e.target.value)}
                                    className="flex-1 bg-transparent border-b border-gray-300 dark:border-zinc-600 focus:border-blue-500 outline-none text-sm py-1"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Online Payment">Online</option>
                                    <option value="Due">Due</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                <ShoppingCart size={48} className="mb-2 stroke-1" />
                                <p className="text-sm">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={idx} className="flex flex-col bg-gray-50 dark:bg-zinc-800/30 p-2 rounded-lg gap-2 border dark:border-zinc-800">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-medium line-clamp-1">{item.product_name}</span>
                                        <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center border dark:border-zinc-700 rounded bg-white dark:bg-zinc-900">
                                            <button
                                                onClick={() => updateCartItem(idx, 'qty', Math.max(1, item.qty - 1))}
                                                className="px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                            >-</button>
                                            <span className="px-2 text-sm font-medium w-8 text-center">{item.qty}</span>
                                            <button
                                                onClick={() => updateCartItem(idx, 'qty', item.qty + 1)}
                                                className="px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                            >+</button>
                                        </div>
                                        <span className="text-xs text-gray-400">x</span>
                                        <input
                                            type="number"
                                            value={item.amount === 0 ? '' : item.amount}
                                            onChange={e => updateCartItem(idx, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                            placeholder="Price"
                                            className="w-20 px-2 py-1 text-sm border dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-right placeholder:text-gray-400"
                                        />
                                        <div className="flex-1 text-right font-medium text-blue-600 dark:text-blue-400">
                                            Rs. {(item.qty * item.amount).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Checkout Footer */}
                    <div className="p-4 bg-gray-50 dark:bg-zinc-800/80 border-t dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-500">Total Amount</span>
                            <span className="text-2xl font-bold">Rs. {calculateTotal().toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setCart([])}
                                disabled={cart.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors font-medium disabled:opacity-50"
                            >
                                <RotateCcw size={18} />
                                Reset
                            </button>
                            <button
                                onClick={handleSaveSale}
                                disabled={cart.length === 0 || isSubmitting}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span>Saving...</span>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Checkout
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom: Recent Sales - Hidden in landscape to save space since List is shown on left */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-4 border dark:border-zinc-800 mt-auto hidden lg:block landscape:hidden">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <RotateCcw size={16} />
                        Recent Sales
                    </h3>
                    <button onClick={onSwitchToList} className="text-sm text-blue-600 hover:underline">
                        View All Sales
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500">
                            <tr>
                                <th className="px-3 py-2 font-medium">Time</th>
                                <th className="px-3 py-2 font-medium">Customer</th>
                                <th className="px-3 py-2 font-medium">Items</th>
                                <th className="px-3 py-2 font-medium text-right">Total</th>
                                <th className="px-3 py-2 font-medium">Payment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {recentSales.map((sale: any) => (
                                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                    <td className="px-3 py-2 text-gray-500">
                                        {new Date(sale.sale_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2 font-medium">
                                        {sale.customer_name || 'Walk-in'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">
                                        {sale.items?.map((i: any) => i.product_name).join(', ')}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">
                                        Rs. {sale.total_amount?.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs border px-1.5 py-0.5 rounded bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                                            {sale.payment_type}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
