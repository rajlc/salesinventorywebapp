'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui-shim'
import {
    Sparkles, Trash2, Plus, Upload, Loader2, Info, CheckCircle2,
    RefreshCw, ChevronDown, ArrowLeft, Edit3, Send, Calendar, MoreVertical, Store
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
    quantity: number
    sellerSku: string
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
    attributes?: Record<string, string>
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
    status: 'draft' | 'generating' | 'generated' | 'pushing' | 'pushed' | 'failed'
    error?: string
    created_at?: string
}

interface BulkAddRow {
    id: string
    rawName: string
    images: string[]
    targetStores: string[]
    price?: number
    special_price?: number
    supplier_id?: string
    wholesale_price?: number
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

    // ── Stores & Suppliers ──────────────────────────────────────────────────
    const [stores, setStores] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<Array<{ id: string; supplier_name: string }>>([])

    // ── Bulk add rows ───────────────────────────────────────────────────────
    const [bulkRows, setBulkRows] = useState<BulkAddRow[]>([])
    const [bulkUploadingId, setBulkUploadingId] = useState<string | null>(null)

    // ── Single / Edit form state ────────────────────────────────────────────
    const [rawName, setRawName] = useState('')
    const [savingDraft, setSavingDraft] = useState(false)
    const [selectedStores, setSelectedStores] = useState<string[]>([])
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
    const [wholesalePrice, setWholesalePrice] = useState<number | undefined>(undefined)

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

    const [sellingPrice, setSellingPrice] = useState<number>(0)
    const [specialPrice, setSpecialPrice] = useState<number | undefined>(undefined)
    const [specialPriceFrom, setSpecialPriceFrom] = useState(today())
    const [specialPriceTo, setSpecialPriceTo] = useState(fiveYearsFromNow())
    const [stock, setStock] = useState(100)

    const [hasVariants, setHasVariants] = useState(false)
    const [variant1Values, setVariant1Values] = useState<string[]>([])
    const [variant2Values, setVariant2Values] = useState<string[]>([])
    const [skuRows, setSkuRows] = useState<SkuRow[]>([])

    const [weight, setWeight] = useState(0.1)
    const [length, setLength] = useState(1)
    const [width, setWidth] = useState(1)
    const [height, setHeight] = useState(1)
    const [dangerousGoods, setDangerousGoods] = useState('None')

    const [aiModel, setAiModel] = useState('gpt-4o-mini')
    const [generating, setGenerating] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // ── Load stores + drafts + suppliers on mount ───────────────────────────
    useEffect(() => {
        fetchStores()
        fetchDrafts()
        fetchSuppliers()
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
            const res = await fetch('/api/daraz/stores')
            const json = await res.json()
            if (json.success && json.data) {
                setStores(json.data)
                if (json.data.length > 0) setSelectedStores([json.data[0].id])
            }
        } catch (err) {
            console.error('Failed to load stores:', err)
        }
    }

    const fetchDrafts = async () => {
        setDraftsLoading(true)
        try {
            const res = await fetch('/api/daraz/drafts')
            const json = await res.json()
            if (json.success) {
                setDrafts(json.data || [])
                setCurrentPage(1)
            }
        } catch (err) {
            console.error('Failed to load drafts:', err)
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

    // ── Variant SKU grid generation ──────────────────────────────────────────
    useEffect(() => {
        if (!hasVariants) { setSkuRows([]); return }
        const rows: SkuRow[] = []
        const v1List = variant1Values.length > 0 ? variant1Values : ['']
        const v2List = variant2Values.length > 0 ? variant2Values : ['']
        v1List.forEach(v1 => {
            v2List.forEach(v2 => {
                if (v1 || v2) {
                    rows.push({
                        colorFamily: v1 || undefined,
                        size: v2 || undefined,
                        price: sellingPrice,
                        specialPrice,
                        quantity: stock,
                        sellerSku: `${rawName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 10).toUpperCase()}-${v1}-${v2}`,
                        images: images.slice(0, 1)
                    })
                }
            })
        })
        setSkuRows(rows)
    }, [hasVariants, variant1Values, variant2Values, sellingPrice, specialPrice, stock])

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
                    target_stores: selectedStores,
                    images,
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

    // ── Single AI Generation ──────────────────────────────────────────────────
    const handleAIGenerate = async () => {
        if (!rawName.trim()) return alert('Please enter a product name first')
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

            const res = await fetch('/api/daraz/products/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: rawName,
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
        if (!draft.raw_name?.trim()) return alert('Product name is required')
        if (!draft.target_stores || draft.target_stores.length === 0) {
            return alert('No target stores configured for this draft. Please edit it first.')
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
            const storeNames = draft.target_stores
                .map(id => stores.find(s => s.id === id)?.seller_account || id)

            const res = await fetch('/api/daraz/products/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: draft.raw_name,
                    price: draft.price || 500,
                    imageUrl: draft.images?.[0] || null,
                    storeNames: storeNames.length > 0 ? storeNames : ['Default Store'],
                    model: aiModel
                })
            })
            const data = await res.json()

            if (data.success) {
                const newTitlesPerStore: Record<string, string> = {}
                draft.target_stores.forEach(storeId => {
                    const storeName = stores.find(s => s.id === storeId)?.seller_account || storeId
                    newTitlesPerStore[storeId] = data.titles?.[storeName] || draft.raw_name
                })

                await fetch('/api/daraz/drafts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: draft.id,
                        title: Object.values(newTitlesPerStore)[0] || draft.raw_name,
                        titles_per_store: newTitlesPerStore,
                        description: data.description || '',
                        highlights: data.highlights || [],
                        attributes: data.attributes || {},
                        category_id: data.category_id || null,
                        category_path: data.category_suggestion || '',
                        status: 'generated'
                    })
                })
                
                alert(`AI content generated successfully for "${draft.raw_name}"!`)
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
            images: [],
            targetStores: stores.length > 0 ? [stores[0].id] : [],
            price: undefined,
            special_price: undefined,
            supplier_id: undefined,
            wholesale_price: undefined
        }])
        setViewMode('add-bulk')
        setIsAddMenuOpen(false)
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
        const valid = bulkRows.filter(r => r.rawName.trim().length > 0)
        if (valid.length === 0) return alert('Please enter at least one product name')

        // Save each bulk row to Supabase
        await Promise.all(valid.map(r =>
            fetch('/api/daraz/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_name: r.rawName.trim(),
                    images: r.images,
                    target_stores: r.targetStores,
                    price: r.price || null,
                    special_price: r.special_price || null,
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
                const storeNames = item.target_stores
                    .map(id => stores.find(s => s.id === id)?.seller_account || id)

                const res = await fetch('/api/daraz/products/ai-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productName: item.raw_name,
                        price: item.price || 500,
                        imageUrl: item.images?.[0] || null,
                        storeNames: storeNames.length > 0 ? storeNames : ['Default Store'],
                        model: 'gpt-4o-mini'
                    })
                })
                const data = await res.json()

                if (data.success) {
                    const newTitlesPerStore: Record<string, string> = {}
                    item.target_stores.forEach(storeId => {
                        const storeName = stores.find(s => s.id === storeId)?.seller_account || storeId
                        newTitlesPerStore[storeId] = data.titles?.[storeName] || item.raw_name
                    })

                    await fetch('/api/daraz/drafts', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: item.id,
                            title: Object.values(newTitlesPerStore)[0] || item.raw_name,
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
                        title: Object.values(newTitlesPerStore)[0] || item.raw_name,
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
        setSelectedSupplierId(draft.supplier_id || '')
        setWholesalePrice(draft.wholesale_price || undefined)
        setTitlesPerStore(draft.titles_per_store || {})
        setActiveTitleStoreId(draft.target_stores?.[0] || '')
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
        setViewMode('edit-single')
    }

    const handleBackToList = () => {
        setViewMode('list')
        setEditingDraftId(null)
        setAiCategorySuggestion(null)
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
        if (sellingPrice <= 0) return alert('Please enter a selling price')

        setSubmitting(true)
        
        const submissionAttributes = {
            ...dynamicAttributes,
            ...(!hasVariants ? {
                color_family: singleColorFamily,
                size: singleSize || undefined
            } : {})
        }

        try {
            const finalSkus = hasVariants
                ? skuRows.map(row => ({
                    sellerSku: row.sellerSku,
                    price: Number(row.price),
                    specialPrice: row.specialPrice ? Number(row.specialPrice) : undefined,
                    quantity: Number(row.quantity),
                    packageWeight: weight,
                    packageLength: length,
                    packageWidth: width,
                    packageHeight: height,
                    images: row.images,
                    color_family: row.colorFamily || 'Not Specified',
                    size: row.size
                }))
                : [{
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
                    color_family: singleColorFamily,
                    size: singleSize || undefined
                }]

            const response = await fetch('/api/daraz/products/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeIds: selectedStores,
                    titlesPerStore: titlesPerStore,
                    primaryCategory: categoryId,
                    name: Object.values(titlesPerStore)[0] || rawName,
                    rawName: rawName,
                    shortDescription: highlights.map(h => `• ${h}`).join('\n'),
                    description,
                    brand: dynamicAttributes.brand || 'No Brand',
                    attributes: submissionAttributes,
                    supplier_id: selectedSupplierId || undefined,
                    wholesale_price: wholesalePrice || undefined,
                    skus: finalSkus,
                    images
                })
            })

            const result = await response.json()
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
                            status: targetStatus,
                            error: errorSummary,
                            titles_per_store: titlesPerStore,
                            description,
                            highlights,
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
                        highlights,
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

    // ── Content completeness score ────────────────────────────────────────────
    const checklist = [
        { label: 'Add product name', met: !!rawName },
        { label: 'Add min 3 main images', met: images.length >= 3 },
        { label: 'Choose category', met: !!categoryId },
        { label: 'Fill specifications', met: Object.keys(dynamicAttributes).length >= 2 },
        { label: 'Set price', met: sellingPrice > 0 },
        { label: 'Add description', met: description.length > 50 },
        { label: 'Add highlights (min 5)', met: highlights.filter(h => h.trim()).length >= 5 },
        { label: 'Package dimensions', met: weight > 0 && length > 0 },
    ]
    const contentScore = Math.round((checklist.filter(c => c.met).length / checklist.length) * 100)

    // ── Status badge helper ───────────────────────────────────────────────────
    const statusBadge = (status: DraftListing['status']) => {
        const map: Record<string, string> = {
            draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/30',
            generating: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border border-blue-100/50 dark:border-blue-900/20',
            generated: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border border-emerald-100/50 dark:border-emerald-900/20',
            pushing: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border border-amber-100/50 dark:border-amber-900/20',
            pushed: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-100/50 dark:border-indigo-900/20',
            failed: 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border border-rose-100/50 dark:border-rose-900/20',
        }
        const label: Record<string, string> = {
            draft: 'Draft',
            generating: 'AI Writing...',
            generated: 'Ready',
            pushing: 'Pushing...',
            pushed: 'Pushed ✓',
            failed: 'Not Pushed',
        }
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] || map.draft}`}>
                {status === 'generating' && <Loader2 className="inline animate-spin mr-1 shrink-0" size={10} />}
                {label[status] || status}
            </span>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW 1: DRAFTS LIST
    // ═══════════════════════════════════════════════════════════════════════
    if (viewMode === 'list') {
        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-lg shadow-sm">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 dark:text-zinc-200">Draft Listings</h2>
                        <p className="text-xs text-gray-500">Prepare, generate AI content, and push products to Daraz</p>
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
                            <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md shadow-lg z-50 divide-y dark:divide-zinc-800 text-xs">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingDraftId(null)
                                        setRawName(''); setTitlesPerStore({}); setImages([])
                                        setDescription(''); setHighlights(['']); setCategoryId(null)
                                        setCategoryPath(''); setSellingPrice(0); setSpecialPrice(undefined)
                                        setSpecialPriceFrom(today()); setSpecialPriceTo(fiveYearsFromNow())
                                        setDynamicAttributes({}); setAiCategorySuggestion(null)
                                        setViewMode('add-single'); setIsAddMenuOpen(false)
                                    }}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 font-medium"
                                >
                                    ✦ One by One
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartBulkAdd}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 font-medium"
                                >
                                    ⊞ Multiple Add
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
                        <Card className="p-3 bg-amber-50/70 dark:bg-amber-950/10 border border-amber-200/50 flex justify-between items-center shadow-sm">
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
                        </Card>
                    );
                })()}

                {/* Drafts Card List */}
                <div className="space-y-3">
                    {draftsLoading ? (
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-12 text-center text-gray-400 shadow-sm">
                            <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={24} />
                            Loading draft listings...
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-12 text-center text-gray-400 italic shadow-sm">
                            No draft listings. Click "Add Product" to get started.
                        </div>
                    ) : (
                        (() => {
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

                            const sortedDrafts = [...drafts].sort((a, b) => {
                                const priorityA = getStatusGroupPriority(a.status);
                                const priorityB = getStatusGroupPriority(b.status);
                                if (priorityA !== priorityB) {
                                    return priorityA - priorityB;
                                }
                                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                            });

                            const ITEMS_PER_PAGE = 50;
                            const totalPages = Math.ceil(sortedDrafts.length / ITEMS_PER_PAGE);
                            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                            const paginatedDrafts = sortedDrafts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                            return (
                                <>
                                    {paginatedDrafts.map(draft => (
                                        <div 
                                            key={draft.id} 
                                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-lg shadow-sm hover:shadow transition-all duration-200 relative"
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

                                            {/* Product Image */}
                                            <div className="relative flex-none">
                                                <img
                                                    src={draft.images?.[0] || '/placeholder.png'}
                                                    alt="Preview"
                                                    className="w-16 h-16 rounded object-cover border dark:border-zinc-800 bg-gray-50"
                                                />
                                                {draft.images && draft.images.length > 1 && (
                                                    <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] text-white px-1 rounded font-bold">
                                                        +{draft.images.length - 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Main info columns */}
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center min-w-0">
                                                
                                                {/* Column 1: Names */}
                                                <div className="min-w-0 flex flex-col justify-center">
                                                    <span className="font-bold text-gray-800 dark:text-zinc-200 block truncate text-sm" title={draft.raw_name}>
                                                        {draft.raw_name}
                                                    </span>
                                                    <span className="text-xs mt-1 block truncate" title={draft.title || 'AI Content: Not Generated'}>
                                                        {draft.title ? (
                                                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                                                                <Sparkles size={12} className="shrink-0 text-amber-500" />
                                                                {draft.title}
                                                            </span>
                                                        ) : (
                                                            <span className="italic text-gray-400">AI Content Not Generated</span>
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Column 2: Category & Attributes */}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 truncate">
                                                        {draft.category_path || 'No Category Selected'}
                                                    </span>
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
                                                </div>

                                                {/* Column 3: Price & Status */}
                                                <div className="flex flex-col md:items-center justify-center min-w-0">
                                                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                                        {draft.price ? `NPR ${draft.price}` : 'Price: N/A'}
                                                    </span>
                                                    <div className="mt-1">
                                                        {statusBadge(draft.status)}
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

                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-5 space-y-4 shadow-sm">
                    <div className="divide-y dark:divide-zinc-800 space-y-4">
                        {bulkRows.map((row, idx) => (
                            <div key={row.id} className="pt-4 first:pt-0 flex flex-col md:flex-row gap-4 items-start">
                                <span className="font-bold text-gray-400 text-sm self-center w-6 shrink-0">#{idx + 1}</span>

                                {/* Product name */}
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Product Raw Name *</label>
                                    <input
                                        type="text"
                                        value={row.rawName}
                                        onChange={(e) => {
                                            const next = [...bulkRows]
                                            next[idx].rawName = e.target.value
                                            setBulkRows(next)
                                        }}
                                        placeholder="e.g. Zodiac Bracelet Watch Gold Tone"
                                        className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                    />
                                </div>

                                {/* Price */}
                                <div className="w-28 space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Price (NPR)</label>
                                    <input
                                        type="number"
                                        placeholder="500"
                                        value={row.special_price || ''}
                                        onChange={(e) => {
                                            const next = [...bulkRows]
                                            const val = Number(e.target.value)
                                            next[idx].special_price = val
                                            next[idx].price = val > 0 ? val + 200 : undefined
                                            setBulkRows(next)
                                        }}
                                        className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                                    />
                                    {row.special_price ? (
                                        <p className="text-[10px] text-orange-600 font-semibold mt-0.5">Listed: NPR {row.price}</p>
                                    ) : null}
                                </div>

                                {/* Supplier (Optional) */}
                                <div className="w-full md:w-44 space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Supplier</label>
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

                                {/* Wholesale Price (Optional) */}
                                <div className="w-28 space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Wholesale (NPR)</label>
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
                                        className="w-full py-1.5 px-2 border rounded text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                                    />
                                </div>

                                {/* Stores */}
                                <div className="w-full md:w-52 space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Target Accounts</label>
                                    <div className="flex flex-wrap gap-1">
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
                                                    className={`px-2 py-1 rounded text-[10px] font-semibold border ${active
                                                        ? 'bg-orange-500/10 text-orange-600 border-orange-500'
                                                        : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500'
                                                        }`}
                                                >
                                                    {store.seller_account}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Image upload */}
                                <div className="space-y-1 flex-1 min-w-[200px]">
                                    <label className="text-xs font-bold text-gray-600 block">Images (Drag to reorder)</label>
                                    <div className="flex flex-wrap gap-1.5 items-center">
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
                                                className={`relative w-20 h-20 border-2 rounded overflow-hidden group cursor-grab active:cursor-grabbing transition-all
                                                    ${bulkDragSourceRowId === row.id && bulkDragOverIdx === imgIdx 
                                                        ? 'border-orange-500 scale-105' 
                                                        : imgIdx === 0 
                                                            ? 'border-orange-400' 
                                                            : 'border-gray-200 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <img src={img} className="w-full h-full object-cover" alt="" />
                                                
                                                {/* Primary badge */}
                                                {imgIdx === 0 && (
                                                    <span className="absolute top-0 left-0 bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-br select-none">
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
                                                    className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 text-white flex items-center justify-center text-xs font-bold transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {row.images.length < 8 && (
                                            <label className="w-20 h-20 border border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors shrink-0">
                                                {bulkUploadingId === row.id
                                                    ? <Loader2 className="animate-spin text-gray-400" size={16} />
                                                    : <Upload className="text-gray-400" size={16} />
                                                }
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

                                {bulkRows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setBulkRows(bulkRows.filter(r => r.id !== row.id))}
                                        className="p-1.5 hover:text-red-500 self-center text-gray-400"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 flex justify-between items-center border-t dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setBulkRows([...bulkRows, {
                                id: crypto.randomUUID(), rawName: '', images: [],
                                targetStores: stores.length > 0 ? [stores[0].id] : []
                            }])}
                            className="px-3 py-1.5 border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded font-bold flex items-center gap-1 text-sm"
                        >
                            <Plus size={14} /> Add Row
                        </button>

                        <div className="flex gap-2">
                            <button type="button" onClick={handleBackToList} className="px-4 py-2 border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded text-sm">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveBulkDrafts}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-bold shadow text-sm"
                            >
                                Save Drafts ({bulkRows.filter(r => r.rawName.trim()).length})
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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={handleBackToList} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-base font-bold">
                            {viewMode === 'edit-single' ? 'Edit & Configure Listing' : 'New Product Listing'}
                        </h2>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            {savingDraft && <><Loader2 className="animate-spin" size={10} /> Auto-saving...</>}
                            {!savingDraft && editingDraftId && <><CheckCircle2 size={10} className="text-green-500" /> Draft saved in database</>}
                            {!editingDraftId && !savingDraft && 'Name your product to auto-save as draft'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-6 lg:max-w-4xl">

                    {/* AI Banner */}
                    <Card className="p-4 bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-3">
                            <Sparkles className="text-orange-500 shrink-0" size={22} />
                            <div>
                                <h4 className="font-bold text-sm">AI Listing Generator</h4>
                                <p className="text-xs text-gray-500">One click → generates titles (per store), category, description, highlights & attributes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <select
                                value={aiModel}
                                onChange={(e) => setAiModel(e.target.value)}
                                className="py-1 px-2.5 border rounded text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                <option value="gpt-4o">GPT-4o (Vision)</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleAIGenerate}
                                disabled={generating || !rawName}
                                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shadow"
                            >
                                {generating ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                {generating ? 'Generating...' : 'Generate Content'}
                            </button>
                        </div>
                    </Card>

                    {/* Wholesale Pricing & Supplier Card (Internal Inventory) */}
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b dark:border-zinc-800 pb-2">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                Wholesale Price & Supplier <span className="text-xs font-normal text-gray-400 dark:text-zinc-400">(Optional - Internal Inventory Only)</span>
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Supplier Dropdown */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
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
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
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
                                    className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Basic Information */}
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 space-y-5 shadow-sm">
                        <h3 className="text-base font-bold border-b dark:border-zinc-800 pb-2">1. Basic Information</h3>

                        {/* Seller Accounts */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                Target Seller Accounts <span className="text-red-500">*</span>
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
                                        className={`py-1.5 px-3 rounded text-xs font-medium border transition-all ${selectedStores.includes(store.id)
                                            ? 'bg-orange-500/10 text-orange-600 border-orange-500 font-bold'
                                            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'
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

                        {/* Raw Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                Product Raw Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Zodiac Constellation Charm Bracelet"
                                value={rawName}
                                onChange={(e) => setRawName(e.target.value)}
                                onBlur={handleRawNameBlur}
                                className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                required
                            />
                            <p className="text-xs text-gray-400">Saved automatically as draft when you leave this field</p>
                        </div>

                        {/* Per-Store SEO Titles (shown after AI generation) */}
                        {Object.keys(titlesPerStore).length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                    SEO-Optimized Product Titles (per store)
                                </label>

                                {/* Store tabs */}
                                {selectedStores.length > 1 && (
                                    <div className="flex gap-1 border-b dark:border-zinc-800 mb-1">
                                        {selectedStores.map(storeId => {
                                            const store = stores.find(s => s.id === storeId)
                                            return (
                                                <button
                                                    key={storeId}
                                                    type="button"
                                                    onClick={() => setActiveTitleStoreId(storeId)}
                                                    className={`px-3 py-1 text-xs font-semibold rounded-t transition-all ${activeTitleStoreId === storeId
                                                        ? 'bg-orange-500 text-white'
                                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300'
                                                        }`}
                                                >
                                                    {store?.seller_account || storeId}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Active store title editor */}
                                {(activeTitleStoreId || selectedStores[0]) && (() => {
                                    const storeId = activeTitleStoreId || selectedStores[0]
                                    const titleVal = titlesPerStore[storeId] || ''
                                    return (
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-gray-400">
                                                    {stores.find(s => s.id === storeId)?.seller_account}
                                                </span>
                                                <span className="text-xs text-gray-400">{titleVal.length}/255</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={titleVal}
                                                onChange={(e) => setTitlesPerStore(prev => ({ ...prev, [storeId]: e.target.value }))}
                                                maxLength={255}
                                                className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                            />
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Category Picker with auto-select */}
                        <CategoryPicker
                            productName={Object.values(titlesPerStore)[0] || ''}
                            selectedCategoryId={categoryId}
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
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-1">
                                Product Images <span className="text-red-500">* (Add min 3)</span>
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
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm">
                        <h3 className="text-base font-bold border-b dark:border-zinc-800 pb-2 flex items-center justify-between">
                            2. Product Specification
                            {categoryId && (
                                <span className="text-xs bg-orange-50 text-orange-600 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-100 dark:border-zinc-800">
                                    {categoryPath.split(' > ').slice(-2).join(' > ')}
                                </span>
                            )}
                        </h3>

                        {categoryId ? (
                            <DynamicAttributesForm
                                categoryId={categoryId}
                                values={dynamicAttributes}
                                onChange={(key, val) => setDynamicAttributes(prev => ({ ...prev, [key]: val }))}
                                onLoadSaleProps={(props) => setSaleProps(props)}
                                onLoadAttributesSchema={(schema) => setAttributesSchema(schema)}
                            />
                        ) : (
                            <div className="p-4 bg-gray-50 dark:bg-zinc-800/40 text-center rounded border border-dashed dark:border-zinc-800">
                                <Info className="text-gray-400 mx-auto mb-1.5" size={18} />
                                <p className="text-sm text-gray-500">Select category to load specification fields</p>
                                <p className="text-xs text-gray-400 mt-1">AI will auto-suggest a category when you click "Generate Content"</p>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Price, Stock & Variants */}
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center border-b dark:border-zinc-800 pb-2">
                            <h3 className="text-base font-bold">3. Price, Stock &amp; Variants</h3>
                            {saleProps.length > 0 && (
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={hasVariants}
                                        onChange={(e) => setHasVariants(e.target.checked)}
                                        className="rounded border-gray-300 text-orange-600"
                                    />
                                    Enable Variants
                                </label>
                            )}
                        </div>

                        {!hasVariants ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                                            Actual Selling Price (NPR) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={specialPrice || ''}
                                            onChange={(e) => {
                                                const val = e.target.value ? Number(e.target.value) : undefined
                                                setSpecialPrice(val)
                                                if (val && val > 0) {
                                                    setSellingPrice(val + 200)
                                                } else {
                                                    setSellingPrice(0)
                                                }
                                            }}
                                            placeholder="e.g. 500"
                                            className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                            required
                                        />
                                        <p className="text-[10px] text-gray-400">Type what the customer pays</p>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                                            Original / Listed Price (NPR) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={sellingPrice || ''}
                                            onChange={(e) => setSellingPrice(Number(e.target.value))}
                                            placeholder="Auto-calculated (Price + 200)"
                                            className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-850 dark:border-zinc-700 focus:outline-none"
                                            required
                                        />
                                        <p className="text-[10px] text-orange-600 font-medium">Auto-sets to Actual Price + NPR 200</p>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Stock</label>
                                        <input
                                            type="number"
                                            value={stock}
                                            onChange={(e) => setStock(Number(e.target.value))}
                                            className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                            Color Family
                                        </label>
                                        <input
                                            type="text"
                                            list="variant-color-options"
                                            value={singleColorFamily}
                                            onChange={(e) => setSingleColorFamily(e.target.value)}
                                            placeholder="e.g. Multicolour, Red, Black, etc."
                                            className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                        <p className="text-[10px] text-gray-400">Defaults to "Not Specified" if left empty or unchanged</p>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                            Size
                                        </label>
                                        <input
                                            type="text"
                                            value={singleSize}
                                            onChange={(e) => setSingleSize(e.target.value)}
                                            placeholder="e.g. S, M, L, XL, 16 CM, etc."
                                            className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                        <p className="text-[10px] text-gray-400">Optional. Enter product size if applicable</p>
                                    </div>
                                </div>

                                {/* Special Price Date Range (Always rendered when discount price is active) */}
                                {specialPrice && (
                                    <div className="border dark:border-zinc-800 rounded-lg p-4 space-y-3 bg-gray-50/50 dark:bg-zinc-800/20">
                                        <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Calendar size={14} className="text-orange-500" />
                                            Discount Period (Default: 5 Years)
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-gray-500 uppercase font-semibold">Valid From</label>
                                                <input
                                                    type="date"
                                                    value={specialPriceFrom}
                                                    onChange={(e) => setSpecialPriceFrom(e.target.value)}
                                                    min={today()}
                                                    className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-gray-500 uppercase font-semibold">Valid To</label>
                                                <input
                                                    type="date"
                                                    value={specialPriceTo}
                                                    onChange={(e) => setSpecialPriceTo(e.target.value)}
                                                    min={specialPriceFrom}
                                                    className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                    {specialPrice && (
                                        <p className="text-xs text-orange-600 font-medium">
                                            Discount: NPR {sellingPrice - specialPrice} off ({Math.round(((sellingPrice - specialPrice) / sellingPrice) * 100)}% off)
                                        </p>
                                    )}
                                </div>
                            ) : (
                            /* Variants UI */
                            <div className="space-y-4">
                                {saleProps.map((prop, idx) => (
                                    <div key={prop.name} className="space-y-2 border dark:border-zinc-800 p-3 rounded-lg bg-gray-50/50 dark:bg-zinc-800/30">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                                            Variant {idx + 1}: {prop.label || prop.name}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                list={prop.name === 'color_family' || prop.label?.toLowerCase() === 'color family' ? "variant-color-options" : undefined}
                                                placeholder={`Add value (e.g. ${idx === 0 ? 'Blue, Red' : 'M, L, XL'})`}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const val = e.currentTarget.value.trim()
                                                        if (val) {
                                                            if (idx === 0) setVariant1Values([...variant1Values, val])
                                                            else setVariant2Values([...variant2Values, val])
                                                            e.currentTarget.value = ''
                                                        }
                                                    }
                                                }}
                                                className="py-1 px-2.5 border rounded text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 flex-1 max-w-xs"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(idx === 0 ? variant1Values : variant2Values).map(val => (
                                                <span key={val} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 font-medium">
                                                    {val}
                                                    <button type="button" onClick={() => {
                                                        if (idx === 0) setVariant1Values(variant1Values.filter(v => v !== val))
                                                        else setVariant2Values(variant2Values.filter(v => v !== val))
                                                    }} className="hover:text-red-500 font-bold ml-0.5">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {skuRows.length > 0 && (
                                    <div className="border rounded-lg dark:border-zinc-800 overflow-hidden text-xs">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-zinc-800/50 font-bold border-b dark:border-zinc-800">
                                                <tr>
                                                    {saleProps.map(p => <th key={p.name} className="p-2">{p.label}</th>)}
                                                    <th className="p-2 w-24">Price</th>
                                                    <th className="p-2 w-24">Special</th>
                                                    <th className="p-2 w-20">Stock</th>
                                                    <th className="p-2">SKU</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-zinc-800">
                                                {skuRows.map((row, idx) => (
                                                    <tr key={idx}>
                                                        {row.colorFamily !== undefined && <td className="p-2 font-semibold">{row.colorFamily}</td>}
                                                        {row.size !== undefined && <td className="p-2 font-semibold">{row.size}</td>}
                                                        <td className="p-1.5"><input type="number" value={row.price} onChange={(e) => { const n = [...skuRows]; n[idx].price = Number(e.target.value); setSkuRows(n) }} className="w-full py-1 px-2 border rounded text-xs" /></td>
                                                        <td className="p-1.5"><input type="number" value={row.specialPrice || ''} onChange={(e) => { const n = [...skuRows]; n[idx].specialPrice = e.target.value ? Number(e.target.value) : undefined; setSkuRows(n) }} className="w-full py-1 px-2 border rounded text-xs" /></td>
                                                        <td className="p-1.5"><input type="number" value={row.quantity} onChange={(e) => { const n = [...skuRows]; n[idx].quantity = Number(e.target.value); setSkuRows(n) }} className="w-full py-1 px-2 border rounded text-xs" /></td>
                                                        <td className="p-1.5"><input type="text" value={row.sellerSku} onChange={(e) => { const n = [...skuRows]; n[idx].sellerSku = e.target.value; setSkuRows(n) }} className="w-full py-1 px-2 border rounded font-mono text-[10px]" /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Product Description */}
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm">
                        <h3 className="text-base font-bold border-b dark:border-zinc-800 pb-2">4. Product Description</h3>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                                    Main Description (HTML) <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setPreviewDesc(!previewDesc)}
                                    className="text-xs font-bold text-orange-600 hover:underline"
                                >
                                    {previewDesc ? 'Editor' : 'HTML Preview'}
                                </button>
                            </div>
                            {previewDesc ? (
                                <div
                                    className="border dark:border-zinc-800 rounded p-3 min-h-[180px] prose dark:prose-invert text-sm max-w-none bg-gray-50/50 dark:bg-zinc-800/10"
                                    dangerouslySetInnerHTML={{ __html: description }}
                                />
                            ) : (
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder='AI will generate: "Perfect for: [3 lines]" + ~200 word product description...'
                                    className="w-full border dark:border-zinc-800 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono min-h-[180px] bg-white dark:bg-zinc-800 resize-y"
                                    required
                                />
                            )}
                        </div>

                        {/* Highlights */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">
                                Key Highlights (Bullet Points) <span className="text-red-500">*</span>
                                <span className="text-gray-400 font-normal ml-1">— AI generates 8-10 points covering specs, benefits & care</span>
                            </label>
                            <div className="space-y-2">
                                {highlights.map((h, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="text-orange-500 font-bold text-sm">•</span>
                                        <input
                                            type="text"
                                            value={h}
                                            onChange={(e) => {
                                                const next = [...highlights]
                                                next[i] = e.target.value
                                                setHighlights(next)
                                            }}
                                            placeholder="Add highlight..."
                                            className="flex-1 py-1 px-3 border rounded text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                        />
                                        {highlights.length > 1 && (
                                            <button type="button" onClick={() => setHighlights(highlights.filter((_, idx) => idx !== i))} className="p-1 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setHighlights([...highlights, ''])}
                                    className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1"
                                >
                                    <Plus size={12} /> Add Highlight
                                </button>
                            </div>
                            <p className="text-xs text-gray-400">
                                {highlights.filter(h => h.trim()).length} highlights added
                            </p>
                        </div>
                    </div>

                    {/* Section 5: Shipping */}
                    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm">
                        <h3 className="text-base font-bold border-b dark:border-zinc-800 pb-2">5. Shipping &amp; Package</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Weight (kg)', val: weight, set: setWeight, step: '0.01' },
                                { label: 'Length (cm)', val: length, set: setLength, step: '1' },
                                { label: 'Width (cm)', val: width, set: setWidth, step: '1' },
                                { label: 'Height (cm)', val: height, set: setHeight, step: '1' },
                            ].map(({ label, val, set, step }) => (
                                <div key={label} className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">{label} <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step={step}
                                        value={val}
                                        onChange={(e) => set(Number(e.target.value))}
                                        className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                        required
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 block">Dangerous Goods</label>
                            <div className="flex gap-4">
                                {['None', 'Battery', 'Flammable', 'Liquid'].map(opt => (
                                    <label key={opt} className="flex items-center gap-1.5 text-xs">
                                        <input
                                            type="radio"
                                            name="danger"
                                            value={opt}
                                            checked={dangerousGoods === opt}
                                            onChange={() => setDangerousGoods(opt)}
                                            className="text-orange-600 border-gray-300 focus:ring-orange-500"
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="bg-gray-100 dark:bg-zinc-950 p-4 border dark:border-zinc-800 rounded-lg flex justify-end gap-3">
                        <button type="button" onClick={handleBackToList} className="px-4 py-2 border rounded text-sm hover:bg-gray-200 dark:hover:bg-zinc-850 text-gray-700 dark:text-gray-300">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting
                                ? <><Loader2 className="animate-spin" size={16} /> Pushing...</>
                                : <><Send size={16} /> Push to Daraz ({selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''})</>
                            }
                        </button>
                    </div>
                </div>

                {/* Right Sidebar: Content Score */}
                <div className="w-full lg:w-60 space-y-4 shrink-0 lg:sticky lg:top-20 h-fit self-start">
                    <Card className="p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 space-y-4 shadow-sm text-xs">
                        <div>
                            <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1">Content Score</h4>
                            <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded-full font-bold ${contentScore < 40 ? 'bg-red-50 text-red-600' : contentScore < 70 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                                    {contentScore < 40 ? 'Poor' : contentScore < 70 ? 'Needs Work' : 'Excellent'}
                                </span>
                                <span className="text-base font-bold">{contentScore}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                    className={`h-full transition-all duration-500 ${contentScore < 40 ? 'bg-red-500' : contentScore < 70 ? 'bg-orange-500' : 'bg-green-500'}`}
                                    style={{ width: `${contentScore}%` }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h5 className="font-bold border-b dark:border-zinc-800 pb-1 text-gray-500">Checklist</h5>
                            {checklist.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.met ? 'bg-green-500' : 'bg-orange-400'}`} />
                                    <span className={item.met ? 'line-through text-gray-400 dark:text-gray-600' : ''}>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {editingDraftId && (
                            <div className="pt-1 border-t dark:border-zinc-800 text-gray-400 text-[10px]">
                                Draft ID: {editingDraftId.substring(0, 8)}...
                                <br />Auto-synced to database
                            </div>
                        )}
                    </Card>
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
