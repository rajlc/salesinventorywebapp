'use client'

import { useState, useEffect } from 'react'
import { getProductById } from '@/features/inventory/actions/product-actions'
import { X, Package, ArrowRight } from 'lucide-react'

interface ComboComponentSelectModalProps {
    comboProductId: string | null
    comboProductName: string | null
    initialComponents?: any[] // Support pre-loaded components
    onClose: () => void
    onSelectComponent: (componentProduct: any) => void
}

export function ComboComponentSelectModal({ comboProductId, comboProductName, initialComponents, onClose, onSelectComponent }: ComboComponentSelectModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [components, setComponents] = useState<any[]>(initialComponents || [])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (comboProductId) {
            if (initialComponents && initialComponents.length > 0) {
                setComponents(initialComponents)
                setIsLoading(false)
            } else {
                fetchComponents()
            }
        }
    }, [comboProductId, initialComponents])

    const fetchComponents = async () => {
        if (!comboProductId) return

        setIsLoading(true)
        setError(null)
        try {
            const product = await getProductById(comboProductId)
            if (product.product_type === 'combo' && product.combo_items) {
                setComponents(product.combo_items)
            } else {
                setError('This product is not a combo or has no components.')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load components')
        } finally {
            setIsLoading(false)
        }
    }

    if (!comboProductId) return null

    // Handle click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Select Component</h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            From Bundle: {comboProductName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-500">Loading components...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    ) : components.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No components found for this combo.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                Please select which individual component you want to process:
                            </p>
                            <div className="grid gap-2">
                                {components.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => onSelectComponent(item.child)}
                                        className="group relative flex items-center justify-between w-full p-4 text-left border dark:border-zinc-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors">
                                                <Package className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {item.child.product_name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    Quantity in Bundle: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{item.quantity}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
