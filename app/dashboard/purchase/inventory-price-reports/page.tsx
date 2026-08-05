'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Edit2, Check, X, Loader2, Package, Box, Download, Upload, Menu } from 'lucide-react'
import { getInventoryPriceReports, updateProductEstPrice, bulkUpdateEstPrices, InventoryPriceReportItem } from '@/features/purchase/actions/price-report-actions'
import Image from 'next/image'
import { useDashboard } from '@/app/dashboard/context'

export default function InventoryPriceReportsPage() {
    const router = useRouter()
    const { setIsMobileMenuOpen } = useDashboard()

    // Data State
    const [reports, setReports] = useState<InventoryPriceReportItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [pagination, setPagination] = useState({
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
    })

    // Filter State
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    // Import State
    const [isImporting, setIsImporting] = useState(false)

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    // Load Data
    useEffect(() => {
        loadReports()
    }, [debouncedSearch, pagination.currentPage])

    async function loadReports() {
        setIsLoading(true)
        try {
            const result = await getInventoryPriceReports({
                page: pagination.currentPage,
                limit: 100, // Explicit requirement: 100 items per page
                search: debouncedSearch
            })
            setReports(result.data)
            setPagination({
                totalCount: result.totalCount,
                totalPages: result.totalPages,
                currentPage: result.currentPage
            })
        } catch (error) {
            console.error('Failed to load reports:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Handlers
    const handlePageChange = (page: number) => {
        if (page < 1 || page > pagination.totalPages) return
        setPagination(prev => ({ ...prev, currentPage: page }))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const startEditing = (item: InventoryPriceReportItem) => {
        setEditingId(item.product_id)
        setEditValue(item.est_price?.toString() || '')
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditValue('')
    }

    const saveEstPrice = async (itemId: string) => {
        setIsSaving(true)
        try {
            const price = parseFloat(editValue)
            if (isNaN(price)) {
                alert('Please enter a valid number')
                return
            }

            await updateProductEstPrice(itemId, price)

            // Optimistic update locally
            setReports(prev => prev.map(item =>
                item.product_id === itemId ? { ...item, est_price: price } : item
            ))

            setEditingId(null)
        } catch (error) {
            console.error('Failed to save price:', error)
            alert('Failed to save price. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    // Export CSV
    const handleExport = () => {
        const csvHeader = 'product_code,product_name,est_price\n'
        const csvRows = reports.map(item =>
            `${item.product_code || ''},"${item.product_name}",${item.est_price || 0}`
        ).join('\n')

        const csvContent = csvHeader + csvRows
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-prices-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
    }

    // Import CSV
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const text = await file.text()
            const lines = text.trim().split('\n')

            // Skip header
            const dataLines = lines.slice(1)

            const updates: { product_code: string, est_price: number }[] = []

            for (const line of dataLines) {
                const parts = line.split(',')
                const product_code = parts[0]?.trim()
                const est_price = parts[parts.length - 1]?.trim() // Get last column as price

                if (product_code && est_price) {
                    const price = parseFloat(est_price)
                    if (!isNaN(price) && product_code !== '') {
                        updates.push({ product_code, est_price: price })
                    }
                }
            }

            if (updates.length === 0) {
                alert('No valid data found in CSV file')
                return
            }

            const result = await bulkUpdateEstPrices(updates)
            alert(`Successfully updated ${result.successful} products${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
            loadReports() // Reload data
        } catch (error) {
            console.error('Import failed:', error)
            alert('Failed to import CSV. Please check the file format.')
        } finally {
            setIsImporting(false)
            // Reset file input
            event.target.value = ''
        }
    }

    // Pagination Logic (Smart Pagination like Product List)
    const renderPagination = () => {
        const { currentPage, totalPages } = pagination
        const pages = []

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages)
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
            }
        }

        return (
            <div className="flex items-center justify-between px-3 md:px-4 py-3 border-t dark:border-zinc-700 bg-white dark:bg-zinc-900 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                    <span className="md:hidden">Total: {pagination.totalCount}</span>
                    <span className="hidden md:inline">Showing {((currentPage - 1) * 100) + 1} to {Math.min(currentPage * 100, pagination.totalCount)} of {pagination.totalCount} entries</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    {pages.map((p, idx) => (
                        p === '...' ? (
                            <span key={idx} className="px-1 md:px-2 text-gray-400 text-xs">...</span>
                        ) : (
                            <button
                                key={idx}
                                onClick={() => handlePageChange(p as number)}
                                className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded ${p === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    ))}
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col md:h-[calc(100vh-64px)] h-screen overflow-hidden bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between md:static fixed top-0 left-0 right-0 z-50 h-auto gap-3 md:gap-0">
                <div className="flex items-center justify-between md:justify-start w-full md:w-auto relative">
                    {/* Mobile Menu Button - Left */}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                    >
                        <Menu size={24} />
                    </button>

                    {/* Title - Center on Mobile, Left on Desktop */}
                    <div className="flex flex-col items-center md:items-start absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 w-full md:w-auto pointer-events-none md:pointer-events-auto">
                        <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">Inventory Reports</h1>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 hidden md:block">Manage product estimated prices and view purchase history</p>
                    </div>

                    {/* Spacer for Right Side balance on mobile */}
                    <div className="w-8 md:hidden"></div>
                </div>

                {/* Center Search - Desktop Only */}
                <div className="hidden md:flex flex-1 justify-center px-4">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-9 pr-4 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100 placeholder:text-gray-400 font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={reports.length === 0}
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>

                    {/* Import Button */}
                    <label className="hidden md:flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        <Upload size={16} />
                        {isImporting ? 'Importing...' : 'Import CSV'}
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleImport}
                            disabled={isImporting}
                            className="hidden"
                        />
                    </label>

                    {/* Search (Mobile Only - kept here, Desktop moved to center) */}
                    <div className="relative w-full md:hidden">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-9 pr-4 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100 placeholder:text-gray-400"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPagination(prev => ({ ...prev, currentPage: 1 }))
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-0 md:p-6 md:mt-0 mt-[6.5rem]">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 shadow-sm overflow-hidden w-full">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-1 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider w-8 md:w-16 text-center">S.N</th>
                                <th className="px-1 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider w-10 md:w-20 text-center">Img</th>
                                <th className="px-1 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                                <th className="px-1 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider w-[5.5rem] md:w-40 text-right">Est. Price</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 text-right hidden md:table-cell">Last Price</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 text-right hidden md:table-cell">Low Price</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 text-right hidden md:table-cell">Avg. Price</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 text-center hidden md:table-cell">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        Loading reports...
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                reports.map((item, index) => (
                                    <tr key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-1 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-500 text-center truncate">
                                            {((pagination.currentPage - 1) * 100) + index + 1}
                                        </td>
                                        <td className="px-1 md:px-4 py-2 md:py-3 text-center">
                                            <div className="w-8 h-8 md:w-10 md:h-10 relative bg-gray-100 dark:bg-zinc-800 rounded overflow-hidden mx-auto">
                                                {item.image_url ? (
                                                    <Image
                                                        src={item.image_url}
                                                        alt={item.product_name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center w-full h-full text-gray-300">
                                                        <div className="w-4 h-4 rounded-full border-2 border-current opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-1 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer" onClick={() => router.push(`/dashboard/inventory/product-list?search=${item.product_code || item.product_name}`)}>
                                            <div className="flex items-center gap-1">
                                                <div className="flex-1 min-w-0">
                                                    <div className="whitespace-normal break-words leading-tight">{item.product_name}</div>
                                                    <div className="text-[10px] md:text-xs text-gray-500 font-mono mt-0.5 truncate">ID: {item.product_code || '-'}</div>
                                                </div>
                                                {/* Product Type Badge */}
                                                <span className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-full border ${item.product_type === 'combo'
                                                    ? (item.product_combos?.[0]?.count === 1
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                                                        : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30')
                                                    : 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                                                    }`}>
                                                    {item.product_type === 'combo' ? (
                                                        <Package size={12} />
                                                    ) : (
                                                        <Box size={12} />
                                                    )}
                                                    {item.product_type === 'combo'
                                                        ? (item.product_combos?.[0]?.count === 1 ? 'Variation' : 'Combo')
                                                        : 'Single'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Editable Est. Price */}
                                        {/* Editable Est. Price - Enhanced for Mobile */}
                                        {/* Editable Est. Price - Enhanced for Mobile */}
                                        <td className="px-1 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-medium">
                                            {editingId === item.product_id ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                saveEstPrice(item.product_id)
                                                            }
                                                        }}
                                                        className="w-16 md:w-24 px-1 md:px-2 py-1 text-right text-xs md:text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                                                        autoFocus
                                                    />
                                                    {/* Mobile Save/Cancel Actions inside the cell when editing */}
                                                    <button onClick={() => saveEstPrice(item.product_id)} className="md:hidden p-1 text-green-600 bg-green-50 rounded"><Check size={14} /></button>
                                                    <button onClick={cancelEditing} className="md:hidden p-1 text-red-600 bg-red-50 rounded"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-0.5 md:gap-1">
                                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                                        <span className="text-blue-600 dark:text-blue-400">
                                                            Rs. {item.est_price?.toLocaleString() || '0'}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                startEditing(item);
                                                            }}
                                                            className="md:hidden p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </div>

                                                    {/* Last Price - Mobile Only */}
                                                    <div className="md:hidden text-[10px] text-gray-500">
                                                        Last: {item.last_price ? `Rs. ${item.last_price.toLocaleString()}` : '-'}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Combo Price Info Helper */}
                                            {item.product_type === 'combo' && (
                                                <div className="md:hidden text-[10px] text-orange-500 text-right mt-0.5">
                                                    (Sum of components)
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                            {item.last_price ? `Rs. ${item.last_price.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 hidden md:table-cell">
                                            {item.low_price ? `Rs. ${item.low_price.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400 hidden md:table-cell">
                                            {item.average_price ? `Rs. ${item.average_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-center hidden md:table-cell">
                                            {editingId === item.product_id ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => saveEstPrice(item.product_id)}
                                                        disabled={isSaving}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                                        title="Save"
                                                    >
                                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={isSaving}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                                        title="Cancel"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : item.product_type === 'combo' ? (
                                                <span className="text-gray-400 text-xs italic cursor-help" title="Combo price is calculated from components">
                                                    Auto-Calc
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => startEditing(item)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded transition-colors"
                                                    title="Edit Estimated Price"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* renderPagination was here, moving it outside to stick to bottom properly */}
            </div>
            {/* Footer / Pagination (Outside scroll area) */}
            {renderPagination()}
        </div>
    )
}
