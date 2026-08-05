'use client'

import { useState } from 'react'
import { ProductForm } from '@/features/inventory/components/ProductForm'
import { updateProduct, getProductById } from '@/features/inventory/actions/product-actions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'

interface EditProductModalProps {
    productId: string | null
    isOpen: boolean
    onClose: () => void
}

export function EditProductModal({ productId, isOpen, onClose }: EditProductModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    // Fetch product details for editing
    const { data: product, isLoading } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? getProductById(productId) : null,
        enabled: !!productId && isOpen
    })

    if (!isOpen || !productId) return null

    const handleSubmit = async (formData: any) => {
        setIsSubmitting(true)
        try {
            await updateProduct(productId, formData)

            // Refresh product list and details
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['product', productId] })

            alert('Product updated successfully!')
            onClose()
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-700">
                    <h2 className="text-xl font-bold">Edit Product</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading product...</div>
                    ) : product ? (
                        <ProductForm
                            initialData={product}
                            onSubmit={handleSubmit}
                            onCancel={onClose}
                            isSubmitting={isSubmitting}
                        />
                    ) : (
                        <div className="text-center py-8 text-gray-500">Product not found</div>
                    )}
                </div>
            </div>
        </div>
    )
}
