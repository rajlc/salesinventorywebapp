'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, RefreshCw, Layers, ExternalLink, ChevronDown, CheckCircle, AlertTriangle, MoreVertical, Settings, Edit3, FileText, CheckCircle2, Info } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import ProductDetailDrawer from './ProductDetailDrawer'
import EditProductDrawer from './EditProductDrawer'
import { syncAllDarazProductsAction } from '@/features/inventory/actions/daraz-sync-products'

// ── Content Score Calculation (User Specification) ───────────────────────────
// Excellent: 3+ images, highlights with bullet points, and description with at least one image
// Incomplete: less than 3 images OR no description
// To be Improved: missing bullet points OR short description OR no image in description
export function calculateDarazContentScore(product: any) {
    const imagesCount = (product.images || []).length
    const shortDesc = (product.attributes?.short_description || product.highlights || '').trim()
    const desc = (product.attributes?.description || product.description || '').trim()

    const hasBulletPoints = shortDesc.includes('<li') ||
        shortDesc.includes('•') ||
        shortDesc.includes('* ') ||
        shortDesc.includes('- ') ||
        shortDesc.split('\n').filter((l: string) => l.trim().length > 3).length >= 2

    const hasImageInDesc = desc.includes('<img') ||
        desc.includes('data:image') ||
        /https?:\/\/[^\s"']+\.(jpeg|jpg|png|webp|gif)/i.test(desc) ||
        desc.includes('slatic.net')

    const isShortDesc = desc.replace(/<[^>]*>/g, '').trim().length < 60

    // 1. Incomplete: missing images completely OR missing description OR both <3 images and missing highlights
    if (imagesCount === 0 || !desc || (imagesCount < 3 && (!desc || !shortDesc))) {
        const missingReasons: string[] = []
        if (imagesCount === 0) missingReasons.push('No product images')
        else if (imagesCount < 3) missingReasons.push(`Only ${imagesCount} image(s) and missing highlights`)
        if (!desc) missingReasons.push('Missing description')
        return {
            status: 'incomplete',
            label: 'Incomplete',
            colorClass: 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
            dotClass: 'bg-red-500',
            missing: missingReasons
        }
    }

    // 2. Excellent: 3+ images AND highlights with bullet points AND description with at least one image
    if (imagesCount >= 3 && hasBulletPoints && hasImageInDesc) {
        return {
            status: 'excellent',
            label: 'Excellent',
            colorClass: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
            dotClass: 'bg-green-500',
            missing: []
        }
    }

    // 3. To be Improved: everything else (e.g. only 1-2 images, missing bullets, short description, or no image in description)
    const missingReasons: string[] = []
    if (imagesCount < 3) missingReasons.push(`Only ${imagesCount} image(s) (needs 3+ for Excellent)`)
    if (!hasBulletPoints) missingReasons.push('Missing bullet points in highlights')
    if (isShortDesc) missingReasons.push('Short description (under 60 chars)')
    if (!hasImageInDesc) missingReasons.push('No image in description')

    return {
        status: 'to_be_improved',
        label: 'To be Improved',
        colorClass: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        missing: missingReasons
    }
}

interface DarazProductsTabProps {
    onPushToAnotherAccount: (product: any) => void
}

export default function DarazProductsTab({ onPushToAnotherAccount }: DarazProductsTabProps) {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [contentScoreFilter, setContentScoreFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [storeFilter, setStoreFilter] = useState('')
    const [stores, setStores] = useState<any[]>([])
    
    // Pagination state
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    
    // Status counts map to store total count per status tab returned dynamically
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
        all: 0,
        active: 0,
        inactive: 0,
        draft: 0,
        pending_qc: 0,
        deleted: 0
    })

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    // Detail Drawer state
    const [detailProduct, setDetailProduct] = useState<any>(null)

    // Edit Product Drawer state
    const [editProduct, setEditProduct] = useState<any>(null)

    // Manual full sync from Daraz to local database
    const handleManualSync = async () => {
        setSyncing(true)
        try {
            const res = await syncAllDarazProductsAction()
            if (res.success) {
                alert(res.message || 'Products synced successfully!')
                fetchProducts()
            }
        } catch (err: any) {
            alert('Failed to sync products: ' + err.message)
        } finally {
            setSyncing(false)
        }
    }

    // Fetch stores list
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch('/api/daraz/stores')
                const json = await res.json()
                if (json.success && json.data) {
                    setStores(json.data)
                }
            } catch (err) {
                console.error('Failed to fetch stores:', err)
            }
        }
        fetchStores()
    }, [])

    // Fetch Daraz products
    const fetchProducts = async () => {
        setLoading(true)
        try {
            const limit = 50
            const offset = (page - 1) * limit
            const params = new URLSearchParams({
                status: statusFilter,
                store_id: storeFilter,
                search: searchTerm,
                offset: offset.toString(),
                limit: limit.toString()
            })
            const res = await fetch(`/api/daraz/products/list?${params}`)
            const data = await res.json()
            if (data.success) {
                setProducts(data.products)
                setTotal(data.total || 0)
                
                // Dynamically update the count of the selected filter in our tab counts
                setStatusCounts(prev => ({
                    ...prev,
                    [statusFilter]: data.total || 0
                }))
            }
        } catch (err) {
            console.error('Failed to load Daraz products:', err)
        } finally {
            setLoading(false)
        }
    }

    // Fetch on filter or page change
    useEffect(() => {
        fetchProducts()
    }, [statusFilter, storeFilter, page])

    // Reset to page 1 when filters or search change
    const handleFilterReset = () => {
        setPage(1)
    }

    // Trigger filter reset when tab, store, or search changes
    useEffect(() => {
        handleFilterReset()
    }, [statusFilter, storeFilter])

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(products.map(p => p.item_id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (itemId: string, checked: boolean) => {
        const next = new Set(selectedIds)
        if (checked) {
            next.add(itemId)
        } else {
            next.delete(itemId)
        }
        setSelectedIds(next)
    }

    // Normalize and retrieve count
    const getTabCount = (tabValue: string) => {
        // If we have fetched a count for this tab, return it. Otherwise, use active length as estimate.
        if (statusCounts[tabValue] > 0) {
            return statusCounts[tabValue]
        }
        if (tabValue === 'all') return total || products.length
        
        // Lowercase normalization
        return products.filter(p => {
            const status = (p.status || '').toLowerCase()
            if (tabValue === 'active') return status === 'active' || status === 'live'
            if (tabValue === 'inactive') return status === 'inactive' || status === 'offline'
            if (tabValue === 'draft') return status === 'draft'
            if (tabValue === 'pending_qc') return status === 'pending'
            return status === tabValue
        }).length
    }

    const tabs = [
        { label: 'All', value: 'all', count: getTabCount('all') },
        { label: 'Active', value: 'active', count: getTabCount('active') },
        { label: 'Inactive', value: 'inactive', count: getTabCount('inactive') },
        { label: 'Draft', value: 'draft', count: getTabCount('draft') },
        { label: 'Pending QC', value: 'pending_qc', count: getTabCount('pending_qc') },
        { label: 'Deleted', value: 'deleted', count: getTabCount('deleted') }
    ]

    return (
        <div className="space-y-4">
            {/* Status Tabs Bar */}
            <div className="flex border-b dark:border-zinc-800 overflow-x-auto gap-4 scrollbar-none bg-white dark:bg-zinc-900 p-2 rounded-t-lg shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={`pb-2 px-3 text-sm font-semibold transition-all relative border-b-2 whitespace-nowrap ${
                            statusFilter === tab.value
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-zinc-100'
                        }`}
                    >
                        {tab.label}
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <Card className="p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search Field */}
                    <div className="relative min-w-[240px] flex-1 max-w-sm">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                            <Search size={16} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search by Product Name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    {/* Store Account Switcher */}
                    <select
                        value={storeFilter}
                        onChange={(e) => setStoreFilter(e.target.value)}
                        className="py-2 px-3 border rounded-md text-sm bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                        <option value="">All Seller Accounts</option>
                        {stores.map(s => (
                            <option key={s.id} value={s.id}>{s.seller_account}</option>
                        ))}
                    </select>

                    {/* Content Score Filter Dropdown */}
                    <select
                        value={contentScoreFilter}
                        onChange={(e) => setContentScoreFilter(e.target.value)}
                        className="py-2 px-3 border rounded-md text-sm bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                    >
                        <option value="all">All Content Scores</option>
                        <option value="excellent">● Excellent</option>
                        <option value="to_be_improved">● To be Improved</option>
                        <option value="incomplete">● Incomplete</option>
                    </select>

                    <button
                        onClick={fetchProducts}
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md border dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                        title="Refresh List"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {/* Manual Sync from Daraz Button */}
                    <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={syncing}
                        className="py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow disabled:opacity-50"
                    >
                        {syncing ? (
                            <>
                                <RefreshCw className="animate-spin" size={12} />
                                Syncing Daraz...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={12} />
                                Sync Products from Daraz
                            </>
                        )}
                    </button>
                </div>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-lg border border-orange-200">
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                            {selectedIds.size} Selected
                        </span>
                        <button className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-all">
                            Deactivate
                        </button>
                        <button className="px-2.5 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-all">
                            Delete
                        </button>
                    </div>
                )}
            </Card>

            {/* Products Table */}
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 uppercase text-xs border-b dark:border-zinc-800">
                        <tr>
                            <th className="p-3 w-10">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={products.length > 0 && selectedIds.size === products.length}
                                />
                            </th>
                            <th className="p-3">Product Info</th>
                            <th className="p-3 w-32 text-right">Price</th>
                            <th className="p-3 w-28 text-center">Stock</th>
                            <th className="p-3 w-28 text-center">Status</th>
                            <th className="p-3 w-40 text-center">Content Score</th>
                            <th className="p-3 w-28 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <RefreshCw className="animate-spin text-orange-500" size={18} />
                                        Loading listings from Daraz...
                                    </div>
                                </td>
                            </tr>
                        ) : (() => {
                            const filteredProducts = products.filter(product => {
                                if (contentScoreFilter === 'all') return true
                                const score = calculateDarazContentScore(product)
                                return score.status === contentScoreFilter
                            })

                            if (filteredProducts.length === 0) {
                                return (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-gray-400">
                                            No products match the selected Content Score filter ({contentScoreFilter.replace(/_/g, ' ')}).
                                        </td>
                                    </tr>
                                )
                            }

                            return filteredProducts.map(product => {
                                const mainSku = product.skus?.[0] || {}
                                const matchedInvId = mainSku.inventoryProductId
                                const score = calculateDarazContentScore(product)
                                const isDraftSaved = product.daraz_push_status === 'draft_saved' || !!product.daraz_edit_draft
                                const isPushed = product.daraz_push_status === 'pushed'

                                return (
                                    <tr key={product.item_id} className="hover:bg-gray-50/55 dark:hover:bg-zinc-800/40">
                                        <td className="p-3 align-middle">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(product.item_id)}
                                                onChange={(e) => handleSelectOne(product.item_id, e.target.checked)}
                                            />
                                        </td>
                                        <td className="p-3 flex gap-3 align-top">
                                            <img
                                                src={product.images?.[0] || '/placeholder.png'}
                                                alt={product.name}
                                                className="w-14 h-14 rounded object-cover border dark:border-zinc-700 flex-shrink-0"
                                            />
                                            <div className="space-y-1 min-w-0">
                                                <button
                                                    onClick={() => setDetailProduct(product)}
                                                    className="font-semibold text-gray-800 dark:text-gray-100 hover:text-orange-500 text-left line-clamp-2"
                                                >
                                                    {product.name}
                                                </button>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>Product Id: <span className="font-mono">{product.item_id}</span></span>
                                                    <span>Sku: <span className="font-mono">{mainSku.SellerSku}</span></span>
                                                    {matchedInvId ? (
                                                        <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                                            🔗 Linked Inv: {matchedInvId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">
                                                            No Linked Inventory
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center align-middle">
                                            {mainSku.special_price ? (
                                                <div className="flex flex-col">
                                                    <span className="text-orange-600 font-bold">
                                                        Rs. {mainSku.special_price}
                                                    </span>
                                                    <span className="text-xs text-gray-400 line-through">
                                                        Rs. {mainSku.price}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-900 dark:text-white font-semibold">
                                                    Rs. {mainSku.price}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center align-middle font-semibold text-gray-800 dark:text-gray-200">
                                            {mainSku.quantity || 0}
                                        </td>
                                        <td className="p-3 text-center align-middle">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                product.status === 'active' || product.status === 'live'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                                            }`}>
                                                {product.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center align-middle">
                                            {/* Dynamic Content Score Badge with Tooltip */}
                                            <div className="relative group inline-block">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-default transition-all ${score.colorClass}`}>
                                                    <span className={`w-2 h-2 rounded-full ${score.dotClass}`}></span>
                                                    {score.label}
                                                    {score.missing.length > 0 && (
                                                        <Info size={12} className="opacity-70 group-hover:opacity-100" />
                                                    )}
                                                </span>
                                                {score.missing.length > 0 && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-52 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl text-left pointer-events-none">
                                                        <p className="font-bold text-amber-400 mb-1">To improve score:</p>
                                                        <ul className="list-disc pl-3.5 space-y-0.5 text-gray-200">
                                                            {score.missing.map((m, i) => (
                                                                <li key={i}>{m}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right align-middle">
                                            <div className="flex flex-col items-end gap-1.5">
                                                {/* Top Status Indicators */}
                                                {isPushed && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                                                        <CheckCircle2 size={11} className="text-green-600" />
                                                        Pushed
                                                    </span>
                                                )}
                                                {isDraftSaved && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                                        <FileText size={11} className="text-amber-600" />
                                                        Draft Saved
                                                    </span>
                                                )}

                                                {/* Action Buttons Row */}
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setEditProduct(product)}
                                                        className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                                                            isDraftSaved
                                                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs'
                                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 border dark:border-zinc-700'
                                                        }`}
                                                        title="Edit product details, images, description, or pricing"
                                                    >
                                                        <Edit3 size={11} />
                                                        {isDraftSaved ? 'Edit Draft' : 'Edit'}
                                                    </button>
                                                    <button
                                                        onClick={() => onPushToAnotherAccount(product)}
                                                        className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-orange-500 hover:text-white transition-all border dark:border-zinc-700"
                                                        title="Copy / Push this listing to another account"
                                                    >
                                                        Push Account
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        })()}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {total > 50 && (
                    <div className="p-3 bg-gray-50 dark:bg-zinc-800/40 border-t dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-400">
                        <div>
                            Showing {Math.min(total, (page - 1) * 50 + 1)}-{Math.min(total, page * 50)} of {total} listings
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                className="px-2.5 py-1 rounded border dark:border-zinc-700 bg-white dark:bg-zinc-850 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="px-2 font-bold">
                                Page {page} of {Math.ceil(total / 50)}
                            </span>
                            <button
                                type="button"
                                disabled={page >= Math.ceil(total / 50)}
                                onClick={() => setPage(prev => prev + 1)}
                                className="px-2.5 py-1 rounded border dark:border-zinc-700 bg-white dark:bg-zinc-850 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Slide-over Detail Drawer */}
            {detailProduct && (
                <ProductDetailDrawer
                    product={detailProduct}
                    onClose={() => setDetailProduct(null)}
                    onPushToAnotherAccount={onPushToAnotherAccount}
                />
            )}

            {/* Slide-over Edit Product Drawer */}
            {editProduct && (
                <EditProductDrawer
                    product={editProduct}
                    onClose={() => setEditProduct(null)}
                    onSuccess={() => {
                        fetchProducts()
                        setEditProduct(null)
                    }}
                />
            )}
        </div>
    )
}
