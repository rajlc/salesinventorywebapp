'use client'

import { useState, useRef } from 'react'
import { X, Upload, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { bulkImportDarazOrders } from '@/features/sales/actions/daraz-actions'
import { useQueryClient } from '@tanstack/react-query'

interface ImportDarazOrdersModalProps {
    isOpen: boolean
    onClose: () => void
}

interface ValidationResult {
    row: number
    status: 'valid' | 'error'
    message?: string
    data: any
}

// Required CSS headers
const REQUIRED_HEADERS = [
    'Order Number',
    'Tracking Number',
    'Customer Name',
    'Seller Skus',
    'Quantity',
    'Amount'
]

export function ImportDarazOrdersModal({ isOpen, onClose }: ImportDarazOrdersModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [previewData, setPreviewData] = useState<ValidationResult[]>([])
    const [showResults, setShowResults] = useState(false)
    const [importStats, setImportStats] = useState({ success: 0, failures: 0, failureReasons: [] as any[] })
    const fileInputRef = useRef<HTMLInputElement>(null)
    const queryClient = useQueryClient()

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
                toast.error('Please upload a valid CSV file')
                return
            }
            setFile(selectedFile)
            analyzeFile(selectedFile)
        }
    }

    const analyzeFile = (file: File) => {
        setIsAnalyzing(true)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || []
                const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h))

                if (missingHeaders.length > 0) {
                    toast.error(`Missing required columns: ${missingHeaders.join(', ')}`)
                    setFile(null)
                    setIsAnalyzing(false)
                    return
                }

                // Analyze rows
                const analyzed = results.data.map((row: any, index: number) => {
                    const isValid =
                        row['Order Number']?.trim() &&
                        row['Tracking Number']?.trim() &&
                        row['Customer Name']?.trim()

                    return {
                        row: index + 1,
                        status: isValid ? 'valid' : 'error',
                        message: isValid ? 'Ready to import' : 'Missing required fields',
                        data: row
                    } as ValidationResult
                })

                setPreviewData(analyzed)
                setIsAnalyzing(false)
            },
            error: (error) => {
                toast.error(`Parsig error: ${error.message}`)
                setIsAnalyzing(false)
            }
        })
    }

    const handleImport = async () => {
        const validRows = previewData.filter(r => r.status === 'valid').map(r => r.data)

        if (validRows.length === 0) {
            toast.error('No valid rows found to import')
            return
        }

        setIsImporting(true)

        try {
            const result = await bulkImportDarazOrders(validRows)

            setImportStats({
                success: result.success,
                failures: result.failures.length,
                failureReasons: result.failures
            })
            setShowResults(true)
            toast.success(`Imported ${result.success} orders successfully`)
            // Auto-sync sales entry
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
        } catch (error: any) {
            toast.error(error.message || 'Import failed')
        } finally {
            setIsImporting(false)
        }
    }

    const handleReset = () => {
        setFile(null)
        setPreviewData([])
        setShowResults(false)
        setImportStats({ success: 0, failures: 0, failureReasons: [] })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const validCount = previewData.filter(r => r.status === 'valid').length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-700">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <FileSpreadsheet className="text-green-600" size={16} />
                        Import Daraz Orders (CSV)
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto">

                    {!showResults ? (
                        <>
                            {/* Upload Section */}
                            {!file ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed dark:border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                    <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                                    <p className="text-sm font-medium">Click to upload CSV file</p>
                                    <p className="text-xs text-gray-500 mt-1">Required columns: Order Number, Tracking Number, Customer Name, Seller Skus, Quantity, Amount</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".csv"
                                        className="hidden"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 p-3 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="text-green-600" size={16} />
                                            <div>
                                                <p className="text-xs font-bold">{file.name}</p>
                                                <p className="text-[10px] text-gray-500">{validCount} valid rows found</p>
                                            </div>
                                        </div>
                                        <button onClick={handleReset} className="text-xs text-red-600 hover:text-red-700">Change File</button>
                                    </div>

                                    {/* Preview Table */}
                                    <div className="border dark:border-zinc-700 rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-1.5 font-medium">Row</th>
                                                    <th className="px-2 py-1.5 font-medium">Order#</th>
                                                    <th className="px-2 py-1.5 font-medium">Customer</th>
                                                    <th className="px-2 py-1.5 font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-zinc-700">
                                                {previewData.slice(0, 100).map((row, idx) => (
                                                    <tr key={idx} className={row.status === 'valid' ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                                                        <td className="px-2 py-1">{row.row}</td>
                                                        <td className="px-2 py-1">{row.data['Order Number']}</td>
                                                        <td className="px-2 py-1">{row.data['Customer Name']}</td>
                                                        <td className="px-2 py-1">
                                                            {row.status === 'valid' ? (
                                                                <span className="text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Valid</span>
                                                            ) : (
                                                                <span className="text-red-600 flex items-center gap-1"><AlertCircle size={10} /> Error</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {previewData.length > 100 && (
                                            <div className="text-center py-2 text-[10px] text-gray-400 bg-gray-50 dark:bg-zinc-800">
                                                And {previewData.length - 100} more rows...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Results Section */
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                    <CheckCircle className="mx-auto text-green-600 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importStats.success}</p>
                                    <p className="text-xs text-green-600 dark:text-green-300">Orders Added</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                    <AlertCircle className="mx-auto text-red-600 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{importStats.failures}</p>
                                    <p className="text-xs text-red-600 dark:text-red-300">Failed Rows</p>
                                </div>
                            </div>

                            {importStats.failures > 0 && (
                                <div className="border dark:border-zinc-700 rounded-lg p-3 bg-gray-50 dark:bg-zinc-800/50">
                                    <h3 className="text-xs font-bold mb-2 text-red-600">Failure Reasons:</h3>
                                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                                        {importStats.failureReasons.map((f: any, i) => (
                                            <div key={i} className="text-[10px] text-gray-600 dark:text-gray-300 flex gap-2">
                                                <span className="font-mono bg-white dark:bg-zinc-700 px-1 rounded">Row {f.row}</span>
                                                <span>{f.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-b-lg flex justify-end gap-2">
                    {!showResults ? (
                        <>
                            <button
                                onClick={handleReset}
                                disabled={isImporting}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-zinc-700 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!file || validCount === 0 || isImporting}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImporting && <Loader2 className="animate-spin" size={12} />}
                                {isImporting ? 'Importing...' : 'Start Import'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
