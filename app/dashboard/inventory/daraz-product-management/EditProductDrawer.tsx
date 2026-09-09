'use client'

import React, { useState, useRef } from 'react'
import {
    X,
    Upload,
    Trash2,
    Star,
    Image as ImageIcon,
    CheckCircle2,
    FileText,
    Loader2,
    Lock,
    AlertCircle,
    Plus,
    Sparkles,
    Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface EditProductDrawerProps {
    product: any
    onClose: () => void
    onSuccess: () => void
}

export default function EditProductDrawer({ product, onClose, onSuccess }: EditProductDrawerProps) {
    const mainSku = product.skus?.[0] || {}
    const draft = product.daraz_edit_draft || null

    // Prefill states from draft or current live values
    const [name, setName] = useState<string>(draft?.name || product.name || '')
    const [images, setImages] = useState<string[]>(
        draft?.images && draft.images.length > 0 ? draft.images : (product.images || [])
    )
    
    // Clean highlights HTML to readable bullets if needed
    const initialShortDesc = draft?.shortDescription || product.attributes?.short_description || ''
    const [shortDescription, setShortDescription] = useState<string>(() => {
        if (!initialShortDesc) return ''
        // Extract <li> contents if HTML
        const matches = initialShortDesc.match(/<li[^>]*>(.*?)<\/li>/gi)
        if (matches && matches.length > 0) {
            return matches.map((m: string) => m.replace(/<\/?[^>]+(>|$)/g, '').trim()).join('\n')
        }
        return initialShortDesc.replace(/<\/?[^>]+(>|$)/g, '').trim()
    })

    const [description, setDescription] = useState<string>(
        draft?.description || product.attributes?.description || ''
    )
    const [price, setPrice] = useState<number | ''>(
        draft?.price !== undefined ? draft.price : (mainSku.price || '')
    )
    const [specialPrice, setSpecialPrice] = useState<number | ''>(
        draft?.specialPrice !== undefined ? draft.specialPrice : (mainSku.special_price || '')
    )

    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadingDescImage, setUploadingDescImage] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [pushing, setPushing] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const imageInputRef = useRef<HTMLInputElement>(null)
    const descImageInputRef = useRef<HTMLInputElement>(null)

    // Upload image to Supabase Storage
    const uploadImageToSupabase = async (file: File): Promise<string> => {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const { error } = await supabase.storage
            .from('mobile-captures')
            .upload(fileName, file, { contentType: 'image/jpeg', upsert: false })
        if (error) throw new Error(error.message)
        const { data: { publicUrl } } = supabase.storage.from('mobile-captures').getPublicUrl(fileName)
        return publicUrl
    }

    // Handle product images upload
    const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return
        setUploadingImage(true)
        setErrorMsg(null)
        try {
            const uploadedUrls = await Promise.all(files.map(f => uploadImageToSupabase(f)))
            setImages(prev => [...prev, ...uploadedUrls].slice(0, 8))
        } catch (err: any) {
            setErrorMsg('Image upload failed: ' + err.message)
        } finally {
            setUploadingImage(false)
            if (imageInputRef.current) imageInputRef.current.value = ''
        }
    }

    // Set cover / primary image
    const handleSetPrimaryImage = (index: number) => {
        if (index === 0) return
        setImages(prev => {
            const next = [...prev]
            const [selected] = next.splice(index, 1)
            next.unshift(selected)
            return next
        })
    }

    // Remove an image
    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, idx) => idx !== index))
    }

    // Insert image directly into description
    const handleInsertDescImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDescImage(true)
        setErrorMsg(null)
        try {
            const url = await uploadImageToSupabase(file)
            const imgHtml = `\n<p><img src="${url}" alt="Product detail image" style="max-width:100%; border-radius:8px; margin:8px 0;" /></p>\n`
            setDescription(prev => prev + imgHtml)
            setSuccessMsg('Image inserted into description!')
            setTimeout(() => setSuccessMsg(null), 3000)
        } catch (err: any) {
            setErrorMsg('Failed to insert description image: ' + err.message)
        } finally {
            setUploadingDescImage(false)
            if (descImageInputRef.current) descImageInputRef.current.value = ''
        }
    }

    // Save Draft
    const handleSaveDraft = async () => {
        setSavingDraft(true)
        setErrorMsg(null)
        setSuccessMsg(null)
        try {
            const res = await fetch('/api/daraz/products/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_draft',
                    productId: product.productId || product.item_id,
                    name: name.trim(),
                    images,
                    shortDescription: shortDescription.trim(),
                    description: description.trim(),
                    price: price === '' ? 0 : Number(price),
                    specialPrice: specialPrice === '' ? undefined : Number(specialPrice),
                    sellerSku: mainSku.SellerSku,
                    sellerAccount: product.sellerAccount,
                    storeId: product.storeId,
                })
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Failed to save draft')

            setSuccessMsg('Draft saved! You can edit or push to Daraz whenever ready.')
            setTimeout(() => {
                onSuccess()
            }, 1000)
        } catch (err: any) {
            setErrorMsg(err.message)
        } finally {
            setSavingDraft(false)
        }
    }

    // Push live update to Daraz
    const handlePushToDaraz = async () => {
        if (!name.trim()) {
            setErrorMsg('Product title is required.')
            return
        }
        if (images.length === 0) {
            setErrorMsg('At least one product image is required.')
            return
        }

        setPushing(true)
        setErrorMsg(null)
        setSuccessMsg(null)
        try {
            const res = await fetch('/api/daraz/products/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'push',
                    productId: product.productId || product.item_id,
                    itemId: product.daraz_item_id || product.item_id,
                    name: name.trim(),
                    images,
                    shortDescription: shortDescription.trim(),
                    description: description.trim(),
                    price: price === '' ? 0 : Number(price),
                    specialPrice: specialPrice === '' ? undefined : Number(specialPrice),
                    sellerSku: mainSku.SellerSku,
                    sellerAccount: product.sellerAccount,
                    storeId: product.storeId,
                })
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Failed to push update to Daraz')

            setSuccessMsg('Successfully updated and pushed to Daraz!')
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 1200)
        } catch (err: any) {
            setErrorMsg(err.message)
        } finally {
            setPushing(false)
        }
    }

    return (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col border-l dark:border-zinc-800 animate-slide-in">
            {/* Header */}
            <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/80 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-orange-500" size={20} />
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Edit Daraz Listing
                            {product.daraz_push_status === 'draft_saved' && (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <FileText size={11} /> Draft Saved
                                </span>
                            )}
                            {product.daraz_push_status === 'pushed' && (
                                <span className="text-[11px] font-semibold text-green-700 bg-green-100 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Pushed
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Store: <span className="font-semibold text-gray-700 dark:text-gray-300">{product.sellerAccount}</span> | SKU: <span className="font-mono text-gray-600 dark:text-gray-300">{mainSku.SellerSku}</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full text-gray-500 transition-colors"
                    title="Close"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Notifications */}
            {errorMsg && (
                <div className="m-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
            {successMsg && (
                <div className="m-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
                {/* 1. Category (Locked) */}
                <div className="bg-gray-50 dark:bg-zinc-850 p-3 rounded-lg border dark:border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Primary Category (Locked)</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{product.primaryCategory || 'Default Category'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-200/60 dark:bg-zinc-800 px-2 py-1 rounded">
                        <Lock size={12} />
                        <span>Cannot change</span>
                    </div>
                </div>

                {/* 2. Product Title */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                            Product Title <span className="text-red-500">*</span>
                        </label>
                        <span className={`text-[11px] ${name.length < 10 || name.length > 255 ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                            {name.length}/255 chars
                        </span>
                    </div>
                    <textarea
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        rows={2}
                        placeholder="e.g. 5 Pcs Cable Protector Mac Charging And Sync Cable"
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                    />
                </div>

                {/* 3. Product Images */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                            Product Images ({images.length}/8)
                        </label>
                        <span className="text-[11px] text-gray-400">3+ images recommended for Excellent score</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className="relative group w-20 h-20 rounded-lg border dark:border-zinc-700 overflow-hidden bg-gray-100 dark:bg-zinc-800 shadow-sm flex-shrink-0"
                            >
                                <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                                
                                {idx === 0 && (
                                    <span className="absolute top-1 left-1 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                                        Cover
                                    </span>
                                )}

                                {/* Overlay actions */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                    {idx !== 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleSetPrimaryImage(idx)}
                                            className="p-1 bg-white/90 hover:bg-white text-gray-800 rounded shadow"
                                            title="Set as Cover Image"
                                        >
                                            <Star size={13} className="text-amber-500 fill-amber-500" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(idx)}
                                        className="p-1 bg-red-600 text-white hover:bg-red-700 rounded shadow"
                                        title="Remove Image"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {images.length < 8 && (
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-orange-500 dark:hover:border-orange-500 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-orange-500 transition-all bg-gray-50/50 dark:bg-zinc-850"
                            >
                                {uploadingImage ? (
                                    <Loader2 size={18} className="animate-spin text-orange-500" />
                                ) : (
                                    <>
                                        <Plus size={18} />
                                        <span className="text-[10px] font-semibold">Add Image</span>
                                    </>
                                )}
                            </button>
                        )}
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleAddImages}
                        />
                    </div>
                </div>

                {/* 4. Pricing */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-850 p-4 rounded-lg border dark:border-zinc-800">
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Regular Price (Rs.)</label>
                        <input
                            type="number"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="e.g. 500"
                            className="w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Special / Sales Price (Rs.)</label>
                        <input
                            type="number"
                            min="0"
                            value={specialPrice}
                            onChange={(e) => setSpecialPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="e.g. 380"
                            className="w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm font-semibold text-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                    </div>
                </div>

                {/* 5. Highlights (Bullet Points) */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                            Highlights (Bullet Points)
                        </label>
                        <span className="text-[11px] text-gray-400">One bullet per line (≥3 for Excellent score)</span>
                    </div>
                    <textarea
                        value={shortDescription}
                        onChange={(e) => setShortDescription(e.target.value)}
                        rows={4}
                        placeholder="• High quality material&#10;• Easy to use and carry&#10;• Durable and long-lasting"
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono leading-relaxed"
                    />
                </div>

                {/* 6. Full Description with Image Inserter */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                            Full Description (HTML / Rich text)
                        </label>
                        {/* Insert Image button */}
                        <div>
                            <button
                                type="button"
                                onClick={() => descImageInputRef.current?.click()}
                                disabled={uploadingDescImage}
                                className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold flex items-center gap-1.5 border dark:border-zinc-700 transition-all"
                                title="Upload and insert an image directly into the description"
                            >
                                {uploadingDescImage ? (
                                    <Loader2 size={13} className="animate-spin text-orange-500" />
                                ) : (
                                    <ImageIcon size={13} className="text-orange-500" />
                                )}
                                Insert Image in Description
                            </button>
                            <input
                                ref={descImageInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleInsertDescImage}
                            />
                        </div>
                    </div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={7}
                        placeholder="<p>Detailed product description, specifications, and usage instructions...</p>"
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs font-mono leading-relaxed"
                    />
                    <p className="text-[11px] text-gray-400">
                        Tip: Including at least one image in the description qualifies the listing for an <strong className="text-green-600">Excellent</strong> content score.
                    </p>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/90 flex items-center justify-between gap-3 sticky bottom-0 z-10">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={pushing || savingDraft}
                    className="px-4 py-2 border dark:border-zinc-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    Cancel
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={savingDraft || pushing}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                        {savingDraft ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <FileText size={15} />
                        )}
                        Save Draft
                    </button>

                    <button
                        type="button"
                        onClick={handlePushToDaraz}
                        disabled={pushing || savingDraft}
                        className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                    >
                        {pushing ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                Updating on Daraz...
                            </>
                        ) : (
                            <>
                                <Send size={15} />
                                Push to Daraz
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
