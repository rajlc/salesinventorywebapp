'use client'

import { useState, useEffect } from 'react'
import { X, Globe, Plus, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
    getProductById, 
    getEcommerceCategories, 
    getEcommerceBrands, 
    pushProductToEcommerce 
} from '@/features/inventory/actions/product-actions'

interface PushToWebsiteModalProps {
    productId: string | null
    isOpen: boolean
    onClose: () => void
}

function parseHighlights(html: string | null): string[] {
    if (!html) return ['']
    const match = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi)
    if (match) {
        return match.map(m => m.replace(/<[^>]*>/g, '').trim()).filter(Boolean)
    }
    return html
        .split('\n')
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
}

export function PushToWebsiteModal({ productId, isOpen, onClose }: PushToWebsiteModalProps) {
    const queryClient = useQueryClient()

    // 1. Fetch product details
    const { data: product, isLoading: isProductLoading } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? getProductById(productId) : null,
        enabled: !!productId && isOpen
    })

    // 2. Fetch categories and brands
    const [categoriesList, setCategoriesList] = useState<any[]>([])
    const [brandsList, setBrandsList] = useState<any[]>([])
    const [isMetaLoading, setIsMetaLoading] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        const fetchMetadata = async () => {
            setIsMetaLoading(true)
            try {
                const cats = await getEcommerceCategories()
                const brs = await getEcommerceBrands()
                setCategoriesList(cats || [])
                setBrandsList(brs || [])
            } catch (err) {
                console.error('Failed to load metadata:', err)
            } finally {
                setIsMetaLoading(false)
            }
        }
        fetchMetadata()
    }, [isOpen])

    // 3. Form States
    const [displayName, setDisplayName] = useState('')
    const [description, setDescription] = useState('')
    const [regularPrice, setRegularPrice] = useState(0)
    const [specialPrice, setSpecialPrice] = useState(0)
    const [stockQty, setStockQty] = useState(100)
    const [category, setCategory] = useState('')
    const [subCategory, setSubCategory] = useState('')
    const [brand, setBrand] = useState('No Brand')
    const [images, setImages] = useState<string[]>([])
    const [highlights, setHighlights] = useState<string[]>([''])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Prefill form when product details are loaded
    useEffect(() => {
        if (product && isOpen) {
            setDisplayName(product.product_title || product.product_name || '')
            setDescription(product.description || '')
            setRegularPrice(product.regular_price || 0)
            setSpecialPrice(product.special_price || 0)
            setStockQty(100) // prefill with 100 as requested
            setBrand('No Brand')

            // Setup images
            const imageList: string[] = []
            if (product.image_url) imageList.push(product.image_url)
            if (Array.isArray(product.other_images)) {
                imageList.push(...product.other_images)
            }
            setImages(imageList)

            // Setup highlights
            if (product.highlights) {
                setHighlights(parseHighlights(product.highlights))
            } else {
                setHighlights([''])
            }

            // Autofill category if matched by name or category matching rules
            const targetCategory = product.website_category || product.category_name
            if (targetCategory && categoriesList.length > 0) {
                const match = categoriesList.find(
                    c => c.name.toLowerCase() === targetCategory.toLowerCase()
                )
                if (match) {
                    if (match.parent_id) {
                        const parent = categoriesList.find(c => c.id === match.parent_id)
                        if (parent) {
                            setCategory(parent.name)
                            setSubCategory(match.name)
                        }
                    } else {
                        setCategory(match.name)
                        setSubCategory('')
                    }
                }
            }
        }
    }, [product, isOpen, categoriesList])

    // Drag & Drop Handlers for Image sorting
    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', String(index))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault()
        const sourceIndex = Number(e.dataTransfer.getData('text/plain'))
        if (sourceIndex === targetIndex) return

        const nextImages = [...images]
        const [moved] = nextImages.splice(sourceIndex, 1)
        nextImages.splice(targetIndex, 0, moved)
        setImages(nextImages)
    }

    const handleRemoveImage = (index: number) => {
        setImages(images.filter((_, idx) => idx !== index))
    }

    // Highlights modifiers
    const handleHighlightChange = (index: number, val: string) => {
        const next = [...highlights]
        next[index] = val
        setHighlights(next)
    }

    const addHighlightField = () => {
        setHighlights([...highlights, ''])
    }

    const removeHighlightField = (index: number) => {
        setHighlights(highlights.filter((_, idx) => idx !== index))
    }

    // Dropdown helpers
    const parentCategories = categoriesList.filter(c => !c.parent_id)
    const selectedCategoryObj = categoriesList.find(c => c.name === category)
    const subCategories = selectedCategoryObj 
        ? categoriesList.filter(c => c.parent_id === selectedCategoryObj.id) 
        : []

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!productId || !product) return

        if (!category || category === 'Select Category') {
            alert('Please select a Category')
            return
        }

        if (images.length === 0) {
            alert('At least one product image is required!')
            return
        }

        if (regularPrice <= 0) {
            alert('Regular Price must be greater than 0!')
            return
        }

        if (specialPrice > 0 && specialPrice >= regularPrice) {
            alert('Special Price must be lower than Regular Price!')
            return
        }

        const filteredHighlights = highlights.map(h => h.trim()).filter(Boolean)
        if (filteredHighlights.length === 0) {
            alert('At least one Highlight is required!')
            return
        }

        if (!description.trim()) {
            alert('Product Description is required!')
            return
        }

        setIsSubmitting(true)
        try {
            const payload = {
                inventory_id: product.id,
                warehouse_product_id: String(product.product_id),
                display_name: displayName,
                description: description,
                regular_price: regularPrice,
                special_price: specialPrice || null,
                stock_quantity: stockQty,
                category: category,
                sub_category: subCategory || null,
                brand: brand || 'No Brand',
                images: images,
                highlights: filteredHighlights
            }

            await pushProductToEcommerce(product.id, payload)
            alert('Product pushed to website successfully!')
            queryClient.invalidateQueries({ queryKey: ['products'] })
            onClose()
        } catch (err: any) {
            alert(`Failed to push product: ${err.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen || !productId) return null

    const isLoading = isProductLoading || isMetaLoading

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Box */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden mx-4 border dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                        <Globe className="text-blue-500 animate-pulse" size={22} />
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Push Product to Ecommerce Website</h2>
                            <p className="text-xs text-gray-500">Configure listing details for your storefront catalog.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Content */}
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p className="text-sm text-gray-500 font-medium">Loading catalog metadata...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Section 1: Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-zinc-800 pb-1.5">Basic Information</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Product Title</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Warehouse ID</label>
                                    <input
                                        type="text"
                                        value={product?.product_id || ''}
                                        disabled
                                        className="w-full px-3 py-2 rounded-lg border border-gray-150 dark:border-zinc-850 bg-gray-100 dark:bg-zinc-800 text-sm font-mono font-bold text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => {
                                            setCategory(e.target.value)
                                            setSubCategory('')
                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {parentCategories.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sub Category</label>
                                    <select
                                        value={subCategory}
                                        onChange={(e) => setSubCategory(e.target.value)}
                                        disabled={!category || subCategories.length === 0}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Sub Category (Optional)</option>
                                        {subCategories.map(sc => (
                                            <option key={sc.id} value={sc.name}>{sc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Brand</label>
                                    <select
                                        value={brand}
                                        onChange={(e) => setBrand(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                    >
                                        <option value="No Brand">No Brand</option>
                                        {brandsList.filter(b => b.name !== 'No Brand').map(b => (
                                            <option key={b.id} value={b.name}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Image Manager with Drag and Drop */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-zinc-800 pb-1.5">Product Images</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Drag and drop thumbnails to sort. The first thumbnail represents the primary/cover image.</p>
                            </div>

                            <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-dashed dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/20 min-h-[96px]">
                                {images.map((imgUrl, idx) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        className="relative w-20 h-20 rounded-lg overflow-hidden border dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-all group flex-shrink-0"
                                    >
                                        <img src={imgUrl} className="w-full h-full object-cover select-none pointer-events-none" alt="" />
                                        
                                        {/* Badges and Remove Actions */}
                                        {idx === 0 && (
                                            <span className="absolute top-0.5 left-0.5 px-1 py-0.5 text-[8px] font-black uppercase bg-blue-500 text-white rounded">Cover</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute top-0.5 right-0.5 p-1 bg-black/60 text-white hover:bg-red-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete image"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                ))}
                                {images.length === 0 && (
                                    <div className="w-full flex flex-col items-center justify-center py-4 text-xs text-gray-400 font-medium">
                                        <ImageIcon size={20} className="mb-1 text-gray-300" />
                                        No images loaded
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Price and Stock */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-zinc-800 pb-1.5">Pricing & Stock</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Regular Price (Rs.)</label>
                                    <input
                                        type="number"
                                        value={regularPrice || ''}
                                        onChange={(e) => setRegularPrice(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors font-mono"
                                        required
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Special Price (Rs.)</label>
                                    <input
                                        type="number"
                                        value={specialPrice || ''}
                                        onChange={(e) => setSpecialPrice(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors text-red-500 font-mono"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Stock Quantity</label>
                                    <input
                                        type="number"
                                        value={stockQty}
                                        onChange={(e) => setStockQty(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-sm font-semibold outline-none focus:border-blue-500 transition-colors font-mono"
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Highlights */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b dark:border-zinc-800 pb-1.5">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Highlights</h3>
                                <button
                                    type="button"
                                    onClick={addHighlightField}
                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                    <Plus size={12} /> Add bullet
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {highlights.map((bullet, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-750 flex-shrink-0" />
                                        <input
                                            type="text"
                                            value={bullet}
                                            onChange={(e) => handleHighlightChange(idx, e.target.value)}
                                            placeholder="Enter product highlight feature..."
                                            className="flex-grow px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
                                            required
                                        />
                                        {highlights.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeHighlightField(idx)}
                                                className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                                                title="Delete bullet"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 5: Description */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-zinc-800 pb-1.5">Description</h3>
                            <div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full h-44 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs font-medium leading-relaxed outline-none focus:border-blue-500 transition-colors resize-none"
                                    required
                                    placeholder="Enter full product description details..."
                                />
                            </div>
                        </div>
                    </form>
                )}

                {/* Footer */}
                {!isLoading && (
                    <div className="border-t dark:border-zinc-800 p-6 flex items-center justify-end gap-4 bg-gray-50/50 dark:bg-zinc-900/50">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2 border dark:border-zinc-700 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-sm font-semibold transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Pushing...</span>
                                </>
                            ) : (
                                <>
                                    <Globe size={16} />
                                    <span>Push to Store</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
