'use client'

interface AdminDeleteConfirmProps {
    isOpen: boolean
    orderNumber: string
    onClose: () => void
    onConfirm: () => void
    isDeleting?: boolean
}

export function AdminDeleteConfirm({
    isOpen,
    orderNumber,
    onClose,
    onConfirm,
    isDeleting = false
}: AdminDeleteConfirmProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="p-4 border-b dark:border-zinc-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Confirm Deletion
                    </h3>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                        <p className="text-sm text-red-800 dark:text-red-300">
                            <strong>Are you sure delete?</strong>
                        </p>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Order: <strong>{orderNumber}</strong>
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        This order will be moved to Restore Backup and can be recovered within 7 days.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Order'}
                    </button>
                </div>
            </div>
        </div>
    )
}
