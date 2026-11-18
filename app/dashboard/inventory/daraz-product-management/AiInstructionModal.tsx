'use client'

import { useEffect, useState } from 'react'
import { X, Save, RotateCcw, Copy, Check, BookOpen, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AiInstructionModalProps {
    isOpen: boolean
    onClose: () => void
}

const STARTER_PROMPT =
    'Read my Product List Instruction from the connector first, then generate the product title, description, and highlights for this product and save it as a draft.'

export default function AiInstructionModal({ isOpen, onClose }: AiInstructionModalProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [instruction, setInstruction] = useState('')
    const [updatedAt, setUpdatedAt] = useState<string | null>(null)
    const [isDefault, setIsDefault] = useState(true)
    const [canEdit, setCanEdit] = useState(true)
    const [copiedStarter, setCopiedStarter] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/daraz/ai-instruction')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to load AI instruction')
                if (cancelled) return
                setInstruction(data.instruction || '')
                setUpdatedAt(data.updated_at || null)
                setIsDefault(Boolean(data.is_default))
                setCanEdit(data.can_edit !== false)
            } catch (err: any) {
                if (!cancelled) {
                    toast.error(err.message || 'Failed to load AI instruction')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!instruction.trim()) {
            toast.error('Instruction cannot be empty')
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/daraz/ai-instruction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save instruction')
            setInstruction(data.instruction)
            setUpdatedAt(data.updated_at || null)
            setIsDefault(Boolean(data.is_default))
            toast.success('AI Instruction saved! ChatGPT, Claude & Gemini will use this automatically.')
            onClose()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save instruction')
        } finally {
            setSaving(false)
        }
    }

    const handleReset = async () => {
        if (!window.confirm('Reset Product List Instruction back to the default template?')) return
        setResetting(true)
        try {
            const res = await fetch('/api/daraz/ai-instruction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reset: true })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to reset instruction')
            setInstruction(data.instruction)
            setUpdatedAt(null)
            setIsDefault(true)
            toast.success('Reset to default Product List Instruction')
        } catch (err: any) {
            toast.error(err.message || 'Failed to reset instruction')
        } finally {
            setResetting(false)
        }
    }

    const handleCopyStarter = () => {
        navigator.clipboard.writeText(STARTER_PROMPT)
        setCopiedStarter(true)
        toast.success('Starter prompt copied')
        setTimeout(() => setCopiedStarter(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                                Product List Instruction (AI Connector)
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                Auto-injected into ChatGPT, Claude &amp; Gemini so every new chat follows your exact rules.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Status & Starter Bar */}
                <div className="px-5 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                                isDefault
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                        >
                            <Sparkles size={11} />
                            {isDefault ? 'Default Template' : 'Custom Instruction Active'}
                        </span>
                        {updatedAt && (
                            <span className="text-gray-500 dark:text-zinc-400">
                                Updated {new Date(updatedAt).toLocaleString()}
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyStarter}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 font-medium transition-colors cursor-pointer"
                    >
                        {copiedStarter ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {copiedStarter ? 'Copied!' : 'Copy Chat Starter'}
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 overflow-y-auto space-y-3">
                    {loading ? (
                        <div className="h-72 flex items-center justify-center text-sm text-gray-500 dark:text-zinc-400 gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            Loading instruction...
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                disabled={!canEdit || saving || resetting}
                                rows={15}
                                placeholder="Write your Product List Instruction here (title format, description HTML structure, highlight count, forbidden words, etc.)..."
                                className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-xs sm:text-sm font-mono text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-y leading-relaxed disabled:opacity-60"
                            />
                            <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                                <strong>How it works:</strong> Claude receives this automatically on session connect, and ChatGPT/Gemini receive it via{' '}
                                <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">get_product_list_instruction</code> and automatic tool injection — even if you forget to mention &quot;Product List Instruction&quot; in your chat.
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={!canEdit || loading || saving || resetting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-200/70 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        <RotateCcw size={13} />
                        {resetting ? 'Resetting...' : 'Reset Default'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        {canEdit && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={loading || saving || resetting}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                            >
                                <Save size={13} />
                                {saving ? 'Saving...' : 'Save Instruction'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
