'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Sparkles, Copy, Check, Pencil, X, Trash2, Plus, Upload, Loader2, Info, CheckCircle2,
    RefreshCw, ChevronDown, ArrowLeft, Edit3, Send, Calendar, MoreVertical, Store,
    AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Image as ImageIcon, Maximize2,
    Search, Zap, Camera, Link as LinkIcon, ExternalLink, FileText, Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import CategoryPicker from './CategoryPicker'
import DynamicAttributesForm from './DynamicAttributesForm'
import SearchableSupplierSelect from './SearchableSupplierSelect'

interface NewListingTabProps {
    prefilledData?: any
    onClearPrefilled?: () => void
}

interface SkuRow {
    colorFamily?: string
    size?: string
    price: number
    specialPrice?: number
    specialPriceFrom?: string
    specialPriceTo?: string
    quantity: number
    sellerSku: string
    freeItems?: string
    available?: boolean
    images: string[]
}

interface DraftListing {
    id: string
    raw_name: string
    title?: string
    titles_per_store?: Record<string, string>
    description?: string
    highlights?: string[]
    category_id?: number
    category_path?: string
    images: string[]
    attributes?: Record<string, any>
    target_stores: string[]
    price?: number
    special_price?: number
    special_price_from?: string
    special_price_to?: string
    weight?: number
    pkg_length?: number
    pkg_width?: number
    pkg_height?: number
    supplier_id?: string
    wholesale_price?: number
    campaign_price?: number
    product_link?: string
    draft_type?: 'image_only' | 'link_only' | 'name_only' | 'pending' | 'ready' | 'pushed'
    status: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed'
    error?: string
    created_at?: string
}

interface BulkAddRow {
    id: string
    rawName: string
    productLink?: string
    isExtracting?: boolean
    images: string[]
    targetStores: string[]
    price?: number
    special_price?: number
    campaign_price?: number
    supplier_id?: string
    wholesale_price?: number
    extractedCategory?: { id: number; path: string }
    description?: string
    highlights?: string[]
}

// Formats today's date as YYYY-MM-DD
const today = () => new Date().toISOString().split('T')[0]
// Default special price end date: 5 years from today
const fiveYearsFromNow = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 5)
    return d.toISOString().split('T')[0]
}

const COMMON_COLORS = [
    'Not Specified',
    'Multicolor',
    'Black',
    'White',
    'Red',
    'Blue',
    'Green',
    'Yellow',
    'Pink',
    'Purple',
    'Orange',
    'Grey',
    'Gold',
    'Silver',
    'Brown',
    'Beige',
    'Bronze',
    'Copper',
    'Olive',
    'Navy Blue',
    'Maroon',
    'Teal'
]

export default function NewListingTab({ prefilledData, onClearPrefilled }: NewListingTabProps) {
    // ── View mode ───────────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'list' | 'add-single' | 'add-bulk' | 'edit-single'>('list')
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)
    const [singleColorFamily, setSingleColorFamily] = useState('Not Specified')
    const [singleSize, setSingleSize] = useState('')

    // ── Drafts (from Supabase) ──────────────────────────────────────────────
    const [drafts, setDrafts] = useState<DraftListing[]>([])
    const [draftsLoading, setDraftsLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [generatingId, setGeneratingId] = useState<string | null>(null)
    const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
    const [bulkGenerating, setBulkGenerating] = useState(false)
    const [bulkPushing, setBulkPushing] = useState(false)

    // ── Helper: Draft Classification ───────────────────────────────────────
    const getDraftClassification = useCallback((draft: DraftListing): 'image_only' | 'link_only' | 'name_only' | 'pending' | 'ready' | 'pushed' => {
        if (draft.status === 'pushed') return 'pushed'
        if (draft.draft_type) return draft.draft_type
        const link = draft.product_link || draft.attributes?.product_link
        const hasImages = Array.isArray(draft.images) && draft.images.length > 0
        const hasLink = Boolean(link && String(link).trim().length > 0)
        const isAutoName = !draft.raw_name || draft.raw_name.startsWith('[Image Only]') || draft.raw_name.startsWith('[Link]') || draft.raw_name.startsWith('Raw Product')
        const hasRealName = Boolean(draft.raw_name && !isAutoName && draft.raw_name.trim().length > 0)

        if (hasImages && !hasLink && !hasRealName) return 'image_only'
        if (hasLink && !hasImages && !hasRealName) return 'link_only'
        if (hasRealName && !hasImages && !hasLink) return 'name_only'

        const hasTitle = Boolean(draft.title && draft.title.trim().length > 0)
        const hasCategory = Boolean(draft.category_id)
        const hasHighlights = Boolean(draft.highlights && draft.highlights.length > 0 && draft.highlights.some(h => h.trim().length > 0))
        const hasDesc = Boolean(draft.description && draft.description.trim().length > 0)

        if ((hasTitle || hasRealName) && hasCategory && hasHighlights && hasDesc && hasImages) {
            return 'ready'
        }
        return 'pending'
    }, [])

    // ── Filtering state ─────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [storeFilter, setStoreFilter] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState<string>('')

    // ── Stores & Suppliers ──────────────────────────────────────────────────
    const [stores, setStores] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<Array<{ id: string; supplier_name: string }>>([])

    // ── Tab counts based on current storeFilter ─────────────────────────────
    const tabCounts = useMemo(() => {
        const storeFiltered = drafts.filter(draft => {
            if (storeFilter) {
                const hasStore = draft.target_stores && draft.target_stores.some(st => 
                    st === storeFilter || 
                    stores.find(s => s.id === storeFilter)?.seller_account?.toLowerCase() === st?.toLowerCase()
                )
                if (!hasStore) return false
            }
            return true
        })

        const counts = {
            all: storeFiltered.length,
            image_only: 0,
            link_only: 0,
            pending: 0,
            ready: 0,
            pushed: 0
        }

        storeFiltered.forEach(d => {
            const type = getDraftClassification(d)
            if (type === 'image_only') counts.image_only++
            else if (type === 'link_only') counts.link_only++
            else if (type === 'ready' || d.status === 'generated') counts.ready++
            else if (type === 'pushed' || d.status === 'pushed') counts.pushed++
            else counts.pending++
        })

        return counts
    }, [drafts, storeFilter, stores, getDraftClassification])

    const statusTabs = [
        { label: 'All', value: 'all', count: tabCounts.all },
        { label: 'Image Only', value: 'image_only', count: tabCounts.image_only },
        { label: 'Link Only', value: 'link_only', count: tabCounts.link_only },
        { label: 'Pending', value: 'pending', count: tabCounts.pending },
        { label: 'Ready', value: 'ready', count: tabCounts.ready },
        { label: 'Pushed', value: 'pushed', count: tabCounts.pushed },
    ]

    // ── Bulk add rows ───────────────────────────────────────────────────────
    const [bulkRows, setBulkRows] = useState<BulkAddRow[]>([])
    const [bulkUploadingId, setBulkUploadingId] = useState<string | null>(null)

    // ── Single / Edit form state ────────────────────────────────────────────
    const [rawName, setRawName] = useState('')
    const [singleProductLink, setSingleProductLink] = useState('')
    const [singleIsExtracting, setSingleIsExtracting] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [selectedStores, setSelectedStores] = useState<string[]>([])
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
    const [wholesalePrice, setWholesalePrice] = useState<number | undefined>(undefined)
    const [campaignPrice, setCampaignPrice] = useState<number | undefined>(undefined)

    // ── Quick Edit Modals on Card (Desktop) ─────────────────────────────────
    const [imageModalDraft, setImageModalDraft] = useState<DraftListing | null>(null)
    const [modalImages, setModalImages] = useState<string[]>([])
    const [imageModalUploading, setImageModalUploading] = useState(false)
    const [imageModalSaving, setImageModalSaving] = useState(false)

    const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null)

    const [categoryModalDraft, setCategoryModalDraft] = useState<DraftListing | null>(null)
    const [editCatId, setEditCatId] = useState<number | null>(null)
    const [editCatPath, setEditCatPath] = useState<string>('')
    const [editAttributes, setEditAttributes] = useState<Record<string, any>>({})
    const [categoryModalSaving, setCategoryModalSaving] = useState(false)

    const [priceModalDraft, setPriceModalDraft] = useState<DraftListing | null>(null)
    const [editRegularPrice, setEditRegularPrice] = useState<string>('')
    const [editSpecialPrice, setEditSpecialPrice] = useState<string>('')
    const [priceModalSaving, setPriceModalSaving] = useState(false)

    // Per-store titles: { storeId: title }
    const [titlesPerStore, setTitlesPerStore] = useState<Record<string, string>>({})
    // Which store tab is active in the title editor
    const [activeTitleStoreId, setActiveTitleStoreId] = useState<string>('')

    const [categoryId, setCategoryId] = useState<number | null>(null)
    const [categoryPath, setCategoryPath] = useState('')
    const [aiCategorySuggestion, setAiCategorySuggestion] = useState<string | null>(null)
    const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, string>>({})
    const [attributesSchema, setAttributesSchema] = useState<any[]>([])
    const [saleProps, setSaleProps] = useState<any[]>([])

     const [images, setImages] = useState<string[]>([])
    const [uploadingImage, setUploadingImage] = useState(false)
    const [dragImageIdx, setDragImageIdx] = useState<number | null>(null)
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
    const [bulkDragSourceRowId, setBulkDragSourceRowId] = useState<string | null>(null)
    const [bulkDragImageIdx, setBulkDragImageIdx] = useState<number | null>(null)
    const [bulkDragOverIdx, setBulkDragOverIdx] = useState<number | null>(null)

    const [description, setDescription] = useState('')
    const [highlights, setHighlights] = useState<string[]>([''])
    const [previewDesc, setPreviewDesc] = useState(false)
    const [descAlign, setDescAlign] = useState<'left' | 'center' | 'right'>('left')
    const [isAdvancedMode, setIsAdvancedMode] = useState(false)

    const [sellingPrice, setSellingPrice] = useState<number>(0)
    const [specialPrice, setSpecialPrice] = useState<number | undefined>(undefined)
    const [specialPriceFrom, setSpecialPriceFrom] = useState(today())
    const [specialPriceTo, setSpecialPriceTo] = useState(fiveYearsFromNow())
    const [stock, setStock] = useState(100)

    const [hasVariants, setHasVariants] = useState(false)
    const [variant1Values, setVariant1Values] = useState<string[]>([])
    const [variant2Values, setVariant2Values] = useState<string[]>([])
    const [skuRows, setSkuRows] = useState<SkuRow[]>([])

    // Daraz Variant UI states
    const [addVariantImages, setAddVariantImages] = useState(false)
    const [variantImages, setVariantImages] = useState<Record<string, string[]>>({})
    const [variant1Name, setVariant1Name] = useState('Color Family')
    const [variant2Name, setVariant2Name] = useState('Size')
    const [showVariant2, setShowVariant2] = useState(false)
    const [batchPrice, setBatchPrice] = useState<string>('')
    const [batchSpecialPrice, setBatchSpecialPrice] = useState<string>('')
    const [batchStock, setBatchStock] = useState<string>('')
    const [variantInputText, setVariantInputText] = useState('')
    const [variant2InputText, setVariant2InputText] = useState('')
    const [singleSellerSku, setSingleSellerSku] = useState('')
    const [singleFreeItems, setSingleFreeItems] = useState('')
    const [singleAvailable, setSingleAvailable] = useState(true)
    const variant1InputRef = useRef<HTMLInputElement>(null)
    const variant2InputRef = useRef<HTMLInputElement>(null)

    const [weight, setWeight] = useState(0.1)
    const [length, setLength] = useState(1)
    const [width, setWidth] = useState(1)
    const [height, setHeight] = useState(1)
    const [dangerousGoods, setDangerousGoods] = useState('None')

    const [aiModel, setAiModel] = useState('gemini-3.6-flash')
    const [generating, setGenerating] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // ── Load stores + drafts + suppliers + AI settings on mount ─────────────
    useEffect(() => {
        fetchStores()
        fetchDrafts()
        fetchSuppliers()
        // Auto-load configured model from settings
        fetch('/api/settings/ai-integration')
            .then(res => res.json())
            .then(data => {
                if (data.model) {
                    const normalized = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(data.model)
                        ? 'gemini-3.6-flash'
                        : data.model
                    setAiModel(normalized)
                }
            })
            .catch(() => {})
    }, [])

    const fetchSuppliers = async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, supplier_name')
                .eq('is_deleted', false)
                .order('supplier_name', { ascending: true })
            if (data) setSuppliers(data)
        } catch (err) {
            console.error('Failed to load suppliers:', err)
        }
    }

    const fetchStores = async () => {
        try {
            const res = await fetch('/api/daraz/stores', { cache: 'no-store' })
            if (!res.ok) return
            const json = await res.json().catch(() => null)
            if (json?.success && json.data) {
                setStores(json.data)
                if (json.data.length > 0) setSelectedStores([json.data[0].id])
            }
        } catch (err) {
            console.error('Failed to load stores:', err)
        }
    }

    const fetchDrafts = async (retryArg?: any) => {
        const retryCount = typeof retryArg === 'number' ? retryArg : 0
        setDraftsLoading(true)
        try {
            const res = await fetch('/api/daraz/drafts', { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json().catch(() => null)
                if (json?.success && Array.isArray(json.data)) {
                    setDrafts(json.data)
                    setCurrentPage(1)
                    return
                }
            }
            throw new Error('Drafts API response not OK')
        } catch (err: any) {
            // Direct client fallback to Supabase if Next API route is compiling, offline or aborted
            try {
                const { data, error } = await supabase
                    .from('daraz_draft_listings')
                    .select('*')
                    .order('created_at', { ascending: false })
                if (!error && Array.isArray(data)) {
                    setDrafts(data as DraftListing[])
                    setCurrentPage(1)
                    return
                }
            } catch (fallbackErr) {
                // Ignore fallback error
            }

            if (retryCount < 1) {
                setTimeout(() => fetchDrafts(retryCount + 1), 600)
            } else {
                console.warn('[NewListingTab] Failed to load drafts after fallback:', err?.message || err)
            }
        } finally {
            setDraftsLoading(false)
        }
    }

    // ── Prefilled data from Products Tab ─────────────────────────────────────
    useEffect(() => {
        if (prefilledData) {
            setRawName(prefilledData.name || '')
            setCategoryId(prefilledData.primaryCategory || null)
            setImages(prefilledData.images || [])
            setDescription(prefilledData.attributes?.description || '')
            setHighlights(
                prefilledData.attributes?.short_description
                    ? prefilledData.attributes.short_description.replace(/<\/?[^>]+(>|$)/g, '').split('\n').filter(Boolean)
                    : ['']
            )
            const mainSku = prefilledData.skus?.[0] || {}
            const prefilledSpecialPrice = mainSku.special_price || (mainSku.price && mainSku.price > 200 ? mainSku.price - 200 : undefined)
            setSellingPrice(mainSku.price || 0)
            setSpecialPrice(prefilledSpecialPrice)
            setWeight(mainSku.package_weight || 0.1)
            setLength(mainSku.package_length || 1)
            setWidth(mainSku.package_width || 1)
            setHeight(mainSku.package_height || 1)
            setViewMode('add-single')
        }
    }, [prefilledData])

    // ── Variant SKU grid generation (preserves individual edits) ─────────────
    useEffect(() => {
        if (!hasVariants && variant1Values.length === 0 && variant2Values.length === 0) {
            setSkuRows([])
            return
        }

        const v1List = variant1Values.length > 0 ? variant1Values : ['']
        const v2List = variant2Values.length > 0 ? variant2Values : ['']

        if (variant1Values.length === 0 && variant2Values.length === 0) {
            setSkuRows([])
            return
        }

        setSkuRows(prevRows => {
            const existingMap = new Map<string, SkuRow>()
            prevRows.forEach(r => {
                const key = `${r.colorFamily || ''}__${r.size || ''}`
                existingMap.set(key, r)
            })

            const newRows: SkuRow[] = []
            const rawPrefix = (rawName || 'SKU').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 10).toUpperCase()

            v1List.forEach(v1 => {
                v2List.forEach(v2 => {
                    if (v1 || v2) {
                        const key = `${v1}__${v2}`
                        const existing = existingMap.get(key)
                        const vImages = (v1 && variantImages[v1]?.length) ? variantImages[v1] : []
                        if (existing) {
                            newRows.push({
                                ...existing,
                                images: vImages
                            })
                        } else {
                            const skuParts = [rawPrefix, v1, v2].filter(Boolean)
                            newRows.push({
                                colorFamily: v1 || undefined,
                                size: v2 || undefined,
                                price: sellingPrice || 0,
                                specialPrice: specialPrice,
                                specialPriceFrom: specialPriceFrom,
                                specialPriceTo: specialPriceTo,
                                quantity: stock || 100,
                                sellerSku: skuParts.join('-'),
                                freeItems: '',
                                available: true,
                                images: vImages
                            })
                        }
                    }
                })
            })
            return newRows
        })
    }, [hasVariants, variant1Values, variant2Values, variantImages])

    // Update variant names when category saleProps change
    useEffect(() => {
        if (saleProps && saleProps.length > 0) {
            if (saleProps[0]?.label || saleProps[0]?.name) {
                setVariant1Name(saleProps[0].label || saleProps[0].name)
            }
            if (saleProps.length > 1 && (saleProps[1]?.label || saleProps[1]?.name)) {
                setVariant2Name(saleProps[1].label || saleProps[1].name)
            }
        }
    }, [saleProps])

    const DARAZ_STANDARD_COLORS = [
        'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple',
        'Orange', 'Brown', 'Grey', 'Gold', 'Silver', 'Multicolor', 'Beige',
        'Navy Blue', 'Maroon', 'Teal', 'Bronze', 'Copper', 'Rose Gold', 'Khaki'
    ]

    const DARAZ_STANDARD_SIZES = [
        'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size', 'One Size',
        '28', '30', '32', '34', '36', '38', '40', '42', '44'
    ]

    const availableV1Options = useMemo(() => {
        if (saleProps && saleProps[0]?.options && saleProps[0].options.length > 0) {
            return saleProps[0].options.map((o: any) => o.name)
        }
        return DARAZ_STANDARD_COLORS
    }, [saleProps])

    const availableV2Options = useMemo(() => {
        if (saleProps && saleProps.length > 1 && saleProps[1]?.options && saleProps[1].options.length > 0) {
            return saleProps[1].options.map((o: any) => o.name)
        }
        return DARAZ_STANDARD_SIZES
    }, [saleProps])

    const handleBatchApply = () => {
        setSkuRows(prev => prev.map(row => ({
            ...row,
            price: batchPrice ? Number(batchPrice) : row.price,
            specialPrice: batchSpecialPrice !== '' ? Number(batchSpecialPrice) : row.specialPrice,
            quantity: batchStock ? Number(batchStock) : row.quantity
        })))
    }

    const handleVariantImageUpload = async (variantVal: string, file: File) => {
        try {
            const url = await uploadImageToSupabase(file)
            const currentImages = variantImages[variantVal] || []
            const next = { ...variantImages, [variantVal]: [...currentImages, url] }
            setVariantImages(next)
            setSkuRows(prev => prev.map(row => {
                if (row.colorFamily === variantVal) {
                    return { ...row, images: [...(row.images || []), url] }
                }
                return row
            }))
        } catch (err: any) {
            alert('Failed to upload variant image: ' + err.message)
        }
    }

    const handleRemoveVariantImage = (variantVal: string, imgIdx: number) => {
        const current = variantImages[variantVal] || []
        const updated = current.filter((_, i) => i !== imgIdx)
        const next = { ...variantImages, [variantVal]: updated }
        setVariantImages(next)
        setSkuRows(prev => prev.map(row => {
            if (row.colorFamily === variantVal) {
                return { ...row, images: updated }
            }
            return row
        }))
    }

    // Auto-filter dynamic attributes to keep ONLY required specifications
    // Auto-fills empty required fields with sensible defaults (e.g. first option)
    useEffect(() => {
        if (attributesSchema.length === 0) return

        const requiredKeys = new Set(
            attributesSchema
                .filter(a => a.is_mandatory === 1 || a.is_mandatory === '1')
                .map(a => a.name)
        )

        setDynamicAttributes(prev => {
            const filtered: Record<string, string> = { brand: 'No Brand' }

            // 1. Keep existing values for required/system keys
            Object.entries(prev).forEach(([key, val]) => {
                if (requiredKeys.has(key) || key === 'brand' || key === 'warranty_type') {
                    filtered[key] = val
                }
            })

            // 2. Auto-fill any missing required fields
            attributesSchema.forEach(attr => {
                const isMandatory = attr.is_mandatory === 1 || attr.is_mandatory === '1'
                if (isMandatory && !filtered[attr.name]) {
                    if (attr.input_type === 'singleSelect' && attr.options && attr.options.length > 0) {
                        filtered[attr.name] = attr.options[0].name
                    } else {
                        filtered[attr.name] = 'Standard'
                    }
                }
            })

            return filtered
        })
    }, [attributesSchema])

    // ── Quick Modal Handlers (Desktop Card Improvements) ───────────────────
    const handleModalDesktopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        const files = Array.from(e.target.files)
        setImageModalUploading(true)
        try {
            const remaining = 8 - modalImages.length
            if (remaining <= 0) {
                alert('Maximum 8 photos allowed per product.')
                return
            }
            const filesToUpload = files.slice(0, remaining)
            const urls = await Promise.all(filesToUpload.map(f => uploadImageToSupabase(f)))
            setModalImages(prev => [...prev, ...urls].slice(0, 8))
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setImageModalUploading(false)
            e.target.value = ''
        }
    }

    const handleSaveModalImages = async () => {
        if (!imageModalDraft) return
        setImageModalSaving(true)
        try {
            const res = await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: imageModalDraft.id,
                    images: modalImages
                })
            })
            const json = await res.json()
            if (!res.ok || json.error) throw new Error(json.error || 'Failed to update images')

            setDrafts(prev => prev.map(d => d.id === imageModalDraft.id ? { ...d, images: modalImages } : d))
            setImageModalDraft(null)
        } catch (err: any) {
            alert('Failed to save photos: ' + err.message)
        } finally {
            setImageModalSaving(false)
        }
    }

    const handleOpenCategoryModal = (draft: DraftListing) => {
        setCategoryModalDraft(draft)
        setEditCatId(draft.category_id || null)
        setEditCatPath(draft.category_path || '')
        setEditAttributes(draft.attributes || {})
    }

    const handleSaveCategoryModal = async () => {
        if (!categoryModalDraft) return
        setCategoryModalSaving(true)
        try {
            const res = await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: categoryModalDraft.id,
                    category_id: editCatId,
                    category_path: editCatPath,
                    attributes: editAttributes
                })
            })
            const json = await res.json()
            if (!res.ok || json.error) throw new Error(json.error || 'Failed to update category')

            setDrafts(prev => prev.map(d => d.id === categoryModalDraft.id ? {
                ...d,
                category_id: editCatId || undefined,
                category_path: editCatPath,
                attributes: { ...(d.attributes || {}), ...editAttributes }
            } : d))
            setCategoryModalDraft(null)
        } catch (err: any) {
            alert('Failed to save category & specifications: ' + err.message)
        } finally {
            setCategoryModalSaving(false)
        }
    }

    const handleOpenPriceModal = (draft: DraftListing) => {
        setPriceModalDraft(draft)
        setEditRegularPrice(draft.price !== undefined && draft.price !== null ? String(draft.price) : '')
        setEditSpecialPrice(draft.special_price !== undefined && draft.special_price !== null ? String(draft.special_price) : '')
    }

    const handleSavePriceModal = async () => {
        if (!priceModalDraft) return
        const regPrice = editRegularPrice.trim() ? Number(editRegularPrice) : null
        const specPrice = editSpecialPrice.trim() ? Number(editSpecialPrice) : null

        setPriceModalSaving(true)
        try {
            const res = await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: priceModalDraft.id,
                    price: regPrice,
                    special_price: specPrice
                })
            })
            const json = await res.json()
            if (!res.ok || json.error) throw new Error(json.error || 'Failed to update price')

            setDrafts(prev => prev.map(d => d.id === priceModalDraft.id ? {
                ...d,
                price: regPrice !== null ? regPrice : undefined,
                special_price: specPrice !== null ? specPrice : undefined
            } : d))
            setPriceModalDraft(null)
        } catch (err: any) {
            alert('Failed to save price: ' + err.message)
        } finally {
            setPriceModalSaving(false)
        }
    }

    // ── Supabase image upload ────────────────────────────────────────────────
    const uploadImageToSupabase = async (file: File): Promise<string> => {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const { error } = await supabase.storage
            .from('mobile-captures')
            .upload(fileName, file, { contentType: 'image/jpeg', upsert: false })
        if (error) throw new Error(error.message)
        const { data: { publicUrl } } = supabase.storage.from('mobile-captures').getPublicUrl(fileName)
        return publicUrl
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        setUploadingImage(true)
        try {
            const url = await uploadImageToSupabase(e.target.files[0])
            const updated = [...images, url]
            setImages(updated)
            // If editing a draft, patch images
            if (editingDraftId) {
                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingDraftId, images: updated })
                })
            }
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setUploadingImage(false)
        }
    }

    const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx))

    // ── Auto-save draft on raw name blur ─────────────────────────────────────
    const handleRawNameBlur = async () => {
        if (!rawName.trim() || editingDraftId) return
        setSavingDraft(true)
        try {
            const res = await fetch('/api/daraz/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_name: rawName.trim(),
                    product_link: singleProductLink.trim() || undefined,
                    target_stores: selectedStores,
                    images,
                    category_id: categoryId || null,
                    category_path: categoryPath || '',
                    attributes: dynamicAttributes || {},
                    price: sellingPrice || null,
                    supplier_id: selectedSupplierId || null,
                    wholesale_price: wholesalePrice || null,
                    status: 'draft'
                })
            })
            const json = await res.json()
            if (json.success && json.data?.id) {
                setEditingDraftId(json.data.id)
                // Refresh draft list in background
                fetchDrafts()
            }
        } catch (err) {
            console.error('Auto-save failed:', err)
        } finally {
            setSavingDraft(false)
        }
    }

    // ── Save/patch draft field ────────────────────────────────────────────────
    const patchDraft = useCallback(async (fields: Partial<DraftListing>) => {
        if (!editingDraftId) return
        try {
            await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingDraftId, ...fields })
            })
        } catch (err) {
            console.error('Patch draft failed:', err)
        }
    }, [editingDraftId])

    const [draftSavedSuccess, setDraftSavedSuccess] = useState(false)

    // ── Save full form as draft ──────────────────────────────────────────────
    const handleSaveAsDraft = async () => {
        const effectiveRawName = rawName.trim() || (singleProductLink.trim() ? `[Link] ${singleProductLink.trim().slice(0, 40)}` : (images.length > 0 ? `[Image Only] ${new Date().toLocaleDateString()}` : ''))
        if (!effectiveRawName) {
            return alert('Please enter a Product Name, paste a Competitor Link, or upload an Image to save as draft')
        }
        setSavingDraft(true)
        try {
            const primaryTitle = Object.values(titlesPerStore)[0] || titlesPerStore['__manual__'] || (rawName.trim() || effectiveRawName)
            const cleanHighlights = highlights
                .filter(h => h.trim().length > 0)
                .map(h => h.replace(/^[•\-\*\s]+/, '').trim())
                .filter(Boolean)

            const draftPayload: any = {
                raw_name: effectiveRawName,
                product_link: singleProductLink.trim() || undefined,
                title: primaryTitle,
                titles_per_store: titlesPerStore,
                description: description || '',
                highlights: cleanHighlights,
                category_id: categoryId || null,
                category_path: categoryPath || '',
                images: images || [],
                attributes: {
                    ...(dynamicAttributes || {}),
                    ...(hasVariants ? {
                        has_variants: true,
                        variant1_name: variant1Name,
                        variant1_values: variant1Values,
                        variant2_name: variant2Name,
                        variant2_values: variant2Values,
                        sku_rows: skuRows,
                        variant_images: variantImages,
                        add_variant_images: addVariantImages
                    } : {
                        has_variants: false,
                        color_family: singleColorFamily,
                        size: singleSize
                    })
                },
                target_stores: selectedStores || [],
                price: (hasVariants && skuRows.length > 0) ? (Number(skuRows[0]?.price) || sellingPrice || null) : (sellingPrice || null),
                special_price: (hasVariants && skuRows.length > 0) ? (Number(skuRows[0]?.specialPrice) || specialPrice || null) : (specialPrice || null),
                special_price_from: specialPriceFrom || null,
                special_price_to: specialPriceTo || null,
                weight: weight || 0.1,
                pkg_length: length || 1,
                pkg_width: width || 1,
                pkg_height: height || 1,
                supplier_id: selectedSupplierId || null,
                wholesale_price: wholesalePrice || null,
                campaign_price: campaignPrice || null,
                status: 'draft'
            }

            if (editingDraftId) {
                const res = await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingDraftId, ...draftPayload })
                })
                const json = await res.json()
                if (!json.success) throw new Error(json.error || 'Failed to update draft')
            } else {
                const res = await fetch('/api/daraz/drafts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(draftPayload)
                })
                const json = await res.json()
                if (!json.success) throw new Error(json.error || 'Failed to create draft')
                if (json.data?.id) {
                    setEditingDraftId(json.data.id)
                }
            }

            setDraftSavedSuccess(true)
            setTimeout(() => setDraftSavedSuccess(false), 3000)
            fetchDrafts()
        } catch (err: any) {
            console.error('Save as draft failed:', err)
            alert('Failed to save draft: ' + err.message)
        } finally {
            setSavingDraft(false)
        }
    }

    // ── Single AI Generation ──────────────────────────────────────────────────
    const handleAIGenerate = async () => {
        const hasImage = images.length > 0
        if (!rawName.trim() && !hasImage) return alert('Please enter a product name or upload an image first')
        if (selectedStores.length === 0) return alert('Please select at least one seller account')
        setGenerating(true)

        // Mark draft as generating
        if (editingDraftId) {
            await patchDraft({ status: 'generating' })
        }

        try {
            // Get store names for per-store title generation
            const storeNames = selectedStores
                .map(id => stores.find(s => s.id === id)?.seller_account || id)

            const effectiveName = rawName.trim() || 'Product from uploaded image'

            const res = await fetch('/api/daraz/products/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: effectiveName,
                    price: sellingPrice || 500,
                    imageUrl: images[0] || null,
                    storeNames,
                    categoryPath: categoryPath || 'General',
                    attributesSchema,
                    model: aiModel
                })
            })
            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'AI generation failed')
            }

            // ── Apply generated content ──────────────────────────────────────
            // 1. Per-store titles
            const newTitlesPerStore: Record<string, string> = {}
            selectedStores.forEach(storeId => {
                const storeName = stores.find(s => s.id === storeId)?.seller_account || storeId
                newTitlesPerStore[storeId] = data.titles?.[storeName] || rawName
            })
            setTitlesPerStore(newTitlesPerStore)
            if (selectedStores.length > 0) {
                setActiveTitleStoreId(selectedStores[0])
            }

            // 2. Description
            if (data.description) setDescription(data.description)

            // 3. Highlights (8-10 points)
            if (data.highlights && data.highlights.length > 0) {
                setHighlights(data.highlights)
            }

            // 4. Attributes (with brand forced to No Brand)
            if (data.attributes) {
                data.attributes.brand = 'No Brand'
                setDynamicAttributes(prev => ({ ...prev, ...data.attributes }))
            }

            // 5. Auto-select category from AI suggestion
            if (data.category_suggestion) {
                setAiCategorySuggestion(data.category_suggestion)
                setCategoryPath(data.category_suggestion)
            }
            if (data.category_id) {
                setCategoryId(data.category_id)
            }

            // ── Save generated content to DB ──────────────────────────────────
            if (editingDraftId) {
                await patchDraft({
                    title: Object.values(newTitlesPerStore)[0] || rawName,
                    titles_per_store: newTitlesPerStore as any,
                    description: data.description || '',
                    highlights: data.highlights || [],
                    attributes: data.attributes || {},
                    category_id: data.category_id || null,
                    category_path: data.category_suggestion || categoryPath,
                    status: 'generated'
                })
                fetchDrafts()
            }

        } catch (err: any) {
            alert('AI Generation error: ' + err.message)
            if (editingDraftId) {
                await patchDraft({ status: 'failed', error: err.message })
            }
        } finally {
            setGenerating(false)
        }
    }

    const handleSingleGenerate = async (draft: DraftListing) => {
        const hasImage = draft.images && draft.images.length > 0
        const isImageOnly = !draft.raw_name?.trim() || draft.raw_name.startsWith('[Image Only]')
        const effectiveName = !isImageOnly ? draft.raw_name!.trim() : (hasImage ? 'Product from uploaded image' : '')
        if (!effectiveName && !hasImage) return alert('Product name or image is required')

        let targetStores = draft.target_stores
        if (!targetStores || targetStores.length === 0) {
            if (stores.length > 0) {
                targetStores = [stores[0].id]
            } else {
                return alert('No online store found. Please connect a Daraz store first.')
            }
        }

        setGeneratingId(draft.id)
        
        // Mark as generating
        await fetch('/api/daraz/drafts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: draft.id, status: 'generating' })
        })
        
        // Update local state status to generating
        setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'generating' } : d))

        try {
            const storeNames = targetStores
                .map(id => stores.find(s => s.id === id)?.seller_account || id)

            const res = await fetch('/api/daraz/products/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: effectiveName,
                    price: draft.price || 500,
                    imageUrl: draft.images?.[0] || null,
                    storeNames: storeNames.length > 0 ? storeNames : ['Default Store'],
                    model: aiModel
                })
            })
            const data = await res.json()

            if (data.success) {
                const newTitlesPerStore: Record<string, string> = {}
                targetStores.forEach(storeId => {
                    const storeName = stores.find(s => s.id === storeId)?.seller_account || storeId
                    newTitlesPerStore[storeId] = data.titles?.[storeName] || effectiveName
                })

                const finalTitle = Object.values(newTitlesPerStore)[0] || effectiveName

                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: draft.id,
                        title: finalTitle,
                        raw_name: isImageOnly ? finalTitle : draft.raw_name,
                        target_stores: targetStores,
                        titles_per_store: newTitlesPerStore,
                        description: data.description || '',
                        highlights: data.highlights || [],
                        attributes: { ...(data.attributes || {}), brand: 'No Brand' },
                        category_id: data.category_id || null,
                        category_path: data.category_suggestion || '',
                        status: 'generated'
                    })
                })
                
                alert(`AI content generated successfully for "${finalTitle}"!`)
            } else {
                throw new Error(data.error || 'AI Generation failed')
            }
        } catch (err: any) {
            console.error('Single generation failed:', err)
            await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: draft.id, status: 'failed' })
            })
            alert(`Generation failed: ${err.message}`)
        } finally {
            setGeneratingId(null)
            fetchDrafts()
        }
    }

    // ── Bulk Add handlers ─────────────────────────────────────────────────────
    const handleStartBulkAdd = () => {
        setBulkRows([{
            id: crypto.randomUUID(),
            rawName: '',
            productLink: '',
            images: [],
            targetStores: stores.length > 0 ? [stores[0].id] : [],
            price: undefined,
            special_price: undefined,
            campaign_price: undefined,
            supplier_id: undefined,
            wholesale_price: undefined
        }])
        setViewMode('add-bulk')
        setIsAddMenuOpen(false)
    }

    const handleExtractRowLink = async (idx: number) => {
        const row = bulkRows[idx]
        if (!row.productLink || !row.productLink.trim()) {
            return alert('Please enter a product URL first')
        }
        const updated = [...bulkRows]
        updated[idx].isExtracting = true
        setBulkRows(updated)

        try {
            const res = await fetch('/api/daraz/extract-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: row.productLink.trim() })
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to extract product link')
            }

            const data = json.data
            setBulkRows(prev => {
                const next = [...prev]
                const cur = next[idx]
                if (!cur) return prev

                if (!cur.rawName.trim() && data.raw_name) {
                    cur.rawName = data.raw_name
                }
                if (data.special_price) {
                    cur.special_price = data.special_price
                    cur.price = data.price || (data.special_price + 200)
                } else if (data.price) {
                    cur.price = data.price
                    cur.special_price = data.price > 200 ? data.price - 200 : data.price
                }
                if (data.images && data.images.length > 0) {
                    const existing = cur.images || []
                    const merged = Array.from(new Set([...existing, ...data.images])).slice(0, 8)
                    cur.images = merged
                }
                if (data.category_id) {
                    cur.extractedCategory = { id: data.category_id, path: data.category_path || '' }
                }
                if (data.description) {
                    cur.description = data.description
                }
                if (data.highlights) {
                    cur.highlights = data.highlights
                }
                return next
            })
        } catch (err: any) {
            alert('Extraction failed: ' + err.message)
        } finally {
            setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, isExtracting: false } : r))
        }
    }

    const handleSingleExtractLink = async () => {
        if (!singleProductLink.trim()) return alert('Please enter a competitor product URL')
        setSingleIsExtracting(true)
        try {
            const res = await fetch('/api/daraz/extract-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: singleProductLink.trim() })
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to extract product link')
            }
            const data = json.data
            if (data.raw_name && !rawName) setRawName(data.raw_name)
            if (data.title) {
                const initTitles: Record<string, string> = { ...titlesPerStore }
                selectedStores.forEach(sId => { if (!initTitles[sId]) initTitles[sId] = data.title })
                initTitles['__manual__'] = data.title
                setTitlesPerStore(initTitles)
            }
            if (data.special_price) {
                setSpecialPrice(data.special_price)
                setSellingPrice(data.price || data.special_price + 200)
            } else if (data.price) {
                setSellingPrice(data.price)
                setSpecialPrice(data.price > 200 ? data.price - 200 : data.price)
            }
            if (data.images && data.images.length > 0) {
                const merged = Array.from(new Set([...images, ...data.images])).slice(0, 8)
                setImages(merged)
            }
            if (data.category_id) {
                setCategoryId(data.category_id)
                setCategoryPath(data.category_path || '')
                setAiCategorySuggestion(data.category_path || null)
            }
            if (data.description) {
                setDescription(data.description)
            }
            if (data.highlights && data.highlights.length > 0) {
                setHighlights(data.highlights)
            }
            alert(`Extracted details successfully from ${data.platform || 'link'}!`)
        } catch (err: any) {
            alert('Extraction failed: ' + err.message)
        } finally {
            setSingleIsExtracting(false)
        }
    }

    const handleBulkImageUpload = async (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        setBulkUploadingId(rowId)
        try {
            const files = Array.from(e.target.files)
            const urls = await Promise.all(files.map(file => uploadImageToSupabase(file)))
            setBulkRows(prev => prev.map(r => r.id === rowId ? { ...r, images: [...r.images, ...urls] } : r))
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setBulkUploadingId(null)
        }
    }

    const handleSaveBulkDrafts = async () => {
        const valid = bulkRows.filter(r => 
            r.rawName.trim().length > 0 || 
            (r.productLink && r.productLink.trim().length > 0) || 
            (r.images && r.images.length > 0)
        )
        if (valid.length === 0) return alert('Please enter at least a product name, competitor link, or upload an image')

        // Save each bulk row to Supabase
        await Promise.all(valid.map(r =>
            fetch('/api/daraz/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_name: r.rawName.trim(),
                    product_link: r.productLink?.trim() || null,
                    category_id: r.extractedCategory?.id || null,
                    category_path: r.extractedCategory?.path || null,
                    description: r.description || null,
                    highlights: r.highlights || null,
                    images: r.images,
                    target_stores: r.targetStores,
                    price: r.price || null,
                    special_price: r.special_price || null,
                    campaign_price: r.campaign_price || null,
                    supplier_id: r.supplier_id || null,
                    wholesale_price: r.wholesale_price || null,
                    status: 'draft'
                })
            }).then(res => res.json())
        ))

        await fetchDrafts()
        setViewMode('list')
    }

    // ── Bulk AI generation ────────────────────────────────────────────────────
    const handleBulkGenerateContent = async () => {
        const toGen = drafts.filter(
            d => selectedDraftIds.has(d.id) && (d.status === 'draft' || d.status === 'failed')
        )
        if (toGen.length === 0) return alert('No selected drafts need AI generation (already ready or pushed)')
        setBulkGenerating(true)

        // Mark all as generating
        await Promise.all(toGen.map(d =>
            fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: d.id, status: 'generating' })
            })
        ))
        setDrafts(prev => prev.map(d => selectedDraftIds.has(d.id) ? { ...d, status: 'generating' } : d))

        // Generate one by one
        for (const item of toGen) {
            try {
                const hasImage = item.images && item.images.length > 0
                const isImageOnly = !item.raw_name?.trim() || item.raw_name.startsWith('[Image Only]')
                const effectiveName = !isImageOnly ? item.raw_name!.trim() : (hasImage ? 'Product from uploaded image' : '')
                if (!effectiveName && !hasImage) continue

                let targetStores = item.target_stores
                if (!targetStores || targetStores.length === 0) {
                    targetStores = stores.length > 0 ? [stores[0].id] : []
                }

                const storeNames = targetStores
                    .map(id => stores.find(s => s.id === id)?.seller_account || id)

                const res = await fetch('/api/daraz/products/ai-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productName: effectiveName,
                        price: item.price || 500,
                        imageUrl: item.images?.[0] || null,
                        storeNames: storeNames.length > 0 ? storeNames : ['Default Store'],
                        model: aiModel
                    })
                })
                const data = await res.json()

                if (data.success) {
                    const newTitlesPerStore: Record<string, string> = {}
                    targetStores.forEach(storeId => {
                        const storeName = stores.find(s => s.id === storeId)?.seller_account || storeId
                        newTitlesPerStore[storeId] = data.titles?.[storeName] || effectiveName
                    })

                    const finalTitle = Object.values(newTitlesPerStore)[0] || effectiveName

                    await fetch('/api/daraz/drafts', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: item.id,
                            title: finalTitle,
                            raw_name: isImageOnly ? finalTitle : item.raw_name,
                            target_stores: targetStores,
                            titles_per_store: newTitlesPerStore,
                            description: data.description || '',
                            highlights: data.highlights || [],
                            attributes: { ...(data.attributes || {}), brand: 'No Brand' },
                            category_id: data.category_id || null,
                            category_path: data.category_suggestion || '',
                            status: 'generated'
                        })
                    })

                    setDrafts(prev => prev.map(d => d.id === item.id ? {
                        ...d,
                        title: finalTitle,
                        titles_per_store: newTitlesPerStore,
                        category_id: data.category_id || undefined,
                        category_path: data.category_suggestion || undefined,
                        status: 'generated'
                    } : d))
                }
            } catch (err: any) {
                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, status: 'failed', error: err.message })
                })
                setDrafts(prev => prev.map(d => d.id === item.id ? { ...d, status: 'failed' } : d))
            }
        }

        setSelectedDraftIds(new Set())
        setBulkGenerating(false)
        fetchDrafts()
    }

    // ── Delete draft ──────────────────────────────────────────────────────────
    const handleDeleteDraft = async (id: string) => {
        if (!confirm('Delete this draft listing?')) return
        await fetch(`/api/daraz/drafts?id=${id}`, { method: 'DELETE' })
        setDrafts(prev => prev.filter(d => d.id !== id))
    }

    // ── Edit draft (open full form) ───────────────────────────────────────────
    const handleEditDraft = (draft: DraftListing) => {
        setEditingDraftId(draft.id)
        setRawName(draft.raw_name)
        setSingleProductLink(draft.product_link || draft.attributes?.product_link || '')
        setSelectedSupplierId(draft.supplier_id || '')
        setWholesalePrice(draft.wholesale_price || undefined)
        setCampaignPrice(draft.campaign_price || (draft as any).attributes?.campaign_price || undefined)
        
        // Populate titles per store from draft.titles_per_store and draft.title fallback
        const initialTitles: Record<string, string> = { ...(draft.titles_per_store || {}) }
        const targetStores = draft.target_stores && draft.target_stores.length > 0
            ? draft.target_stores
            : (stores.length > 0 ? [stores[0].id] : [])

        if (draft.title) {
            targetStores.forEach(sId => {
                if (!initialTitles[sId]) initialTitles[sId] = draft.title!
            })
            if (!initialTitles['__manual__']) initialTitles['__manual__'] = draft.title
        }

        setTitlesPerStore(initialTitles)
        setActiveTitleStoreId(targetStores[0] || '')
        setSelectedStores(targetStores)
        setCategoryId(draft.category_id || null)
        setCategoryPath(draft.category_path || '')
        setAiCategorySuggestion(draft.category_path || null)
        setImages(draft.images || [])
        setDescription(draft.description || '')
        setHighlights(draft.highlights && draft.highlights.length > 0 ? draft.highlights : [''])
        setDynamicAttributes(draft.attributes || {})
        setSelectedStores(draft.target_stores || [])
        const draftSpecialPrice = draft.special_price || (draft.price && draft.price > 200 ? draft.price - 200 : undefined)
        setSellingPrice(draft.price || 0)
        setSpecialPrice(draftSpecialPrice)
        setSpecialPriceFrom(draft.special_price_from || today())
        setSpecialPriceTo(draft.special_price_to || fiveYearsFromNow())
        setWeight(draft.weight || 0.1)
        setLength(draft.pkg_length || 1)
        setWidth(draft.pkg_width || 1)
        setHeight(draft.pkg_height || 1)
        setSingleColorFamily(draft.attributes?.color_family || 'Not Specified')
        setSingleSize(draft.attributes?.size || '')

        // Restore variants if present in draft.attributes
        const attr = draft.attributes || {}
        const hasVar = Boolean(attr.has_variants || (attr.sku_rows && attr.sku_rows.length > 0) || (attr.variant1_values && attr.variant1_values.length > 0))
        setHasVariants(hasVar)
        if (hasVar) {
            setVariant1Name(attr.variant1_name || 'Color Family')
            setVariant1Values(Array.isArray(attr.variant1_values) ? attr.variant1_values : [])
            setVariant2Name(attr.variant2_name || 'Size')
            setVariant2Values(Array.isArray(attr.variant2_values) ? attr.variant2_values : [])
            setShowVariant2(Boolean(attr.variant2_values && attr.variant2_values.length > 0))
            setSkuRows(Array.isArray(attr.sku_rows) ? attr.sku_rows : [])
            setVariantImages((typeof attr.variant_images === 'object' && attr.variant_images !== null && !Array.isArray(attr.variant_images)) ? (attr.variant_images as Record<string, string[]>) : {})
            setAddVariantImages(Boolean(attr.add_variant_images || (attr.variant_images && Object.keys(attr.variant_images).length > 0)))
        } else {
            setVariant1Values([])
            setVariant2Values([])
            setSkuRows([])
            setShowVariant2(false)
            setVariantImages({})
            setAddVariantImages(false)
        }

        setViewMode('edit-single')
    }

    const handleBackToList = () => {
        setViewMode('list')
        setEditingDraftId(null)
        setAiCategorySuggestion(null)
        setSelectedSupplierId('')
        setWholesalePrice(undefined)
        setCampaignPrice(undefined)
        if (onClearPrefilled) onClearPrefilled()
        fetchDrafts()
    }

    // Helper to resolve category suggestions using OpenAI + client-side categories tree matching
    const resolveCategoryForName = async (productName: string): Promise<{ id: number; path: string } | null> => {
        try {
            const res = await fetch(`/api/daraz/categories/suggestion?productName=${encodeURIComponent(productName)}`)
            const json = await res.json()
            if (json.success && json.paths && json.paths.length > 0) {
                const suggestedPath = json.paths[0]
                
                // Traverse local category tree cached in sessionStorage
                const cached = sessionStorage.getItem('daraz_categories_tree')
                if (cached) {
                    const treeData = JSON.parse(cached)
                    const segments = suggestedPath.toLowerCase().split('>').map((s: string) => s.trim())
                    const leafName = segments[segments.length - 1]
                    const leafTokens = leafName.split(/\s+/).filter((t: string) => t.length > 2)

                    const candidates: Array<{ id: number; path: string; score: number }> = []

                    const traverse = (node: any, parentPath: string = '') => {
                        const currentPathName = parentPath ? `${parentPath} > ${node.name}` : node.name
                        if (node.leaf) {
                            const nodeLower = node.name.toLowerCase()
                            const nodePathLower = currentPathName.toLowerCase()
                            let score = 0

                            if (nodeLower === leafName) {
                                score = 200
                            } else if (nodeLower.includes(leafName) || leafName.includes(nodeLower)) {
                                score = 100
                            } else {
                                leafTokens.forEach((token: string) => {
                                    const regex = new RegExp(`\\b${token}s?\\b`, 'i')
                                    if (regex.test(nodeLower)) score += 20
                                    else if (nodeLower.includes(token)) score += 8
                                })
                            }

                            segments.slice(0, -1).forEach((seg: string, idx: number) => {
                                const segTokens = seg.split(/\s+/).filter((t: string) => t.length > 2)
                                segTokens.forEach((token: string) => {
                                    if (nodePathLower.includes(token)) {
                                        score += (idx === segments.length - 2) ? 15 : 5
                                    }
                                })
                            })

                            if (score > 0) {
                                candidates.push({ id: node.category_id, path: currentPathName, score })
                            }
                        } else if (node.children) {
                            node.children.forEach((child: any) => traverse(child, currentPathName))
                        }
                    }

                    treeData.forEach((root: any) => traverse(root))
                    candidates.sort((a, b) => b.score - a.score)
                    if (candidates.length > 0) {
                        return { id: candidates[0].id, path: candidates[0].path }
                    }
                }
            }
        } catch (err) {
            console.error('resolveCategoryForName error:', err)
        }
        return null
    }

    const pushSingleDraft = async (draft: DraftListing): Promise<{ success: boolean; summary?: string; error?: string }> => {
        let categoryId = draft.category_id
        let categoryPath = draft.category_path
        const primaryTitle = Object.values(draft.titles_per_store || {})[0] || draft.title || draft.raw_name

        // Auto-resolve category if missing
        if (!categoryId) {
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'pushing' } : d))
            const resolved = await resolveCategoryForName(primaryTitle)
            if (resolved) {
                categoryId = resolved.id
                categoryPath = resolved.path
                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: draft.id, category_id: resolved.id, category_path: resolved.path })
                })
            } else {
                const errMsg = 'Missing category (Auto-resolution failed)'
                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: draft.id, status: 'failed', error: errMsg })
                })
                setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'failed', error: errMsg } : d))
                return { success: false, error: errMsg }
            }
        }

        if (!draft.images || draft.images.length === 0) {
            const errMsg = 'Please add at least one image before pushing'
            await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: draft.id, status: 'failed', error: errMsg })
            })
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'failed', error: errMsg } : d))
            return { success: false, error: errMsg }
        }

        setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'pushing' } : d))

        try {
            const response = await fetch('/api/daraz/products/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeIds: draft.target_stores,
                    titlesPerStore: draft.titles_per_store,
                    primaryCategory: categoryId,
                    name: primaryTitle,
                    rawName: draft.raw_name,
                    shortDescription: (draft.highlights || []).map(h => `• ${h}`).join('\n'),
                    description: draft.description || '',
                    brand: 'No Brand',
                    attributes: draft.attributes || {},
                    supplier_id: draft.supplier_id || undefined,
                    wholesale_price: draft.wholesale_price || undefined,
                    sales_price: draft.special_price || undefined,
                    campaign_price: draft.campaign_price || (draft as any).attributes?.campaign_price || undefined,
                    skus: [{
                        price: draft.price || 100,
                        specialPrice: draft.special_price || undefined,
                        specialPriceFrom: draft.special_price_from,
                        specialPriceTo: draft.special_price_to,
                        quantity: 100,
                        packageWeight: draft.weight || 0.1,
                        packageLength: draft.pkg_length || 1,
                        packageWidth: draft.pkg_width || 1,
                        packageHeight: draft.pkg_height || 1,
                        images: draft.images.slice(0, 1),
                        color_family: 'Not Specified'
                    }],
                    images: draft.images
                })
            })
            const result = await response.json()
            if (result.success) {
                const anyFailed = result.results.some((r: any) => !r.success)
                const targetStatus = anyFailed ? 'failed' : 'pushed'
                
                let errorSummary = ''
                if (anyFailed) {
                    errorSummary = result.results.filter((r: any) => !r.success).map((r: any) => `${r.sellerAccount}: ${r.error}`).join('; ')
                }

                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: draft.id, status: targetStatus, error: errorSummary || null })
                })
                setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: targetStatus, category_id: categoryId, category_path: categoryPath, error: errorSummary || undefined } : d))
                const summary = result.results.map((r: any) => `${r.sellerAccount}: ${r.success ? '✅ Success' : `❌ ${r.error}`}`).join('\n')
                return { success: !anyFailed, summary }
            } else {
                throw new Error(result.error || 'API response failed')
            }
        } catch (err: any) {
            await fetch('/api/daraz/drafts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: draft.id, status: 'failed', error: err.message })
            })
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'failed', error: err.message } : d))
            return { success: false, error: err.message }
        }
    }

    const handleQuickPush = async (draft: DraftListing) => {
        const res = await pushSingleDraft(draft)
        if (res.success && res.summary) {
            alert(`Push Completed!\n\n${res.summary}`)
        } else if (res.error) {
            alert(`Push Failed:\n\n${res.error || res.summary}`)
        }
    }

    const handleBulkPush = async () => {
        const toPush = drafts.filter(d => selectedDraftIds.has(d.id) && d.status === 'generated')
        if (toPush.length === 0) return alert('No selected products are ready to push (pushed or draft status will be skipped)')
        if (!confirm(`Push all ${toPush.length} selected ready products to Daraz?`)) return

        setBulkPushing(true)
        let successCount = 0
        let failCount = 0

        for (const draft of toPush) {
            if (draft.status === 'pushing') continue
            const res = await pushSingleDraft(draft)
            if (res.success) {
                successCount++
            } else {
                failCount++
            }
        }

        setBulkPushing(false)
        setSelectedDraftIds(new Set())
        alert(`Bulk Push completed!\n\nSuccessfully Pushed: ${successCount}\nFailed: ${failCount}`)
    }

    // ── Form submit (push to Daraz from edit form) ────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedStores.length === 0) return alert('Select target accounts')
        if (!categoryId) return alert('Please select category')
        if (images.length === 0) return alert('Add at least one image')
        if (hasVariants && skuRows.length > 0) {
            const missingPrice = skuRows.find(r => !r.price || Number(r.price) <= 0)
            if (missingPrice) {
                return alert(`Please enter a price for variant ${missingPrice.colorFamily || missingPrice.size || 'item'}`)
            }
        } else if (sellingPrice <= 0) {
            return alert('Please enter a selling price')
        }

        setSubmitting(true)
        
        const submissionAttributes = {
            ...dynamicAttributes,
            ...(!hasVariants ? {
                color_family: singleColorFamily,
                size: singleSize || undefined
            } : {})
        }

        const validHighlights = highlights
            .filter(h => h.trim().length > 0)
            .map(h => h.replace(/^[•\-\*\s]+/, '').trim())
            .filter(Boolean)

        try {
            const finalSkus = (hasVariants && skuRows.length > 0)
                ? skuRows.filter(row => row.available !== false).map((row, i) => ({
                    sellerSku: row.sellerSku || `${rawName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 10).toUpperCase()}-${row.colorFamily || 'VAR'}-${row.size || i + 1}`,
                    price: Number(row.price),
                    specialPrice: row.specialPrice ? Number(row.specialPrice) : undefined,
                    specialPriceFrom: row.specialPrice ? (row.specialPriceFrom || specialPriceFrom) : undefined,
                    specialPriceTo: row.specialPrice ? (row.specialPriceTo || specialPriceTo) : undefined,
                    quantity: Number(row.quantity ?? 0),
                    packageWeight: weight,
                    packageLength: length,
                    packageWidth: width,
                    packageHeight: height,
                    images: row.images && row.images.length > 0 ? row.images : [],
                    color_family: row.colorFamily || 'Not Specified',
                    size: row.size || undefined
                }))
                : [{
                    sellerSku: singleSellerSku || `${rawName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 15).toUpperCase()}`,
                    price: Number(sellingPrice),
                    specialPrice: specialPrice ? Number(specialPrice) : undefined,
                    specialPriceFrom: specialPrice ? specialPriceFrom : undefined,
                    specialPriceTo: specialPrice ? specialPriceTo : undefined,
                    quantity: stock,
                    packageWeight: weight,
                    packageLength: length,
                    packageWidth: width,
                    packageHeight: height,
                    images: images.slice(0, 1),
                    color_family: singleColorFamily || 'Not Specified',
                    size: singleSize || undefined
                }]

            // Build final titles per store — fallback to rawName for stores without a manual/AI title
            const finalTitlesPerStore: Record<string, string> = {}
            selectedStores.forEach(storeId => {
                finalTitlesPerStore[storeId] = titlesPerStore[storeId] || titlesPerStore['__manual__'] || rawName
            })
            const primaryTitle = Object.values(finalTitlesPerStore)[0] || rawName

            const response = await fetch('/api/daraz/products/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeIds: selectedStores,
                    titlesPerStore: finalTitlesPerStore,
                    primaryCategory: categoryId,
                    name: primaryTitle,
                    rawName: rawName,
                    shortDescription: validHighlights.map(h => `• ${h}`).join('\n'),
                    description,
                    brand: dynamicAttributes.brand || 'No Brand',
                    attributes: submissionAttributes,
                    supplier_id: selectedSupplierId || undefined,
                    wholesale_price: wholesalePrice || undefined,
                    sales_price: specialPrice || undefined,
                    campaign_price: campaignPrice || undefined,
                    skus: finalSkus,
                    images
                })
            })

            const result = await response.json()
            if (!result.success) {
                const failSummary = result.error || result.results?.map((r: any) => `${r.sellerAccount}: ${r.error}`).join('; ') || 'Push to Daraz failed'
                throw new Error(failSummary)
            }
            if (result.success) {
                const anyFailed = result.results.some((r: any) => !r.success)
                const targetStatus = anyFailed ? 'failed' : 'pushed'
                
                let errorSummary: string | null = null
                if (anyFailed) {
                    errorSummary = result.results.filter((r: any) => !r.success).map((r: any) => `${r.sellerAccount}: ${r.error}`).join('; ')
                }

                const summary = result.results
                    .map((r: any) => `${r.sellerAccount}: ${r.success ? '✅ Success' : `❌ Failed (${r.error})`}`)
                    .join('\n')
                alert(`Push Completed!\n\n${summary}`)

                if (editingDraftId) {
                    await fetch('/api/daraz/drafts', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: editingDraftId,
                            product_link: singleProductLink.trim() || undefined,
                            status: targetStatus,
                            error: errorSummary,
                            titles_per_store: titlesPerStore,
                            description,
                            highlights: validHighlights,
                            attributes: submissionAttributes,
                            price: Number(sellingPrice) || null,
                            special_price: specialPrice ? Number(specialPrice) : null,
                            special_price_from: specialPrice ? specialPriceFrom : null,
                            special_price_to: specialPrice ? specialPriceTo : null,
                            weight,
                            pkg_length: length,
                            pkg_width: width,
                            pkg_height: height,
                            target_stores: selectedStores
                        })
                    })
                }
                handleBackToList()
            }
        } catch (err: any) {
            alert('Push failed: ' + err.message)
            if (editingDraftId) {
                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingDraftId,
                        status: 'failed',
                        error: err.message,
                        titles_per_store: titlesPerStore,
                        description,
                        highlights: validHighlights,
                        attributes: submissionAttributes,
                        price: Number(sellingPrice) || null,
                        special_price: specialPrice ? Number(specialPrice) : null,
                        special_price_from: specialPrice ? specialPriceFrom : null,
                        special_price_to: specialPrice ? specialPriceTo : null,
                        weight,
                        pkg_length: length,
                        pkg_width: width,
                        pkg_height: height,
                        target_stores: selectedStores
                    })
                })
            }
        } finally {
            setSubmitting(false)
        }
    }



    // ── Status badge helper ───────────────────────────────────────────────────
    const statusBadge = (status: DraftListing['status'], draft?: DraftListing) => {
        if (status === 'generating') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border border-blue-100/50 dark:border-blue-900/20">
                    <Loader2 className="inline animate-spin mr-1 shrink-0" size={10} />
                    AI Writing...
                </span>
            )
        }
        if (status === 'pushing') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border border-amber-100/50 dark:border-amber-900/20">
                    <Loader2 className="inline animate-spin mr-1 shrink-0" size={10} />
                    Pushing...
                </span>
            )
        }
        if (status === 'failed') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border border-rose-100/50 dark:border-rose-900/20">
                    Not Pushed
                </span>
            )
        }
        if (status === 'pushed') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-100/50 dark:border-indigo-900/20">
                    ✓ Pushed
                </span>
            )
        }

        const classification = draft ? getDraftClassification(draft) : (status === 'generated' ? 'ready' : 'pending')

        if (status === 'generated' || classification === 'ready') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/30">
                    <Sparkles size={10} className="shrink-0 text-emerald-600" />
                    Ready Draft
                </span>
            )
        }
        if (classification === 'image_only') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/30">
                    <Camera size={10} className="shrink-0 text-purple-600" />
                    Image Only
                </span>
            )
        }
        if (classification === 'link_only') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/30">
                    <ExternalLink size={10} className="shrink-0 text-blue-600" />
                    Product Link Only
                </span>
            )
        }
        if (classification === 'name_only') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/30">
                    <FileText size={10} className="shrink-0 text-amber-600" />
                    Product Name Only
                </span>
            )
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/30">
                <Clock size={10} className="shrink-0 text-orange-600" />
                Pending Draft
            </span>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW 1: DRAFTS LIST
    // ═══════════════════════════════════════════════════════════════════════
    if (viewMode === 'list') {
        return (
            <div className="space-y-4">
                {/* Status Tabs Bar */}
                <div className="flex border-b border-gray-200 dark:border-zinc-800 overflow-x-auto gap-4 scrollbar-none bg-white dark:bg-zinc-900 p-2 rounded-t-lg shadow-xs">
                    {statusTabs.map(tab => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => {
                                setStatusFilter(tab.value)
                                setCurrentPage(1)
                            }}
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

                {/* Filter & Action Bar */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Search Field */}
                        <div className="relative min-w-[240px] flex-1 max-w-sm">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                <Search size={16} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by Product Name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setCurrentPage(1)
                                }}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-zinc-700 rounded-md text-sm bg-gray-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>

                        {/* Store Account Switcher */}
                        <select
                            value={storeFilter}
                            onChange={(e) => {
                                setStoreFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="py-2 px-3 border border-gray-200 dark:border-zinc-700 rounded-md text-sm bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                        >
                            <option value="">All Seller Accounts</option>
                            {stores.map(s => (
                                <option key={s.id} value={s.id}>{s.seller_account}</option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => fetchDrafts()}
                            disabled={draftsLoading}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                            title="Refresh List"
                        >
                            <RefreshCw size={16} className={draftsLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow"
                        >
                            <Plus size={16} />
                            Add Product
                            <ChevronDown size={14} />
                        </button>

                        {isAddMenuOpen && (
                            <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md shadow-lg z-50 divide-y divide-gray-100 dark:divide-zinc-800 text-xs">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingDraftId(null)
                                        setRawName(''); setTitlesPerStore({}); setImages([])
                                        setDescription(''); setHighlights(['']); setCategoryId(null)
                                        setCategoryPath(''); setSellingPrice(0); setSpecialPrice(undefined)
                                        setSelectedSupplierId(''); setWholesalePrice(undefined); setCampaignPrice(undefined)
                                        setSpecialPriceFrom(today()); setSpecialPriceTo(fiveYearsFromNow())
                                        setDynamicAttributes({}); setAiCategorySuggestion(null)
                                        setViewMode('add-single'); setIsAddMenuOpen(false)
                                    }}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 font-medium"
                                >
                                    ✦ Single Add
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartBulkAdd}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 font-medium"
                                >
                                    ⊞ Bulk Add
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bulk action bar */}
                {(() => {
                    const selectedDraftsList = drafts.filter(d => selectedDraftIds.has(d.id));
                    const readyToPushCount = selectedDraftsList.filter(d => d.status === 'generated').length;
                    const draftsToGenerateCount = selectedDraftsList.filter(d => d.status === 'draft' || d.status === 'failed').length;

                    return selectedDraftIds.size > 0 && (
                        <div className="rounded-xl p-3 bg-amber-50/70 dark:bg-amber-950/10 border border-amber-200/50 flex justify-between items-center shadow-sm">
                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                                <Info size={14} className="text-amber-600 dark:text-amber-500" />
                                {selectedDraftIds.size} Selected | {readyToPushCount} Ready to Push
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleBulkGenerateContent}
                                    disabled={bulkGenerating || bulkPushing || draftsToGenerateCount === 0}
                                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shadow-sm transition-all"
                                >
                                    {bulkGenerating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                    Generate AI Content ({draftsToGenerateCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkPush}
                                    disabled={bulkGenerating || bulkPushing || readyToPushCount === 0}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shadow-sm transition-all"
                                >
                                    {bulkPushing ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                                    Push Selected ({readyToPushCount})
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {/* Drafts Card List */}
                <div className="space-y-3">
                    {draftsLoading ? (
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-12 text-center text-gray-400 shadow-xs">
                            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={24} />
                            Loading draft listings...
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-12 text-center text-gray-400 italic shadow-xs">
                            No draft listings. Click "Add Product" to get started.
                        </div>
                    ) : (
                        (() => {
                        const filteredDrafts = drafts.filter(draft => {
                            // 1. Status & Classification Filter
                            if (statusFilter !== 'all') {
                                const classification = getDraftClassification(draft)
                                if (statusFilter === 'pushed') {
                                    if (draft.status !== 'pushed' && classification !== 'pushed') return false
                                } else if (statusFilter === 'ready') {
                                    if (draft.status !== 'generated' && classification !== 'ready') return false
                                } else if (statusFilter === 'image_only') {
                                    if (classification !== 'image_only') return false
                                } else if (statusFilter === 'link_only') {
                                    if (classification !== 'link_only') return false
                                } else if (statusFilter === 'pending') {
                                    if (classification !== 'pending' && classification !== 'name_only' && classification !== 'image_only' && classification !== 'link_only') return false
                                }
                            }

                            // 2. Store Filter
                            if (storeFilter) {
                                const hasStore = draft.target_stores && draft.target_stores.some(st => 
                                    st === storeFilter || 
                                    stores.find(s => s.id === storeFilter)?.seller_account?.toLowerCase() === st?.toLowerCase()
                                )
                                if (!hasStore) return false
                            }

                            // 3. Search Query
                            if (searchQuery.trim()) {
                                const q = searchQuery.toLowerCase()
                                const matchRaw = draft.raw_name?.toLowerCase().includes(q)
                                const matchTitle = draft.title?.toLowerCase().includes(q)
                                const matchCategory = draft.category_path?.toLowerCase().includes(q)
                                if (!matchRaw && !matchTitle && !matchCategory) return false
                            }

                            return true
                        })

                        if (filteredDrafts.length === 0) {
                            return (
                                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-12 text-center text-gray-400 shadow-xs">
                                    <p className="font-medium text-gray-600 dark:text-zinc-300 text-sm">No listings found matching the selected filters.</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStatusFilter('all')
                                            setStoreFilter('')
                                            setSearchQuery('')
                                            setCurrentPage(1)
                                        }}
                                        className="mt-3 px-3 py-1.5 text-xs text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            )
                        }

                        const getStatusGroupPriority = (status: string) => {
                            switch (status) {
                                case 'draft':
                                case 'generating':
                                    return 1;
                                case 'generated':
                                case 'failed':
                                    return 2;
                                case 'pushing':
                                case 'pushed':
                                    return 3;
                                default:
                                    return 4;
                            }
                        };

                        const sortedDrafts = [...filteredDrafts].sort((a, b) => {
                            const priorityA = getStatusGroupPriority(a.status);
                            const priorityB = getStatusGroupPriority(b.status);
                            if (priorityA !== priorityB) {
                                return priorityA - priorityB;
                            }
                            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                        });

                        const ITEMS_PER_PAGE = 50;
                        const totalPages = Math.ceil(sortedDrafts.length / ITEMS_PER_PAGE) || 1;
                        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                        const paginatedDrafts = sortedDrafts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                        return (
                            <>
                                {paginatedDrafts.map(draft => (
                                        <div 
                                            key={draft.id} 
                                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-xs hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-200 relative"
                                        >
                                            {/* Selection Checkbox */}
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDraftIds.has(draft.id)}
                                                    onChange={(e) => {
                                                        const next = new Set(selectedDraftIds)
                                                        if (e.target.checked) next.add(draft.id)
                                                        else next.delete(draft.id)
                                                        setSelectedDraftIds(next)
                                                    }}
                                                    className="w-4 h-4 text-orange-500 border-gray-300 dark:border-zinc-700 rounded focus:ring-orange-500 cursor-pointer"
                                                />
                                            </div>

                                            {/* Product Image - Click opens Gallery & Desktop Upload */}
                                            <div 
                                                onClick={() => {
                                                    setImageModalDraft(draft)
                                                    setModalImages(draft.images ? [...draft.images] : [])
                                                }}
                                                className="relative flex-none cursor-pointer group"
                                                title="Click to view & edit all photos"
                                            >
                                                <img
                                                    src={draft.images?.[0] || '/placeholder.png'}
                                                    alt="Preview"
                                                    className="w-16 h-16 rounded object-cover border border-gray-200 dark:border-zinc-800 bg-gray-50 transition-transform group-hover:scale-105 group-hover:shadow-md"
                                                />
                                                <div className="absolute inset-0 bg-black/35 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                    <Pencil size={14} />
                                                </div>
                                                {draft.images && draft.images.length > 1 && (
                                                    <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] text-white px-1 rounded font-bold">
                                                        +{draft.images.length - 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Main info columns */}
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center min-w-0">
                                                
                                                {/* Column 1: Names + Copy Button for Daraz Title */}
                                                <div className="min-w-0 flex flex-col justify-center">
                                                    <span className="font-bold text-gray-800 dark:text-zinc-200 block truncate text-sm" title={draft.raw_name}>
                                                        {draft.raw_name}
                                                    </span>
                                                    <div className="text-xs mt-1 flex items-center min-w-0">
                                                        {draft.title ? (
                                                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium min-w-0 max-w-full">
                                                                <Sparkles size={12} className="shrink-0 text-amber-500" />
                                                                <span className="truncate" title={draft.title}>{draft.title}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        navigator.clipboard.writeText(draft.title || '')
                                                                        setCopiedTitleId(draft.id)
                                                                        setTimeout(() => setCopiedTitleId(null), 2000)
                                                                    }}
                                                                    className="shrink-0 p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 rounded transition-colors"
                                                                    title={copiedTitleId === draft.id ? 'Copied!' : 'Copy Daraz Title'}
                                                                >
                                                                    {copiedTitleId === draft.id ? (
                                                                        <Check size={12} className="text-emerald-500" />
                                                                    ) : (
                                                                        <Copy size={12} />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="italic text-gray-400 text-xs">AI Content Not Generated</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Column 2: Category & Attributes + Edit Icon */}
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span 
                                                            onClick={() => handleOpenCategoryModal(draft)}
                                                            className="text-xs font-semibold text-gray-700 dark:text-zinc-300 truncate cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                                                            title="Click to edit category & specifications"
                                                        >
                                                            {draft.category_path || 'No Category Selected'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleOpenCategoryModal(draft)
                                                            }}
                                                            className="shrink-0 p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                            title="Edit Category & Product Specifications"
                                                        >
                                                            <Pencil size={11} />
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {draft.target_stores && draft.target_stores.map(storeId => {
                                                            const sName = stores.find(s => s.id === storeId)?.seller_account || 'Account'
                                                            return (
                                                                <span key={storeId} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30 rounded font-medium transition-all hover:bg-amber-100/50 dark:hover:bg-amber-950/40">
                                                                    <Store size={10} className="shrink-0 text-amber-600 dark:text-amber-500" />
                                                                    {sName}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                    {(() => {
                                                        const pLink = draft.product_link || draft.attributes?.product_link
                                                        if (!pLink) return null
                                                        let hostname = 'link'
                                                        try {
                                                            hostname = new URL(pLink).hostname.replace('www.', '')
                                                        } catch {
                                                            hostname = 'link'
                                                        }
                                                        return (
                                                            <a
                                                                href={pLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline max-w-[220px] truncate mt-1 bg-blue-50/50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30"
                                                                title={pLink}
                                                            >
                                                                <ExternalLink size={10} className="shrink-0" />
                                                                <span>{hostname}</span>
                                                            </a>
                                                        )
                                                    })()}
                                                </div>

                                                {/* Column 3: Price (Regular & Special) + Edit Icon */}
                                                <div className="flex flex-col md:items-center justify-center min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="flex flex-col md:items-center">
                                                            {draft.special_price ? (
                                                                <div className="flex items-baseline gap-1.5">
                                                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                                        NPR {draft.special_price}
                                                                    </span>
                                                                    <span className="text-[11px] text-gray-400 line-through">
                                                                        NPR {draft.price || 0}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                                                    {draft.price ? `NPR ${draft.price}` : 'Price: N/A'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleOpenPriceModal(draft)
                                                            }}
                                                            className="shrink-0 p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                            title="Edit Regular & Special Price"
                                                        >
                                                            <Pencil size={11} />
                                                        </button>
                                                    </div>
                                                    <div className="mt-1">
                                                        {statusBadge(draft.status, draft)}
                                                    </div>
                                                    {draft.status === 'failed' && draft.error && (
                                                        <div className="mt-1.5 text-[10px] text-rose-600 dark:text-rose-400 md:text-center max-w-[220px] bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/10 px-2 py-1 rounded leading-tight font-medium hover:max-w-none transition-all duration-200 cursor-help" title={draft.error}>
                                                            {draft.error}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>

                                            {/* Action Buttons Column */}
                                            <div className="flex-none flex sm:flex-col items-stretch justify-center gap-1.5 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-zinc-800 pt-3 sm:pt-0 sm:pl-4 min-w-[110px]">
                                                {/* 1. Draft/Failed/Generating Status Action Group */}
                                                {(draft.status === 'draft' || draft.status === 'failed' || draft.status === 'generating') && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSingleGenerate(draft)}
                                                            disabled={draft.status === 'generating' || generatingId === draft.id}
                                                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition-all flex items-center gap-1.5 text-xs font-semibold justify-center disabled:opacity-50 shadow-sm"
                                                            title="Generate AI Content"
                                                        >
                                                            {draft.status === 'generating' || generatingId === draft.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <Sparkles size={12} />
                                                            )}
                                                            Generate AI
                                                        </button>
                                                        <div className="relative w-full">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveDropdownId(activeDropdownId === draft.id ? null : draft.id)}
                                                                className={`w-full px-2.5 py-1.5 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold justify-start ${activeDropdownId === draft.id ? 'bg-gray-100 text-gray-700 dark:bg-zinc-800' : ''}`}
                                                                title="More Actions"
                                                            >
                                                                <MoreVertical size={14} />
                                                                More
                                                            </button>
                                                            
                                                            {activeDropdownId === draft.id && (
                                                                <div className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mt-1 mb-1 sm:mb-0 w-28 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1 text-xs text-left">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleEditDraft(draft);
                                                                            setActiveDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center gap-1.5 font-medium"
                                                                    >
                                                                        <Edit3 size={12} />
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleDeleteDraft(draft.id);
                                                                            setActiveDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 flex items-center gap-1.5 font-medium"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {/* 2. Ready (Generated) Status Action Group */}
                                                {draft.status === 'generated' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickPush(draft)}
                                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all flex items-center gap-1.5 text-xs font-semibold justify-center shadow-sm"
                                                            title="Push to Daraz"
                                                        >
                                                            <Send size={12} />
                                                            Push
                                                        </button>
                                                        <div className="relative w-full">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveDropdownId(activeDropdownId === draft.id ? null : draft.id)}
                                                                className={`w-full px-2.5 py-1.5 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold justify-start ${activeDropdownId === draft.id ? 'bg-gray-100 text-gray-700 dark:bg-zinc-800' : ''}`}
                                                                title="More Actions"
                                                            >
                                                                <MoreVertical size={14} />
                                                                More
                                                            </button>
                                                            
                                                            {activeDropdownId === draft.id && (
                                                                <div className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mt-1 mb-1 sm:mb-0 w-28 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1 text-xs text-left">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleEditDraft(draft);
                                                                            setActiveDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center gap-1.5 font-medium"
                                                                    >
                                                                        <Edit3 size={12} />
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleDeleteDraft(draft.id);
                                                                            setActiveDropdownId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 flex items-center gap-1.5 font-medium"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {/* 3. Pushed Status Action Group (No Edit, only Delete) */}
                                                {(draft.status === 'pushed' || draft.status === 'pushing') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteDraft(draft.id)}
                                                        disabled={draft.status === 'pushing'}
                                                        className="px-2.5 py-1.5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 text-gray-600 dark:text-zinc-400 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold justify-center disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Pagination Controls */}
                                    {sortedDrafts.length > ITEMS_PER_PAGE && (
                                        <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-lg shadow-sm mt-4">
                                            <span className="text-xs text-gray-500">
                                                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sortedDrafts.length)} of {sortedDrafts.length} listings
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                    className="px-3 py-1.5 border rounded text-xs bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 disabled:opacity-50 font-medium"
                                                >
                                                    Previous
                                                </button>
                                                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                                                    Page {currentPage} of {totalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                    className="px-3 py-1.5 border rounded text-xs bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 disabled:opacity-50 font-medium"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()
                    )}
                
                {/* ── 1. Image Gallery & Desktop Upload Modal ──────────────── */}
                {imageModalDraft && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                        Product Photos
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30">
                                            {modalImages.length}/8
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-0.5 max-w-md min-w-0">
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate" title={imageModalDraft.title || imageModalDraft.raw_name}>
                                            {imageModalDraft.title || imageModalDraft.raw_name}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const textToCopy = imageModalDraft.title || imageModalDraft.raw_name || ''
                                                navigator.clipboard.writeText(textToCopy)
                                                setCopiedTitleId('modal-img-' + imageModalDraft.id)
                                                setTimeout(() => setCopiedTitleId(null), 2000)
                                            }}
                                            className="shrink-0 p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors"
                                            title={copiedTitleId === 'modal-img-' + imageModalDraft.id ? 'Copied!' : 'Copy Product Title'}
                                        >
                                            {copiedTitleId === 'modal-img-' + imageModalDraft.id ? (
                                                <Check size={12} className="text-emerald-500" />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                        </button>
                                        {copiedTitleId === 'modal-img-' + imageModalDraft.id && (
                                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                Copied!
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setImageModalDraft(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Gallery Content */}
                            <div className="p-5 overflow-y-auto flex-1 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {modalImages.map((url, idx) => (
                                        <div
                                            key={idx}
                                            className={`relative group rounded-lg overflow-hidden border-2 bg-gray-50 dark:bg-zinc-800 aspect-square ${
                                                idx === 0 ? 'border-orange-500 shadow-sm' : 'border-gray-200 dark:border-zinc-700'
                                            }`}
                                        >
                                            <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />

                                            {idx === 0 && (
                                                <span className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                                    Main
                                                </span>
                                            )}

                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalImages(prev => prev.filter((_, i) => i !== idx))
                                                        }}
                                                        className="p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-xs transition-colors"
                                                        title="Delete photo"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                                {idx !== 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [url, ...modalImages.filter((_, i) => i !== idx)]
                                                            setModalImages(updated)
                                                        }}
                                                        className="w-full py-1 bg-white/90 hover:bg-white text-gray-900 text-[10px] font-bold rounded shadow-xs transition-colors"
                                                    >
                                                        Set as Main
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Upload from Desktop Tile */}
                                    {modalImages.length < 8 && (
                                        <label className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/10 hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer aspect-square p-3 transition-colors ${
                                            imageModalUploading ? 'opacity-60 pointer-events-none' : ''
                                        }`}>
                                            {imageModalUploading ? (
                                                <Loader2 size={24} className="animate-spin text-orange-600 mb-1" />
                                            ) : (
                                                <Upload size={22} className="text-orange-600 dark:text-orange-400 mb-1" />
                                            )}
                                            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300 text-center">
                                                {imageModalUploading ? 'Uploading...' : 'Add Photos'}
                                            </span>
                                            <span className="text-[9px] text-orange-600/70 dark:text-orange-400/70 text-center">
                                                from Desktop
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                disabled={imageModalUploading}
                                                onChange={handleModalDesktopUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>

                                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                                    💡 The first photo is your Daraz cover image. Up to 8 photos supported. Hover on any photo to delete or set as Main.
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                                <button
                                    type="button"
                                    onClick={() => setImageModalDraft(null)}
                                    disabled={imageModalSaving}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveModalImages}
                                    disabled={imageModalSaving || imageModalUploading}
                                    className="px-4 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    {imageModalSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    Save Photos
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── 2. Category & Product Specifications Modal ───────────── */}
                {categoryModalDraft && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                                        Edit Category & Product Specifications
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-0.5 max-w-lg min-w-0">
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate" title={categoryModalDraft.title || categoryModalDraft.raw_name}>
                                            {categoryModalDraft.title || categoryModalDraft.raw_name}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const textToCopy = categoryModalDraft.title || categoryModalDraft.raw_name || ''
                                                navigator.clipboard.writeText(textToCopy)
                                                setCopiedTitleId('modal-cat-' + categoryModalDraft.id)
                                                setTimeout(() => setCopiedTitleId(null), 2000)
                                            }}
                                            className="shrink-0 p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors"
                                            title={copiedTitleId === 'modal-cat-' + categoryModalDraft.id ? 'Copied!' : 'Copy Product Title'}
                                        >
                                            {copiedTitleId === 'modal-cat-' + categoryModalDraft.id ? (
                                                <Check size={12} className="text-emerald-500" />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                        </button>
                                        {copiedTitleId === 'modal-cat-' + categoryModalDraft.id && (
                                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                Copied!
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCategoryModalDraft(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Category Picker */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        Category Selection
                                    </label>
                                    <CategoryPicker
                                        productName={categoryModalDraft.raw_name || categoryModalDraft.title || ''}
                                        selectedCategoryId={editCatId}
                                        selectedCategoryPath={editCatPath}
                                        onSelectCategory={(id, path) => {
                                            setEditCatId(id)
                                            setEditCatPath(path)
                                        }}
                                    />
                                </div>

                                {/* Dynamic Attributes */}
                                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                        Product Specifications & Key Attributes
                                    </label>
                                    {editCatId ? (
                                        <div className="bg-gray-50/50 dark:bg-zinc-800/30 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
                                            <DynamicAttributesForm
                                                categoryId={editCatId}
                                                values={editAttributes}
                                                onChange={(k, v) => setEditAttributes(prev => ({ ...prev, [k]: v }))}
                                                onLoadSaleProps={() => {}}
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-xs text-gray-400 italic bg-gray-50 dark:bg-zinc-800/30 rounded-lg border border-dashed border-gray-200 dark:border-zinc-800">
                                            Please select a category above to configure specifications.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                                <button
                                    type="button"
                                    onClick={() => setCategoryModalDraft(null)}
                                    disabled={categoryModalSaving}
                                    className="px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCategoryModal}
                                    disabled={categoryModalSaving}
                                    className="px-5 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    {categoryModalSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    Save Specifications
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── 3. Quick Price Editor Modal ─────────────────────────── */}
                {priceModalDraft && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-sm w-full flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                                        Edit Price
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-0.5 max-w-[240px] min-w-0">
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate" title={priceModalDraft.title || priceModalDraft.raw_name}>
                                            {priceModalDraft.title || priceModalDraft.raw_name}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const textToCopy = priceModalDraft.title || priceModalDraft.raw_name || ''
                                                navigator.clipboard.writeText(textToCopy)
                                                setCopiedTitleId('modal-price-' + priceModalDraft.id)
                                                setTimeout(() => setCopiedTitleId(null), 2000)
                                            }}
                                            className="shrink-0 p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors"
                                            title={copiedTitleId === 'modal-price-' + priceModalDraft.id ? 'Copied!' : 'Copy Product Title'}
                                        >
                                            {copiedTitleId === 'modal-price-' + priceModalDraft.id ? (
                                                <Check size={12} className="text-emerald-500" />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                        </button>
                                        {copiedTitleId === 'modal-price-' + priceModalDraft.id && (
                                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                Copied!
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPriceModalDraft(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Inputs */}
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                                        Regular Selling Price (NPR) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={editRegularPrice}
                                        onChange={(e) => setEditRegularPrice(e.target.value)}
                                        placeholder="e.g. 1000"
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                                            Special / Discount Price (NPR)
                                        </label>
                                        <span className="text-[10px] text-gray-400">Optional</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={editSpecialPrice}
                                        onChange={(e) => setEditSpecialPrice(e.target.value)}
                                        placeholder="e.g. 850 (leave empty if none)"
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    />
                                    {editSpecialPrice && Number(editSpecialPrice) >= Number(editRegularPrice) && Number(editRegularPrice) > 0 && (
                                        <p className="text-[11px] text-amber-600 mt-1">
                                            ⚠️ Special price is usually lower than regular price.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                                <button
                                    type="button"
                                    onClick={() => setPriceModalDraft(null)}
                                    disabled={priceModalSaving}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePriceModal}
                                    disabled={priceModalSaving}
                                    className="px-4 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    {priceModalSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    Save Price
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW 2: BULK ADD FORM
    // ═══════════════════════════════════════════════════════════════════════
    if (viewMode === 'add-bulk') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-lg shadow-sm">
                    <button type="button" onClick={handleBackToList} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-base font-bold">Bulk Add Raw Listings</h2>
                        <p className="text-xs text-gray-500">Enter multiple product names + images. AI will generate content in bulk after saving.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-4">
                        {bulkRows.map((row, idx) => (
                            <div
                                key={row.id}
                                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4 transition-all"
                            >
                                {/* Top Header: Index Badge, Status Badge, Competitor Link + Extract Button, and Delete */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 font-bold text-xs">
                                            #{idx + 1}
                                        </span>
                                        {(() => {
                                            const hasImg = row.images && row.images.length > 0
                                            const hasLnk = Boolean(row.productLink && row.productLink.trim().length > 0)
                                            const hasNm = Boolean(row.rawName && row.rawName.trim().length > 0)
                                            if (hasImg && !hasLnk && !hasNm) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200" title="Image Only">📷 Img Only</span>
                                            if (hasLnk && !hasImg && !hasNm) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200" title="Link Only">🔗 Link Only</span>
                                            if (hasNm && !hasImg && !hasLnk) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200" title="Name Only">📝 Name Only</span>
                                            if (hasNm || hasImg || hasLnk) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200" title="Pending Draft">⏳ Draft</span>
                                            return null
                                        })()}
                                        {row.extractedCategory?.path && (
                                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 truncate max-w-[200px]" title={row.extractedCategory.path}>
                                                ✓ {row.extractedCategory.path.split('>').pop()?.trim()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Competitor URL Input with Extract & Delete */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:max-w-xl sm:ml-auto">
                                        <div className="relative flex-1 flex gap-1.5">
                                            <input
                                                type="url"
                                                value={row.productLink || ''}
                                                onChange={(e) => {
                                                    const next = [...bulkRows]
                                                    next[idx].productLink = e.target.value
                                                    setBulkRows(next)
                                                }}
                                                placeholder="Auto-fill from Competitor URL (Daraz, Amazon, etc.)"
                                                className="flex-1 h-8 px-2.5 border border-gray-300 dark:border-zinc-700 rounded-md text-xs bg-gray-50/50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-850 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                disabled={row.isExtracting || !row.productLink?.trim()}
                                                onClick={() => handleExtractRowLink(idx)}
                                                className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-1 shrink-0 transition-all shadow-xs"
                                                title="Auto-extract name, price, images, and category"
                                            >
                                                {row.isExtracting ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Zap size={11} />
                                                        Extract
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {bulkRows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setBulkRows(bulkRows.filter(r => r.id !== row.id))}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors shrink-0"
                                                title="Remove this product"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Section 1: Product Raw Name + Target Accounts */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                                    <div className="lg:col-span-7 space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                            Product Raw Name
                                            <span className="text-[10px] text-gray-400 font-normal">(Optional if link or images provided)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={row.rawName}
                                            onChange={(e) => {
                                                const next = [...bulkRows]
                                                next[idx].rawName = e.target.value
                                                setBulkRows(next)
                                            }}
                                            placeholder="e.g. Zodiac Bracelet Watch Gold Tone"
                                            className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-orange-500 focus:outline-none font-medium"
                                        />
                                    </div>

                                    <div className="lg:col-span-5 space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                            Target Seller Accounts
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {stores.map(store => {
                                                const active = row.targetStores.includes(store.id)
                                                return (
                                                    <button
                                                        key={store.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const next = [...bulkRows]
                                                            const target = next[idx].targetStores
                                                            next[idx].targetStores = target.includes(store.id)
                                                                ? target.filter(id => id !== store.id)
                                                                : [...target, store.id]
                                                            setBulkRows(next)
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                                                            active
                                                                ? 'bg-orange-500/10 text-orange-600 border-orange-500 shadow-xs'
                                                                : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-gray-700'
                                                        }`}
                                                    >
                                                        {store.seller_account}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: 4-Col Pricing & Supplier Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/70 dark:bg-zinc-850/40 p-3.5 rounded-lg border border-gray-200/80 dark:border-zinc-800">
                                    {/* Supplier */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                            Supplier
                                        </label>
                                        <SearchableSupplierSelect
                                            suppliers={suppliers}
                                            value={row.supplier_id || ''}
                                            onChange={(val) => {
                                                const next = [...bulkRows]
                                                next[idx].supplier_id = val || undefined
                                                setBulkRows(next)
                                            }}
                                            placeholder="Search Supplier..."
                                        />
                                    </div>

                                    {/* Wholesale Price */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                            Wholesale Price (NPR)
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="Cost Price"
                                            value={row.wholesale_price || ''}
                                            onChange={(e) => {
                                                const next = [...bulkRows]
                                                const val = e.target.value ? Number(e.target.value) : undefined
                                                next[idx].wholesale_price = val
                                                setBulkRows(next)
                                            }}
                                            className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                                        />
                                    </div>

                                    {/* Sales Price (Special Price) */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                                Sales Price (NPR)
                                                <span className="text-[10px] text-orange-600 font-normal ml-1">(Special)</span>
                                            </label>
                                            {row.price ? (
                                                <span className="text-[10px] font-semibold text-orange-600">Listed: {row.price}</span>
                                            ) : null}
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Special Price"
                                            value={row.special_price || ''}
                                            onChange={(e) => {
                                                const next = [...bulkRows]
                                                const val = e.target.value ? Number(e.target.value) : undefined
                                                next[idx].special_price = val
                                                next[idx].price = (val && val > 0) ? val + 200 : undefined
                                                setBulkRows(next)
                                            }}
                                            className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                                        />
                                    </div>

                                    {/* Campaign Price */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                            Campaign Price (NPR)
                                            <span className="text-[10px] text-purple-600 font-semibold ml-1">(Optional)</span>
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="Campaign Price"
                                            value={row.campaign_price || ''}
                                            onChange={(e) => {
                                                const next = [...bulkRows]
                                                const val = e.target.value ? Number(e.target.value) : undefined
                                                next[idx].campaign_price = val
                                                setBulkRows(next)
                                            }}
                                            className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Section 3: Product Images Strip */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <span>Images</span>
                                            <span className="text-[10px] text-gray-400 font-normal">(Drag to reorder - first image is Primary)</span>
                                        </label>
                                        <span className="text-[11px] text-gray-400">{row.images.length}/8 images</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {row.images.map((img, imgIdx) => (
                                            <div 
                                                key={imgIdx} 
                                                draggable
                                                onDragStart={() => {
                                                    setBulkDragSourceRowId(row.id);
                                                    setBulkDragImageIdx(imgIdx);
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (bulkDragSourceRowId === row.id) {
                                                        setBulkDragOverIdx(imgIdx);
                                                    }
                                                }}
                                                onDragLeave={() => setBulkDragOverIdx(null)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (bulkDragSourceRowId !== row.id || bulkDragImageIdx === null || bulkDragImageIdx === imgIdx) return;
                                                    
                                                    const next = [...bulkRows];
                                                    const reordered = [...row.images];
                                                    const [moved] = reordered.splice(bulkDragImageIdx, 1);
                                                    reordered.splice(imgIdx, 0, moved);
                                                    
                                                    next[idx].images = reordered;
                                                    setBulkRows(next);
                                                    
                                                    setBulkDragSourceRowId(null);
                                                    setBulkDragImageIdx(null);
                                                    setBulkDragOverIdx(null);
                                                }}
                                                onDragEnd={() => {
                                                    setBulkDragSourceRowId(null);
                                                    setBulkDragImageIdx(null);
                                                    setBulkDragOverIdx(null);
                                                }}
                                                className={`relative w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-lg overflow-hidden group cursor-grab active:cursor-grabbing transition-all ${
                                                    bulkDragSourceRowId === row.id && bulkDragOverIdx === imgIdx 
                                                        ? 'border-orange-500 scale-105 shadow-md' 
                                                        : imgIdx === 0 
                                                            ? 'border-orange-500 shadow-xs' 
                                                            : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300'
                                                }`}
                                            >
                                                <img src={img} className="w-full h-full object-cover" alt="" />
                                                
                                                {/* Primary badge */}
                                                {imgIdx === 0 && (
                                                    <span className="absolute top-0 left-0 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br shadow-xs select-none">
                                                        Primary
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = [...bulkRows]
                                                        next[idx].images = next[idx].images.filter((_, i) => i !== imgIdx)
                                                        setBulkRows(next)
                                                    }}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 text-white flex items-center justify-center text-sm font-bold transition-opacity"
                                                    title="Remove image"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {row.images.length < 8 && (
                                            <label className="w-16 h-16 sm:w-20 sm:h-20 border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-orange-500 hover:bg-orange-50/20 transition-all shrink-0">
                                                {bulkUploadingId === row.id
                                                    ? <Loader2 className="animate-spin text-orange-500" size={16} />
                                                    : <Upload className="text-gray-400 group-hover:text-orange-500 transition-colors" size={16} />
                                                }
                                                <span className="text-[10px] text-gray-400 font-medium">Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={(e) => handleBulkImageUpload(row.id, e)}
                                                    className="hidden"
                                                    disabled={!!bulkUploadingId}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => setBulkRows([...bulkRows, {
                                id: crypto.randomUUID(),
                                rawName: '',
                                images: [],
                                targetStores: stores.length > 0 ? [stores[0].id] : [],
                                price: undefined,
                                special_price: undefined,
                                campaign_price: undefined,
                                supplier_id: undefined,
                                wholesale_price: undefined
                            }])}
                            className="px-3.5 py-2 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg font-bold flex items-center gap-1.5 text-xs text-gray-700 dark:text-zinc-200 transition-colors"
                        >
                            <Plus size={14} /> Add Another Product
                        </button>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleBackToList}
                                className="px-4 py-2 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveBulkDrafts}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white rounded-lg font-bold shadow-xs text-xs transition-all flex items-center gap-1.5"
                            >
                                <Check size={14} />
                                Save Drafts ({bulkRows.filter(r => r.rawName.trim() || r.productLink?.trim() || r.images.length > 0).length})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW 3: FULL ADD / EDIT FORM
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-5">
            {/* Merged Header & AI Generator Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-xl shadow-sm">
                {/* 1. Left: Back Arrow, Title & Subtitle */}
                <div className="flex items-center gap-3">
                    <button type="button" onClick={handleBackToList} className="p-2 hover:bg-orange-50 dark:hover:bg-zinc-800 rounded-full text-gray-500 hover:text-orange-600 transition-all">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                            {viewMode === 'edit-single' ? '✎ Edit & Configure Listing' : '✦ New Product Listing'}
                        </h2>
                        <p className="text-xs flex items-center gap-1 mt-0.5">
                            {savingDraft && <span className="flex items-center gap-1 text-orange-500 font-medium"><Loader2 className="animate-spin" size={10} /> Auto-saving draft...</span>}
                            {!savingDraft && editingDraftId && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={10} /> Draft saved in database</span>}
                            {!editingDraftId && !savingDraft && <span className="text-gray-400">Name your product to auto-save as draft</span>}
                        </p>
                    </div>
                </div>

                {/* 2. Middle: AI Generator */}
                <div className="flex flex-wrap items-center gap-2.5 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/30 px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                        <Sparkles size={14} />
                        AI Generator
                    </span>
                    <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="py-1 px-2.5 border border-orange-200 dark:border-zinc-700 rounded-md text-xs bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-400 font-medium"
                    >
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4o">GPT-4o (Vision)</option>
                    </select>
                    <button
                        type="button"
                        onClick={handleAIGenerate}
                        disabled={generating || !rawName}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shadow-sm transition-all"
                    >
                        {generating ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        {generating ? 'Generating...' : 'Generate Content'}
                    </button>
                </div>

                {/* 3. Right: Live Draft */}
                <div className="flex items-center gap-2 text-xs text-gray-400 self-end lg:self-center">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span>Live Draft</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Wholesale Pricing & Supplier Card (Internal Inventory & Target Pricing) */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-5 shadow-xs">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                Wholesale Price &amp; Supplier
                                <span className="text-xs font-normal text-gray-400 dark:text-zinc-500">(Optional - Internal Inventory &amp; Target Pricing)</span>
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                Link a supplier and prices for internal inventory tracking and profit calculation on Daraz Average Sales Price.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Supplier Dropdown */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
                                    Supplier
                                </label>
                                <SearchableSupplierSelect
                                    suppliers={suppliers}
                                    value={selectedSupplierId}
                                    onChange={(val) => {
                                        setSelectedSupplierId(val)
                                        patchDraft({ supplier_id: val || undefined })
                                    }}
                                    placeholder="Search & Select Supplier (Optional)"
                                />
                            </div>

                            {/* Wholesale Price Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
                                    Wholesale Price (NPR)
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 350"
                                    value={wholesalePrice || ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : undefined
                                        setWholesalePrice(val)
                                        patchDraft({ wholesale_price: val })
                                    }}
                                    className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-medium"
                                />
                            </div>

                            {/* Sales Price (Special Price) Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
                                    Sales Price (NPR)
                                    <span className="text-[10px] text-orange-600 font-semibold ml-1">(Special Price)</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 500"
                                    value={specialPrice !== undefined && specialPrice !== null ? specialPrice : ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : undefined
                                        setSpecialPrice(val)
                                        if (val && (!sellingPrice || sellingPrice <= val)) {
                                            setSellingPrice(val + 200)
                                        }
                                        patchDraft({ special_price: val })
                                    }}
                                    className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-medium"
                                />
                                {specialPrice && sellingPrice ? (
                                    <p className="text-[10px] text-gray-400 truncate">Listed Price: NPR {sellingPrice}</p>
                                ) : null}
                            </div>

                            {/* Campaign Price Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
                                    Campaign Price (NPR)
                                    <span className="text-[10px] text-purple-600 font-semibold ml-1">(Optional)</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 450"
                                    value={campaignPrice !== undefined && campaignPrice !== null ? campaignPrice : ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : undefined
                                        setCampaignPrice(val)
                                        patchDraft({ campaign_price: val })
                                    }}
                                    className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Basic Information */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-xs">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                Basic Information
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                Provide basic details, target seller accounts, product title, and images.
                            </p>
                        </div>

                        {/* Seller Accounts */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                Target Seller Accounts <span className="text-red-500 font-bold">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {stores.map(store => (
                                    <button
                                        key={store.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedStores(prev =>
                                                prev.includes(store.id)
                                                    ? prev.filter(id => id !== store.id)
                                                    : [...prev, store.id]
                                            )
                                        }}
                                        className={`h-8 px-3 rounded-md text-xs font-medium border transition-all ${selectedStores.includes(store.id)
                                            ? 'bg-orange-500/10 text-orange-600 border-orange-500 font-bold'
                                            : 'bg-white dark:bg-zinc-850 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-400'
                                            }`}
                                    >
                                        {store.seller_account}
                                    </button>
                                ))}
                            </div>
                            {selectedStores.length > 1 && (
                                <p className="text-xs text-orange-600 font-medium">
                                    ✦ AI will generate {selectedStores.length} unique SEO titles — one per store
                                </p>
                            )}
                        </div>

                        {/* Competitor Link Auto-fill */}
                        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg space-y-1.5">
                            <label className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                                <LinkIcon size={13} className="text-blue-600 dark:text-blue-400" />
                                Auto-fill from Competitor Product Link
                                <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-normal">(Daraz, Amazon, Alibaba, AliExpress, etc.)</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="Paste competitor URL (e.g. https://www.daraz.com.np/products/...)"
                                    value={singleProductLink}
                                    onChange={(e) => setSingleProductLink(e.target.value)}
                                    className="flex-1 h-9 px-3 border border-blue-200 dark:border-blue-800 rounded-md text-xs bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    disabled={singleIsExtracting || !singleProductLink.trim()}
                                    onClick={handleSingleExtractLink}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                                >
                                    {singleIsExtracting ? (
                                        <>
                                            <Loader2 size={13} className="animate-spin" />
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={13} />
                                            Extract ⚡
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Raw Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                Product Raw Name <span className="text-red-500 font-bold">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Zodiac Constellation Charm Bracelet"
                                value={rawName}
                                onChange={(e) => setRawName(e.target.value)}
                                onBlur={handleRawNameBlur}
                                className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-normal"
                                required
                            />
                            <p className="text-[11px] text-gray-400">Saved automatically as draft when you leave this field</p>
                        </div>

                        {/* Product Title / Name on Daraz — always visible */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                    Product Title (Name on Daraz) <span className="text-red-500 font-bold">*</span>
                                </label>
                                <span className="text-[11px] text-gray-400">
                                    {((activeTitleStoreId || selectedStores[0]) ? (titlesPerStore[activeTitleStoreId || selectedStores[0]] || '') : '').length}/255
                                </span>
                            </div>

                            {/* Per-store tabs — only when multiple stores */}
                            {selectedStores.length > 1 && (
                                <div className="flex gap-1 border-b dark:border-zinc-800">
                                    {selectedStores.map(storeId => {
                                        const store = stores.find(s => s.id === storeId)
                                        return (
                                            <button
                                                key={storeId}
                                                type="button"
                                                onClick={() => setActiveTitleStoreId(storeId)}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-t transition-all ${
                                                    (activeTitleStoreId || selectedStores[0]) === storeId
                                                        ? 'bg-orange-500 text-white'
                                                        : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                }`}
                                            >
                                                {store?.seller_account || storeId}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Title input — always shown */}
                            {(() => {
                                const storeId = activeTitleStoreId || selectedStores[0]
                                const titleVal = (storeId && titlesPerStore[storeId])
                                    ? titlesPerStore[storeId]
                                    : (titlesPerStore['__manual__'] || Object.values(titlesPerStore)[0] || '')
                                return (
                                    <div className="space-y-1">
                                        {selectedStores.length > 1 && storeId && (
                                            <span className="text-[10px] text-gray-400">
                                                {stores.find(s => s.id === storeId)?.seller_account}
                                            </span>
                                        )}
                                        <input
                                            type="text"
                                            value={titleVal}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (storeId) {
                                                    setTitlesPerStore(prev => ({ ...prev, [storeId]: val, '__manual__': val }))
                                                } else {
                                                    setTitlesPerStore(prev => ({ ...prev, '__manual__': val }))
                                                }
                                            }}
                                            maxLength={255}
                                            placeholder={rawName ? `e.g. ${rawName} — Premium Quality...` : 'Enter the product title that will appear on Daraz'}
                                            className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-normal"
                                        />
                                        <p className="text-[11px] text-gray-400">
                                            {Object.keys(titlesPerStore).length > 0
                                                ? <span className="text-orange-500 font-medium">✦ AI-generated title — you can edit it</span>
                                                : 'Type manually or click "Generate Content" to auto-generate an SEO-optimized title'
                                            }
                                        </p>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Category Picker with auto-select */}
                        <CategoryPicker
                            productName={Object.values(titlesPerStore).filter(t => t && t !== '').join(' ') || rawName || ''}
                            selectedCategoryId={categoryId}
                            selectedCategoryPath={categoryPath}
                            onSelectCategory={(id, path) => {
                                setCategoryId(id)
                                setCategoryPath(path)
                                setAiCategorySuggestion(null) // clear after selection
                                patchDraft({ category_id: id, category_path: path })
                            }}
                            autoSelectCategoryPath={aiCategorySuggestion}
                        />

                        {/* Images — Draggable + Primary Badge */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                Product Images <span className="text-red-500 font-bold">* (Add min 3)</span>
                                {images[0] && aiModel === 'gpt-4o' && (
                                    <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950/20 px-1.5 py-0.5 rounded font-semibold">
                                        AI Vision: Reading image ✓
                                    </span>
                                )}
                            </label>
                            <p className="text-xs text-gray-400">Drag to reorder. First image is your <strong>primary listing image</strong>.</p>
                            <div className="flex flex-wrap gap-3">
                                {images.map((img, idx) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={() => setDragImageIdx(idx)}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
                                        onDragLeave={() => setDragOverIdx(null)}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            if (dragImageIdx === null || dragImageIdx === idx) return
                                            const reordered = [...images]
                                            const [moved] = reordered.splice(dragImageIdx, 1)
                                            reordered.splice(idx, 0, moved)
                                            setImages(reordered)
                                            setDragImageIdx(null)
                                            setDragOverIdx(null)
                                        }}
                                        onDragEnd={() => { setDragImageIdx(null); setDragOverIdx(null) }}
                                        className={`relative w-20 h-20 group border-2 rounded overflow-hidden cursor-grab active:cursor-grabbing transition-all
                                            ${dragOverIdx === idx ? 'border-orange-500 scale-105' : idx === 0 ? 'border-orange-400' : 'border-gray-200 dark:border-zinc-700'}`}
                                    >
                                        <img src={img} className="w-full h-full object-cover" alt="" />
                                        {/* Primary badge */}
                                        {idx === 0 && (
                                            <span className="absolute top-0 left-0 bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-br">
                                                Primary
                                            </span>
                                        )}
                                        {/* Drag indicator */}
                                        <span className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-80 transition-opacity">
                                            <svg width="12" height="12" viewBox="0 0 16 16" fill="white"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-80 flex items-center justify-center text-white transition-opacity pt-4"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {images.length < 8 && (
                                    <label className="w-20 h-20 rounded border-2 border-dashed border-gray-300 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors">
                                        {uploadingImage
                                            ? <Loader2 className="animate-spin text-gray-400" size={20} />
                                            : <><Upload className="text-gray-400" size={20} /><span className="text-[10px] text-gray-400 font-semibold mt-1">Upload</span></>
                                        }
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Product Specification */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                    Product Specification
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    Category-specific attributes and key properties required by Daraz.
                                </p>
                            </div>
                            {categoryId && (
                                <span className="text-xs bg-[#f8f9fa] dark:bg-zinc-850 text-orange-600 dark:text-orange-400 font-semibold px-2.5 py-1 rounded-md border border-gray-200 dark:border-zinc-700">
                                    {categoryPath.split(' > ').slice(-2).join(' > ')}
                                </span>
                            )}
                        </div>

                        {categoryId ? (
                            <DynamicAttributesForm
                                categoryId={categoryId}
                                values={dynamicAttributes}
                                onChange={(key, val) => {
                                    const next = { ...dynamicAttributes, [key]: val }
                                    setDynamicAttributes(next)
                                    if (editingDraftId) {
                                        patchDraft({ attributes: next })
                                    }
                                }}
                                onLoadSaleProps={(props) => setSaleProps(props)}
                                onLoadAttributesSchema={(schema) => setAttributesSchema(schema)}
                            />
                        ) : (
                            <div className="p-5 bg-[#f8f9fa] dark:bg-zinc-850/50 text-center rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 space-y-1">
                                <Info className="text-gray-400 mx-auto mb-1" size={18} />
                                <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">Select category above to load specification fields</p>
                                <p className="text-[11px] text-gray-400">AI will auto-suggest a category when you click "Generate Content"</p>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Price, Stock & Variants (Daraz Seller Center Design) */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-xs">
                        {/* Section Header */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                Price, Stock &amp; Variants
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                You can add variants to a product that has more than one option, such as size or color.
                            </p>
                        </div>

                        {/* Variant 1 Card */}
                        <div className="bg-[#f8f9fa] dark:bg-zinc-850/50 border border-gray-200/90 dark:border-zinc-800 rounded-lg p-5 sm:p-6 space-y-4">
                            {/* Variant 1 Info Header */}
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-1">
                                    <span className="text-red-500 font-bold">*</span> Variant1
                                </div>
                                <div className="text-xs text-gray-500 dark:text-zinc-400 font-normal">Variant Name</div>
                                <div className="text-xs font-medium text-gray-800 dark:text-zinc-200">
                                    {variant1Name || 'Color Family'}
                                </div>
                                <div className="text-xs text-gray-400 font-normal">
                                    Spot a missing attribute value?{' '}
                                    <button
                                        type="button"
                                        onClick={() => variant1InputRef.current?.focus()}
                                        className="text-blue-500 hover:text-blue-600 hover:underline"
                                    >
                                        click me
                                    </button>
                                </div>
                            </div>

                            {/* Total Variants & Add Image Checkbox */}
                            <div className="space-y-2.5 pt-1">
                                <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                                    Total Variants
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                                    <input
                                        type="checkbox"
                                        checked={addVariantImages}
                                        onChange={(e) => setAddVariantImages(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                    />
                                    <span className="text-gray-700 dark:text-zinc-300 font-normal">Add Image</span>
                                    <span className="text-gray-400 text-xs font-normal">Max 8 images for each variant.</span>
                                </label>

                                {/* Dotted Container for Tags and Input */}
                                <div className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-md p-3.5 bg-white dark:bg-zinc-900 space-y-3">
                                    {/* Integrated Input Box with Tags */}
                                    <div className="flex flex-wrap items-center gap-1.5 p-1.5 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-850 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all min-h-[38px]">
                                        {variant1Values.map(val => (
                                            <span
                                                key={val}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#f0f2f5] dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs font-medium text-gray-800 dark:text-zinc-200"
                                            >
                                                {val}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = variant1Values.filter(v => v !== val)
                                                        setVariant1Values(next)
                                                        if (next.length === 0 && variant2Values.length === 0) setHasVariants(false)
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}

                                        <input
                                            ref={variant1InputRef}
                                            type="text"
                                            list="variant1-standard-options"
                                            placeholder={variant1Values.length === 0 ? "Please type or select" : "Type more or select..."}
                                            value={variantInputText}
                                            onChange={(e) => setVariantInputText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    const val = variantInputText.trim()
                                                    if (val && !variant1Values.includes(val)) {
                                                        setVariant1Values([...variant1Values, val])
                                                        setHasVariants(true)
                                                        setVariantInputText('')
                                                    }
                                                }
                                            }}
                                            className="flex-1 min-w-[140px] border-none outline-none text-xs bg-transparent text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 py-1 px-1.5"
                                        />

                                        {variantInputText.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = variantInputText.trim()
                                                    if (val && !variant1Values.includes(val)) {
                                                        setVariant1Values([...variant1Values, val])
                                                        setHasVariants(true)
                                                        setVariantInputText('')
                                                    }
                                                }}
                                                className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium shrink-0"
                                            >
                                                Add
                                            </button>
                                        )}
                                    </div>

                                    <datalist id="variant1-standard-options">
                                        {availableV1Options
                                            .filter((opt: string) => !variant1Values.includes(opt))
                                            .map((opt: string) => (
                                                <option key={opt} value={opt} />
                                            ))}
                                    </datalist>

                                    {/* Quick Select Chips */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-xs text-gray-400 font-normal mr-1">Quick Select:</span>
                                        {availableV1Options
                                            .filter((opt: string) => !variant1Values.includes(opt))
                                            .slice(0, 14)
                                            .map((opt: string) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => {
                                                        setVariant1Values([...variant1Values, opt])
                                                        setHasVariants(true)
                                                    }}
                                                    className="px-2 py-0.5 rounded text-xs bg-gray-50 dark:bg-zinc-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 hover:border-orange-300 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition-colors"
                                                >
                                                    + {opt}
                                                </button>
                                            ))}
                                    </div>
                                </div>

                                {/* Per-Variant Image Uploaders (Shown when Add Image is enabled) */}
                                {addVariantImages && variant1Values.length > 0 && (
                                    <div className="pt-3 space-y-3">
                                        <div className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                                            Variant Images (Max 8 per variant)
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {variant1Values.map(val => {
                                                const currentImgs = variantImages[val] || []
                                                return (
                                                    <div key={val} className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{val}</span>
                                                            <span className="text-[11px] text-gray-400">{currentImgs.length}/8 images</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {currentImgs.map((imgUrl, imgIdx) => (
                                                                <div key={imgIdx} className="relative w-12 h-12 rounded border dark:border-zinc-700 overflow-hidden group">
                                                                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveVariantImage(val, imgIdx)}
                                                                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {currentImgs.length < 8 && (
                                                                <label className="w-12 h-12 border border-dashed border-gray-300 dark:border-zinc-700 rounded flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 text-gray-400 hover:text-orange-500 transition-colors">
                                                                    <Upload size={14} />
                                                                    <span className="text-[9px] mt-0.5">Upload</span>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0]
                                                                            if (file) handleVariantImageUpload(val, file)
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Optional Variant 2 Card (e.g. Size) */}
                        {showVariant2 ? (
                            <div className="bg-[#f8f9fa] dark:bg-zinc-850/50 border border-gray-200/90 dark:border-zinc-800 rounded-lg p-5 sm:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                                            Variant 2
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-400">Variant Name: <span className="font-medium text-gray-800 dark:text-zinc-200">{variant2Name || 'Size'}</span></div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowVariant2(false)
                                            setVariant2Values([])
                                        }}
                                        className="text-xs text-red-500 hover:underline font-medium"
                                    >
                                        Remove Variant 2
                                    </button>
                                </div>

                                <div className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-md p-3.5 bg-white dark:bg-zinc-900 space-y-3">
                                    <div className="flex flex-wrap items-center gap-1.5 p-1.5 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-850 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all min-h-[38px]">
                                        {variant2Values.map(val => (
                                            <span
                                                key={val}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#f0f2f5] dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs font-medium text-gray-800 dark:text-zinc-200"
                                            >
                                                {val}
                                                <button
                                                    type="button"
                                                    onClick={() => setVariant2Values(variant2Values.filter(v => v !== val))}
                                                    className="text-gray-400 hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}

                                        <input
                                            ref={variant2InputRef}
                                            type="text"
                                            list="variant2-standard-options"
                                            placeholder={variant2Values.length === 0 ? "Please type or select size" : "Type more or select size..."}
                                            value={variant2InputText}
                                            onChange={(e) => setVariant2InputText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    const val = variant2InputText.trim()
                                                    if (val && !variant2Values.includes(val)) {
                                                        setVariant2Values([...variant2Values, val])
                                                        setVariant2InputText('')
                                                    }
                                                }
                                            }}
                                            className="flex-1 min-w-[140px] border-none outline-none text-xs bg-transparent text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 py-1 px-1.5"
                                        />

                                        {variant2InputText.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = variant2InputText.trim()
                                                    if (val && !variant2Values.includes(val)) {
                                                        setVariant2Values([...variant2Values, val])
                                                        setVariant2InputText('')
                                                    }
                                                }}
                                                className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium shrink-0"
                                            >
                                                Add
                                            </button>
                                        )}
                                    </div>

                                    <datalist id="variant2-standard-options">
                                        {availableV2Options
                                            .filter((opt: string) => !variant2Values.includes(opt))
                                            .map((opt: string) => (
                                                <option key={opt} value={opt} />
                                            ))}
                                    </datalist>

                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-xs text-gray-400 font-normal mr-1">Quick Select:</span>
                                        {availableV2Options
                                            .filter((opt: string) => !variant2Values.includes(opt))
                                            .slice(0, 12)
                                            .map((opt: string) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setVariant2Values([...variant2Values, opt])}
                                                    className="px-2 py-0.5 rounded text-xs bg-gray-50 dark:bg-zinc-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 hover:border-orange-300 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition-colors"
                                                >
                                                    + {opt}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowVariant2(true)}
                                className="px-3.5 py-2 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-orange-500 text-gray-600 dark:text-zinc-400 hover:text-orange-600 hover:bg-orange-50/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <Plus size={14} /> Add Second Variant ({variant2Name || 'Size'})
                            </button>
                        )}

                        {/* Price & Stock Section */}
                        <div className="space-y-3 pt-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-1">
                                    <span className="text-red-500 font-bold">*</span> Price &amp; Stock
                                </h4>

                                {skuRows.length > 1 && (
                                    <span className="text-xs text-gray-400">
                                        {skuRows.length} variant combinations
                                    </span>
                                )}
                            </div>

                            {/* Batch Edit Bar */}
                            {skuRows.length > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#f8f9fa] dark:bg-zinc-850/60 rounded-md border border-gray-200 dark:border-zinc-800">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">Batch Edit:</span>
                                        <div className="relative w-32">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                value={batchPrice}
                                                onChange={(e) => setBatchPrice(e.target.value)}
                                                className="w-full pl-9 pr-2.5 py-1.5 h-8 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500"
                                            />
                                        </div>
                                        <div className="relative w-32">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                            <input
                                                type="number"
                                                placeholder="Special Price"
                                                value={batchSpecialPrice}
                                                onChange={(e) => setBatchSpecialPrice(e.target.value)}
                                                className="w-full pl-9 pr-2.5 py-1.5 h-8 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <input
                                                type="number"
                                                placeholder="Stock"
                                                value={batchStock}
                                                onChange={(e) => setBatchStock(e.target.value)}
                                                className="w-full px-2.5 py-1.5 h-8 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleBatchApply}
                                            className="px-3.5 py-1.5 h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded text-xs font-semibold shadow-2xs transition-all"
                                        >
                                            Apply to All
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-gray-400 font-normal">Apply common price/stock to all variants</span>
                                </div>
                            )}

                            {/* Daraz Seller Center Style Table */}
                            <div className="border border-gray-200 dark:border-zinc-800 rounded-md overflow-x-auto bg-white dark:bg-zinc-900">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-[#f8f9fa] dark:bg-zinc-800/70 font-semibold border-b border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300">
                                        <tr>
                                            {skuRows.length > 0 && (
                                                <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 w-44 font-semibold">
                                                    Variant
                                                </th>
                                            )}
                                            <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 w-36 font-semibold">
                                                <span className="text-red-500 font-bold mr-0.5">*</span> Price
                                            </th>
                                            <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 w-36 font-semibold">
                                                Special Price
                                            </th>
                                            <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 w-28 font-semibold">
                                                Stock <span className="text-gray-400 font-normal text-[11px]">ⓘ</span>
                                            </th>
                                            <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 min-w-[200px] font-semibold">
                                                SellerSKU
                                            </th>
                                            <th className="py-3 px-3.5 border-r border-gray-200 dark:border-zinc-800 min-w-[160px] font-semibold">
                                                Free Items
                                            </th>
                                            <th className="py-3 px-3.5 text-center w-28 font-semibold">
                                                Availability
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                        {skuRows.length > 0 ? (
                                            /* Multi-variant Rows */
                                            skuRows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/40 dark:hover:bg-zinc-850/30 transition-colors">
                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        <div className="flex items-center gap-2.5">
                                                            {row.images && row.images.length > 0 && (
                                                                <img src={row.images[0]} alt="" className="w-9 h-9 rounded border border-gray-200 dark:border-zinc-750 object-cover shrink-0 bg-gray-50" />
                                                            )}
                                                            <div className="leading-tight">
                                                                <div className="font-semibold text-gray-800 dark:text-zinc-100 text-xs">
                                                                    {row.colorFamily || 'Standard'}
                                                                </div>
                                                                {row.size && (
                                                                    <div className="text-[11px] text-gray-400 font-normal mt-0.5">
                                                                        Size: {row.size}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                                            <input
                                                                type="number"
                                                                value={row.price || ''}
                                                                onChange={(e) => {
                                                                    const n = [...skuRows]
                                                                    n[idx].price = Number(e.target.value)
                                                                    setSkuRows(n)
                                                                }}
                                                                placeholder="0"
                                                                className="w-full pl-9 pr-3 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                                required
                                                            />
                                                        </div>
                                                    </td>

                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        {row.specialPrice !== undefined ? (
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                                                <input
                                                                    type="number"
                                                                    value={row.specialPrice || ''}
                                                                    onChange={(e) => {
                                                                        const n = [...skuRows]
                                                                        n[idx].specialPrice = e.target.value ? Number(e.target.value) : undefined
                                                                        setSkuRows(n)
                                                                    }}
                                                                    placeholder="Special"
                                                                    className="w-full pl-9 pr-6 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    title="Remove special price"
                                                                    onClick={() => {
                                                                        const n = [...skuRows]
                                                                        n[idx].specialPrice = undefined
                                                                        setSkuRows(n)
                                                                    }}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold leading-none p-0.5"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const n = [...skuRows]
                                                                    n[idx].specialPrice = n[idx].price && n[idx].price > 100 ? n[idx].price - 50 : 0
                                                                    setSkuRows(n)
                                                                }}
                                                                className="text-xs text-blue-500 hover:text-blue-600 font-medium hover:underline py-1 px-1.5"
                                                            >
                                                                Add
                                                            </button>
                                                        )}
                                                    </td>

                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        <input
                                                            type="number"
                                                            value={row.quantity ?? ''}
                                                            onChange={(e) => {
                                                                const n = [...skuRows]
                                                                n[idx].quantity = Number(e.target.value)
                                                                setSkuRows(n)
                                                            }}
                                                            placeholder="0"
                                                            className="w-full px-3 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                            required
                                                        />
                                                    </td>

                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={row.sellerSku || ''}
                                                                maxLength={200}
                                                                onChange={(e) => {
                                                                    const n = [...skuRows]
                                                                    n[idx].sellerSku = e.target.value
                                                                    setSkuRows(n)
                                                                }}
                                                                placeholder="Seller SKU"
                                                                className="w-full pl-3 pr-14 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none select-none">
                                                                {(row.sellerSku || '').length}/200
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                        <input
                                                            type="text"
                                                            value={row.freeItems || ''}
                                                            onChange={(e) => {
                                                                const n = [...skuRows]
                                                                n[idx].freeItems = e.target.value
                                                                setSkuRows(n)
                                                            }}
                                                            placeholder=""
                                                            className="w-full px-3 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500"
                                                        />
                                                    </td>

                                                    <td className="p-3 text-center align-middle">
                                                        <div className="flex justify-center items-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const n = [...skuRows]
                                                                    n[idx].available = !(n[idx].available ?? true)
                                                                    setSkuRows(n)
                                                                }}
                                                                className={`w-10 h-5 inline-flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                                                                    (row.available ?? true) ? 'bg-orange-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                                                                }`}
                                                                title={(row.available ?? true) ? 'Available' : 'Unavailable'}
                                                            >
                                                                <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            /* Single-Item Row (No Variants Added Yet) */
                                            <tr className="hover:bg-gray-50/40 dark:hover:bg-zinc-850/30 transition-colors">
                                                <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                                        <input
                                                            type="number"
                                                            value={sellingPrice || ''}
                                                            onChange={(e) => setSellingPrice(Number(e.target.value))}
                                                            placeholder="0"
                                                            className="w-full pl-9 pr-3 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                            required
                                                        />
                                                    </div>
                                                </td>

                                                <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                    {specialPrice !== undefined ? (
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-normal">Rs.</span>
                                                            <input
                                                                type="number"
                                                                value={specialPrice || ''}
                                                                onChange={(e) => setSpecialPrice(e.target.value ? Number(e.target.value) : undefined)}
                                                                placeholder="Special"
                                                                className="w-full pl-9 pr-6 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                            />
                                                            <button
                                                                type="button"
                                                                title="Remove special price"
                                                                onClick={() => setSpecialPrice(undefined)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold leading-none p-0.5"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSpecialPrice(sellingPrice && sellingPrice > 100 ? sellingPrice - 50 : 0)}
                                                            className="text-xs text-blue-500 hover:text-blue-600 font-medium hover:underline py-1 px-1.5"
                                                        >
                                                            Add
                                                        </button>
                                                    )}
                                                </td>

                                                <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                    <input
                                                        type="number"
                                                        value={stock ?? ''}
                                                        onChange={(e) => setStock(Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full px-3 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-medium"
                                                        required
                                                    />
                                                </td>

                                                <td className="p-3 border-r border-gray-200 dark:border-zinc-800 align-middle">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={singleSellerSku || (rawName ? `${rawName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 15).toUpperCase()}` : '')}
                                                            maxLength={200}
                                                            onChange={(e) => setSingleSellerSku(e.target.value)}
                                                            placeholder="Seller SKU"
                                                            className="w-full pl-3 pr-14 py-1.5 h-9 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 font-mono"
                                                        />
                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none select-none">
                                                            {(singleSellerSku || rawName || '').length}/200
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="text"
                                                        value={singleFreeItems}
                                                        onChange={(e) => setSingleFreeItems(e.target.value)}
                                                        placeholder=""
                                                        className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-850 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </td>

                                                <td className="p-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSingleAvailable(!singleAvailable)}
                                                        className={`w-11 h-6 inline-flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                                                            singleAvailable ? 'bg-orange-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                                                        }`}
                                                        title={singleAvailable ? 'Available' : 'Unavailable'}
                                                    >
                                                        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Product Description */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-xs">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                Product Description
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                Add rich product details, formatting, specifications, and highlights.
                            </p>
                        </div>

                        {/* Main Description */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
                                Main Description
                            </label>
                            <div className="border border-gray-300 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-900 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-colors shadow-xs">
                                {/* Daraz Toolbar */}
                                <div className="bg-[#f8f9fa] dark:bg-zinc-850 border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 select-none">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
                                        {/* Font size */}
                                        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-zinc-600">
                                            <span className="font-medium text-xs">11</span>
                                            <ChevronDown size={12} className="text-gray-400" />
                                        </div>

                                        <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-700" />

                                        {/* Alignments */}
                                        <button
                                            type="button"
                                            title="Align Left"
                                            onClick={() => setDescAlign('left')}
                                            className={`p-1.5 rounded transition-colors ${descAlign === 'left' ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100' : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                                        >
                                            <AlignLeft size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            title="Align Center"
                                            onClick={() => setDescAlign('center')}
                                            className={`p-1.5 rounded transition-colors ${descAlign === 'center' ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100' : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                                        >
                                            <AlignCenter size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            title="Align Right"
                                            onClick={() => setDescAlign('right')}
                                            className={`p-1.5 rounded transition-colors ${descAlign === 'right' ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100' : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                                        >
                                            <AlignRight size={15} />
                                        </button>

                                        <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-700" />

                                        {/* Lists */}
                                        <button
                                            type="button"
                                            title="Bulleted List"
                                            onClick={() => {
                                                setDescription(prev => prev ? prev + '\n<ul>\n  <li></li>\n</ul>' : '<ul>\n  <li></li>\n</ul>')
                                            }}
                                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 hover:text-gray-800 dark:text-zinc-400 transition-colors"
                                        >
                                            <List size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            title="Numbered List"
                                            onClick={() => {
                                                setDescription(prev => prev ? prev + '\n<ol>\n  <li></li>\n</ol>' : '<ol>\n  <li></li>\n</ol>')
                                            }}
                                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 hover:text-gray-800 dark:text-zinc-400 transition-colors"
                                        >
                                            <ListOrdered size={15} />
                                        </button>

                                        <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-700" />

                                        {/* Image */}
                                        <button
                                            type="button"
                                            title="Insert Image"
                                            onClick={() => {
                                                const url = prompt('Enter image URL:')
                                                if (url) {
                                                    setDescription(prev => prev + `\n<p><img src="${url}" alt="Product" style="max-width:100%;" /></p>`)
                                                }
                                            }}
                                            className="flex items-center gap-0.5 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 hover:text-gray-800 dark:text-zinc-400 transition-colors"
                                        >
                                            <ImageIcon size={15} />
                                            <ChevronDown size={11} className="text-gray-400" />
                                        </button>
                                    </div>

                                    {/* Right side tools */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                                            className={`border text-xs px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors ${
                                                isAdvancedMode
                                                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                                    : 'border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                                            }`}
                                        >
                                            <Maximize2 size={12} />
                                            <span>Advanced Mode</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDesc(!previewDesc)}
                                            className={`border text-xs px-3 py-1 rounded font-medium transition-colors ${
                                                previewDesc
                                                    ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-sm'
                                                    : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            {previewDesc ? 'Editor' : 'Preview'}
                                        </button>
                                    </div>
                                </div>

                                {/* Textarea or Preview */}
                                {previewDesc ? (
                                    <div
                                        className={`p-4 prose dark:prose-invert max-w-none text-xs bg-gray-50/50 dark:bg-zinc-900/30 overflow-y-auto ${
                                            isAdvancedMode ? 'min-h-[400px]' : 'min-h-[220px]'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: description || '<p class="text-gray-400 dark:text-zinc-500 italic">No description content to preview</p>'
                                        }}
                                    />
                                ) : (
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Please input"
                                        style={{ textAlign: descAlign }}
                                        className={`w-full p-3.5 text-xs text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none resize-y leading-relaxed font-sans ${
                                            isAdvancedMode ? 'min-h-[400px]' : 'min-h-[220px]'
                                        }`}
                                        required
                                    />
                                )}
                            </div>
                        </div>

                        {/* Highlights */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                <span className="text-red-500 font-bold">*</span> Highlights
                            </label>
                            <div className="border border-gray-300 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-900 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-colors shadow-xs">
                                {/* Daraz Toolbar */}
                                <div className="bg-[#f8f9fa] dark:bg-zinc-850 border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-between select-none">
                                    <button
                                        type="button"
                                        title="Bulleted List"
                                        className="p-1.5 rounded bg-white dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-600 cursor-default"
                                    >
                                        <List size={14} />
                                    </button>
                                    <span className="text-[11px] text-gray-400">
                                        {highlights.filter(h => h.trim()).length} point{highlights.filter(h => h.trim()).length === 1 ? '' : 's'} (1 per line)
                                    </span>
                                </div>

                                {/* Highlights Textarea */}
                                <textarea
                                    value={highlights.join('\n')}
                                    onChange={(e) => {
                                        setHighlights(e.target.value.split('\n'))
                                    }}
                                    placeholder="Please input bullet points..."
                                    rows={6}
                                    className="w-full p-3.5 min-h-[140px] text-xs text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none resize-y leading-relaxed font-sans"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Shipping & Package */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-xs">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                Shipping &amp; Package
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                Enter package weight, dimensions, and dangerous goods classification.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Weight (kg)', val: weight, set: setWeight, step: '0.01' },
                                { label: 'Length (cm)', val: length, set: setLength, step: '1' },
                                { label: 'Width (cm)', val: width, set: setWidth, step: '1' },
                                { label: 'Height (cm)', val: height, set: setHeight, step: '1' },
                            ].map(({ label, val, set, step }) => (
                                <div key={label} className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                                        {label} <span className="text-red-500 font-bold">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step={step}
                                        value={val}
                                        onChange={(e) => set(Number(e.target.value))}
                                        className="w-full h-9 px-3 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-medium"
                                        required
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="bg-[#f8f9fa] dark:bg-zinc-850/50 border border-gray-200/90 dark:border-zinc-800 rounded-lg p-4 space-y-2">
                            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">Dangerous Goods</label>
                            <div className="flex flex-wrap gap-5">
                                {['None', 'Battery', 'Flammable', 'Liquid'].map(opt => (
                                    <label key={opt} className="flex items-center gap-2 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer select-none">
                                        <input
                                            type="radio"
                                            name="danger"
                                            value={opt}
                                            checked={dangerousGoods === opt}
                                            onChange={() => setDangerousGoods(opt)}
                                            className="w-3.5 h-3.5 text-orange-500 border-gray-300 focus:ring-orange-500 cursor-pointer"
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Floating Sticky Footer Bar (Matching Daraz Seller Center) */}
                    <div className="sticky bottom-0 z-30 -mx-4 px-6 py-3.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3 mt-6">
                        <button
                            type="button"
                            onClick={handleBackToList}
                            className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-all font-medium"
                        >
                            ← Back to List
                        </button>

                        <div className="flex items-center gap-3">
                            {/* Save as Draft Button */}
                            <button
                                type="button"
                                onClick={handleSaveAsDraft}
                                disabled={savingDraft}
                                className={`px-6 py-2 rounded font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 border active:scale-95 disabled:opacity-50 ${
                                    draftSavedSuccess
                                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                                        : 'border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                                }`}
                            >
                                {savingDraft ? (
                                    <><Loader2 className="animate-spin" size={15} /> Saving...</>
                                ) : draftSavedSuccess ? (
                                    <><CheckCircle2 size={15} className="text-green-600" /> Saved as Draft</>
                                ) : (
                                    'Save Draft'
                                )}
                            </button>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-7 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all"
                            >
                                {submitting ? (
                                    <><Loader2 className="animate-spin" size={15} /> Submitting...</>
                                ) : (
                                    <><Send size={15} /> Submit ({selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''})</>
                                )}
                            </button>
                        </div>
                    </div>
            </form>

            <datalist id="variant-color-options">
                {COMMON_COLORS.map(color => (
                    <option key={color} value={color} />
                ))}
            </datalist>
        </div>
    )
}
