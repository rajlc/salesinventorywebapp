'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, exportProducts, toggleProductStatus, updateProduct, approveProduct, rejectProduct, updateSyncStatuses, syncWebsiteStatus, remapAllCategories } from '@/features/inventory/actions/product-actions'
import { syncSelectedProductsFromDaraz } from '@/features/inventory/actions/daraz-sync-products'
import { ArrowLeft, Plus, Upload, Download, Search, X, Package, Trash2, Box, Image as ImageIcon, Check, RefreshCw, ExternalLink, Filter, CheckSquare, Square, Zap, Tags } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { AddProductModal } from '@/features/inventory/components/AddProductModal'
import { ViewProductModal } from '@/features/inventory/components/ViewProductModal'
import { EditProductModal } from '@/features/inventory/components/EditProductModal'
import { DeleteProductButton } from '@/features/inventory/components/DeleteProductButton'
import { ImportCSVModal } from '@/features/inventory/components/ImportCSVModal'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { PushToWebsiteModal } from '@/features/inventory/components/PushToWebsiteModal'

// Helper function to group variation products client-side under their main (single component) products
const groupProductsByVariation = (productsList: any[]) => {
    // Identify variations (combos with exactly 1 component)
    const variations = productsList.filter(p => 
        p.product_type === 'combo' && 
        p.product_combos && 
        p.product_combos.length === 1
    )

    // Map of child_product_id to variation products
    const childToVariationsMap = new Map<string, any[]>()
    variations.forEach(v => {
        const childId = v.product_combos?.[0]?.child_product_id
        if (childId) {
            if (!childToVariationsMap.has(childId)) {
                childToVariationsMap.set(childId, [])
            }
            childToVariationsMap.get(childId)!.push(v)
        }
    })

    const processedIds = new Set<string>()
    const result: any[] = []

    productsList.forEach(product => {
        if (processedIds.has(product.id)) return

        // Check if this product is a main product (Single) that has variations on the page
        if (childToVariationsMap.has(product.id)) {
            // Add the main product
            result.push(product)
            processedIds.add(product.id)

            // Add all variations for this main product
            const vars = childToVariationsMap.get(product.id) || []
            vars.forEach(v => {
                if (!processedIds.has(v.id)) {
                    result.push(v)
                    processedIds.add(v.id)
                }
            })
        } 
        // Check if this product is a variation whose main product is also in the list
        else if (product.product_type === 'combo' && 
                 product.product_combos && 
                 product.product_combos.length === 1) {
            const childId = product.product_combos[0].child_product_id
            const mainProductExists = productsList.some(p => p.id === childId)

            if (mainProductExists) {
                // This variation will be added when its main product is processed
            } else {
                // Main product is not in list. Group this variation with any other variations of the same child
                if (childId) {
                    const vars = childToVariationsMap.get(childId) || []
                    vars.forEach(v => {
                        if (!processedIds.has(v.id)) {
                            result.push(v)
                            processedIds.add(v.id)
                        }
                    })
                } else {
                    result.push(product)
                    processedIds.add(product.id)
                }
            }
        } else {
            // Regular product
            result.push(product)
            processedIds.add(product.id)
        }
    })

    return result
}

export default function ProductListPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [viewProductId, setViewProductId] = useState<string | null>(null)
    const [editProductId, setEditProductId] = useState<string | null>(null)
    const [pushProductId, setPushProductId] = useState<string | null>(null)

    // Priority and More menu states
    const [priorityEditId, setPriorityEditId] = useState<string | null>(null)
    const [moreMenuId, setMoreMenuId] = useState<string | null>(null)
    const [isSavingPriority, setIsSavingPriority] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isSyncingWebsite, setIsSyncingWebsite] = useState(false)
    const [isSyncingFromDaraz, setIsSyncingFromDaraz] = useState(false)
    const [isRemapping, setIsRemapping] = useState(false)
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)

    // Selection & filter state
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
    const [syncFilter, setSyncFilter] = useState<'all' | 'website_pending' | 'marketplace_pending' | 'variation_product'>('all')

    // Get real user role from permission context
    const { userRole } = usePermissions()
    const queryClient = useQueryClient()

    const handleSyncDarazProducts = async () => {
        setIsSyncing(true)
        try {
            const res = await fetch('/api/daraz/products/sync', { method: 'POST' })
            const data = await res.json()
            if (!res.ok || data.error) {
                throw new Error(data.error || data.details || 'Failed to sync')
            }
            alert(data.message || 'Sync completed successfully!')
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Sync failed: ${err.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSyncWebsite = async () => {
        setIsSyncingWebsite(true)
        try {
            const result = await syncWebsiteStatus()
            if (!result.success) throw new Error(result.error)
            alert(`✅ Website sync complete!\n\n🟢 Done: ${result.markedDone} products\n🟡 Pending: ${result.markedPending} products`)
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Website sync failed: ${err.message}`)
        } finally {
            setIsSyncingWebsite(false)
        }
    }

    const handleSyncFromDaraz = async () => {
        const ids = Array.from(selectedProductIds)
        if (ids.length === 0) return

        // Filter selected products that have a valid seller SKU
        const selectedProducts = groupedProducts.filter(p => ids.includes(p.id))
        const productsToSync = selectedProducts.filter(p => p.seller_sku1 && p.seller_sku1.trim() !== '')
        const skippedCount = selectedProducts.length - productsToSync.length

        if (productsToSync.length === 0) {
            alert('None of the selected products have a valid seller SKU. Sync skipped.')
            return
        }

        const confirmMsg = skippedCount > 0
            ? `Sync ${productsToSync.length} selected product(s) from Daraz? (${skippedCount} product(s) with no seller SKU will be skipped.)`
            : `Sync ${productsToSync.length} selected product(s) from Daraz? This will update their images, description, prices and other data.`

        if (!confirm(confirmMsg)) return
        setIsSyncingFromDaraz(true)
        try {
            const result = await syncSelectedProductsFromDaraz(productsToSync.map(p => p.id))
            const errMsg = result.errors.length > 0 ? `\n\n⚠️ Errors:\n${result.errors.slice(0, 5).join('\n')}` : ''
            alert(`✅ Daraz Sync Complete!\n\n🟢 Updated: ${result.updated}\n🟡 Not found on Daraz: ${result.notFound}${errMsg}`)
            setSelectedProductIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Sync from Daraz failed: ${err.message}`)
        } finally {
            setIsSyncingFromDaraz(false)
        }
    }

    const handleRemapCategories = async () => {
        if (!confirm('Re-map website & marketplace categories for ALL products based on current mapping table?\n\nProducts with no Daraz category will have their categories cleared.')) return
        setIsRemapping(true)
        try {
            const result = await remapAllCategories()
            if (!result.success) throw new Error(result.error)
            alert(`✅ Category remap complete!\n\n🟢 Remapped: ${result.updated} products\n🟡 Cleared (no Daraz category): ${result.cleared} products`)
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Category remap failed: ${err.message}`)
        } finally {
            setIsRemapping(false)
        }
    }

    const handleApprove = async (product: any) => {
        try {
            await approveProduct(product.id)
            setEditProductId(product.id)
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Approval failed: ${err.message}`)
        }
    }

    const handleReject = async (productId: string, productName: string) => {
        if (!confirm(`Are you sure you want to reject and remove "${productName}" from the database?`)) {
            return
        }
        try {
            await rejectProduct(productId)
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Rejection failed: ${err.message}`)
        }
    }

    const handleSyncStatusChange = async (productId: string, currentMarketplace: any, currentWebsite: any, field: 'marketplace' | 'website', value: 'Pending' | 'Done') => {
        try {
            const newMarketplace = field === 'marketplace' ? value : (currentMarketplace || 'Done')
            const newWebsite = field === 'website' ? value : (currentWebsite || 'Done')
            await updateSyncStatuses(productId, newMarketplace, newWebsite)
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            alert(`Failed to update status: ${err.message}`)
        }
    }

    const handleSetPriority = async (product: any, priority: boolean) => {
        setIsSavingPriority(true)
        try {
            let prioritySellerAccount = product.priority_seller_account;
            if (priority) {
                // Find configured seller accounts
                const accounts = [
                    product.seller_account1,
                    product.seller_account2,
                    product.seller_account3,
                    product.seller_account4
                ].filter(Boolean);

                if (accounts.length === 0) {
                    alert('Please configure seller accounts for this product first by editing it.');
                    setIsSavingPriority(false);
                    setPriorityEditId(null);
                    return;
                }
                if (!prioritySellerAccount) {
                    prioritySellerAccount = accounts[0];
                }
            } else {
                prioritySellerAccount = null;
            }

            await updateProduct(product.id, {
                sales_priority: priority,
                priority_seller_account: prioritySellerAccount
            });

            queryClient.invalidateQueries({ queryKey: ['products'] });
        } catch (err: any) {
            alert(`Failed to save priority: ${err.message}`);
        } finally {
            setIsSavingPriority(false);
            setPriorityEditId(null);
        }
    }

    // Fetch products with pagination, search, and syncFilter
    const { data, isLoading, error } = useQuery({
        queryKey: ['products', page, search, syncFilter],
        queryFn: () => getProducts({ page, search, limit: 50, syncFilter })
    })

    // Filtered products are now fully server-side filtered
    const filteredProducts = data?.products || []

    // Group products client-side for visual grouping
    const groupedProducts = groupProductsByVariation(filteredProducts)

    // Identify child product IDs that have variations on this page
    const variationChildIds = new Set<string>()
    filteredProducts.forEach(p => {
        if (p.product_type === 'combo' && p.product_combos && p.product_combos.length === 1) {
            const childId = p.product_combos[0].child_product_id
            if (childId) {
                variationChildIds.add(childId)
            }
        }
    })

    const isProductInVariationGroup = (product: any) => {
        const isVariation = product.product_type === 'combo' && product.product_combos && product.product_combos.length === 1
        const isMainProductOfVariation = variationChildIds.has(product.id)
        return isVariation || isMainProductOfVariation
    }

    // Map of variation group ID to the ID of the single product eligible to edit Marketplace/Website
    const groupEditableProductIdMap = new Map<string, string>()

    // Group products in this page by their variation group ID (main product ID)
    const variationGroupsMap = new Map<string, any[]>()
    groupedProducts.forEach(p => {
        let groupId = null
        if (p.product_type === 'combo' && p.product_combos && p.product_combos.length === 1) {
            groupId = p.product_combos[0].child_product_id
        } else if (variationChildIds.has(p.id)) {
            groupId = p.id
        }

        if (groupId) {
            if (!variationGroupsMap.has(groupId)) {
                variationGroupsMap.set(groupId, [])
            }
            variationGroupsMap.get(groupId)!.push(p)
        }
    })

    // Find the first product in each group that has a seller SKU (or fallback to the first product)
    variationGroupsMap.forEach((productsInGroup, groupId) => {
        const editableProduct = productsInGroup.find(p => p.seller_sku1 && p.seller_sku1.trim() !== '') || productsInGroup[0]
        if (editableProduct) {
            groupEditableProductIdMap.set(groupId, editableProduct.id)
        }
    })

    const getProductEligibility = (product: any) => {
        // If a product has no seller SKU, it is not eligible under any circumstances
        if (!product.seller_sku1 || product.seller_sku1.trim() === '') {
            return { inGroup: false, isEligible: false }
        }

        let groupId = null
        if (product.product_type === 'combo' && product.product_combos && product.product_combos.length === 1) {
            groupId = product.product_combos[0].child_product_id
        } else if (variationChildIds.has(product.id)) {
            groupId = product.id
        }

        if (!groupId) {
            return { inGroup: false, isEligible: true }
        }

        const eligibleId = groupEditableProductIdMap.get(groupId)
        return {
            inGroup: true,
            isEligible: eligibleId === product.id
        }
    }

    // Select All applies to currently filtered visible products only
    const allFilteredIds = groupedProducts.map(p => p.id)
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedProductIds.has(id))

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedProductIds(prev => {
                const next = new Set(prev)
                allFilteredIds.forEach(id => next.delete(id))
                return next
            })
        } else {
            setSelectedProductIds(prev => {
                const next = new Set(prev)
                allFilteredIds.forEach(id => next.add(id))
                return next
            })
        }
    }

    const toggleSelectProduct = (id: string) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1) // Reset to first page on new search
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const handleExport = async (filter: 'all' | 'marketplace_pending' | 'website_pending' = 'all') => {
        try {
            const csvData = await exportProducts(filter)

            if (csvData.length === 0) {
                alert('No products found matching this filter.')
                return
            }

            // Convert to CSV string
            const headers = Object.keys(csvData[0] || {})
            const csvRows = [
                headers.join(','),
                ...csvData.map(row =>
                    headers.map(header => {
                        const value = row[header as keyof typeof row]
                        // Escape values with commas, quotes, or newlines
                        return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))
                            ? `"${value.replace(/"/g, '""')}"`
                            : value
                    }).join(',')
                )
            ]

            const csvString = csvRows.join('\n')

            // Create download link
            const blob = new Blob([csvString], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `products_export_${filter}_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            alert('Products exported successfully!')
        } catch (error: any) {
            alert(`Export error: ${error.message}`)
        }
    }

    const handleToggleStatus = async (productId: string, currentStatus: string) => {
        try {
            await toggleProductStatus(productId, currentStatus || 'Active')
            // No need to reload, revalidatePath handles it
        } catch (error: any) {
            alert(`Error updating status: ${error.message}`)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-zinc-950">
            {/* Header Area - Clean & Modern */}
            <div className="hidden md:flex sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b dark:border-zinc-800 px-6 py-4 items-center justify-between shadow-sm transition-all duration-200">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        Inventory List
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                            {data?.totalCount || 0} items
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage and organize your product catalog</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/inventory"
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                    >
                        <ArrowLeft size={14} />
                        Back to Inventory
                    </Link>
                </div>
            </div>

            {/* Action Bar - Floating Card Effect */}
            <div className="sticky top-0 md:top-[76px] z-10 px-0 py-0 md:px-6 md:py-4 pointer-events-none transition-all">
                <div className="bg-white dark:bg-zinc-900 rounded-none md:rounded-xl border-b md:border dark:border-zinc-800 md:shadow-sm p-3 flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
                    {/* Filter Dropdown + Search Field */}
                    <div className="flex-1 w-full md:w-auto md:min-w-[240px] md:max-w-lg flex items-center gap-2">
                        {/* Sync Status Filter */}
                        <div className="relative flex-shrink-0">
                            <div className="flex items-center gap-1.5 h-[38px] pl-3 pr-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-inner">
                                <Filter size={13} className="text-gray-400 flex-shrink-0" />
                                <select
                                    value={syncFilter}
                                    onChange={(e) => {
                                        setSyncFilter(e.target.value as any)
                                        setPage(1)
                                        setSelectedProductIds(new Set())
                                    }}
                                    className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none cursor-pointer pr-1"
                                >
                                    <option value="all">All</option>
                                    <option value="website_pending">Website Pending</option>
                                    <option value="marketplace_pending">Marketplace Pending</option>
                                    <option value="variation_product">Variation Product</option>
                                </select>
                            </div>
                        </div>
                        <div className="relative group flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, SKU, or ID..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-10 pr-10 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all shadow-inner"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons Group */}
                    <div className="flex items-center gap-2">
                        {/* Select All — only shown when at least one row is selected */}
                        {selectedProductIds.size > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg hover:bg-blue-100 transition-all"
                            >
                                {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                                {allSelected ? 'Deselect All' : `Select All (${groupedProducts.length})`}
                            </button>
                        )}
                        {/* Sync From Daraz — shown when 1+ product is selected */}
                        {selectedProductIds.size > 0 && (
                            <button
                                onClick={handleSyncFromDaraz}
                                disabled={isSyncingFromDaraz}
                                className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                                title={`Sync ${selectedProductIds.size} selected product(s) from Daraz`}
                            >
                                <Zap size={14} className={isSyncingFromDaraz ? 'animate-pulse' : ''} />
                                {isSyncingFromDaraz ? 'Syncing...' : `Sync From Daraz (${selectedProductIds.size})`}
                            </button>
                        )}
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 hover:border-gray-400 transition-all"
                        >
                            <Upload size={14} className="text-gray-500" />
                            Import CSV
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm"
                            >
                                <Download size={14} className="text-gray-500" />
                                Export
                            </button>
                            {isExportDropdownOpen && (
                                <>
                                    {/* Backdrop */}
                                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsExportDropdownOpen(false)} />
                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 mt-1.5 w-48 rounded-lg bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                        <button
                                            onClick={() => {
                                                handleExport('all')
                                                setIsExportDropdownOpen(false)
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            All Products
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleExport('marketplace_pending')
                                                setIsExportDropdownOpen(false)
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                                        >
                                            Marketplace Pending
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleExport('website_pending')
                                                setIsExportDropdownOpen(false)
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                                        >
                                            Website Pending
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="hidden md:block w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
                        <button
                            onClick={handleSyncDarazProducts}
                            disabled={isSyncing}
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={14} className={`text-gray-500 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync'}
                        </button>
                        <button
                            onClick={handleSyncWebsite}
                            disabled={isSyncingWebsite}
                            title="Sync Website Status from Ecommerce Store"
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={14} className={`text-emerald-500 ${isSyncingWebsite ? 'animate-spin' : ''}`} />
                            {isSyncingWebsite ? 'Syncing...' : 'Sync Website'}
                        </button>
                        <button
                            onClick={handleRemapCategories}
                            disabled={isRemapping}
                            title="Re-map website & marketplace categories for all products"
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Tags size={14} className={`text-violet-500 ${isRemapping ? 'animate-pulse' : ''}`} />
                            {isRemapping ? 'Remapping...' : 'Remap Categories'}
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98]"
                        >
                            <Plus size={16} />
                            Add Product
                        </button>
                    </div>
                </div>
            </div>

            {/* Products Table Area */}
            <div className="flex-1 overflow-auto px-2 md:px-6 pb-2 md:pb-6">
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg md:rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800">
                                    <th className="px-2 md:px-4 py-3 w-8 md:w-10">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                                            title={allSelected ? 'Deselect all' : 'Select all on this page'}
                                        >
                                            {allSelected
                                                ? <CheckSquare size={15} className="text-blue-500" />
                                                : <Square size={15} />}
                                        </button>
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white w-10 md:w-12 text-center">#</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white w-12 md:w-16">Image</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Product</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Type</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Status</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Product ID</th>
                                    <th className="hidden lg:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Mapped Categories</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Marketplace</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Website</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-sm text-gray-500">Loading products...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center text-sm text-red-500 bg-red-50/50 dark:bg-red-900/10">
                                            Error loading products: {error.message}
                                        </td>
                                    </tr>
                                ) : !data || data.products.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-400">
                                                    <Box size={20} />
                                                </div>
                                                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">No products found</h3>
                                                <p className="text-sm text-gray-500 max-w-xs mx-auto mb-2">
                                                    {search ? 'We couldn\'t find any products matching your search.' : 'Get started by adding your first product.'}
                                                </p>
                                                <button
                                                    onClick={() => setIsModalOpen(true)}
                                                    className="text-sm text-blue-600 font-medium hover:underline"
                                                >
                                                    Add New Product
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    groupedProducts.map((product, index) => {
                                        const isSelected = selectedProductIds.has(product.id)
                                        const inVariationGroup = isProductInVariationGroup(product)
                                        return (
                                            <tr
                                                key={product.id}
                                                className={`group transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-50/40 dark:bg-blue-950/10 hover:bg-blue-100/30 dark:hover:bg-blue-900/20'
                                                        : inVariationGroup
                                                            ? 'bg-sky-50/60 dark:bg-sky-950/20 hover:bg-sky-100/50 dark:hover:bg-sky-900/30'
                                                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                                }`}
                                            >
                                                <td className={`px-2 md:px-4 py-3 ${inVariationGroup ? 'border-l-[3px] border-sky-400 dark:border-sky-500' : 'border-l-[3px] border-transparent'}`}>
                                                    <button
                                                        onClick={() => toggleSelectProduct(product.id)}
                                                        className="flex items-center justify-center text-gray-300 hover:text-blue-500 transition-colors"
                                                    >
                                                        {isSelected
                                                            ? <CheckSquare size={15} className="text-blue-500" />
                                                            : <Square size={15} />}
                                                    </button>
                                                </td>
                                                <td className="px-2 md:px-4 py-3 text-xs text-center text-gray-400 font-mono">
                                                    {(page - 1) * 50 + index + 1}
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 shadow-sm">
                                                        {product.image_url ? (
                                                            <img
                                                                src={product.image_url}
                                                                alt={product.product_name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div className={`absolute inset-0 flex items-center justify-center text-gray-300 ${product.image_url ? 'hidden' : ''} fallback-icon`}>
                                                            <ImageIcon size={16} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5 max-w-xs md:max-w-md">
                                                            <button
                                                                onClick={() => setViewProductId(product.id)}
                                                                className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors line-clamp-1"
                                                                title={product.product_name}
                                                            >
                                                                {product.product_name}
                                                            </button>
                                                            {product.daraz_product_url && (
                                                                <a
                                                                    href={product.daraz_product_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-orange-500 hover:text-orange-600 transition-colors flex-shrink-0"
                                                                    title="Open on Daraz"
                                                                >
                                                                    <ExternalLink size={13} />
                                                                </a>
                                                            )}
                                                        </div>
                                                        {product.seller_sku1 && (
                                                            <span className="text-[11px] text-gray-400 font-mono mt-0.5">SKU: {product.seller_sku1}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-full border ${product.product_type === 'combo'
                                                        ? (product.product_combos?.length === 1
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                                                            : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30')
                                                        : 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                                                        }`}>
                                                        {product.product_type === 'combo' ? (
                                                            <Package size={12} />
                                                        ) : (
                                                            <Box size={12} />
                                                        )}
                                                        {product.product_type === 'combo'
                                                            ? (product.product_combos?.length === 1 ? 'Variation' : 'Combo')
                                                            : 'Single'}
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleToggleStatus(product.id, product.status || (product.is_deleted ? 'Inactive' : 'Active'))
                                                        }}
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${(product.status === 'Active' || (!product.status && !product.is_deleted))
                                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                                            }`}
                                                        title="Click to toggle status"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${(product.status === 'Active' || (!product.status && !product.is_deleted)) ? 'bg-green-500' : 'bg-red-500'
                                                            }`}></span>
                                                        {product.status || (product.is_deleted ? 'Inactive' : 'Active')}
                                                    </button>
                                                </td>
                                                <td className="px-2 md:px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                                                    #{product.product_id}
                                                </td>
                                                {/* Mapped Categories */}
                                                <td className="hidden lg:table-cell px-4 py-3">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-11 flex-shrink-0">Web:</span>
                                                            {product.website_category ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                                                    {product.website_category}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 dark:text-gray-500 italic text-[10px]">Unmapped</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-11 flex-shrink-0">Market:</span>
                                                            {product.marketplace_category ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                                                                    {product.marketplace_category}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 dark:text-gray-500 italic text-[10px]">Unmapped</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Marketplace Sync Status */}
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    {getProductEligibility(product).isEligible ? (
                                                        <select
                                                            value={product.marketplace_sync_status || 'Done'}
                                                            onChange={(e) => handleSyncStatusChange(product.id, product.marketplace_sync_status, product.website_sync_status, 'marketplace', e.target.value as 'Pending' | 'Done')}
                                                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-800 ${
                                                                (product.marketplace_sync_status === 'Pending')
                                                                    ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/30'
                                                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                                                            }`}
                                                        >
                                                            <option value="Pending">Pending</option>
                                                            <option value="Done">Done</option>
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-50 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700" title="Only the top variation SKU in this group is eligible to sync/edit status">
                                                            Not Eligible
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Website Sync Status */}
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    {getProductEligibility(product).isEligible ? (
                                                        <select
                                                            value={product.website_sync_status || 'Pending'}
                                                            onChange={(e) => handleSyncStatusChange(product.id, product.marketplace_sync_status, product.website_sync_status, 'website', e.target.value as 'Pending' | 'Done')}
                                                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-800 ${
                                                                (product.website_sync_status === 'Pending' || !product.website_sync_status)
                                                                    ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/30'
                                                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                                                            }`}
                                                        >
                                                            <option value="Pending">Pending</option>
                                                            <option value="Done">Done</option>
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-50 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700" title="Only the top variation SKU in this group is eligible to sync/edit status">
                                                            Not Eligible
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3 relative">
                                                    {product.approval_status === 'Pending' ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleApprove(product)
                                                                }}
                                                                className="p-1 rounded-md text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 hover:scale-105 active:scale-95 transition-all"
                                                                title="Approve Listing"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleReject(product.id, product.product_name)
                                                                }}
                                                                className="p-1 rounded-md text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:scale-105 active:scale-95 transition-all"
                                                                title="Reject & Remove"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-2">
                                                            {/* Priority Button Wrapper */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => {
                                                                        setPriorityEditId(priorityEditId === product.id ? null : product.id);
                                                                        setMoreMenuId(null);
                                                                    }}
                                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
                                                                        product.sales_priority
                                                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-none shadow-md shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95'
                                                                            : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/10 dark:hover:bg-amber-950/10 active:scale-95'
                                                                    }`}
                                                                >
                                                                    Priority{product.sales_priority ? ': Yes' : ''}
                                                                </button>

                                                                {priorityEditId === product.id && (
                                                                    <>
                                                                        {/* Fixed full-screen backdrop to detect click-out */}
                                                                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setPriorityEditId(null)} />
                                                                        {/* Floating Dropdown */}
                                                                        <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                                                            <button
                                                                                disabled={isSavingPriority}
                                                                                onClick={() => handleSetPriority(product, true)}
                                                                                className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-1.5 transition-colors"
                                                                            >
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                Yes
                                                                            </button>
                                                                            <button
                                                                                disabled={isSavingPriority}
                                                                                onClick={() => handleSetPriority(product, false)}
                                                                                className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1.5 transition-colors"
                                                                            >
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                                                No
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* More Button Wrapper */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => {
                                                                        setMoreMenuId(moreMenuId === product.id ? null : product.id);
                                                                        setPriorityEditId(null);
                                                                    }}
                                                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-800 rounded-lg shadow-sm transition-all active:scale-95"
                                                                >
                                                                    More
                                                                </button>

                                                                {moreMenuId === product.id && (
                                                                    <>
                                                                        {/* Fixed full-screen backdrop to detect click-out */}
                                                                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMoreMenuId(null)} />
                                                                        {/* Floating Dropdown */}
                                                                        <div className="absolute right-0 mt-1.5 w-40 rounded-lg bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewProductId(product.id);
                                                                                    setMoreMenuId(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 transition-colors"
                                                                            >
                                                                                View
                                                                            </button>
                                                                            
                                                                            {product.website_sync_status === 'Pending' && (
                                                                                <>
                                                                                    <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setPushProductId(product.id);
                                                                                            setMoreMenuId(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 flex items-center gap-1.5 transition-colors"
                                                                                    >
                                                                                        Push to Website
                                                                                    </button>
                                                                                </>
                                                                            )}

                                                                            <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                                                                            
                                                                            <div className="px-1 py-0.5">
                                                                                <DeleteProductButton
                                                                                    productId={product.id}
                                                                                    productName={product.product_name}
                                                                                    userRole={userRole ?? 'user'}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data && data.totalPages > 1 && (
                        <div className="border-t dark:border-zinc-800 px-3 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Previous
                                </button>

                                {/* Smart Pagination */}
                                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                                    .filter(p => {
                                        // Always show first page, last page, current page, and pages around current
                                        return p === 1 ||
                                            p === data.totalPages ||
                                            Math.abs(p - page) <= 1
                                    })
                                    .map((p, i, arr) => (
                                        <div key={p} className="flex items-center gap-1.5">
                                            {/* Show ellipsis if there's a gap */}
                                            {i > 0 && arr[i - 1] !== p - 1 && (
                                                <span className="px-1 text-[13px] text-gray-400">...</span>
                                            )}
                                            <button
                                                onClick={() => setPage(p)}
                                                className={`px-2 py-0.5 text-[13px] rounded ${p === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        </div>
                                    ))}

                                <button
                                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                    disabled={page === data.totalPages}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-1">
                                Page {page} of {data.totalPages} ({data.totalCount} total products)
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Product Modal */}
            <AddProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* View Product Modal */}
            <ViewProductModal
                productId={viewProductId}
                isOpen={!!viewProductId}
                onClose={() => setViewProductId(null)}
                onEdit={(id) => setEditProductId(id)}
            />

            {/* Edit Product Modal */}
            <EditProductModal
                productId={editProductId}
                isOpen={!!editProductId}
                onClose={() => setEditProductId(null)}
            />

            {/* Import CSV Modal */}
            <ImportCSVModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />

            {/* Push To Website Modal */}
            <PushToWebsiteModal
                productId={pushProductId}
                isOpen={!!pushProductId}
                onClose={() => setPushProductId(null)}
            />
        </div>
    )
}
