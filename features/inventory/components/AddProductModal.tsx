'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createProduct } from '@/features/inventory/actions/product-actions'
import { useQueryClient } from '@tanstack/react-query'
import { ProductForm } from '@/features/inventory/components/ProductForm'

interface AddProductModalProps {
    isOpen: boolean
    onClose: () => void
}

export function AddProductModal({ isOpen, onClose }: AddProductModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const queryClient = useQueryClient()

    const handleClose = () => {
        if (hasChanges) {
            if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                onClose()
                setHasChanges(false)
            }
        } else {
            onClose()
        }
    }

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) handleClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, handleClose]) // Added handleClose to dependencies

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose()
        }
    }

    const handleSubmit = async (formData: any) => {
        setIsSubmitting(true)
        try {
            await createProduct(formData)

            // Refresh product list
            queryClient.invalidateQueries({ queryKey: ['products'] })

            // Show success toast (you can add a toast library later)
            alert('Product added successfully!')

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
                onClick={handleBackdropClick}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">Add New Product</h2>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <ProductForm
                        onSubmit={handleSubmit}
                        onCancel={handleClose}
                        isSubmitting={isSubmitting}
                    />
                </div>
            </div>
        </div>
    )
}
