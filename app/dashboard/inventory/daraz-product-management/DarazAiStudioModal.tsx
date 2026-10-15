'use client'

import { useState } from 'react'
import {
    Sparkles, X, Check, Loader2, Download, RefreshCw, Eye,
    Layers, Wand2, Camera, CheckCircle2, AlertCircle, Maximize2,
    SlidersHorizontal, ArrowRight, ShieldCheck
} from 'lucide-react'

export interface DarazAiStudioModalProps {
    isOpen: boolean
    onClose: () => void
    rawImages: string[]
    productName: string
    categoryPath?: string
    price?: number | string
    onApplyImages: (appliedUrls: string[], mode: 'replace' | 'append') => Promise<void> | void
}

interface SlotInfo {
    id: number
    title: string
    badge: string
    badgeColor: string
    isFree: boolean
    desc: string
    previewTip: string
}

const STUDIO_SLOTS: SlotInfo[] = [
    {
        id: 1,
        title: 'Main Studio Cover Image',
        badge: '100% Free · Daraz SEO',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        isFree: true,
        desc: 'Pure #FFFFFF 1000×1000 studio white canvas with balanced lighting & soft contact shadow. Highest CTR and 0% risk of search suppression.',
        previewTip: 'Daraz Catalog Compliant (1:1 Square)'
    },
    {
        id: 2,
        title: 'Side-by-Side / Multi-Angle View',
        badge: 'AI Studio Scene',
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        isFree: false,
        desc: 'Product + packaging or 45° angle perspective showing item dimensions and profile view to build customer confidence.',
        previewTip: 'Perspective & Packaging Layout'
    },
    {
        id: 3,
        title: 'Refined Texture & Micro-Detail',
        badge: '100% Free · Enhanced Detail',
        badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        isFree: true,
        desc: 'Ultra-sharp unsharp mask filter, micro-texture clarity, and balanced contrast so customers can verify build quality.',
        previewTip: 'High-Clarity Material Detail'
    },
    {
        id: 4,
        title: 'Lifestyle & In-Context Scene',
        badge: 'AI Studio Scene',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        isFree: false,
        desc: 'Photorealistic real-world placement (desk, kitchen counter, shelf, living room) demonstrating product scale and aesthetic.',
        previewTip: 'Real-World Atmosphere'
    }
]

export default function DarazAiStudioModal({
    isOpen,
    onClose,
    rawImages,
    productName,
    categoryPath = 'General Merchandise',
    price = '',
    onApplyImages
}: DarazAiStudioModalProps) {
    // ── State ────────────────────────────────────────────────────────────────
    const [selectedSlots, setSelectedSlots] = useState<number[]>([1, 2, 3, 4])
    const [selectedRawImageIdx, setSelectedRawImageIdx] = useState<number>(0)
    const [step, setStep] = useState<'select' | 'generating' | 'preview'>('select')
    const [statusMessage, setStatusMessage] = useState<string>('Preparing studio environment...')
    const [generatedResults, setGeneratedResults] = useState<Record<number, string>>({})
    const [approvedSlots, setApprovedSlots] = useState<Set<number>>(new Set([1, 2, 3, 4]))
    const [applyMode, setApplyMode] = useState<'append' | 'replace'>('append')
    const [regeneratingSlot, setRegeneratingSlot] = useState<number | null>(null)
    const [isApplying, setIsApplying] = useState<boolean>(false)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    if (!isOpen) return null

    const currentRawUrl = rawImages[selectedRawImageIdx] || rawImages[0] || '/placeholder.png'

    // ── Selection helpers ────────────────────────────────────────────────────
    const toggleSlot = (id: number) => {
        setSelectedSlots(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id].sort((a, b) => a - b)
        )
    }

    const selectPreset = (type: 'all' | 'free' | 'cover') => {
        if (type === 'all') setSelectedSlots([1, 2, 3, 4])
        else if (type === 'free') setSelectedSlots([1, 3])
        else if (type === 'cover') setSelectedSlots([1])
    }

    // ── Main Generation ──────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (selectedSlots.length === 0) {
            alert('Please select at least one image slot to generate.')
            return
        }

        if (!currentRawUrl || currentRawUrl === '/placeholder.png') {
            alert('Please ensure your product has at least one raw image before generating.')
            return
        }

        setStep('generating')
        setStatusMessage('Reading original camera capture...')

        try {
            // Simulated gradual status messages for smooth UX
            const statusTimer1 = setTimeout(() => {
                setStatusMessage('Generating Pure White Studio Cover (Slot 1)...')
            }, 1200)
            const statusTimer2 = setTimeout(() => {
                setStatusMessage('Processing AI perspective & texture refinement...')
            }, 3000)

            const res = await fetch('/api/daraz/products/ai-image-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawImageUrl: currentRawUrl,
                    productName,
                    categoryPath,
                    price,
                    selectedSlots
                })
            })

            clearTimeout(statusTimer1)
            clearTimeout(statusTimer2)

            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate studio images')
            }

            setGeneratedResults(data.results || {})
            // Pre-select all successfully returned slots for approval
            const returnedSlots = Object.keys(data.results || {}).map(Number)
            setApprovedSlots(new Set(returnedSlots))
            setStep('preview')
        } catch (err: any) {
            console.error('[AIStudio] Generation error:', err)
            alert('Image generation failed: ' + (err.message || 'Unknown error'))
            setStep('select')
        }
    }

    // ── Regenerate Individual Slot ───────────────────────────────────────────
    const handleRegenerateSlot = async (slotId: number) => {
        setRegeneratingSlot(slotId)
        try {
            const res = await fetch('/api/daraz/products/ai-image-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawImageUrl: currentRawUrl,
                    productName,
                    categoryPath,
                    price,
                    selectedSlots: [slotId]
                })
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || `Failed to regenerate Slot ${slotId}`)
            }

            if (data.results && data.results[slotId]) {
                setGeneratedResults(prev => ({
                    ...prev,
                    [slotId]: data.results[slotId]
                }))
                setApprovedSlots(prev => new Set(prev).add(slotId))
            }
        } catch (err: any) {
            alert(`Regeneration failed for Slot ${slotId}: ` + err.message)
        } finally {
            setRegeneratingSlot(null)
        }
    }

    // ── Toggle Approved Slot in Preview ──────────────────────────────────────
    const toggleApprovedSlot = (slotId: number) => {
        setApprovedSlots(prev => {
            const next = new Set(prev)
            if (next.has(slotId)) next.delete(slotId)
            else next.add(slotId)
            return next
        })
    }

    // ── Download Generated Image ─────────────────────────────────────────────
    const handleDownloadImage = async (url: string, slotId: number) => {
        try {
            const res = await fetch(url, { mode: 'cors' })
            const blob = await res.blob()
            const objectUrl = window.URL.createObjectURL(blob)
            const safeName = productName.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 35) || 'daraz_product'
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = `${safeName}_slot${slotId}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1500)
        } catch {
            window.open(url, '_blank')
        }
    }

    // ── Apply Selected Images to Listing ─────────────────────────────────────
    const handleApply = async () => {
        const approvedUrls: string[] = []
        // Maintain slot order 1, 2, 3, 4
        ;[1, 2, 3, 4].forEach(slotId => {
            if (approvedSlots.has(slotId) && generatedResults[slotId]) {
                approvedUrls.push(generatedResults[slotId])
            }
        })

        if (approvedUrls.length === 0) {
            alert('Please select at least one generated image to apply to your listing.')
            return
        }

        setIsApplying(true)
        try {
            await onApplyImages(approvedUrls, applyMode)
            onClose()
        } catch (err: any) {
            alert('Failed to apply images: ' + err.message)
        } finally {
            setIsApplying(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden">
                {/* ── Modal Header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-orange-50/70 via-amber-50/30 to-transparent dark:from-orange-950/20 dark:via-amber-950/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-zinc-100">
                                    AI Product Image Studio
                                </h3>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                    Daraz Nepal Ready
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                Transform raw camera photos into 1000×1000 studio white covers & AI lifestyle scenes
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── Product Summary Strip ─────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={currentRawUrl}
                            alt="Reference"
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-zinc-700 bg-white"
                        />
                        <div className="min-w-0">
                            <p className="font-bold text-gray-800 dark:text-zinc-200 truncate max-w-md" title={productName}>
                                {productName}
                            </p>
                            <p className="text-gray-400 truncate text-[11px]">
                                {categoryPath} {price ? `· Rs. ${price}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Multi-raw image selector if product has > 1 raw photos */}
                    {rawImages.length > 1 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-gray-500 font-medium">Base Photo:</span>
                            <div className="flex gap-1">
                                {rawImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedRawImageIdx(idx)}
                                        className={`relative w-7 h-7 rounded border-2 overflow-hidden transition-all ${
                                            selectedRawImageIdx === idx
                                                ? 'border-orange-500 scale-105 shadow-xs'
                                                : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={img} className="w-full h-full object-cover" alt="" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Content Area ─────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    {/* ══ STEP 1: SELECT SLOTS ══ */}
                    {step === 'select' && (
                        <div className="space-y-6">
                            {/* Preset Buttons & Helper */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50/50 to-amber-50/30 dark:from-zinc-800/60 dark:to-zinc-800/30 p-3.5 rounded-xl border border-orange-100 dark:border-zinc-700">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                                        Choose Images to Generate (1 to 4 Slots)
                                    </h4>
                                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                                        Select only the slots you need to save time and API tokens.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => selectPreset('all')}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                            selectedSlots.length === 4
                                                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-orange-400'
                                        }`}
                                    >
                                        Select All (4)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => selectPreset('free')}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                            selectedSlots.length === 2 && selectedSlots.includes(1) && selectedSlots.includes(3)
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-emerald-400'
                                        }`}
                                    >
                                        Free Only (1 & 3)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => selectPreset('cover')}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                            selectedSlots.length === 1 && selectedSlots.includes(1)
                                                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-orange-400'
                                        }`}
                                    >
                                        Cover Only (1)
                                    </button>
                                </div>
                            </div>

                            {/* 4 Slot Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {STUDIO_SLOTS.map(slot => {
                                    const isSelected = selectedSlots.includes(slot.id)
                                    return (
                                        <div
                                            key={slot.id}
                                            onClick={() => toggleSlot(slot.id)}
                                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                                                isSelected
                                                    ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/10 shadow-sm'
                                                    : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
                                                        />
                                                        <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                                                            Slot {slot.id}: {slot.title}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${slot.badgeColor}`}>
                                                        {slot.badge}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed pl-6">
                                                    {slot.desc}
                                                </p>
                                            </div>

                                            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] pl-6 text-gray-400">
                                                <span>{slot.previewTip}</span>
                                                {slot.isFree ? (
                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <ShieldCheck size={12} /> 0 Cost
                                                    </span>
                                                ) : (
                                                    <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                                        <Wand2 size={12} /> Imagen 3
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Informational Callout */}
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300">
                                <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">Daraz Best Practice:</span> Slot 1 delivers a clean pure white background required by Daraz search algorithms. You can customize the image generation model and custom prompt instructions anytime in <strong>Settings &gt; AI Integration</strong>.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 2: GENERATING STATE ══ */}
                    {step === 'generating' && (
                        <div className="py-16 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-200">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 animate-pulse">
                                    <Sparkles size={36} />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-orange-500 flex items-center justify-center">
                                    <Loader2 size={15} className="animate-spin text-orange-500" />
                                </div>
                            </div>

                            <div className="space-y-2 max-w-md">
                                <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                                    Generating Studio Product Photos
                                </h4>
                                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold animate-pulse">
                                    {statusMessage}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                    Processing {selectedSlots.length} requested image slots with 1000×1000 square resolution...
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {selectedSlots.map(s => (
                                    <span key={s} className="px-2 py-1 text-[11px] rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-medium">
                                        Slot {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 3: SIDE-BY-SIDE PREVIEW & APPROVAL ══ */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Layout: Left = Raw Image, Right = Generated Studio Slots */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                {/* Left Column: Raw Capture (4 of 12 cols on desktop) */}
                                <div className="lg:col-span-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Camera size={14} className="text-gray-500" /> Original Camera Photo
                                        </label>
                                        <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 px-2 py-0.5 rounded font-medium">
                                            Raw Capture
                                        </span>
                                    </div>

                                    <div className="relative rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden bg-gray-50 dark:bg-zinc-800 aspect-square group shadow-xs">
                                        <img
                                            src={currentRawUrl}
                                            alt="Raw Camera Capture"
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setLightboxUrl(currentRawUrl)}
                                            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                            title="View Full Size"
                                        >
                                            <Maximize2 size={14} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-400">
                                        Base reference photograph captured from mobile camera.
                                    </p>
                                </div>

                                {/* Right Column: Generated Studio Slots (8 of 12 cols) */}
                                <div className="lg:col-span-8 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Wand2 size={14} className="text-orange-500" /> AI Studio Results ({Object.keys(generatedResults).length} Generated)
                                        </label>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-400 text-[11px]">
                                                {approvedSlots.size} selected to apply
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {[1, 2, 3, 4].map(slotId => {
                                            const url = generatedResults[slotId]
                                            const slotMeta = STUDIO_SLOTS.find(s => s.id === slotId)
                                            if (!url) return null

                                            const isApproved = approvedSlots.has(slotId)
                                            const isRegenerating = regeneratingSlot === slotId

                                            return (
                                                <div
                                                    key={slotId}
                                                    className={`relative rounded-xl border-2 transition-all p-3 flex flex-col justify-between bg-white dark:bg-zinc-900 ${
                                                        isApproved
                                                            ? 'border-orange-500 shadow-md ring-1 ring-orange-500/20'
                                                            : 'border-gray-200 dark:border-zinc-800 opacity-75'
                                                    }`}
                                                >
                                                    <div>
                                                        {/* Slot Header */}
                                                        <div className="flex items-center justify-between gap-1 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`approve-slot-${slotId}`}
                                                                    checked={isApproved}
                                                                    onChange={() => toggleApprovedSlot(slotId)}
                                                                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
                                                                />
                                                                <label
                                                                    htmlFor={`approve-slot-${slotId}`}
                                                                    className="text-xs font-bold text-gray-800 dark:text-zinc-200 cursor-pointer truncate max-w-[130px]"
                                                                >
                                                                    Slot {slotId}: {slotMeta?.title.split(' ')[0]}
                                                                </label>
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${slotMeta?.badgeColor}`}>
                                                                {slotMeta?.isFree ? 'Free' : 'AI'}
                                                            </span>
                                                        </div>

                                                        {/* Generated Image Preview */}
                                                        <div className="relative rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800 aspect-square group bg-gray-50 dark:bg-zinc-800">
                                                            <img
                                                                src={url}
                                                                alt={`Slot ${slotId}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            {isRegenerating && (
                                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs gap-1">
                                                                    <Loader2 size={20} className="animate-spin text-orange-400" />
                                                                    <span>Regenerating...</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setLightboxUrl(url)}
                                                                    className="p-1 rounded bg-black/70 text-white hover:bg-black"
                                                                    title="View Large"
                                                                >
                                                                    <Maximize2 size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDownloadImage(url, slotId)}
                                                                    className="p-1 rounded bg-black/70 text-white hover:bg-black"
                                                                    title="Download Photo"
                                                                >
                                                                    <Download size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Slot Action Controls */}
                                                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleApprovedSlot(slotId)}
                                                            className={`font-semibold cursor-pointer ${
                                                                isApproved
                                                                    ? 'text-orange-600 dark:text-orange-400'
                                                                    : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                        >
                                                            {isApproved ? '✓ Included' : '+ Include'}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRegenerateSlot(slotId)}
                                                            disabled={isRegenerating}
                                                            className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition-colors disabled:opacity-50"
                                                            title="Regenerate only this slot"
                                                        >
                                                            <RefreshCw size={11} className={isRegenerating ? 'animate-spin' : ''} />
                                                            <span>Regenerate</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                    {step === 'select' ? (
                        <>
                            <div className="text-xs text-gray-500 dark:text-zinc-400">
                                {selectedSlots.length} of 4 images selected for generation
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={selectedSlots.length === 0}
                                    className="px-5 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    <Sparkles size={14} />
                                    Generate {selectedSlots.length} Image{selectedSlots.length !== 1 ? 's' : ''}
                                </button>
                            </div>
                        </>
                    ) : step === 'generating' ? (
                        <div className="w-full flex justify-end">
                            <span className="text-xs text-gray-400 italic">
                                Please wait while studio images are prepared...
                            </span>
                        </div>
                    ) : (
                        <>
                            {/* In Preview: Option to replace or append */}
                            <div className="flex items-center gap-4 text-xs">
                                <span className="font-semibold text-gray-700 dark:text-zinc-300">
                                    Placement:
                                </span>
                                <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-zinc-400">
                                    <input
                                        type="radio"
                                        name="studio-apply-mode"
                                        checked={applyMode === 'append'}
                                        onChange={() => setApplyMode('append')}
                                        className="text-orange-500 focus:ring-orange-400"
                                    />
                                    Append to existing photos
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-zinc-400">
                                    <input
                                        type="radio"
                                        name="studio-apply-mode"
                                        checked={applyMode === 'replace'}
                                        onChange={() => setApplyMode('replace')}
                                        className="text-orange-500 focus:ring-orange-400"
                                    />
                                    Replace current photos
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStep('select')}
                                    className="px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    ← Back to Selection
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={approvedSlots.size === 0 || isApplying}
                                    className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    {isApplying ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={14} />
                                    )}
                                    Apply {approvedSlots.size} Photo{approvedSlots.size !== 1 ? 's' : ''} to Listing
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Lightbox Overlay for Fullscreen Preview ─────────────────── */}
            {lightboxUrl && (
                <div
                    onClick={() => setLightboxUrl(null)}
                    className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <img
                            src={lightboxUrl}
                            alt="Full preview"
                            className="max-h-[85vh] max-w-full rounded-lg object-contain border border-white/20 shadow-2xl"
                        />
                        <button
                            type="button"
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-10 right-0 text-white hover:text-orange-400 p-2 text-sm font-semibold flex items-center gap-1"
                        >
                            <X size={20} /> Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
