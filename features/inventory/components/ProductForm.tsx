'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getProducts } from '@/features/inventory/actions/product-actions'
import AsyncSelect from 'react-select/async'

import { getOnlineStores } from '@/features/settings/actions/settingsActions'

interface ProductFormProps {
    initialData?: any
    onSubmit: (data: any) => Promise<void>
    onCancel: () => void
    isSubmitting: boolean
}

interface ComboItem {
    child_product_id: string
    child_product_name?: string
    quantity: number
}

export function ProductForm({ initialData, onSubmit, onCancel, isSubmitting }: ProductFormProps) {
    const [productName, setProductName] = useState(initialData?.product_name || '')
    const [imageUrl, setImageUrl] = useState(initialData?.image_url || '')
    const [productType, setProductType] = useState<'single' | 'combo'>(initialData?.product_type || 'single')

    // Seller SKUs
    const [sellerSku1, setSellerSku1] = useState(initialData?.seller_sku1 || '')
    const [salesPriority, setSalesPriority] = useState<boolean>(initialData?.sales_priority || false)
    const [prioritySellerAccount, setPrioritySellerAccount] = useState<string>(initialData?.priority_seller_account || '')
    const [sellerAccount1, setSellerAccount1] = useState(initialData?.seller_account1 || '')
    const [sellerSku2, setSellerSku2] = useState(initialData?.seller_sku2 || '')
    const [sellerAccount2, setSellerAccount2] = useState(initialData?.seller_account2 || '')
    const [sellerSku3, setSellerSku3] = useState(initialData?.seller_sku3 || '')
    const [sellerAccount3, setSellerAccount3] = useState(initialData?.seller_account3 || '')
    const [sellerSku4, setSellerSku4] = useState(initialData?.seller_sku4 || '')
    const [sellerAccount4, setSellerAccount4] = useState(initialData?.seller_account4 || '')

    // Combo items
    const [comboItems, setComboItems] = useState<ComboItem[]>(() => {
        if (!initialData?.combo_items) return []
        return initialData.combo_items.map((item: any) => ({
            child_product_id: item.child_product_id || item.child?.id,
            child_product_name: item.child_product_name || item.child?.product_name,
            quantity: item.quantity
        }))
    })
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [quantity, setQuantity] = useState(1)
    const [searchProductId, setSearchProductId] = useState('')

    // Track if form has unsaved changes
    const [hasChanges, setHasChanges] = useState(false)

    // Fetch seller accounts from Settings > Stores > Online Stores
    const { data: storesData } = useQuery({
        queryKey: ['online-stores'],
        queryFn: getOnlineStores
    })

    const sellerAccounts = storesData?.data?.map((store: any) => ({
        value: store.seller_account,
        label: store.seller_account
    })) || []

    // Track changes
    useEffect(() => {
        const changed = productName !== (initialData?.product_name || '') ||
            imageUrl !== (initialData?.image_url || '') ||
            productType !== (initialData?.product_type || 'single') ||
            sellerSku1 !== (initialData?.seller_sku1 || '') ||
            sellerAccount1 !== (initialData?.seller_account1 || '') ||
            salesPriority !== (initialData?.sales_priority || false) ||
            prioritySellerAccount !== (initialData?.priority_seller_account || '') ||
            comboItems.length > 0
        setHasChanges(changed)
    }, [productName, imageUrl, productType, sellerSku1, sellerAccount1, salesPriority, prioritySellerAccount, comboItems, initialData])

    const handleCancelWithWarning = () => {
        if (hasChanges) {
            if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                onCancel()
            }
        } else {
            onCancel()
        }
    }

    // Load Options for Async Select
    const loadOptions = async (inputValue: string) => {
        try {
            const { products } = await getProducts({
                page: 1,
                limit: 50,
                search: inputValue,
                productType: 'all'
            })

            return products
                .filter(p => {
                    const isSelf = p.id === initialData?.id
                    if (isSelf) return false

                    return p.product_type === 'single'
                })
                .map(p => {
                    return {
                        value: p.id,
                        label: `${p.product_name} (ID: ${p.product_id})`,
                        product_id: p.product_id
                    }
                })
        } catch (error) {
            console.error("Error loading products:", error)
            return []
        }
    }

    // Handle Product ID Input Change (Sync to Dropdown)
    const handleProductIdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearchProductId(val)

        if (val && !isNaN(Number(val))) {
            try {
                // Fetch specific product by ID
                const { products } = await getProducts({
                    page: 1,
                    limit: 5, // Fetch a few to ensure we find the exact match
                    search: val,
                    productType: 'all'
                })

                const found = products.find(p => String(p.product_id) === val)

                if (found) {
                    // Check eligibility
                    const isSelf = found.id === initialData?.id
                    const isSingle = found.product_type === 'single'

                    if (isSelf) {
                        setSelectedProduct(null)
                        return
                    }

                    if (isSingle) {
                        setSelectedProduct({
                            value: found.id,
                            label: `${found.product_name} (ID: ${found.product_id})`,
                            product_id: found.product_id
                        })
                    } else if (found.product_type === 'combo') {
                        alert('Combo product (including variations) cannot be added as a combo component.')
                        setSelectedProduct(null)
                        setSearchProductId('') // Clear the invalid input to avoid confusion
                    } else {
                        setSelectedProduct(null)
                    }
                } else {
                    setSelectedProduct(null)
                }
            } catch (err) {
                setSelectedProduct(null)
            }
        } else {
            setSelectedProduct(null)
        }
    }

    // Handle Dropdown Selection (Sync to Product ID Input)
    const handleProductSelect = (option: any) => {
        setSelectedProduct(option)
        if (option) {
            setSearchProductId(String(option.product_id))
        } else {
            setSearchProductId('')
        }
    }

    const handleAddComboItem = () => {
        if (!selectedProduct || quantity < 1) {
            alert('Please select a product and enter a valid quantity')
            return
        }

        // Check if product already added
        if (comboItems.some(item => item.child_product_id === selectedProduct.value)) {
            alert('This product is already added to the combo')
            return
        }

        setComboItems([...comboItems, {
            child_product_id: selectedProduct.value,
            child_product_name: selectedProduct.label,
            quantity
        }])

        // Reset
        setSelectedProduct(null)
        setSearchProductId('')
        setQuantity(1)
    }

    const handleRemoveComboItem = (productId: string) => {
        setComboItems(comboItems.filter(item => item.child_product_id !== productId))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!productName.trim()) {
            alert('Product name is required')
            return
        }

        let finalComboItems = [...comboItems]

        if (productType === 'combo' && finalComboItems.length === 0) {
            // UX Improvement: If user selected a product but didn't click add, auto-add it or warn them
            if (selectedProduct) {
                finalComboItems.push({
                    child_product_id: selectedProduct.value,
                    child_product_name: selectedProduct.label,
                    quantity: quantity
                })
            } else {
                alert('Combo products must have at least one component. Please add a product to the combo list.')
                return
            }
        }

        const formData = {
            product_name: productName.trim(),
            image_url: imageUrl.trim() || undefined,
            product_type: productType,
            seller_sku1: sellerSku1.trim() || undefined,
            seller_account1: sellerAccount1.trim() || undefined,
            seller_sku2: sellerSku2.trim() || undefined,
            seller_account2: sellerAccount2.trim() || undefined,
            seller_sku3: sellerSku3.trim() || undefined,
            seller_account3: sellerAccount3.trim() || undefined,
            seller_sku4: sellerSku4.trim() || undefined,
            seller_account4: sellerAccount4.trim() || undefined,
            sales_priority: salesPriority,
            priority_seller_account: salesPriority ? (prioritySellerAccount.trim() || null) : null,
            combo_items: productType === 'combo' ? finalComboItems.map(item => ({
                child_product_id: item.child_product_id,
                quantity: item.quantity
            })) : undefined
        }

        await onSubmit(formData)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Product Name, Image URL, Product ID, Product Type */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="block text-xs font-medium mb-1">
                        Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                        placeholder="Enter product name"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium mb-1">
                        Image URL
                    </label>
                    <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                        placeholder="https://..."
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium mb-1">
                        Product ID
                    </label>
                    <input
                        type="text"
                        value="Auto-generated"
                        disabled
                        className="w-full px-2.5 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-gray-500 cursor-not-allowed"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium mb-1">
                        Product Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={productType}
                        onChange={(e) => setProductType(e.target.value as 'single' | 'combo')}
                        className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    >
                        <option value="single">Single</option>
                        <option value="combo">Combo</option>
                    </select>
                </div>
            </div>

            {/* Conditional: Combo Product Selector */}
            {productType === 'combo' && (
                <div className="border dark:border-zinc-700 rounded-lg p-3 bg-purple-50 dark:bg-purple-900/10">
                    <h3 className="text-sm font-medium mb-3">Combo Components</h3>

                    <div className="flex items-end gap-2 mb-3">
                        <div className="w-32">
                            <label className="block text-xs font-medium mb-1">
                                Product ID
                            </label>
                            <input
                                type="text"
                                value={searchProductId}
                                onChange={handleProductIdChange}
                                placeholder="Search ID..."
                                className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                            />
                        </div>

                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1">
                                Product Name
                            </label>
                            <AsyncSelect
                                cacheOptions
                                defaultOptions
                                value={selectedProduct}
                                loadOptions={loadOptions}
                                onChange={handleProductSelect}
                                className="text-sm"
                                classNamePrefix="select"
                                placeholder="Search and select product..."
                                isClearable
                                isSearchable
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        minHeight: '32px',
                                        fontSize: '0.875rem'
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        fontSize: '0.875rem',
                                        zIndex: 9999 // Ensure dropdown is visible
                                    })
                                }}
                            />
                        </div>

                        <div className="w-24">
                            <label className="block text-xs font-medium mb-1">
                                Qty
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleAddComboItem}
                            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            Add
                        </button>
                    </div >

                    {/* Combo Items List */}
                    {
                        comboItems.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium">Added Components:</p>
                                {comboItems.map((item) => (
                                    <div
                                        key={item.child_product_id}
                                        className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 rounded-md border dark:border-zinc-700"
                                    >
                                        <span className="text-sm">{item.child_product_name || `Product ID: ${item.child_product_id}`} × {item.quantity}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveComboItem(item.child_product_id)}
                                            className="text-red-600 hover:text-red-700 p-1"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </div >
            )
            }

            {/* Conditional: Seller SKUs (Single & Combo) */}
            {
                (productType === 'single' || productType === 'combo') && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">Seller SKUs & Accounts</h3>

                        {/* Seller SKU 1 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller SKU 1
                                </label>
                                <input
                                    type="text"
                                    value={sellerSku1}
                                    onChange={(e) => setSellerSku1(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    placeholder="Enter SKU"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller Account 1
                                </label>
                                <select
                                    value={sellerAccount1}
                                    onChange={(e) => setSellerAccount1(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                >
                                    <option value="">Select account...</option>
                                    {sellerAccounts.map(acc => (
                                        <option key={acc.value} value={acc.value}>{acc.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Seller SKU 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller SKU 2
                                </label>
                                <input
                                    type="text"
                                    value={sellerSku2}
                                    onChange={(e) => setSellerSku2(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    placeholder="Enter SKU"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller Account 2
                                </label>
                                <select
                                    value={sellerAccount2}
                                    onChange={(e) => setSellerAccount2(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                >
                                    <option value="">Select account...</option>
                                    {sellerAccounts.map(acc => (
                                        <option key={acc.value} value={acc.value}>{acc.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Seller SKU 3 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller SKU 3
                                </label>
                                <input
                                    type="text"
                                    value={sellerSku3}
                                    onChange={(e) => setSellerSku3(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    placeholder="Enter SKU"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller Account 3
                                </label>
                                <select
                                    value={sellerAccount3}
                                    onChange={(e) => setSellerAccount3(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                >
                                    <option value="">Select account...</option>
                                    {sellerAccounts.map(acc => (
                                        <option key={acc.value} value={acc.value}>{acc.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Seller SKU 4 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller SKU 4
                                </label>
                                <input
                                    type="text"
                                    value={sellerSku4}
                                    onChange={(e) => setSellerSku4(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    placeholder="Enter SKU"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Seller Account 4
                                </label>
                                <select
                                    value={sellerAccount4}
                                    onChange={(e) => setSellerAccount4(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                >
                                    <option value="">Select account...</option>
                                    {sellerAccounts.map(acc => (
                                        <option key={acc.value} value={acc.value}>{acc.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Sales Priority Selection */}
            <div className="border dark:border-zinc-700 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/10 space-y-3">
                <h3 className="text-sm font-medium text-amber-900 dark:text-amber-300">Sales Priority</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">
                            Enable Sales Priority
                        </label>
                        <select
                            value={salesPriority ? 'Yes' : 'No'}
                            onChange={(e) => {
                                const isYes = e.target.value === 'Yes'
                                setSalesPriority(isYes)
                                if (!isYes) {
                                    setPrioritySellerAccount('')
                                }
                            }}
                            className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                        >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </div>

                    {salesPriority && (
                        <div>
                            <label className="block text-xs font-medium mb-1">
                                Priority Seller Account <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={prioritySellerAccount}
                                onChange={(e) => setPrioritySellerAccount(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                required
                            >
                                <option value="">Select priority account...</option>
                                {Array.from(new Set([
                                    sellerAccount1,
                                    sellerAccount2,
                                    sellerAccount3,
                                    sellerAccount4
                                ])).filter(Boolean).map(acc => (
                                    <option key={acc} value={acc}>{acc}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-zinc-700">
                <button
                    type="button"
                    onClick={handleCancelWithWarning}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                    Close
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form >
    )
}
