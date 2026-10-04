'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    Search,
    ShoppingBag,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    ExternalLink,
    HelpCircle,
    MessageSquare,
    Sparkles,
    RefreshCw,
    Tag,
    ChevronRight,
    AlertCircle,
    Info,
    Store
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getProductsForQAHub,
    getProductQAs,
    addProductQA,
    updateProductQA,
    deleteProductQA,
    type CatalogProduct,
    type ProductQA
} from '@/features/chat/actions/product-qa-actions'

function stripHtml(html: string | null | undefined): string {
    if (!html) return ''
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export default function ProductKnowledgePage() {
    const [products, setProducts] = useState<CatalogProduct[]>([])
    const [loadingProducts, setLoadingProducts] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'high_selling' | 'with_qa' | 'no_qa'>('all')
    const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)

    // Q&A State for selected product
    const [qas, setQas] = useState<ProductQA[]>([])
    const [loadingQAs, setLoadingQAs] = useState(false)

    // New Q&A Form State
    const [showAddForm, setShowAddForm] = useState(false)
    const [newQuestion, setNewQuestion] = useState('')
    const [newAnswer, setNewAnswer] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Edit Q&A State
    const [editingQAId, setEditingQAId] = useState<string | null>(null)
    const [editQuestion, setEditQuestion] = useState('')
    const [editAnswer, setEditAnswer] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    const [isPending, startTransition] = useTransition()

    // 1. Fetch products
    const loadProducts = async () => {
        setLoadingProducts(true)
        try {
            const res = await getProductsForQAHub({
                search: searchQuery,
                filter: filterType,
                limit: 100
            })
            if (res.success && res.products) {
                setProducts(res.products)
                if (res.products.length > 0 && !selectedProduct) {
                    setSelectedProduct(res.products[0])
                } else if (selectedProduct) {
                    // Update current selected product reference if refreshed
                    const updatedCurrent = res.products.find(p => p.id === selectedProduct.id)
                    if (updatedCurrent) setSelectedProduct(updatedCurrent)
                }
            } else {
                toast.error(res.error || 'Failed to load products')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error loading products')
        } finally {
            setLoadingProducts(false)
        }
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            loadProducts()
        }, 300)
        return () => clearTimeout(timeout)
    }, [searchQuery, filterType])

    // 2. Fetch Q&As when selected product changes
    useEffect(() => {
        if (!selectedProduct) {
            setQas([])
            return
        }

        const fetchQAs = async () => {
            setLoadingQAs(true)
            setShowAddForm(false)
            setEditingQAId(null)
            try {
                const data = await getProductQAs({
                    darazItemId: selectedProduct.daraz_item_id,
                    productId: selectedProduct.id
                })
                setQas(data || [])
            } catch (err: any) {
                toast.error('Failed to load Q&As for this product')
            } finally {
                setLoadingQAs(false)
            }
        }

        fetchQAs()
    }, [selectedProduct?.id, selectedProduct?.daraz_item_id])

    // 3. Add new Q&A
    const handleAddQA = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) return
        if (!newQuestion.trim() || !newAnswer.trim()) {
            toast.warning('Please enter both question and answer')
            return
        }

        setIsSaving(true)
        try {
            const res = await addProductQA({
                product_id: selectedProduct.id,
                daraz_item_id: selectedProduct.daraz_item_id || selectedProduct.id,
                seller_sku: selectedProduct.seller_sku1 || undefined,
                question: newQuestion,
                answer: newAnswer
            })

            if (res.success && res.data) {
                toast.success('Question & Answer added to Knowledge Base!')
                setQas(prev => [res.data!, ...prev])
                setNewQuestion('')
                setNewAnswer('')
                setShowAddForm(false)

                // Increment product QA count in list
                setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, qa_count: (p.qa_count || 0) + 1 } : p))
                setSelectedProduct(prev => prev ? { ...prev, qa_count: (prev.qa_count || 0) + 1 } : null)
            } else {
                toast.error(res.error || 'Failed to save Q&A')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error saving Q&A')
        } finally {
            setIsSaving(false)
        }
    }

    // 4. Update Q&A
    const handleStartEdit = (qa: ProductQA) => {
        setEditingQAId(qa.id)
        setEditQuestion(qa.question || '')
        setEditAnswer(qa.answer || '')
    }

    const handleSaveEdit = async (id: string) => {
        if (!editQuestion.trim() || !editAnswer.trim()) {
            toast.warning('Question and Answer cannot be empty')
            return
        }

        setIsUpdating(true)
        try {
            const res = await updateProductQA(id, {
                question: editQuestion,
                answer: editAnswer
            })

            if (res.success && res.data) {
                toast.success('Q&A updated successfully!')
                setQas(prev => prev.map(q => q.id === id ? res.data! : q))
                setEditingQAId(null)
            } else {
                toast.error(res.error || 'Failed to update Q&A')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating Q&A')
        } finally {
            setIsUpdating(false)
        }
    }

    // 5. Delete Q&A
    const handleDeleteQA = async (id: string) => {
        if (!confirm('Are you sure you want to delete this Q&A? The AI will no longer use this answer.')) return

        try {
            const res = await deleteProductQA(id)
            if (res.success) {
                toast.success('Q&A deleted')
                setQas(prev => prev.filter(q => q.id !== id))
                // Decrement count in list
                if (selectedProduct) {
                    const newCount = Math.max(0, (selectedProduct.qa_count || 1) - 1)
                    setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, qa_count: newCount } : p))
                    setSelectedProduct(prev => prev ? { ...prev, qa_count: newCount } : null)
                }
            } else {
                toast.error(res.error || 'Failed to delete Q&A')
            }
        } catch (err: any) {
            toast.error(err.message || 'Error deleting Q&A')
        }
    }

    const cleanHighlights = stripHtml(selectedProduct?.highlights)
    const cleanDescription = stripHtml(selectedProduct?.description)

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-50 dark:bg-zinc-950 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {/* Top Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400 flex items-center gap-2">
                        <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
                        Product Knowledge Base (Q&A)
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Search products, view highlights, and add custom verified Q&As to train the Daraz AI Chat Agent.
                    </p>
                </div>

                {/* Search & Refresh */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search by Product Name, SKU, Item ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={loadProducts}
                        disabled={loadingProducts}
                        title="Reload Products"
                        className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                    >
                        <RefreshCw size={16} className={loadingProducts ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content Workspace */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Column: Product Catalog List */}
                <div className="w-80 md:w-96 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
                    {/* Filters Header */}
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1.5 text-xs">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 rounded-full font-semibold transition-all ${
                                filterType === 'all'
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                        >
                            All ({products.length})
                        </button>
                        <button
                            onClick={() => setFilterType('high_selling')}
                            className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1 ${
                                filterType === 'high_selling'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40'
                            }`}
                        >
                            🔥 High Selling
                        </button>
                        <button
                            onClick={() => setFilterType('with_qa')}
                            className={`px-3 py-1 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                                filterType === 'with_qa'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                            With Q&A
                        </button>
                        <button
                            onClick={() => setFilterType('no_qa')}
                            className={`px-3 py-1 rounded-full font-semibold transition-all ${
                                filterType === 'no_qa'
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                        >
                            No Q&A
                        </button>
                    </div>

                    {/* Products List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {loadingProducts ? (
                            <div className="p-8 text-center text-zinc-500 text-xs">
                                <RefreshCw className="animate-spin h-5 w-5 mx-auto mb-2 text-zinc-400" />
                                Loading catalog...
                            </div>
                        ) : products.length === 0 ? (
                            <div className="p-8 text-center text-zinc-400 text-xs">
                                No products found matching your filter.
                            </div>
                        ) : (
                            products.map((p) => {
                                const isSelected = selectedProduct?.id === p.id
                                const qaCount = p.qa_count || 0

                                return (
                                    <div
                                        key={p.id}
                                        role="button"
                                        onClick={() => setSelectedProduct(p)}
                                        className={`w-full p-3.5 flex gap-3 text-left transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-50/70 dark:bg-blue-950/20 border-l-4 border-blue-600'
                                                : ''
                                        }`}
                                    >
                                        {/* Product image */}
                                        <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/50 flex items-center justify-center shrink-0 overflow-hidden">
                                            {p.image_url ? (
                                                <img
                                                    src={p.image_url}
                                                    alt={p.product_name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <ShoppingBag size={18} className="text-zinc-400" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-snug">
                                                {p.product_title || p.product_name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-zinc-400">
                                                <span>SKU: {p.seller_sku1 || 'N/A'}</span>
                                                {p.daraz_item_id && p.daraz_item_id !== p.id && (
                                                    <span>• ID: {p.daraz_item_id}</span>
                                                )}
                                                {p.sales_priority && (
                                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200/50 dark:border-amber-800/40">
                                                        🔥 High Selling
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* QA Count Badge */}
                                        <div className="flex flex-col justify-center items-end shrink-0">
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                    qaCount > 0
                                                        ? 'bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                                                        : 'bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700'
                                                }`}
                                            >
                                                {qaCount} Q&A
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Right Column: Selected Product Knowledge Workspace */}
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 flex flex-col min-w-0 h-full overflow-y-auto">
                    {selectedProduct ? (
                        <div className="p-6 space-y-6 max-w-5xl">
                            {/* Product Header Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-5 items-start">
                                <div className="h-20 w-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                    {selectedProduct.image_url ? (
                                        <img
                                            src={selectedProduct.image_url}
                                            alt={selectedProduct.product_name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <ShoppingBag size={28} className="text-zinc-400" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                                            {selectedProduct.product_title || selectedProduct.product_name}
                                        </h2>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                                            SKU: {selectedProduct.seller_sku1 || 'N/A'}
                                        </span>
                                        {selectedProduct.daraz_item_id && selectedProduct.daraz_item_id !== selectedProduct.id && (
                                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                                                Daraz Item ID: {selectedProduct.daraz_item_id}
                                            </span>
                                        )}
                                        {selectedProduct.special_price && (
                                            <span className="text-orange-600 font-bold">
                                                Rs. {selectedProduct.special_price}
                                            </span>
                                        )}
                                        {selectedProduct.sales_priority && (
                                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/50 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1">
                                                🔥 High Selling Product
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Product Highlights & Description Preview */}
                            {(cleanHighlights || cleanDescription) && (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
                                    <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-blue-500" />
                                        Synced Product Specifications & Highlights
                                    </h3>
                                    {cleanHighlights && (
                                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed border border-zinc-200/50 dark:border-zinc-800">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">Highlights:</span>
                                            {cleanHighlights}
                                        </div>
                                    )}
                                    {cleanDescription && (
                                        <details className="text-xs text-zinc-600 dark:text-zinc-400">
                                            <summary className="cursor-pointer font-semibold hover:text-blue-600">View Full Description Text</summary>
                                            <p className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg whitespace-pre-wrap leading-relaxed border border-zinc-200/40 dark:border-zinc-800">
                                                {cleanDescription}
                                            </p>
                                        </details>
                                    )}
                                </div>
                            )}

                            {/* Q&A Knowledge Base Section */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <HelpCircle size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            Verified Product Questions & Answers ({qas.length})
                                        </h3>
                                        <p className="text-[11px] text-zinc-500 mt-0.5">
                                            The AI Chat Agent directly uses these answers when buyers inquire on Daraz.
                                        </p>
                                    </div>

                                    {!showAddForm && (
                                        <button
                                            onClick={() => setShowAddForm(true)}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                        >
                                            <Plus size={14} /> Add Q&A
                                        </button>
                                    )}
                                </div>

                                {/* Add Q&A Form */}
                                {showAddForm && (
                                    <form onSubmit={handleAddQA} className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-3 animate-fadeIn">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                                <Plus size={13} /> Add New Question & Answer
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddForm(false)}
                                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Quick Prompt Chips */}
                                        <div className="space-y-1 pt-0.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                                Quick Question Starters for High-Selling Products:
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: 'Color / Coating', q: 'Is this gold plated colour or natural metal?' },
                                                    { label: 'Size / Measurements', q: 'What is the exact size, diameter, and weight of this item?' },
                                                    { label: 'Material & Quality', q: 'What material is this made of and is it durable?' },
                                                    { label: 'Power / Battery', q: 'Is this rechargeable and how long does the battery last on full charge?' },
                                                    { label: 'Box Contents', q: 'What accessories and attachments are included inside the box?' },
                                                    { label: 'Warranty & Guarantee', q: 'Does this product come with any warranty or return replacement policy?' }
                                                ].map((chip) => (
                                                    <button
                                                        key={chip.label}
                                                        type="button"
                                                        onClick={() => setNewQuestion(chip.q)}
                                                        className="px-2 py-1 text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-all cursor-pointer shadow-2xs"
                                                    >
                                                        + {chip.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Customer Question / Inquired Topic:</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Is this bracelet gold plated colour or not?"
                                                value={newQuestion}
                                                onChange={(e) => setNewQuestion(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Accurate Store Answer:</label>
                                            <textarea
                                                rows={3}
                                                placeholder="e.g., No, this is natural Panchadhatu alloy, NOT gold plated."
                                                value={newAnswer}
                                                onChange={(e) => setNewAnswer(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddForm(false)}
                                                className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50"
                                            >
                                                {isSaving ? 'Saving...' : 'Save to Knowledge Base'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Q&A List */}
                                {loadingQAs ? (
                                    <div className="py-8 text-center text-zinc-500 text-xs">
                                        <RefreshCw className="animate-spin h-5 w-5 mx-auto mb-2 text-zinc-400" />
                                        Loading Q&As...
                                    </div>
                                ) : qas.length === 0 && !showAddForm ? (
                                    <div className="py-10 text-center text-zinc-400 text-xs space-y-2">
                                        <HelpCircle size={28} className="mx-auto text-zinc-300 dark:text-zinc-700" />
                                        <p>No custom Q&As configured for this product yet.</p>
                                        <button
                                            onClick={() => setShowAddForm(true)}
                                            className="text-blue-600 hover:underline font-semibold"
                                        >
                                            Click here to add the first question & answer
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {qas.map((qa) => {
                                            const isEditingThis = editingQAId === qa.id

                                            if (isEditingThis) {
                                                return (
                                                    <div key={qa.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-blue-500/50 rounded-xl space-y-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-bold text-zinc-500">Edit Question:</label>
                                                            <input
                                                                type="text"
                                                                value={editQuestion || ''}
                                                                onChange={(e) => setEditQuestion(e.target.value)}
                                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-100"
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-bold text-zinc-500">Edit Answer:</label>
                                                            <textarea
                                                                rows={3}
                                                                value={editAnswer || ''}
                                                                onChange={(e) => setEditAnswer(e.target.value)}
                                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-800 dark:text-zinc-100"
                                                            />
                                                        </div>

                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingQAId(null)}
                                                                className="px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEdit(qa.id)}
                                                                disabled={isUpdating}
                                                                className="px-3.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow-sm"
                                                            >
                                                                {isUpdating ? 'Saving...' : 'Save Changes'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div
                                                    key={qa.id}
                                                    className="bg-zinc-50/60 dark:bg-zinc-800/20 border border-zinc-200/70 dark:border-zinc-800/80 rounded-xl p-4 space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group shadow-2xs"
                                                >
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex items-start gap-2">
                                                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400 shrink-0">Q:</span>
                                                            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                                                                {qa.question}
                                                            </h4>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleStartEdit(qa)}
                                                                className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                                                title="Edit Answer"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteQA(qa.id)}
                                                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                                                title="Delete Q&A"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2 pl-0.5">
                                                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">A:</span>
                                                        <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed whitespace-pre-wrap">
                                                            {qa.answer}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs">
                            <ShoppingBag size={36} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                            Select a product from the catalog on the left to view and manage its Q&As.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
