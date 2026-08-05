'use client'

import { useState, useEffect, useRef } from 'react'
import { 
    Upload, 
    Trash2, 
    Layers, 
    Globe, 
    FileSpreadsheet, 
    CheckCircle, 
    ArrowLeftRight,
    Loader2,
    Plus,
    X
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { 
    getCategoryMappings, 
    bulkUploadCategoryMappings, 
    deleteCategoryMapping,
    getWebsiteDiscountRules,
    saveWebsiteDiscountRules,
    saveCategoryMapping
} from '@/features/inventory/actions/product-actions'

export default function WebsiteMarketplaceSettings() {
    const [activeTab, setActiveTab] = useState<'website' | 'marketplace'>('website')
    
    // Category Mappings State
    const [mappings, setMappings] = useState<any[]>([])
    const [isLoadingMappings, setIsLoadingMappings] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadResult, setUploadResult] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Add Mapping Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newDarazCategory, setNewDarazCategory] = useState('')
    const [newWebsiteCategory, setNewWebsiteCategory] = useState('')
    const [newMarketplaceCategory, setNewMarketplaceCategory] = useState('')
    const [isSavingMapping, setIsSavingMapping] = useState(false)

    const handleSaveMapping = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDarazCategory.trim()) {
            alert('Daraz Category name is required.')
            return
        }

        setIsSavingMapping(true)
        try {
            await saveCategoryMapping({
                darazCategory: newDarazCategory,
                websiteCategory: newWebsiteCategory || null,
                marketplaceCategory: newMarketplaceCategory || null
            })
            alert('Category mapping saved successfully!')
            setIsAddModalOpen(false)
            // Reset fields
            setNewDarazCategory('')
            setNewWebsiteCategory('')
            setNewMarketplaceCategory('')
            // Reload mappings
            loadMappings()
        } catch (err: any) {
            alert(`Failed to save mapping: ${err.message}`)
        } finally {
            setIsSavingMapping(false)
        }
    }

    // Discount Rules State
    const [isDiscountActive, setIsDiscountActive] = useState<boolean>(false)
    const [discountPercent, setDiscountPercent] = useState<string>('0')
    const [isSavingRules, setIsSavingRules] = useState<boolean>(false)

    // Load Mappings
    const loadMappings = async () => {
        setIsLoadingMappings(true)
        try {
            const data = await getCategoryMappings()
            setMappings(data || [])
        } catch (err: any) {
            console.error('Failed to load mappings:', err)
        } finally {
            setIsLoadingMappings(false)
        }
    }

    // Load Discount Rules
    const loadDiscountRules = async () => {
        try {
            const rules = await getWebsiteDiscountRules()
            setIsDiscountActive(rules.active || false)
            setDiscountPercent(String(rules.percent || 0))
        } catch (err: any) {
            console.error('Failed to load discount rules:', err)
        }
    }

    // Save Discount Rules
    const handleSaveDiscountRules = async () => {
        setIsSavingRules(true)
        try {
            const percentNum = parseFloat(discountPercent) || 0
            await saveWebsiteDiscountRules({
                active: isDiscountActive,
                percent: percentNum
            })
            alert('Settings saved successfully! Website prices have been recalculated and pushed in the background.')
        } catch (err: any) {
            alert(`Failed to save settings: ${err.message}`)
        } finally {
            setIsSavingRules(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'website') {
            loadMappings()
            loadDiscountRules()
        }
    }, [activeTab])

    // File Upload Handler (Excel/CSV)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setUploadResult(null)

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const workbook = XLSX.read(bstr, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const json = XLSX.utils.sheet_to_json(worksheet)

                if (json.length === 0) {
                    throw new Error('The uploaded sheet is empty.')
                }

                // Call bulk upload server action
                const result = await bulkUploadCategoryMappings(json)
                
                setUploadResult(`Successfully loaded & mapped ${result.count} category relationships! Existing products matching these categories have been updated automatically.`)
                loadMappings()
                
                // Clear input
                if (fileInputRef.current) fileInputRef.current.value = ''
            } catch (err: any) {
                alert(`Error uploading matching sheet: ${err.message}`)
            } finally {
                setIsUploading(false)
            }
        }
        reader.onerror = () => {
            alert('File reading failed')
            setIsUploading(false)
        }
        reader.readAsBinaryString(file)
    }

    // Delete mapping handler
    const handleDeleteMapping = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category mapping?')) return
        try {
            await deleteCategoryMapping(id)
            setMappings(mappings.filter(m => m.id !== id))
        } catch (err: any) {
            alert(`Failed to delete mapping: ${err.message}`)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Website & Marketplace Management</h1>
                <p className="text-muted-foreground">Configure storefront category routing patterns and rules.</p>
            </div>

            {/* Tab Switches */}
            <div className="flex gap-4 border-b dark:border-zinc-800 pb-px">
                <button
                    onClick={() => setActiveTab('website')}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'website'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Website Management
                </button>
                <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'marketplace'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Marketplace Management
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'website' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Upload Compartment */}
                    <div className="space-y-6 lg:col-span-1">
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                                <FileSpreadsheet size={20} />
                                <h3>Category Matching</h3>
                            </div>
                            
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Upload an Excel or CSV file mapping your raw Daraz Category names to the target categories on your e-commerce storefront.
                            </p>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-150 dark:border-blue-900/30 rounded-lg text-[11px] font-medium text-blue-700 dark:text-blue-400 space-y-2">
                                <span className="font-bold block uppercase tracking-wider">File Format Template:</span>
                                <table className="w-full text-left border-collapse border dark:border-zinc-800">
                                    <thead>
                                        <tr className="bg-blue-100/50 dark:bg-blue-900/20 border-b dark:border-zinc-800">
                                            <th className="p-1.5 font-bold">Daraz Category</th>
                                            <th className="p-1.5 font-bold">Website Category</th>
                                            <th className="p-1.5 font-bold">Marketplace Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b dark:border-zinc-800">
                                            <td className="p-1.5">Fans & Cooling</td>
                                            <td className="p-1.5">Home Appliances</td>
                                            <td className="p-1.5">Home Appliances</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5">Smart Watches</td>
                                            <td className="p-1.5">Smartphones & Wearables</td>
                                            <td className="p-1.5">Smartphones & Wearables</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="relative border-2 border-dashed border-gray-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-zinc-950/20 rounded-xl p-6 text-center cursor-pointer transition-all">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={isUploading}
                                />
                                {isUploading ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="animate-spin text-blue-500" size={24} />
                                        <span className="text-xs font-bold text-gray-500">Processing sheet...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <Upload className="text-gray-400" size={24} />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Click or Drag Excel / CSV</span>
                                        <span className="text-[10px] text-gray-400">Supports .xlsx, .xls, .csv</span>
                                    </div>
                                )}
                            </div>

                            {uploadResult && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg flex items-start gap-2 text-green-700 dark:text-green-400 text-xs">
                                    <CheckCircle className="shrink-0 text-green-500 mt-0.5" size={14} />
                                    <span>{uploadResult}</span>
                                </div>
                            )}
                        </div>

                        {/* Live Price Auto-Discount Rules Compartment */}
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                                <Globe size={20} />
                                <h3>Live Price Auto-Discount Rules</h3>
                            </div>
                            
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Automatically calculate website pricing by applying a discount percentage to the lowest live price among your seller accounts.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Status</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsDiscountActive(true)}
                                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                isDiscountActive 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50' 
                                                    : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-950/20 dark:border-zinc-800'
                                            }`}
                                        >
                                            Active
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsDiscountActive(false)}
                                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                !isDiscountActive 
                                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50' 
                                                    : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-950/20 dark:border-zinc-800'
                                            }`}
                                        >
                                            Inactive
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Discount Percent by Live Price</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={discountPercent}
                                            onChange={(e) => setDiscountPercent(String(Math.max(0, parseFloat(e.target.value) || 0)))}
                                            placeholder="e.g. 5"
                                            className="w-full text-xs bg-gray-50 dark:bg-zinc-950/20 border border-gray-200 dark:border-zinc-800 rounded-lg p-2.5 pr-8 focus:outline-none focus:border-blue-500 font-medium"
                                            min="0"
                                            max="100"
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 text-xs font-bold">%</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSaveDiscountRules}
                                    disabled={isSavingRules}
                                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingRules ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Applying Prices...</span>
                                        </>
                                    ) : (
                                        <span>Save & Apply Rules</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Existing Mappings List */}
                    <div className="lg:col-span-2 space-y-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between pb-2 border-b dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Layers size={18} className="text-blue-500" />
                                    <span>Active Mappings ({mappings.length})</span>
                                </h3>
                                <p className="text-xs text-gray-500">Mappings used to resolve matching categories on sync.</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Add Mapping</span>
                            </button>
                        </div>

                        {isLoadingMappings ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <Loader2 className="animate-spin text-blue-500" size={28} />
                                <span className="text-xs text-gray-500 font-medium">Loading category relationships...</span>
                            </div>
                        ) : mappings.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 space-y-1.5">
                                <ArrowLeftRight className="mx-auto text-gray-200 dark:text-zinc-800" size={48} />
                                <p className="text-sm font-bold">No Category Mappings Uploaded</p>
                                <p className="text-xs text-gray-500 max-w-xs mx-auto">Upload an Excel sheet mapping to initialize automatic category routing.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b dark:border-zinc-800 text-gray-400 font-bold uppercase tracking-wider h-8">
                                            <th className="pb-2 pr-4">Daraz Category</th>
                                            <th className="pb-2 pr-4">Website Category</th>
                                            <th className="pb-2 pr-4">Marketplace Category</th>
                                            <th className="pb-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-zinc-800 font-medium text-gray-900 dark:text-gray-150">
                                        {mappings.map((m) => (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 h-10 transition-colors">
                                                <td className="pr-4 font-semibold text-gray-800 dark:text-gray-200">{m.daraz_category}</td>
                                                <td className="pr-4">
                                                    {m.website_category ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                                            {m.website_category}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-[10px]">Unmapped</span>
                                                    )}
                                                </td>
                                                <td className="pr-4">
                                                    {m.marketplace_category ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                                                            {m.marketplace_category}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-[10px]">Unmapped</span>
                                                    )}
                                                </td>
                                                <td className="text-right">
                                                    <button
                                                        onClick={() => handleDeleteMapping(m.id)}
                                                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:bg-zinc-800 rounded transition-all"
                                                        title="Delete Mapping"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
                    <Globe className="mx-auto text-blue-500 animate-pulse" size={48} />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Marketplace Management Rules</h3>
                        <p className="text-sm text-gray-500 max-w-md mx-auto">
                            Configure global integration limits, catalog sync schedules, API limits, and marketplace seller account synchronization credentials.
                        </p>
                    </div>
                    <div className="pt-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                            ⚙️ Configurations active & synced to local cron schedules
                        </span>
                    </div>
                </div>
            )}
            {/* Add Mapping Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white text-base">Add New Category Mapping</h3>
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-md"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveMapping}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                        Daraz Category <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Fans & Cooling"
                                        value={newDarazCategory}
                                        onChange={(e) => setNewDarazCategory(e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-zinc-950/20 border border-gray-200 dark:border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-medium"
                                    />
                                    <p className="text-[10px] text-gray-400">The exact category name pulled from Daraz products.</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                        Website Category (Storefront)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Home Appliances"
                                        value={newWebsiteCategory}
                                        onChange={(e) => setNewWebsiteCategory(e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-zinc-950/20 border border-gray-200 dark:border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-medium"
                                    />
                                    <p className="text-[10px] text-gray-400">Target category name on your e-commerce website storefront.</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                        Marketplace Category
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Home Appliances"
                                        value={newMarketplaceCategory}
                                        onChange={(e) => setNewMarketplaceCategory(e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-zinc-950/20 border border-gray-200 dark:border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-medium"
                                    />
                                    <p className="text-[10px] text-gray-400">Target category name on the marketplace dashboard.</p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-950/40 border-t dark:border-zinc-800 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingMapping}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingMapping ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Save Mapping</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
