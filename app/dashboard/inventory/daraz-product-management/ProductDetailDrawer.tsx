'use client'

import { X, ExternalLink, Image as ImageIcon, CheckCircle, Package, Sparkles } from 'lucide-react'

interface ProductDetailDrawerProps {
    product: any
    onClose: () => void
    onPushToAnotherAccount: (product: any) => void
}

export default function ProductDetailDrawer({ product, onClose, onPushToAnotherAccount }: ProductDetailDrawerProps) {
    const mainSku = product.skus?.[0] || {}
    const allImages = product.images || []

    return (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col border-l dark:border-zinc-800 animate-slide-in">
            {/* Drawer Header */}
            <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Daraz Product Details</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {product.item_id} | Store: {product.sellerAccount}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full">
                    <X size={20} />
                </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Images Carousel Section */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase text-gray-400">Product Images ({allImages.length})</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {allImages.map((img: string, idx: number) => (
                            <img
                                key={idx}
                                src={img}
                                alt={`Image ${idx + 1}`}
                                className="w-24 h-24 rounded object-cover border dark:border-zinc-800 shadow-sm"
                            />
                        ))}
                    </div>
                </div>

                {/* Info Card */}
                <div className="grid grid-cols-2 gap-4 border dark:border-zinc-800 p-4 rounded-lg bg-gray-50/50 dark:bg-zinc-800/30">
                    <div>
                        <span className="text-xs text-gray-400 block">Product Name</span>
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{product.name}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block">Category ID</span>
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{product.primaryCategory}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block">Price / Special Price</span>
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                            Rs. {mainSku.price} {mainSku.special_price && ` / Rs. ${mainSku.special_price}`}
                        </span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block">Quantity / Stock</span>
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{mainSku.quantity || 0}</span>
                    </div>
                </div>

                {/* Highlights */}
                {product.attributes?.short_description && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase text-gray-400">Highlights</h3>
                        <div 
                            className="text-sm border dark:border-zinc-800 p-4 rounded-lg bg-white dark:bg-zinc-900 prose dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: product.attributes.short_description }}
                        />
                    </div>
                )}

                {/* Full Description */}
                {product.attributes?.description && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase text-gray-400">Description</h3>
                        <div 
                            className="text-sm border dark:border-zinc-800 p-4 rounded-lg bg-white dark:bg-zinc-900 prose dark:prose-invert max-w-none max-h-80 overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: product.attributes.description }}
                        />
                    </div>
                )}

                {/* SKU Details */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase text-gray-400">SKU Variants</h3>
                    <div className="divide-y border rounded-lg dark:border-zinc-800 overflow-hidden">
                        {product.skus?.map((sku: any, idx: number) => (
                            <div key={idx} className="p-3 bg-white dark:bg-zinc-900 flex justify-between items-center text-sm">
                                <div>
                                    <span className="font-mono font-semibold block">{sku.SellerSku}</span>
                                    <span className="text-xs text-gray-400">Stock: {sku.quantity} | Weight: {sku.package_weight || '0.1'} kg</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold">Rs. {sku.price}</span>
                                    {sku.special_price && <span className="block text-xs text-orange-500 font-semibold">Promo: Rs. {sku.special_price}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 border rounded text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                    Close
                </button>
                <button
                    onClick={() => {
                        onPushToAnotherAccount(product)
                        onClose()
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                >
                    <Sparkles size={16} />
                    Copy to Another Account
                </button>
            </div>
        </div>
    )
}
