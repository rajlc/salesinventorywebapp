'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
    ArrowLeft,
    Upload,
    Plus,
    Search,
    RefreshCw,
    Percent,
    Trash2,
    Edit2,
    FileSpreadsheet,
    DollarSign,
    CheckCircle2,
    X,
    Filter,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
    getDarazCategoryCommissions,
    getUniqueCategory1List,
    bulkUploadDarazCommissions,
    saveDarazCategoryCommission,
    deleteDarazCategoryCommission,
    clearAllDarazCategoryCommissions,
    getDarazOtherFees,
    saveDarazOtherFees
} from '@/features/sales/actions/daraz-commission-actions'
import {
    calculateDarazFeeBreakdown,
    DEFAULT_OTHER_FEES,
    DARAZ_HANDLING_FEE_BRACKETS
} from '@/features/sales/utils/daraz-fee-calculator'
import type {
    OtherFeeItem,
    DarazCommissionItem
} from '@/features/sales/utils/daraz-fee-calculator'


export default function DarazCommissionPage() {
    // Data State
    const [items, setItems] = useState<DarazCommissionItem[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(50)
    const [search, setSearch] = useState('')
    const [category1Filter, setCategory1Filter] = useState('')
    const [category1List, setCategory1List] = useState<string[]>([])

    // Other Fees Modal State
    const [isOtherFeesOpen, setIsOtherFeesOpen] = useState(false)
    const [otherFees, setOtherFees] = useState<OtherFeeItem[]>([])
    const [isSavingOtherFees, setIsSavingOtherFees] = useState(false)
    const [simSalesPrice, setSimSalesPrice] = useState<number>(845)
    const [simCommissionRate, setSimCommissionRate] = useState<number>(15.76)

    // Add / Edit Category Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<{
        id?: string
        category_1: string
        category_2: string
        category_3: string
        category_4: string
        category_5: string
        category_6: string
        commission_rate: number | string
    }>({
        category_1: '',
        category_2: '',
        category_3: '',
        category_4: '',
        category_5: '',
        category_6: '',
        commission_rate: ''
    })
    const [isSavingCategory, setIsSavingCategory] = useState(false)

    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null)
    const [uploadResult, setUploadResult] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load Categories
    const loadCategories = async () => {
        setIsLoading(true)
        try {
            const res = await getDarazCategoryCommissions({
                page,
                limit,
                search,
                category1: category1Filter
            })
            setItems(res.items)
            setTotal(res.total)
        } catch (err: any) {
            console.error('Failed to load category commissions:', err)
        } finally {
            setIsLoading(false)
        }
    }

    // Load filter dropdown list & Other fees
    useEffect(() => {
        getUniqueCategory1List().then(list => setCategory1List(list || []))
        getDarazOtherFees().then(fees => setOtherFees(fees || []))
    }, [])

    useEffect(() => {
        loadCategories()
    }, [page, limit, category1Filter])

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1)
            loadCategories()
        }, 350)
        return () => clearTimeout(t)
    }, [search])

    // Handle Manual Add / Edit Save
    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingItem.category_1.trim()) {
            alert('Category 1 is required.')
            return
        }
        const rateNum = parseFloat(String(editingItem.commission_rate))
        if (isNaN(rateNum) || rateNum < 0) {
            alert('Please enter a valid Commission Rate (%).')
            return
        }

        setIsSavingCategory(true)
        try {
            await saveDarazCategoryCommission({
                id: editingItem.id,
                category_1: editingItem.category_1,
                category_2: editingItem.category_2 || null,
                category_3: editingItem.category_3 || null,
                category_4: editingItem.category_4 || null,
                category_5: editingItem.category_5 || null,
                category_6: editingItem.category_6 || null,
                commission_rate: rateNum
            })
            setIsEditModalOpen(false)
            loadCategories()
            getUniqueCategory1List().then(list => setCategory1List(list || []))
        } catch (err: any) {
            alert(`Failed to save category: ${err.message}`)
        } finally {
            setIsSavingCategory(false)
        }
    }

    // Handle Delete
    const handleDelete = async (item: DarazCommissionItem) => {
        if (!item.id) return
        if (!confirm(`Are you sure you want to delete "${item.leaf_category}"?`)) return
        try {
            await deleteDarazCategoryCommission(item.id)
            loadCategories()
        } catch (err: any) {
            alert(`Delete failed: ${err.message}`)
        }
    }

    // Handle Clear All
    const handleClearAll = async () => {
        if (!confirm('⚠️ Are you sure you want to delete ALL category commissions in the database?\n\nThis will clear all rows so you can re-upload fresh.')) return
        try {
            await clearAllDarazCategoryCommissions()
            loadCategories()
            getUniqueCategory1List().then(list => setCategory1List(list || []))
            alert('All category commissions cleared successfully.')
        } catch (err: any) {
            alert(`Failed to clear: ${err.message}`)
        }
    }

    // Handle File Processing & Upload in Batches
    const handleStartUpload = async () => {
        if (!uploadFile) return
        setIsUploading(true)
        setUploadResult(null)

        try {
            const data = await uploadFile.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet)

            if (!rows || rows.length === 0) {
                throw new Error('The uploaded file contains no rows.')
            }

            const BATCH_SIZE = 500
            const totalRows = rows.length
            let uploadedCount = 0

            for (let i = 0; i < totalRows; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE)
                const res = await bulkUploadDarazCommissions(batch)
                uploadedCount += res.upserted

                setUploadProgress({
                    current: Math.min(i + BATCH_SIZE, totalRows),
                    total: totalRows,
                    percent: Math.round((Math.min(i + BATCH_SIZE, totalRows) / totalRows) * 100)
                })
            }

            setUploadResult(`🎉 Successfully uploaded and processed ${uploadedCount.toLocaleString()} category commission rates!`)
            setUploadFile(null)
            loadCategories()
            getUniqueCategory1List().then(list => setCategory1List(list || []))
        } catch (err: any) {
            alert(`Upload failed: ${err.message}`)
        } finally {
            setIsUploading(false)
        }
    }

    // Download Sample Template
    const handleDownloadTemplate = () => {
        const sampleData = [
            {
                'Category 1': 'Cameras',
                'Category 2': 'Drones',
                'Category 3': 'Drone Accessories',
                'Category 4': '',
                'Category 5': '',
                'Category 6': '',
                'Commission Rate (%)': 8.5
            },
            {
                'Category 1': 'Health & Beauty',
                'Category 2': 'Skin Care',
                'Category 3': 'Face Mask',
                'Category 4': '',
                'Category 5': '',
                'Category 6': '',
                'Commission Rate (%)': 11.0
            },
            {
                'Category 1': 'Home Appliances',
                'Category 2': 'Small Kitchen Appliances',
                'Category 3': 'Kettles',
                'Category 4': 'Electric Kettles',
                'Category 5': '',
                'Category 6': '',
                'Commission Rate (%)': 10.0
            }
        ]

        const ws = XLSX.utils.json_to_sheet(sampleData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Daraz_Commissions')
        XLSX.writeFile(wb, 'daraz_commission_sample_template.xlsx')
    }

    // Save Other Fees
    const handleSaveOtherFees = async () => {
        setIsSavingOtherFees(true)
        try {
            await saveDarazOtherFees(otherFees)
            setIsOtherFeesOpen(false)
            alert('Other Fees configuration saved successfully!')
        } catch (err: any) {
            alert(`Failed to save other fees: ${err.message}`)
        } finally {
            setIsSavingOtherFees(false)
        }
    }

    // Reset to Daraz Nepal standard preset fees
    const handleLoadNepalDefaults = () => {
        if (!confirm('Load standard Daraz Nepal fee presets? This will configure Payment Fee (2.5%), Free Shipping Max (4%), Handling Fee (Tiered Brackets + 13% VAT), Voucher (3%), and WHT (1%).')) return
        setOtherFees(DEFAULT_OTHER_FEES)
    }

    const totalPages = Math.ceil(total / limit) || 1
    const activeOtherFeesCount = otherFees.filter(f => f.is_active).length

    // Active other fees that are percentage-based (with VAT applied if enabled)
    const activeOtherFeesPct = otherFees
        .filter(f => f.is_active && f.type === 'percentage')
        .reduce((sum, f) => sum + (f.apply_vat ? f.rate * 1.13 : f.rate), 0)

    // Active other fees that are fixed amount in Rs. (with VAT applied if enabled)
    const activeOtherFixedFees = otherFees
        .filter(f => f.is_active && f.type === 'fixed')
        .reduce((sum, f) => sum + (f.apply_vat ? f.rate * 1.13 : f.rate), 0)

    // Check if tiered handling fee is active
    const hasActiveTieredHandling = otherFees.some(f => f.is_active && (f.type === 'bracket' || f.id === 'handling_fee'))

    return (
        <div className="space-y-6 pb-12">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Link href="/dashboard/settings" className="hover:text-primary transition-colors flex items-center gap-1">
                            <ArrowLeft size={13} />
                            Settings
                        </Link>
                        <span>/</span>
                        <span className="font-semibold text-foreground">Daraz Commission</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Daraz Commission</h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                            {total.toLocaleString()} Categories
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage category commission rates provided by Daraz and configure platform deduction fees.
                    </p>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Other Fee Button */}
                    <button
                        onClick={() => setIsOtherFeesOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all shadow-sm active:scale-[0.98]"
                        title="Configure additional platform deduction fees (Payment Fee, VAT, etc.)"
                    >
                        <DollarSign size={15} className="text-amber-600 dark:text-amber-400" />
                        <span>Other Fee</span>
                        <span className="px-1.5 py-0.2 text-[11px] font-bold bg-amber-200 dark:bg-amber-800/60 rounded-full text-amber-900 dark:text-amber-200">
                            {activeOtherFeesCount} active
                        </span>
                    </button>

                    {/* Upload Sheet Button */}
                    <button
                        onClick={() => {
                            setUploadResult(null)
                            setUploadProgress(null)
                            setIsUploadModalOpen(true)
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Upload size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Upload Sheet</span>
                    </button>

                    {/* Add Category Button */}
                    <button
                        onClick={() => {
                            setEditingItem({
                                category_1: '',
                                category_2: '',
                                category_3: '',
                                category_4: '',
                                category_5: '',
                                category_6: '',
                                commission_rate: ''
                            })
                            setIsEditModalOpen(true)
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md active:scale-[0.98]"
                    >
                        <Plus size={15} />
                        <span>Add Category</span>
                    </button>

                    {total > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                            title="Clear all categories"
                        >
                            <Trash2 size={14} />
                            <span className="hidden sm:inline">Clear All</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by any category name (e.g. Drones, Kettles, Toys)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-9 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-zinc-800 transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter by Category 1 */}
                    <div className="w-full sm:w-64">
                        <select
                            value={category1Filter}
                            onChange={(e) => {
                                setCategory1Filter(e.target.value)
                                setPage(1)
                            }}
                            className="w-full py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All Top Categories (Category 1)</option>
                            {category1List.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Reset Button */}
                    {(search || category1Filter) && (
                        <button
                            onClick={() => {
                                setSearch('')
                                setCategory1Filter('')
                                setPage(1)
                            }}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-2"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Categories Table */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                <th className="py-3 px-3 w-12 text-center">#</th>
                                <th className="py-3 px-3 min-w-[130px]">Category 1</th>
                                <th className="py-3 px-3 min-w-[120px]">Category 2</th>
                                <th className="py-3 px-3 min-w-[120px]">Category 3</th>
                                <th className="py-3 px-3 min-w-[120px]">Category 4</th>
                                <th className="py-3 px-3 min-w-[110px]">Category 5</th>
                                <th className="py-3 px-3 min-w-[110px]">Category 6</th>
                                <th className="py-3 px-3 min-w-[150px]">Leaf Category (Match Target)</th>
                                <th className="py-3 px-3 w-28 text-center">Raw Comm.</th>
                                <th className="py-3 px-3 w-36 text-center bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-x border-amber-200/60 dark:border-amber-800/50">
                                    Total Commission (%)
                                </th>
                                <th className="py-3 px-3 w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-gray-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                                        Loading Daraz category commissions...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-gray-500">
                                        <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                                        <p className="font-semibold text-base text-gray-700 dark:text-gray-300">No categories found</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                            {search || category1Filter
                                                ? 'No categories match your search filters.'
                                                : 'Upload your Daraz commission Google Sheet / Excel file to populate rates for all 5,300+ categories.'}
                                        </p>
                                        {!search && !category1Filter && (
                                            <button
                                                onClick={() => setIsUploadModalOpen(true)}
                                                className="mt-3 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg shadow hover:bg-primary/90 transition-all inline-flex items-center gap-1.5"
                                            >
                                                <Upload size={14} />
                                                Upload Google Sheet Now
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, idx) => {
                                    const commWithVat = item.commission_rate * 1.13
                                    const totalComm = commWithVat + activeOtherFeesPct

                                    return (
                                        <tr
                                            key={item.id || idx}
                                            className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition-colors group"
                                        >
                                            <td className="py-2.5 px-3 text-center text-gray-400 font-mono">
                                                {(page - 1) * limit + idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100">
                                                {item.category_1}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                {item.category_2 || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                {item.category_3 || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                {item.category_4 || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                {item.category_5 || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                {item.category_6 || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span
                                                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 max-w-[190px] truncate"
                                                    title={item.category_path}
                                                >
                                                    {item.leaf_category}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                        {item.commission_rate.toFixed(2)}%
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5" title="Category Commission + 13% VAT">
                                                        +VAT: {commWithVat.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center bg-amber-50/20 dark:bg-amber-950/10 border-x border-amber-100 dark:border-amber-900/30">
                                                <div
                                                    className="flex flex-col items-center cursor-help"
                                                    title={`Commission (+13% VAT): ${commWithVat.toFixed(2)}% + Other Active % Fees: ${activeOtherFeesPct.toFixed(2)}%${activeOtherFixedFees > 0 ? ` + Rs. ${activeOtherFixedFees.toFixed(2)} fixed` : ''}${hasActiveTieredHandling ? ' + Tiered Handling Fee (Rs. 5.65–33.90)' : ''}`}
                                                >
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700 shadow-sm">
                                                        {totalComm.toFixed(2)}%
                                                        {hasActiveTieredHandling && (
                                                            <span className="ml-1 text-[10px] text-amber-800 dark:text-amber-200">
                                                                + Tiered
                                                            </span>
                                                        )}
                                                        {activeOtherFixedFees > 0 && (
                                                            <span className="ml-1 text-[10px] text-amber-800 dark:text-amber-200">
                                                                + Rs.{activeOtherFixedFees.toFixed(0)}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[9.5px] text-amber-850 dark:text-amber-300 font-mono mt-0.5">
                                                        ({commWithVat.toFixed(1)}% + {activeOtherFeesPct.toFixed(1)}%{hasActiveTieredHandling ? ' + Handl.' : ''})
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({
                                                            id: item.id,
                                                            category_1: item.category_1 || '',
                                                            category_2: item.category_2 || '',
                                                            category_3: item.category_3 || '',
                                                            category_4: item.category_4 || '',
                                                            category_5: item.category_5 || '',
                                                            category_6: item.category_6 || '',
                                                            commission_rate: item.commission_rate
                                                        })
                                                        setIsEditModalOpen(true)
                                                    }}
                                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                                    title="Edit Category & Rate"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                    title="Delete Category"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-850">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Rows per page:</span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value))
                                setPage(1)
                            }}
                            className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded px-2 py-1 text-xs"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                        <span>
                            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="p-1.5 rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-semibold px-2">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* Modal: Other Fee Manager & VAT Rules                          */}
            {/* ───────────────────────────────────────────────────────────── */}
            {isOtherFeesOpen && (() => {
                const simResult = calculateDarazFeeBreakdown({
                    salesPrice: Number(simSalesPrice) || 0,
                    categoryCommissionRate: Number(simCommissionRate) || 0,
                    otherFees
                })

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 bg-amber-50/40 dark:bg-amber-950/20 shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300">
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                            Other Platform Fees & 13% VAT Rules
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            Configure platform deductions and whether 13% VAT applies. Category Commission always adds 13% VAT automatically.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOtherFeesOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {/* VAT Notice Box */}
                                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                                    <HelpCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-bold">Nepal Daraz Fee Deduction Rules:</p>
                                        <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                                            • <strong>Commission Fee:</strong> Raw % from sheet + <strong>13% VAT</strong> on commission (e.g. 15.76% × 1.13 = 17.81%).<br />
                                            • <strong>Payment & Free Shipping Max:</strong> Fixed % + <strong>13% VAT</strong> (e.g. 2.0% × 1.13 = 2.26%).<br />
                                            • <strong>Handling, Voucher Max & GST (WHT):</strong> Fixed % with <strong>NO VAT</strong>.
                                        </p>
                                    </div>
                                </div>

                                {/* Fee Items List */}
                                <div className="space-y-3">
                                    {otherFees.map((fee, idx) => {
                                        const effectiveRate = fee.type === 'percentage'
                                            ? (fee.apply_vat ? fee.rate * 1.13 : fee.rate)
                                            : fee.rate

                                        return (
                                            <div
                                                key={fee.id || idx}
                                                className={`p-3.5 rounded-xl border transition-all ${
                                                    fee.is_active
                                                        ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/50'
                                                        : 'bg-gray-50 dark:bg-zinc-850/60 border-gray-200 dark:border-zinc-800 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 space-y-2.5">
                                                        {/* Fee Name */}
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={fee.name}
                                                                onChange={(e) => {
                                                                    const copy = [...otherFees]
                                                                    copy[idx].name = e.target.value
                                                                    setOtherFees(copy)
                                                                }}
                                                                className="font-bold text-sm bg-transparent border-b border-dashed border-gray-300 dark:border-zinc-600 focus:border-primary focus:outline-none w-full"
                                                                placeholder="Fee Name (e.g. Payment Processing Fee)"
                                                            />
                                                        </div>

                                                        {/* Configuration Row */}
                                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                                            {/* Type */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-gray-500 font-medium">Type:</span>
                                                                <select
                                                                    value={fee.type}
                                                                    onChange={(e) => {
                                                                        const copy = [...otherFees]
                                                                        copy[idx].type = e.target.value as 'percentage' | 'fixed' | 'bracket'
                                                                        if (e.target.value === 'bracket') {
                                                                            copy[idx].apply_vat = true
                                                                            copy[idx].rate = 0
                                                                        }
                                                                        setOtherFees(copy)
                                                                    }}
                                                                    className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-semibold"
                                                                >
                                                                    <option value="bracket">Tiered Bracket (Daraz Official)</option>
                                                                    <option value="percentage">Percentage (%)</option>
                                                                    <option value="fixed">Fixed Amount (Rs.)</option>
                                                                </select>
                                                            </div>

                                                            {/* Rate / Amount (Only if not bracket) */}
                                                            {fee.type !== 'bracket' && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-gray-500 font-medium">Rate:</span>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={fee.rate}
                                                                            onChange={(e) => {
                                                                                const copy = [...otherFees]
                                                                                copy[idx].rate = parseFloat(e.target.value) || 0
                                                                                setOtherFees(copy)
                                                                            }}
                                                                            className="w-24 px-2 py-1 font-mono font-bold rounded bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-right pr-6"
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                                                                            {fee.type === 'percentage' ? '%' : 'Rs'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* 13% VAT Checkbox */}
                                                            <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-amber-400 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(fee.apply_vat)}
                                                                    onChange={(e) => {
                                                                        const copy = [...otherFees]
                                                                        copy[idx].apply_vat = e.target.checked
                                                                        setOtherFees(copy)
                                                                    }}
                                                                    className="w-3.5 h-3.5 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                                                />
                                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                                    Include 13% VAT
                                                                </span>
                                                            </label>

                                                            {/* Effective Rate Badge */}
                                                            {fee.type === 'percentage' && (
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                        fee.apply_vat
                                                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700'
                                                                    }`}
                                                                >
                                                                    {fee.apply_vat
                                                                        ? `${fee.rate.toFixed(2)}% + 13% VAT = ${effectiveRate.toFixed(2)}% effective`
                                                                        : `${fee.rate.toFixed(2)}% effective (no VAT)`}
                                                                </span>
                                                            )}

                                                            {fee.type === 'bracket' && (
                                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                                                    Tiered Brackets {fee.apply_vat ? '(Rs. 5.65 – 33.90 with VAT)' : '(Rs. 5 – 30)'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Tiered Bracket Info Card */}
                                                        {fee.type === 'bracket' && (
                                                            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs">
                                                                <div className="flex items-center justify-between mb-1.5 font-bold text-amber-900 dark:text-amber-200">
                                                                    <span>📦 Daraz Official Price Bracket Rules (Per Item):</span>
                                                                    <span className="text-[10.5px] font-normal text-amber-700 dark:text-amber-400">Applies based on selling price</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded border border-amber-200 dark:border-amber-900/50">
                                                                        <span className="block text-[10px] text-gray-500 font-medium">0 – 400 NPR</span>
                                                                        <span className="font-bold font-mono text-[11.5px] text-amber-800 dark:text-amber-200">
                                                                            Rs. {fee.apply_vat ? '5.65' : '5.00'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded border border-amber-200 dark:border-amber-900/50">
                                                                        <span className="block text-[10px] text-gray-500 font-medium">401 – 1000 NPR</span>
                                                                        <span className="font-bold font-mono text-[11.5px] text-amber-800 dark:text-amber-200">
                                                                            Rs. {fee.apply_vat ? '11.30' : '10.00'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded border border-amber-200 dark:border-amber-900/50">
                                                                        <span className="block text-[10px] text-gray-500 font-medium">1001 – 1500 NPR</span>
                                                                        <span className="font-bold font-mono text-[11.5px] text-amber-800 dark:text-amber-200">
                                                                            Rs. {fee.apply_vat ? '16.95' : '15.00'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded border border-amber-200 dark:border-amber-900/50">
                                                                        <span className="block text-[10px] text-gray-500 font-medium">1500+ NPR</span>
                                                                        <span className="font-bold font-mono text-[11.5px] text-amber-800 dark:text-amber-200">
                                                                            Rs. {fee.apply_vat ? '33.90' : '30.00'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Toggle Active & Delete */}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <label className="relative inline-flex items-center cursor-pointer" title={fee.is_active ? 'Active' : 'Inactive'}>
                                                            <input
                                                                type="checkbox"
                                                                checked={fee.is_active}
                                                                onChange={(e) => {
                                                                    const copy = [...otherFees]
                                                                    copy[idx].is_active = e.target.checked
                                                                    setOtherFees(copy)
                                                                }}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                        <button
                                                            onClick={() => {
                                                                const copy = otherFees.filter((_, i) => i !== idx)
                                                                setOtherFees(copy)
                                                            }}
                                                            className="text-gray-400 hover:text-rose-500 p-1 transition-colors"
                                                            title="Remove fee"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Buttons: Add fee & Preset defaults */}
                                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            setOtherFees([
                                                ...otherFees,
                                                {
                                                    id: `fee_${Date.now()}`,
                                                    name: 'New Deduction Fee',
                                                    type: 'percentage',
                                                    rate: 1.0,
                                                    apply_vat: false,
                                                    applies_to: 'sales_price',
                                                    is_active: true
                                                }
                                            ])
                                        }}
                                        className="w-full sm:flex-1 py-2 border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-xs font-semibold text-gray-500 hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Add Another Fee Deduction
                                    </button>

                                    <button
                                        onClick={handleLoadNepalDefaults}
                                        type="button"
                                        className="w-full sm:w-auto px-3 py-2 border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-1.5"
                                        title="Load Nepal standard presets: Payment 2%, FSM 4%, Handling 1%, Voucher 3%, WHT 1.5%"
                                    >
                                        <RefreshCw size={13} />
                                        Load Nepal Standard Fees
                                    </button>
                                </div>

                                {/* Live Test Deduction Simulator */}
                                <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                            <span>🧪 Live Deduction Simulator</span>
                                            <span className="text-[10px] lowercase text-gray-400 font-normal">(instant accuracy check)</span>
                                        </h3>
                                    </div>

                                    {/* Simulator Inputs */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">
                                                Test Sales Price (Rs.)
                                            </label>
                                            <input
                                                type="number"
                                                step="1"
                                                value={simSalesPrice}
                                                onChange={(e) => setSimSalesPrice(parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-1.5 font-mono font-bold rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">
                                                Raw Category Commission (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={simCommissionRate}
                                                onChange={(e) => setSimCommissionRate(parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-1.5 font-mono font-bold rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Simulator Breakdown */}
                                    <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-zinc-700 text-xs">
                                        {/* Category Commission Breakdown */}
                                        <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                                            <span>
                                                Category Commission ({simCommissionRate.toFixed(2)}% + 13% VAT = {simResult.effectiveCommissionRate.toFixed(2)}%):
                                            </span>
                                            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                                -Rs. {simResult.totalCommissionFee.toFixed(2)}
                                                <span className="text-[10px] text-gray-400 ml-1">
                                                    (base {simResult.baseCommissionAmount.toFixed(2)} + VAT {simResult.commissionVatAmount.toFixed(2)})
                                                </span>
                                            </span>
                                        </div>

                                        {/* Other Active Fees Breakdown */}
                                        {simResult.otherFeeDetails.map((f) => (
                                            <div key={f.id} className="flex items-center justify-between text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-amber-400 dark:border-amber-600">
                                                <span>
                                                    {f.name} {f.type === 'bracket' ? `(${f.bracketNote || 'Tiered Bracket'})` : `(${f.baseRate}%${f.applyVat ? ' + 13% VAT' : ''} = ${f.effectiveRate.toFixed(2)}%)`}:
                                                </span>
                                                <span className="font-mono text-rose-500 dark:text-rose-400 font-semibold">
                                                    -Rs. {f.deductionAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Total Summary */}
                                        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700 flex flex-wrap items-center justify-between font-bold text-sm">
                                            <div>
                                                <span className="text-gray-800 dark:text-gray-200">Total Daraz Deductions:</span>
                                                <span className="text-xs text-rose-600 dark:text-rose-400 ml-1.5 font-mono">
                                                    ({simResult.totalEffectiveFeePercent.toFixed(2)}%)
                                                </span>
                                            </div>
                                            <div className="font-mono text-rose-600 dark:text-rose-400">
                                                -Rs. {simResult.totalDeduction.toFixed(2)}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <span>Estimated Net Payout:</span>
                                            <span className="font-mono text-base">Rs. {simResult.netPayout.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-850 flex items-center justify-end gap-2 shrink-0">
                                <button
                                    onClick={() => setIsOtherFeesOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveOtherFees}
                                    disabled={isSavingOtherFees}
                                    className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow disabled:opacity-50 transition-all flex items-center gap-1.5"
                                >
                                    {isSavingOtherFees ? 'Saving...' : 'Save Other Fees'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* Modal: Add / Edit Category                                    */}
            {/* ───────────────────────────────────────────────────────────── */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <form onSubmit={handleSaveCategory}>
                            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                    {editingItem.id ? 'Edit Category Commission' : 'Add New Category Commission'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 space-y-3 text-xs">
                                <div>
                                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Category 1 <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Cameras, Health & Beauty, Home Appliances"
                                        value={editingItem.category_1}
                                        onChange={(e) => setEditingItem({ ...editingItem, category_1: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Category 2 (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Drones, Skin Care"
                                            value={editingItem.category_2}
                                            onChange={(e) => setEditingItem({ ...editingItem, category_2: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Category 3 (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Drone Accessories"
                                            value={editingItem.category_3}
                                            onChange={(e) => setEditingItem({ ...editingItem, category_3: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Category 4
                                        </label>
                                        <input
                                            type="text"
                                            value={editingItem.category_4}
                                            onChange={(e) => setEditingItem({ ...editingItem, category_4: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Category 5
                                        </label>
                                        <input
                                            type="text"
                                            value={editingItem.category_5}
                                            onChange={(e) => setEditingItem({ ...editingItem, category_5: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Category 6
                                        </label>
                                        <input
                                            type="text"
                                            value={editingItem.category_6}
                                            onChange={(e) => setEditingItem({ ...editingItem, category_6: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Commission Rate (%) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative w-44">
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="e.g. 15.76"
                                            value={editingItem.commission_rate}
                                            onChange={(e) => setEditingItem({ ...editingItem, commission_rate: e.target.value })}
                                            className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pr-8 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                    </div>

                                    {/* Live Total Commission Breakdown Preview */}
                                    {editingItem.commission_rate !== '' && !isNaN(Number(editingItem.commission_rate)) && (() => {
                                        const rawRate = parseFloat(String(editingItem.commission_rate)) || 0
                                        const commWithVat = rawRate * 1.13
                                        const totalComm = commWithVat + activeOtherFeesPct

                                        return (
                                            <div className="mt-3 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs">
                                                <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                        Total Commission (%):
                                                    </span>
                                                    <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                                                        {totalComm.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40">
                                                    <div className="flex justify-between">
                                                        <span>Raw Category Commission:</span>
                                                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{rawRate.toFixed(2)}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Commission + 13% VAT ({rawRate.toFixed(2)}% × 1.13):</span>
                                                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                                            {commWithVat.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Active Other Platform Fees ({activeOtherFeesCount} active):</span>
                                                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                                            +{activeOtherFeesPct.toFixed(2)}%
                                                            {activeOtherFixedFees > 0 && ` + Rs. ${activeOtherFixedFees.toFixed(0)} fixed`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-850 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingCategory}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow disabled:opacity-50 transition-all"
                                >
                                    {isSavingCategory ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* Modal: Upload Sheet (Supports 5,300+ Rows)                    */}
            {/* ───────────────────────────────────────────────────────────── */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 bg-emerald-50/40 dark:bg-emerald-950/20">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                                    <FileSpreadsheet size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Upload Daraz Commission Sheet</h2>
                                    <p className="text-xs text-gray-500">Supports Google Sheet export (.xlsx, .xls, .csv) with ~5,300 rows</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                disabled={isUploading}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Required Columns Info */}
                            <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-gray-700 dark:text-gray-300">Expected Column Headers:</span>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                                    >
                                        <Download size={12} />
                                        Download Sample Template
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6', 'Commission Rate (%)'].map((col) => (
                                        <span key={col} className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border text-[11px] font-mono text-gray-600 dark:text-gray-300">
                                            {col}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Dropzone */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-zinc-850/50"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setUploadFile(e.target.files[0])
                                            setUploadResult(null)
                                        }
                                    }}
                                />
                                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                                {uploadFile ? (
                                    <div>
                                        <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{uploadFile.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB — Click to change</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                                            Click to browse or drop your Daraz commission sheet here
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</p>
                                    </div>
                                )}
                            </div>

                            {/* Progress bar */}
                            {isUploading && uploadProgress && (
                                <div className="space-y-1.5 pt-2">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-emerald-700 dark:text-emerald-400">
                                            Uploading: {uploadProgress.current.toLocaleString()} / {uploadProgress.total.toLocaleString()} rows
                                        </span>
                                        <span>{uploadProgress.percent}%</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-300"
                                            style={{ width: `${uploadProgress.percent}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Result Success */}
                            {uploadResult && (
                                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>{uploadResult}</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-850 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(false)}
                                disabled={isUploading}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={handleStartUpload}
                                disabled={!uploadFile || isUploading}
                                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow disabled:opacity-50 transition-all flex items-center gap-1.5"
                            >
                                {isUploading ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Processing Batches...
                                    </>
                                ) : (
                                    'Start Upload'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
