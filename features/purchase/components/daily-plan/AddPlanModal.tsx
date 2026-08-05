'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createPurchasePlan, getProductPurchaseStats, ProductPurchaseStats } from '@/features/purchase/actions/plan-actions'
import { getAllProductOptions, getProductBySku } from '@/features/inventory/actions/product-actions'
import { toast } from 'sonner'
import Select from 'react-select'

export function AddPlanModal({
    onPlanAdded,
    trigger,
    prefilledProductId,
    prefilledQuantity,
    prefilledRemarks,
    onSuccess,
    isOpen: externalIsOpen,
    onClose: externalOnClose,
    onOpenChange
}: {
    onPlanAdded: () => void
    trigger?: React.ReactNode
    prefilledProductId?: string
    prefilledQuantity?: number
    prefilledRemarks?: string
    onSuccess?: () => void
    isOpen?: boolean
    onClose?: () => void
    onOpenChange?: (isOpen: boolean) => void
}) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Use external control if provided, otherwise use internal state
    const open = externalIsOpen !== undefined ? externalIsOpen : internalOpen
    const setOpen = (value: boolean) => {
        if (externalOnClose) {
            if (!value) externalOnClose()
        } else {
            setInternalOpen(value)
        }
        onOpenChange?.(value)
    }

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [productId, setProductId] = useState('')
    const [productName, setProductName] = useState('') // Controlled display label for Select
    const [sellerSku, setSellerSku] = useState('')
    const [quantity, setQuantity] = useState(prefilledQuantity || 1)
    const [remarks, setRemarks] = useState('')
    const [status, setStatus] = useState('Pending')

    // Stats
    const [stats, setStats] = useState<ProductPurchaseStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)

    // Product Options
    const [productOptions, setProductOptions] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)

    // Load stats when product changes
    useEffect(() => {
        if (productId) {
            setStatsLoading(true)
            getProductPurchaseStats(productId)
                .then(data => setStats(data))
                .catch(() => console.error("Failed to load stats"))
                .finally(() => setStatsLoading(false))
        } else {
            setStats(null)
        }
    }, [productId])

    // Load Products on Mount
    useEffect(() => {
        setLoadingProducts(true)
        getAllProductOptions()
            .then(products => {
                const options = products.map((p: any) => ({
                    value: p.id,
                    label: `${p.product_name} ${p.seller_sku1 ? `(${p.seller_sku1})` : ''}`,
                    product: p
                }))
                setProductOptions(options)
            })
            .catch(err => console.error("Failed to load products", err))
            .finally(() => setLoadingProducts(false))
    }, [])

    // Handle prefilled data when modal opens
    useEffect(() => {
        if (open) {
            // Handle prefilled Product ID
            if (prefilledProductId && productOptions.length > 0 && !productId) {
                const option = productOptions.find(opt => opt.value === prefilledProductId)
                if (option) {
                    setProductId(option.value)
                    setProductName(option.label)
                    // Auto-fill seller sku
                    const p = option.product
                    setSellerSku(p.seller_sku1 || p.seller_sku2 || '')
                }
            }

            // Handle prefilled Remarks
            if (prefilledRemarks && !remarks) {
                setRemarks(prefilledRemarks)
            }

            // Handle prefilled Quantity
            if (prefilledQuantity && quantity === 1) {
                setQuantity(prefilledQuantity)
            }
        }
    }, [prefilledProductId, prefilledRemarks, prefilledQuantity, productOptions, open, productId, remarks])

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            resetForm()
        }
    }, [open])

    const handleProductChange = (option: any) => {
        if (option) {
            setProductId(option.value)
            setProductName(option.label)
            // Auto-fill seller sku
            const p = option.product
            setSellerSku(p.seller_sku1 || p.seller_sku2 || '')
        } else {
            setProductId('')
            setProductName('')
            setSellerSku('')
            setStats(null)
        }
    }

    const handleSkuBlur = async () => {
        if (!sellerSku || !sellerSku.trim()) return

        // Simple check to avoid redundant fetch if SKU likely matches current product (could be improved)
        // But for now, always fetch to ensure correctness

        const toastId = toast.loading("Searching product...")
        try {
            const product = await getProductBySku(sellerSku.trim())
            if (product) {
                setProductId(product.id)
                setProductName(`${product.product_name} ${product.seller_sku1 ? `(${product.seller_sku1})` : ''}`)
                toast.success("Product found: " + product.product_name, { id: toastId })
            } else {
                toast.error("No product found with this SKU", { id: toastId })
            }
        } catch (err) {
            toast.dismiss(toastId)
        }
    }

    const resetForm = () => {
        setProductId('')
        setProductName('')
        setSellerSku('')
        setQuantity(prefilledQuantity || 1)
        setRemarks('')
        setStats(null)
        setStatus('Pending')
        setDate(new Date().toISOString().split('T')[0])
    }

    const handleClose = () => {
        // Dirty Check: If any field has data (except defaults)
        const isDirty = productId || sellerSku || quantity !== 1 || remarks || status !== 'Pending'

        if (isDirty) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                return
            }
        }

        resetForm()
        setOpen(false)
    }

    // Sound Logic (Duplicate from PlanList for self-contained modal)
    const playClapSound = () => {
        try {
            const clapAudio = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3");
            clapAudio.volume = 0.5;
            clapAudio.play().catch(e => console.error("Audio play failed", e));
        } catch (e) {
            console.error("Sound error", e)
        }
    }

    const triggerMobileFeedback = (withSound: boolean) => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            if (navigator.vibrate) {
                navigator.vibrate(200)
            }
            if (withSound) {
                playClapSound()
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!productId) {
            toast.error("Product is required")
            return
        }

        setLoading(true)
        try {
            await createPurchasePlan({
                plan_date: date,
                product_id: productId,
                quantity,
                remarks,
                status,
                stats: stats || undefined
            })

            // Mobile Feedback
            triggerMobileFeedback(true)

            toast.success("Plan added successfully")
            resetForm() // Reset immediately after success
            setOpen(false)

            // Use custom callback if provided, otherwise use default behavior
            if (onSuccess) {
                onSuccess()
            } else {
                router.refresh()
                onPlanAdded()
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {!externalIsOpen && trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : !externalIsOpen && !trigger ? (
                <button
                    onClick={() => setOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                >
                    <Plus size={16} /> Add List
                </button>
            ) : null}

            {mounted && open && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
                    <div className="relative bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-700">
                            <h2 className="text-lg font-bold">Add Daily Purchase Plan</h2>
                            <button onClick={handleClose}><X size={20} className="text-gray-500" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 pb-20 md:pb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Date</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700">
                                        <option value="Pending">Pending</option>
                                        <option value="Complete">Complete</option>
                                        <option value="Cancel">Cancel</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Product Name <span className="text-red-500">*</span></label>
                                <Select
                                    options={productOptions}
                                    isLoading={loadingProducts}
                                    onChange={handleProductChange}
                                    value={productId ? { label: productName, value: productId } : null}
                                    className="text-sm"
                                    placeholder={loadingProducts ? "Loading products..." : "Search product..."}
                                    isDisabled={loadingProducts || !!prefilledProductId}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '42px',
                                            borderColor: 'rgb(229 231 235)',
                                            borderRadius: '0.375rem',
                                            backgroundColor: 'white'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            zIndex: 9999,
                                            color: 'black'
                                        }),
                                        menuPortal: (base) => ({ ...base, zIndex: 99999 })
                                    }}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Seller SKUs</label>
                                <input value={sellerSku} onChange={e => setSellerSku(e.target.value)} placeholder="Auto-filled or Enter SKU" className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Quantity</label>
                                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Remarks</label>
                                    <input value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700" />
                                </div>
                            </div>

                            {/* Stats Section */}
                            <div className="border-t pt-4 mt-4 dark:border-zinc-700">
                                <h3 className="font-semibold mb-2 text-sm">Purchase History Stats</h3>
                                {statsLoading ? (
                                    <div className="text-sm text-gray-500">Loading stats...</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border dark:border-zinc-700">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">Latest Purchase</label>
                                            <div className="font-medium">Rs. {stats?.latestPrice || 0}</div>
                                            <div className="text-xs text-gray-500 truncate">{stats?.latestSupplier || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">All-Time Low</label>
                                            <div className="font-medium text-green-600">Rs. {stats?.lowPrice || 0}</div>
                                            <div className="text-xs text-gray-500 truncate">{stats?.lowSupplier || '-'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 px-4 py-3 border-t dark:border-zinc-700 fixed bottom-[60px] md:bottom-0 left-0 right-0 md:static bg-white dark:bg-zinc-900 shrink-0 z-[101] w-full md:w-auto">
                                <button type="button" onClick={handleClose} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                    {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Save Plan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
