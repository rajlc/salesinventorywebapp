'use client'

import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import Papa from 'papaparse'
import { bulkImportProducts } from '@/features/inventory/actions/product-actions'
import { useQueryClient } from '@tanstack/react-query'

interface ImportCSVModalProps {
    isOpen: boolean
    onClose: () => void
}

interface ImportError {
    row: number
    product: string
    error: string
}

export function ImportCSVModal({ isOpen, onClose }: ImportCSVModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importResult, setImportResult] = useState<{
        success: number
        failed: number
        errors: ImportError[]
    } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const queryClient = useQueryClient()

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile)
            setImportResult(null)
        } else {
            alert('Please select a valid CSV file')
        }
    }

    const handleImport = async () => {
        if (!file) return

        setIsImporting(true)
        setImportResult(null)

        try {
            // Parse CSV file
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        // Call bulk import server action
                        const result = await bulkImportProducts(results.data as any[])

                        setImportResult(result)

                        // Refresh product list
                        queryClient.invalidateQueries({ queryKey: ['products'] })

                        // Show success message
                        if (result.failed === 0) {
                            alert(`Successfully imported ${result.success} products!`)
                        }
                    } catch (error: any) {
                        alert(`Import error: ${error.message}`)
                    } finally {
                        setIsImporting(false)
                    }
                },
                error: (error) => {
                    alert(`CSV parsing error: ${error.message}`)
                    setIsImporting(false)
                }
            })
        } catch (error: any) {
            alert(`Error: ${error.message}`)
            setIsImporting(false)
        }
    }

    const handleReset = () => {
        setFile(null)
        setImportResult(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleClose = () => {
        handleReset()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-700">
                    <h2 className="text-xl font-bold">Import Products from CSV</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Instructions */}
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h3 className="font-semibold mb-2">CSV Format Requirements:</h3>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                            <li>Column headers must match field names exactly</li>
                            <li><code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">product_name</code> is required</li>
                            <li><code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">product_id</code> will be auto-generated if not provided</li>
                            <li>Optional: <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">image_url, product_type, seller_sku1-4, seller_account1-4</code></li>
                            <li>Supports 2000+ rows in a single import</li>
                        </ul>
                    </div>

                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">
                            Select CSV File
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="flex-1 px-3 py-2 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                            />
                            {file && (
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {file && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
                            </p>
                        )}
                    </div>

                    {/* Import Button */}
                    {file && !importResult && (
                        <button
                            onClick={handleImport}
                            disabled={isImporting}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload size={20} />
                            {isImporting ? 'Importing...' : 'Import Products'}
                        </button>
                    )}

                    {/* Import Results */}
                    {importResult && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                                        <CheckCircle size={20} />
                                        <span className="font-semibold">Success</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        {importResult.success}
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-500">products imported</p>
                                </div>

                                {importResult.failed > 0 && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                                            <AlertCircle size={20} />
                                            <span className="font-semibold">Failed</span>
                                        </div>
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                                            {importResult.failed}
                                        </p>
                                        <p className="text-sm text-red-600 dark:text-red-500">products failed</p>
                                    </div>
                                )}
                            </div>

                            {/* Error Details */}
                            {importResult.errors.length > 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                                    <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3">
                                        Import Errors ({importResult.errors.length})
                                    </h4>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {importResult.errors.map((err, idx) => (
                                            <div key={idx} className="p-2 bg-white dark:bg-zinc-800 rounded text-sm">
                                                <span className="font-medium">Row {err.row}:</span> {err.product}
                                                <span className="block text-red-600 dark:text-red-400 ml-4">→ {err.error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reset Button */}
                            <button
                                onClick={handleReset}
                                className="w-full px-6 py-2 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Import Another File
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t dark:border-zinc-700 p-6 flex items-center justify-end gap-4">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
