'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
    Search, Trash2, Eye, Wrench, X, AlertTriangle, Check,
    Filter, Plus, Layers, Edit2, RotateCcw, Lock, ChevronDown,
    ChevronUp, Save
} from 'lucide-react'
import AsyncSelect from 'react-select/async'
import { getProducts } from '@/features/inventory/actions/product-actions'
import {
    getDamagedProductSummaries,
    saveDamagedStock,
    saveDamageResolution,
    updateDamageResolution,
    deleteDamageResolution,
    deleteDamagedProduct,
    DamagedProductSummary,
    DamageResolution
} from '@/features/inventory/actions/damaged-stock-actions'

type ResolutionType = 'Repaired' | 'Exchanged' | 'Non-Repairable'

// ── Helpers ──────────────────────────────────────────────────

function resTypeBadge(type: ResolutionType) {
    switch (type) {
        case 'Repaired':       return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
        case 'Exchanged':      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        case 'Non-Repairable': return 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
    }
}

function resTypeEmoji(type: ResolutionType) {
    switch (type) {
        case 'Repaired':       return '🔧'
        case 'Exchanged':      return '🔄'
        case 'Non-Repairable': return '🔒'
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DamagedStock() {

    // ── Data state ───────────────────────────────────────────
    const [summaries, setSummaries] = useState<DamagedProductSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterMode, setFilterMode] = useState<'Active' | 'All'>('Active')

    // ── Add Damage modal state ───────────────────────────────
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0])
    const [addProduct, setAddProduct] = useState<any>(null)
    const [addQty, setAddQty] = useState<number | ''>('')
    const [addRemarks, setAddRemarks] = useState('')
    const [addIsSaving, setAddIsSaving] = useState(false)
    const [addExistingRemaining, setAddExistingRemaining] = useState(0)

    // ── Resolve modal state ──────────────────────────────────
    const [resolveTarget, setResolveTarget] = useState<DamagedProductSummary | null>(null)
    const [resType, setResType] = useState<ResolutionType>('Repaired')
    const [resQty, setResQty] = useState<number | ''>('')
    const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0])
    const [resRemarks, setResRemarks] = useState('')
    const [resIsSaving, setResIsSaving] = useState(false)

    // ── View modal state ─────────────────────────────────────
    const [viewTarget, setViewTarget] = useState<DamagedProductSummary | null>(null)
    // Add resolution from within View modal
    const [viewAddOpen, setViewAddOpen] = useState(false)
    const [viewAddType, setViewAddType] = useState<ResolutionType>('Repaired')
    const [viewAddQty, setViewAddQty] = useState<number | ''>('')
    const [viewAddDate, setViewAddDate] = useState(new Date().toISOString().split('T')[0])
    const [viewAddRemarks, setViewAddRemarks] = useState('')
    const [viewAddSaving, setViewAddSaving] = useState(false)
    // Edit resolution inline in View modal
    const [editingResId, setEditingResId] = useState<string | null>(null)
    const [editResQty, setEditResQty] = useState<number | ''>('')
    const [editResDate, setEditResDate] = useState('')
    const [editResRemarks, setEditResRemarks] = useState('')
    const [editResSaving, setEditResSaving] = useState(false)

    // ── Data fetching ─────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const data = await getDamagedProductSummaries()
            setSummaries(data)
        } catch (e) {
            console.error('Failed to load damaged stocks:', e)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Keep modal targets in sync after data refresh
    useEffect(() => {
        if (resolveTarget) {
            const updated = summaries.find(s => s.product_id === resolveTarget.product_id)
            if (updated) setResolveTarget(updated)
        }
        if (viewTarget) {
            const updated = summaries.find(s => s.product_id === viewTarget.product_id)
            if (updated) setViewTarget(updated)
        }
    }, [summaries]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived filtered list ─────────────────────────────────
    const filteredSummaries = summaries.filter(s => {
        const q = searchQuery.toLowerCase()
        const matchesSearch = !q ||
            s.product_name.toLowerCase().includes(q) ||
            s.product_custom_id.toLowerCase().includes(q)
        const matchesFilter = filterMode === 'All' || s.remaining_qty > 0
        return matchesSearch && matchesFilter
    })

    // ── Handler: Product search (Add modal) ───────────────────
    const loadProductOptions = async (input: string) => {
        const { products } = await getProducts({ search: input, limit: 20, productType: 'all' })
        return products.map(p => ({
            value: p.id,
            label: p.product_name,
            product_type: p.product_type,
            custom_id: String(p.product_id)
        }))
    }

    const handleProductChange = (option: any) => {
        if (option && (option.product_type === 'combo' || option.product_type === 'variation')) {
            alert('Combo/variation products cannot be added to damage records.')
            return
        }
        setAddProduct(option)
        if (option) {
            const existing = summaries.find(s => s.product_id === option.value)
            setAddExistingRemaining(existing?.remaining_qty || 0)
        } else {
            setAddExistingRemaining(0)
        }
    }

    // ── Handler: Add Damage ───────────────────────────────────
    const handleAddDamage = async () => {
        if (!addProduct) { alert('Please select a product'); return }
        if (!addQty || (addQty as number) <= 0) { alert('Please enter a valid quantity'); return }
        setAddIsSaving(true)
        try {
            await saveDamagedStock({
                date: addDate,
                location: 'Main Warehouse',
                product_id: addProduct.value,
                quantity: Number(addQty),
                remarks: addRemarks
            })
            setIsAddOpen(false)
            setAddProduct(null); setAddQty(''); setAddRemarks(''); setAddExistingRemaining(0)
            await fetchData()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        } finally {
            setAddIsSaving(false)
        }
    }

    // ── Handler: Open Resolve modal ───────────────────────────
    const openResolve = (s: DamagedProductSummary) => {
        setResolveTarget(s)
        setResType('Repaired')
        setResQty('')
        setResDate(new Date().toISOString().split('T')[0])
        setResRemarks('')
    }

    // ── Handler: Save Resolution ──────────────────────────────
    const handleSaveResolution = async () => {
        if (!resolveTarget) return
        const qty = Number(resQty)
        if (!resQty || qty <= 0) { alert('Enter a valid quantity'); return }
        if (qty > resolveTarget.remaining_qty) {
            alert(`Cannot resolve more than remaining damage (${resolveTarget.remaining_qty} pc)`)
            return
        }
        setResIsSaving(true)
        try {
            await saveDamageResolution({
                product_id: resolveTarget.product_id,
                date: resDate,
                resolved_qty: qty,
                resolution_type: resType,
                remarks: resRemarks
            })
            setResolveTarget(null)
            await fetchData()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        } finally {
            setResIsSaving(false)
        }
    }

    // ── Handler: Delete Product ───────────────────────────────
    const handleDeleteProduct = async (s: DamagedProductSummary) => {
        if (s.remaining_qty > 0) {
            alert(`Cannot delete: ${s.remaining_qty} unit(s) still unresolved.\nResolve all damage first, then delete.`)
            return
        }
        if (!confirm(`Delete ALL damage records for "${s.product_name}"?\nThis cannot be undone.`)) return
        try {
            await deleteDamagedProduct(s.product_id)
            await fetchData()
        } catch (e: any) {
            alert(e.message)
        }
    }

    // ── Handler: Edit Resolution inline ──────────────────────
    const startEditRes = (res: DamageResolution) => {
        setEditingResId(res.id)
        setEditResQty(res.resolved_qty)
        setEditResDate(res.date)
        setEditResRemarks(res.remarks || '')
    }

    const cancelEditRes = () => {
        setEditingResId(null); setEditResQty(''); setEditResDate(''); setEditResRemarks('')
    }

    const handleSaveEditRes = async (res: DamageResolution) => {
        if (!viewTarget) return
        const qty = Number(editResQty)
        if (!editResQty || qty <= 0) { alert('Quantity must be greater than 0'); return }
        // Max allowed = this resolution's current qty + whatever is still remaining
        const maxAllowed = res.resolved_qty + viewTarget.remaining_qty
        if (qty > maxAllowed) {
            alert(`Max allowed qty is ${maxAllowed} pc (current ${res.resolved_qty} + remaining ${viewTarget.remaining_qty})`)
            return
        }
        setEditResSaving(true)
        try {
            await updateDamageResolution(res.id, {
                resolved_qty: qty,
                date: editResDate,
                remarks: editResRemarks
            })
            cancelEditRes()
            await fetchData()
        } catch (e: any) {
            alert(e.message)
        } finally {
            setEditResSaving(false)
        }
    }

    const handleDeleteRes = async (resId: string) => {
        if (!confirm('Delete this resolution entry?')) return
        try {
            await deleteDamageResolution(resId)
            await fetchData()
        } catch (e: any) {
            alert(e.message)
        }
    }

    // ── Handler: Add Resolution from View modal ───────────────
    const handleViewAddResolution = async () => {
        if (!viewTarget) return
        const qty = Number(viewAddQty)
        if (!viewAddQty || qty <= 0) { alert('Enter a valid quantity'); return }
        if (qty > viewTarget.remaining_qty) {
            alert(`Cannot exceed remaining damage (${viewTarget.remaining_qty} pc)`)
            return
        }
        setViewAddSaving(true)
        try {
            await saveDamageResolution({
                product_id: viewTarget.product_id,
                date: viewAddDate,
                resolved_qty: qty,
                resolution_type: viewAddType,
                remarks: viewAddRemarks
            })
            setViewAddOpen(false)
            setViewAddQty(''); setViewAddRemarks('')
            await fetchData()
        } catch (e: any) {
            alert(e.message)
        } finally {
            setViewAddSaving(false)
        }
    }

    const closeViewModal = () => {
        setViewTarget(null)
        setViewAddOpen(false)
        cancelEditRes()
    }

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ═══════════════════════════════════════
                HEADER BAR
            ═══════════════════════════════════════ */}
            <div className="flex flex-row gap-2 md:gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-lg border dark:border-zinc-800 shadow-sm">
                {/* Search */}
                <div className="relative flex-1 md:flex-none md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search product..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-zinc-800 dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Filter Toggle */}
                    <button
                        onClick={() => setFilterMode(m => m === 'Active' ? 'All' : 'Active')}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border whitespace-nowrap ${
                            filterMode === 'Active'
                                ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                        }`}
                    >
                        <Filter size={16} />
                        <span className="hidden xs:inline">{filterMode === 'Active' ? 'Active Only' : 'Show All'}</span>
                        <span className="xs:hidden">Filter</span>
                    </button>

                    {/* Add Damage (desktop) */}
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Plus size={16} /> Add Damage
                    </button>
                </div>
            </div>

            {/* Mobile header portal */}
            <MobileHeaderAction onClick={() => setIsAddOpen(true)} />

            {/* ═══════════════════════════════════════
                MAIN TABLE
            ═══════════════════════════════════════ */}
            <div className="overflow-x-auto border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800/80 dark:text-white border-b dark:border-white/10">
                        <tr>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="hidden md:table-cell px-4 py-3">Product ID</th>
                            <th className="px-4 py-3 text-center">Total Damaged</th>
                            <th className="hidden md:table-cell px-4 py-3 text-center">Resolved</th>
                            <th className="px-4 py-3 text-center">Remaining</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <div className="w-6 h-6 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                                        <span className="text-sm">Loading damage records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredSummaries.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                    {filterMode === 'Active'
                                        ? <span className="flex flex-col items-center gap-2"><span className="text-2xl">✅</span><span>No active damage. Everything is resolved!</span></span>
                                        : 'No damage records found.'
                                    }
                                </td>
                            </tr>
                        ) : (
                            filteredSummaries.map(s => (
                                <tr
                                    key={s.product_id}
                                    className={`bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                                        s.remaining_qty === 0 ? 'opacity-55' : ''
                                    }`}
                                >
                                    {/* Product Name */}
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-white leading-tight">
                                            {s.product_name}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5 md:hidden">
                                            ID: {s.product_custom_id} · {s.latest_damage_date}
                                        </div>
                                        {/* Mobile action buttons */}
                                        <div className="flex items-center gap-2 mt-2 md:hidden">
                                            <button
                                                onClick={() => setViewTarget(s)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                                                title="View Details"
                                            >
                                                <Eye size={15} />
                                            </button>
                                            {s.remaining_qty > 0 && (
                                                <button
                                                    onClick={() => openResolve(s)}
                                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md"
                                                    title="Resolve"
                                                >
                                                    <Wrench size={15} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteProduct(s)}
                                                className={`p-1.5 rounded-md ${
                                                    s.remaining_qty > 0
                                                        ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                                                        : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                }`}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Product ID */}
                                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-gray-500">
                                        {s.product_custom_id}
                                    </td>

                                    {/* Total Damaged */}
                                    <td className="px-4 py-3 text-center">
                                        <span className="font-bold font-mono text-red-600 dark:text-red-400">
                                            -{s.total_damaged} pc
                                        </span>
                                    </td>

                                    {/* Resolved Breakdown */}
                                    <td className="hidden md:table-cell px-4 py-3 text-center">
                                        {s.total_resolved === 0 ? (
                                            <span className="text-gray-300 dark:text-zinc-600 text-xs">—</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1 justify-center">
                                                {s.repaired_qty > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                                        🔧 {s.repaired_qty}
                                                    </span>
                                                )}
                                                {s.exchanged_qty > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        🔄 {s.exchanged_qty}
                                                    </span>
                                                )}
                                                {s.non_repairable_qty > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400">
                                                        🔒 {s.non_repairable_qty}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>

                                    {/* Remaining */}
                                    <td className="px-4 py-3 text-center">
                                        {s.remaining_qty === 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                <Check size={11} /> Resolved
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                <AlertTriangle size={11} /> {s.remaining_qty} pc
                                            </span>
                                        )}
                                    </td>

                                    {/* Desktop Actions */}
                                    <td className="hidden md:table-cell px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => setViewTarget(s)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                title="View Details & History"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {s.remaining_qty > 0 && (
                                                <button
                                                    onClick={() => openResolve(s)}
                                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
                                                    title="Resolve Damage (Repair / Exchange / Write-off)"
                                                >
                                                    <Wrench size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteProduct(s)}
                                                className={`p-1.5 rounded-md transition-colors ${
                                                    s.remaining_qty > 0
                                                        ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                                                        : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                }`}
                                                title={s.remaining_qty > 0 ? 'Resolve all damage before deleting' : 'Delete all records'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ═══════════════════════════════════════
                ADD DAMAGE MODAL
            ═══════════════════════════════════════ */}
            {isAddOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setIsAddOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800 bg-red-50 dark:bg-red-900/20">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-red-500" /> Add Damage Record
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Record new damaged goods — reduces stock
                                </p>
                            </div>
                            <button onClick={() => setIsAddOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <input
                                    type="date" value={addDate}
                                    onChange={e => setAddDate(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                />
                            </div>

                            {/* Product */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
                                <AsyncSelect
                                    cacheOptions defaultOptions
                                    loadOptions={loadProductOptions}
                                    onChange={handleProductChange}
                                    value={addProduct}
                                    placeholder="Search product..."
                                    className="text-sm"
                                    isOptionDisabled={(o: any) => o.product_type?.toLowerCase() === 'combo'}
                                    formatOptionLabel={(o: any) => (
                                        <div className="flex items-center gap-2">
                                            {o.product_type?.toLowerCase() === 'combo' && <Layers size={14} className="text-red-400" />}
                                            <span>{o.label}</span>
                                        </div>
                                    )}
                                    classNames={{
                                        control: (s) => `${s.isFocused ? 'ring-2 ring-red-500 border-red-500' : 'border-gray-300 dark:border-zinc-700'} !bg-white dark:!bg-zinc-800 !text-gray-900 dark:!text-white rounded-lg`,
                                        menu: () => '!bg-white dark:!bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg',
                                        option: ({ isFocused }) => `cursor-pointer px-3 py-2 ${isFocused ? '!bg-red-50 dark:!bg-zinc-700/50' : ''} !text-gray-900 dark:!text-white`,
                                        singleValue: () => '!text-gray-900 dark:!text-white',
                                        input: () => '!text-gray-900 dark:!text-white',
                                        placeholder: () => '!text-gray-400'
                                    }}
                                />
                            </div>

                            {/* Product ID (read-only) */}
                            {addProduct && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product ID</label>
                                    <input
                                        value={addProduct.custom_id || '—'}
                                        readOnly disabled
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border dark:border-zinc-700 rounded-lg text-gray-400 cursor-not-allowed font-mono"
                                    />
                                </div>
                            )}

                            {/* ⚠ Existing Damage Warning */}
                            {addExistingRemaining > 0 && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                            Already has {addExistingRemaining} pc unresolved damage
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                            Adding{' '}
                                            <strong>{addQty || 0} pc</strong>{' '}
                                            will bring total remaining to{' '}
                                            <strong>{addExistingRemaining + Number(addQty || 0)} pc</strong>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Damage Quantity
                                </label>
                                <input
                                    type="number" min="1"
                                    value={addQty}
                                    onChange={e => setAddQty(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                    placeholder="Enter quantity"
                                />
                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={11} />
                                    This will reduce inventory stock by {addQty || 0} pc
                                </p>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Remarks <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    rows={2} value={addRemarks}
                                    onChange={e => setAddRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500 resize-none"
                                    placeholder="e.g. Found during warehouse inspection..."
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 flex justify-end gap-3 border-t dark:border-zinc-800">
                            <button
                                onClick={() => setIsAddOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddDamage} disabled={addIsSaving}
                                className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save size={15} />
                                {addIsSaving ? 'Saving...' : 'Save Damage Record'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════
                RESOLVE MODAL
            ═══════════════════════════════════════ */}
            {resolveTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setResolveTarget(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between px-6 py-4 border-b dark:border-zinc-800">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Wrench size={18} className="text-yellow-500" /> Resolve Damage
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[300px]">
                                    {resolveTarget.product_name}
                                </p>
                            </div>
                            <button onClick={() => setResolveTarget(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Remaining Info Card */}
                            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <AlertTriangle size={20} className="text-red-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                        {resolveTarget.remaining_qty} pc still unresolved
                                    </p>
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                        Total: {resolveTarget.total_damaged} pc · Resolved: {resolveTarget.total_resolved} pc
                                    </p>
                                </div>
                            </div>

                            {/* Resolution Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Resolution Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['Repaired', 'Exchanged', 'Non-Repairable'] as ResolutionType[]).map(type => {
                                        const isActive = resType === type
                                        const activeClass = type === 'Repaired'
                                            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                            : type === 'Exchanged'
                                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-400 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => setResType(type)}
                                                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border-2 text-xs font-medium transition-all ${
                                                    isActive ? activeClass : 'border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-zinc-600'
                                                }`}
                                            >
                                                <span className="text-xl">
                                                    {type === 'Repaired' ? '🔧' : type === 'Exchanged' ? '🔄' : '🔒'}
                                                </span>
                                                <span>{type === 'Non-Repairable' ? 'Write-off' : type}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Qty */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Quantity{' '}
                                    <span className="text-gray-400 font-normal">(max: {resolveTarget.remaining_qty} pc)</span>
                                </label>
                                <input
                                    type="number" min="1" max={resolveTarget.remaining_qty}
                                    value={resQty}
                                    onChange={e => setResQty(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-yellow-500"
                                    placeholder={`Max ${resolveTarget.remaining_qty} pc`}
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <input
                                    type="date" value={resDate}
                                    onChange={e => setResDate(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Remarks <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    rows={2} value={resRemarks}
                                    onChange={e => setResRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-yellow-500 resize-none"
                                    placeholder={
                                        resType === 'Repaired' ? 'e.g. Fixed by technician on 2nd floor...'
                                        : resType === 'Exchanged' ? 'e.g. Supplier replaced on invoice #123...'
                                        : 'e.g. Screen cracked beyond repair...'
                                    }
                                />
                            </div>

                            {/* Hint */}
                            <div className={`text-xs px-3 py-2.5 rounded-lg border ${
                                resType === 'Non-Repairable'
                                    ? 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500'
                                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            }`}>
                                {resType === 'Repaired' &&
                                    `✅ Returns ${resQty || 0} units back to usable inventory stock`}
                                {resType === 'Exchanged' &&
                                    `✅ Returns ${resQty || 0} units to stock (replaced by supplier)`}
                                {resType === 'Non-Repairable' &&
                                    `🔒 ${resQty || 0} units permanently written off — will remain as a damage loss in reports`}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t dark:border-zinc-800 flex justify-end gap-3">
                            <button
                                onClick={() => setResolveTarget(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveResolution} disabled={resIsSaving}
                                className="px-5 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save size={15} />
                                {resIsSaving ? 'Saving...' : 'Save Resolution'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════
                VIEW MODAL
            ═══════════════════════════════════════ */}
            {viewTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
                    onClick={closeViewModal}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between px-6 py-4 border-b dark:border-zinc-800 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Eye size={18} className="text-blue-500" /> Damage Details
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {viewTarget.product_name}
                                    <span className="ml-2 font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                        ID: {viewTarget.product_custom_id}
                                    </span>
                                </p>
                            </div>
                            <button onClick={closeViewModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body — scrollable */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-6">

                            {/* ── Summary Card ── */}
                            <div className={`p-4 rounded-xl border-2 ${
                                viewTarget.remaining_qty === 0
                                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                                    : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                            }`}>
                                <div className="flex flex-wrap gap-6 mb-3 items-start">
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Damaged</div>
                                        <div className="text-xl font-bold text-red-600 dark:text-red-400 font-mono">
                                            {viewTarget.total_damaged} pc
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Resolved</div>
                                        <div className="text-xl font-bold text-green-600 dark:text-green-400 font-mono">
                                            {viewTarget.total_resolved} pc
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Remaining</div>
                                        <div className={`text-xl font-bold font-mono ${
                                            viewTarget.remaining_qty > 0
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-green-600 dark:text-green-400'
                                        }`}>
                                            {viewTarget.remaining_qty} pc
                                        </div>
                                    </div>
                                    <div className="ml-auto">
                                        {viewTarget.remaining_qty === 0 ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                <Check size={12} /> Fully Resolved
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                <AlertTriangle size={12} /> Active Damage
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>Resolution Progress</span>
                                        <span className="font-semibold">
                                            {viewTarget.total_damaged > 0
                                                ? Math.round((viewTarget.total_resolved / viewTarget.total_damaged) * 100)
                                                : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-yellow-400 via-green-400 to-green-500"
                                            style={{
                                                width: `${viewTarget.total_damaged > 0
                                                    ? Math.min(100, (viewTarget.total_resolved / viewTarget.total_damaged) * 100)
                                                    : 0}%`
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs pt-0.5">
                                        {viewTarget.repaired_qty > 0 &&
                                            <span className="text-yellow-600 dark:text-yellow-400">🔧 {viewTarget.repaired_qty} Repaired</span>}
                                        {viewTarget.exchanged_qty > 0 &&
                                            <span className="text-blue-600 dark:text-blue-400">🔄 {viewTarget.exchanged_qty} Exchanged</span>}
                                        {viewTarget.non_repairable_qty > 0 &&
                                            <span className="text-gray-500 dark:text-gray-400">🔒 {viewTarget.non_repairable_qty} Written Off</span>}
                                        {viewTarget.remaining_qty > 0 &&
                                            <span className="text-red-500">⚠ {viewTarget.remaining_qty} Unresolved</span>}
                                    </div>
                                </div>
                            </div>

                            {/* ── Damage Events ── */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-red-500" />
                                    Damage Events
                                    <span className="text-xs font-normal text-gray-400">({viewTarget.events.length} entries)</span>
                                </h4>
                                <div className="border dark:border-zinc-700 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Date</th>
                                                <th className="px-3 py-2 text-center">Qty</th>
                                                <th className="px-3 py-2 text-left hidden sm:table-cell">Location</th>
                                                <th className="px-3 py-2 text-left hidden sm:table-cell">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-zinc-700">
                                            {viewTarget.events.map(ev => (
                                                <tr key={ev.id} className="dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ev.date}</td>
                                                    <td className="px-3 py-2 text-center font-bold font-mono text-red-600 dark:text-red-400">
                                                        -{Math.abs(ev.quantity)} pc
                                                    </td>
                                                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-xs">{ev.location}</td>
                                                    <td className="px-3 py-2 hidden sm:table-cell text-gray-400 text-xs">{ev.remarks || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* ── Resolution History ── */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Check size={14} className="text-green-500" />
                                        Resolution History
                                        <span className="text-xs font-normal text-gray-400">
                                            ({viewTarget.resolutions.length} entries)
                                        </span>
                                    </h4>
                                    {viewTarget.remaining_qty > 0 && (
                                        <button
                                            onClick={() => setViewAddOpen(o => !o)}
                                            className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 px-2.5 py-1.5 rounded-lg border border-yellow-200 dark:border-yellow-800 transition-colors"
                                        >
                                            {viewAddOpen ? <ChevronUp size={13} /> : <Plus size={13} />}
                                            {viewAddOpen ? 'Close' : 'Add Resolution'}
                                        </button>
                                    )}
                                </div>

                                {/* Inline Add Resolution Form */}
                                {viewAddOpen && viewTarget.remaining_qty > 0 && (
                                    <div className="mb-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3 animate-in slide-in-from-top-2">
                                        <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">
                                            New Resolution Entry
                                        </p>
                                        {/* Type selector */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['Repaired', 'Exchanged', 'Non-Repairable'] as ResolutionType[]).map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setViewAddType(type)}
                                                    className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                                                        viewAddType === type
                                                            ? resTypeBadge(type) + ' border-current'
                                                            : 'border-gray-200 dark:border-zinc-600 text-gray-500 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {resTypeEmoji(type)} {type === 'Non-Repairable' ? 'Write-off' : type}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    Qty (max {viewTarget.remaining_qty} pc)
                                                </label>
                                                <input
                                                    type="number" min="1" max={viewTarget.remaining_qty}
                                                    value={viewAddQty}
                                                    onChange={e => setViewAddQty(e.target.value === '' ? '' : Number(e.target.value))}
                                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-600 rounded-lg dark:bg-zinc-800 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                                                <input
                                                    type="date" value={viewAddDate}
                                                    onChange={e => setViewAddDate(e.target.value)}
                                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-600 rounded-lg dark:bg-zinc-800 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Remarks</label>
                                            <input
                                                type="text" value={viewAddRemarks}
                                                onChange={e => setViewAddRemarks(e.target.value)}
                                                placeholder="Optional notes..."
                                                className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-600 rounded-lg dark:bg-zinc-800 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => { setViewAddOpen(false); setViewAddQty(''); setViewAddRemarks('') }}
                                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleViewAddResolution} disabled={viewAddSaving}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <Save size={13} /> {viewAddSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Resolutions Table */}
                                {viewTarget.resolutions.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-gray-400 border dark:border-zinc-700 rounded-lg">
                                        No resolutions recorded yet
                                    </div>
                                ) : (
                                    <div className="border dark:border-zinc-700 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs text-gray-500 uppercase">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Date</th>
                                                    <th className="px-3 py-2 text-left">Type</th>
                                                    <th className="px-3 py-2 text-center">Qty</th>
                                                    <th className="px-3 py-2 text-left hidden sm:table-cell">Remarks</th>
                                                    <th className="px-3 py-2 text-right">Edit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-zinc-700">
                                                {viewTarget.resolutions.map(res => (
                                                    editingResId === res.id ? (
                                                        // ── Inline Edit Row ──
                                                        <tr key={res.id} className="bg-blue-50 dark:bg-blue-900/20">
                                                            <td className="px-2 py-2">
                                                                <input
                                                                    type="date" value={editResDate}
                                                                    onChange={e => setEditResDate(e.target.value)}
                                                                    className="w-full px-2 py-1 text-xs border rounded dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${resTypeBadge(res.resolution_type as ResolutionType)}`}>
                                                                    {resTypeEmoji(res.resolution_type as ResolutionType)} {res.resolution_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input
                                                                    type="number" min="1"
                                                                    max={res.resolved_qty + viewTarget.remaining_qty}
                                                                    value={editResQty}
                                                                    onChange={e => setEditResQty(e.target.value === '' ? '' : Number(e.target.value))}
                                                                    className="w-16 px-2 py-1 text-xs border rounded text-center dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
                                                                />
                                                                <div className="text-xs text-gray-400 mt-0.5 text-center">
                                                                    max {res.resolved_qty + viewTarget.remaining_qty}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 hidden sm:table-cell">
                                                                <input
                                                                    type="text" value={editResRemarks}
                                                                    onChange={e => setEditResRemarks(e.target.value)}
                                                                    className="w-full px-2 py-1 text-xs border rounded dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
                                                                    placeholder="Remarks..."
                                                                />
                                                            </td>
                                                            <td className="px-2 py-2 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button
                                                                        onClick={() => handleSaveEditRes(res)}
                                                                        disabled={editResSaving}
                                                                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded disabled:opacity-50"
                                                                        title="Save"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditRes}
                                                                        className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        // ── Normal Row ──
                                                        <tr key={res.id} className="dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                                {res.date}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${resTypeBadge(res.resolution_type as ResolutionType)}`}>
                                                                    {resTypeEmoji(res.resolution_type as ResolutionType)} {res.resolution_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center font-mono font-bold">
                                                                <span className={res.resolution_type === 'Non-Repairable' ? 'text-gray-500' : 'text-green-600 dark:text-green-400'}>
                                                                    {res.resolution_type !== 'Non-Repairable' ? '+' : ''}{res.resolved_qty} pc
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 hidden sm:table-cell text-gray-400 text-xs">
                                                                {res.remarks || '—'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button
                                                                        onClick={() => startEditRes(res)}
                                                                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                                        title="Edit Resolution"
                                                                    >
                                                                        <Edit2 size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRes(res.id)}
                                                                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                                        title="Delete Resolution"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 shrink-0 flex items-center justify-between">
                            {viewTarget.remaining_qty > 0 ? (
                                <button
                                    onClick={() => { closeViewModal(); openResolve(viewTarget) }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors shadow-sm"
                                >
                                    <Wrench size={15} /> Resolve Damage
                                </button>
                            ) : (
                                <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                    <Check size={15} /> All damage resolved
                                </span>
                            )}
                            <button
                                onClick={closeViewModal}
                                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MOBILE HEADER PORTAL
// ─────────────────────────────────────────────────────────────
function MobileHeaderAction({ onClick }: { onClick: () => void }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    if (!mounted) return null

    const container = document.getElementById('navbar-actions')
    if (!container) return null

    return createPortal(
        <button
            onClick={onClick}
            className="md:hidden p-1.5 bg-red-600 text-white rounded-md shadow-sm active:scale-95 transition-transform"
        >
            <Plus size={20} />
        </button>,
        container
    )
}
