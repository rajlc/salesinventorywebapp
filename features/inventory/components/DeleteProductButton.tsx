'use client'

import { useState } from 'react'
import { Trash2, Clock } from 'lucide-react'
import { deleteProduct } from '@/features/inventory/actions/product-actions'
import { useQueryClient } from '@tanstack/react-query'

interface DeleteProductButtonProps {
    productId: string
    productName: string
    userRole: 'admin' | 'editor' | 'user' | 'new_user'
    isPending?: boolean
}

export function DeleteProductButton({ productId, productName, userRole, isPending = false }: DeleteProductButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const queryClient = useQueryClient()

    // User and New User roles cannot delete products — hide the button entirely
    if (userRole === 'user' || userRole === 'new_user') {
        return null
    }

    const handleDelete = async () => {
        if (isPending) {
            return
        }

        const confirmMessage = userRole === 'admin'
            ? `Are you sure you want to delete "${productName}"? This will move it to Restore Backup.`
            : `Delete Product! Need Admin Approval\n\nProduct: ${productName}\n\nYour delete request will be sent to Admin for approval.`

        if (!confirm(confirmMessage)) {
            return
        }

        setIsDeleting(true)
        try {
            const result = await deleteProduct(productId)
            queryClient.invalidateQueries({ queryKey: ['products'] })

            if (result.status === 'deleted') {
                alert('Product deleted successfully and moved to Restore Backup')
            } else if (result.status === 'pending') {
                alert('Delete request sent for admin approval')
            }
        } catch (error: unknown) {
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsDeleting(false)
        }
    }

    // If pending approval, show clock icon
    if (isPending) {
        return (
            <button
                disabled
                className="w-full text-left px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded cursor-not-allowed flex items-center gap-1.5 transition-colors"
                title="Delete pending approval"
            >
                <Clock size={13} />
                Pending Approval
            </button>
        )
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
            <Trash2 size={13} />
            {isDeleting ? 'Deleting...' : 'Delete Product'}
        </button>
    )
}
