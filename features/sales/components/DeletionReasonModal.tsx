'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface DeletionReasonModalProps {
    isOpen: boolean
    orderNumber: string
    onClose: () => void
    onSubmit: (reason: string) => void
    isSubmitting?: boolean
}

export function DeletionReasonModal({
    isOpen,
    orderNumber,
    onClose,
    onSubmit,
    isSubmitting = false
}: DeletionReasonModalProps) {
    const [reason, setReason] = useState('')

    if (!isOpen) return null

    const handleSubmit = () => {
        if (reason.trim()) {
            onSubmit(reason)
            setReason('')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Delete Order - Admin Approval Required
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        disabled={isSubmitting}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <strong>Are you sure to Delete?</strong>
                            <br />
                            This request needs Admin Approval!
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Order: <strong>{orderNumber}</strong>
                        </p>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reason for deletion *
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Please provide a reason for deleting this order..."
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100 resize-none"
                            rows={4}
                            disabled={isSubmitting}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            This reason will be sent to the admin for review.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!reason.trim() || isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    )
}
