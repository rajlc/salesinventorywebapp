'use client'

import { useState, useEffect } from 'react'
import { X, Edit } from 'lucide-react'
import { getProductById } from '@/features/inventory/actions/product-actions'
import { useQuery } from '@tanstack/react-query'
import Barcode from 'react-barcode'

interface ViewProductModalProps {
    productId: string | null
    isOpen: boolean
    onClose: () => void
    onEdit: (productId: string) => void
}

export function ViewProductModal({ productId, isOpen, onClose, onEdit }: ViewProductModalProps) {
    // Fetch product details
    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? getProductById(productId) : null,
        enabled: !!productId && isOpen
    })

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen || !productId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-700">
                    <h2 className="text-xl font-bold">Product Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading product details...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">Error: {error.message}</div>
                    ) : !product ? (
                        <div className="text-center py-8 text-gray-500">Product not found</div>
                    ) : (
                        <div className="space-y-6">
                            {/* Row 1: Product Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    Product Name
                                </label>
                                <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                                    {product.product_name}
                                </p>
                            </div>

                            {/* Row 2 & 3: Image (Left) vs Type & ID (Right) */}
                            <div className="grid grid-cols-[120px_1fr] gap-4">
                                {/* Left: Image (Properly fit) */}
                                <div className="aspect-square w-full bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border dark:border-zinc-700 shadow-sm">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.product_name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = ''
                                                e.currentTarget.style.display = 'none'
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                            }}
                                        />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center text-xs text-gray-400 ${product.image_url ? 'hidden' : ''}`}>
                                        No Image
                                    </div>
                                </div>

                                {/* Right: Type & Header */}
                                <div className="flex flex-col gap-4 justify-center">
                                    {/* Row 2 Right: Product Type */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            Type
                                        </label>
                                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${product.product_type === 'combo'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                            {product.product_type === 'combo' ? 'Combo' : 'Single'}
                                        </span>
                                    </div>

                                    {/* Row 3 Right: Product ID */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            Product ID
                                        </label>
                                        <span className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">
                                            #{product.product_id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Row 4 & 5: Spacers */}
                            <div className="h-8"></div>

                            {/* Combo Items */}
                            {product.product_type === 'combo' && product.combo_items && product.combo_items.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Combo Components</h3>
                                    <div className="space-y-2">
                                        {product.combo_items.map((item: any) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border dark:border-purple-800"
                                            >
                                                <div>
                                                    <p className="font-medium text-sm">{item.child?.product_name || 'Unknown Product'}</p>
                                                    <p className="text-xs text-gray-500">ID: {item.child?.product_id}</p>
                                                </div>
                                                <div className="text-base font-bold text-purple-700 dark:text-purple-400">
                                                    × {item.quantity}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Seller SKUs and Accounts */}
                            {product.product_type === 'single' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b dark:border-zinc-800 pb-2">
                                        Seller SKUs & Accounts
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[1, 2, 3, 4].map((num) => {
                                            const skuKey = `seller_sku${num}` as keyof typeof product
                                            const accountKey = `seller_account${num}` as keyof typeof product
                                            const sku = product[skuKey]
                                            const account = product[accountKey]

                                            if (!sku && !account) return null

                                            return (
                                                <div key={num} className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border dark:border-zinc-800">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Seller SKU {num}</p>
                                                            <p className="font-medium text-sm text-gray-900 dark:text-gray-200 break-all">{sku || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Account {num}</p>
                                                            <p className="font-medium text-sm text-gray-900 dark:text-gray-200">{account || '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Daraz Sync Details */}
                            {(product.product_title || product.category_name || product.regular_price !== null || product.special_price !== null || (product.other_images && product.other_images.length > 0) || product.highlights || product.description) && (
                                <div className="border-t dark:border-zinc-800 pt-6 space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-1 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Daraz Sync Details</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-orange-50/5 dark:bg-zinc-800/10 p-5 rounded-xl border border-orange-100/30 dark:border-zinc-800/50">
                                        {/* Left Column: Basic Metadata */}
                                        <div className="space-y-4">
                                            {product.product_title && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                        Daraz Product Title
                                                    </label>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                                        {product.product_title}
                                                    </p>
                                                </div>
                                            )}

                                            {product.category_name && (
                                                <div className="flex flex-wrap gap-4 items-center">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                            Daraz Category
                                                        </label>
                                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 rounded border border-orange-100 dark:border-orange-900/30">
                                                            {product.category_name}
                                                        </span>
                                                    </div>
                                                    {product.website_category && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                                Website Category
                                                            </label>
                                                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/30">
                                                                {product.website_category}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                {product.regular_price !== undefined && product.regular_price !== null && (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                            Regular Price
                                                        </label>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                                                            Rs. {product.regular_price}
                                                        </p>
                                                    </div>
                                                )}

                                                {product.special_price !== undefined && product.special_price !== null && (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                            Special Price
                                                        </label>
                                                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/10 px-2 py-0.5 rounded border border-emerald-100/50 dark:border-emerald-950/20 inline-block">
                                                            Rs. {product.special_price}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Column: Other Images Gallery */}
                                        {product.other_images && product.other_images.length > 0 && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                    Other Images ({product.other_images.length})
                                                </label>
                                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                                                    {product.other_images.map((imgUrl: string, idx: number) => (
                                                        <a 
                                                            key={idx} 
                                                            href={imgUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="relative w-12 h-12 rounded-lg overflow-hidden border dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm transition-all hover:scale-105 active:scale-95 group cursor-zoom-in flex-shrink-0"
                                                        >
                                                            <img 
                                                                src={imgUrl} 
                                                                alt={`Product image ${idx + 2}`} 
                                                                className="w-full h-full object-cover" 
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Highlights Section */}
                                    {product.highlights && (
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                Product Highlights
                                            </label>
                                            <div 
                                                className="text-xs text-gray-700 dark:text-gray-300 max-w-none bg-gray-50 dark:bg-zinc-800/20 p-4 rounded-xl border dark:border-zinc-800/50 max-h-40 overflow-y-auto leading-relaxed prose dark:prose-invert"
                                                dangerouslySetInnerHTML={{ __html: product.highlights }}
                                            />
                                        </div>
                                    )}

                                    {/* Description Section */}
                                    {product.description && (
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                Product Description
                                            </label>
                                            <div 
                                                className="text-xs text-gray-700 dark:text-gray-300 max-w-none bg-gray-50 dark:bg-zinc-800/20 p-4 rounded-xl border dark:border-zinc-800/50 max-h-60 overflow-y-auto leading-relaxed prose dark:prose-invert"
                                                dangerouslySetInnerHTML={{ __html: product.description }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Audit Trail */}
                            <div className="pt-4">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b dark:border-zinc-800 pb-2 mb-4">
                                    Audit Trail
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3 text-sm">
                                        <div className="w-1 h-full min-h-[40px] bg-blue-500 rounded-full"></div>
                                        <div>
                                            <p className="text-xs text-gray-500">Created / Imported</p>
                                            <p className="font-medium text-gray-900 dark:text-gray-200">
                                                {product.created_by_name || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(product.created_at).toLocaleString()}
                                            </p>
                                            {product.import_flag && (
                                                <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                                                    Imported
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {product.updated_at !== product.created_at && (
                                        <div className="flex gap-3 text-sm">
                                            <div className="w-1 h-full min-h-[40px] bg-green-500 rounded-full"></div>
                                            <div>
                                                <p className="text-xs text-gray-500">Last Updated</p>
                                                <p className="font-medium text-gray-900 dark:text-gray-200">
                                                    {product.updated_by_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(product.updated_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {product && (
                    <div className="border-t dark:border-zinc-700 p-6 flex items-center justify-end gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                onEdit(productId)
                                onClose()
                            }}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                            <Edit size={16} />
                            Edit
                        </button>
                    </div>
                )}
            </div>
        </div >
    )
}
