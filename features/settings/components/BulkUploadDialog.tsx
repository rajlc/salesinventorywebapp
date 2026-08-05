"use client"

import { useState } from "react"
import { Upload, X, FileSpreadsheet, AlertCircle, Check } from "lucide-react"
import Papa from "papaparse"
import { bulkCreateDeliveryLocations } from "../actions/delivery-actions"

interface BulkUploadDialogProps {
    isOpen: boolean
    onClose: () => void
}

interface CSVRow {
    Branch: string
    "Delivery Charge": string
    "Cover Area"?: string
    [key: string]: any
}

export default function BulkUploadDialog({ isOpen, onClose }: BulkUploadDialogProps) {
    const [file, setFile] = useState<File | null>(null)
    const [previewData, setPreviewData] = useState<CSVRow[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successCount, setSuccessCount] = useState<number | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setError(null)
            setSuccessCount(null)

            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        setPreviewData(results.data as CSVRow[])
                    } else {
                        setError("File appears to be empty or invalid format.")
                    }
                },
                error: (err) => {
                    setError(`Parsing error: ${err.message}`)
                }
            })
        }
    }

    const handleUpload = async () => {
        if (!previewData.length) return

        try {
            setIsUploading(true)
            setError(null)

            const formattedData = previewData.map(row => {
                const charge = row["Delivery Charge"] || row["delivery charge"] || row["Charge"] || "0"
                const numericCharge = parseFloat(charge.replace(/[^0-9.-]+/g, ""))

                return {
                    branch_name: row["Branch"] || row["branch"] || "",
                    delivery_charge: isNaN(numericCharge) ? 0 : numericCharge,
                    cover_area: row["Cover Area"] || row["cover area"] || ""
                }
            }).filter(item => item.branch_name) // Filter invalid rows

            if (formattedData.length === 0) {
                setError("No valid data found. Please check columns: Branch, Delivery Charge")
                return
            }

            await bulkCreateDeliveryLocations(formattedData)
            setSuccessCount(formattedData.length)
            setFile(null)
            setPreviewData([])

            // Auto close after 2 seconds on success
            setTimeout(() => {
                onClose()
                setSuccessCount(null)
            }, 2000)

        } catch (err: any) {
            setError(err.message || "Upload failed")
        } finally {
            setIsUploading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700 shrink-0">
                    <h2 className="text-lg font-semibold">Bulk Upload Locations</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {!successCount ? (
                        <div className="space-y-6">
                            {/* Upload Area */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    id="csv-upload"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                    <Upload size={32} className="text-gray-400" />
                                    <span className="text-sm font-medium text-blue-600 hover:text-blue-700">Click to upload CSV</span>
                                    <span className="text-xs text-gray-500">Supports .csv files with 200+ rows</span>
                                </label>
                            </div>

                            {/* Template Info */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-semibold mb-1">Required Columns:</p>
                                <ul className="list-disc list-inside space-y-1 opacity-80">
                                    <li>Branch (e.g., Kathmandu)</li>
                                    <li>Delivery Charge (e.g., 100)</li>
                                    <li>Cover Area (Optional)</li>
                                </ul>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {/* Preview */}
                            {previewData.length > 0 && (
                                <div>
                                    <h3 className="font-medium mb-3 flex items-center gap-2">
                                        <FileSpreadsheet size={16} />
                                        Preview ({previewData.length} rows)
                                    </h3>
                                    <div className="border rounded-md overflow-hidden dark:border-zinc-700">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 dark:bg-zinc-900 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 border-b dark:border-zinc-700">Branch</th>
                                                        <th className="px-4 py-2 border-b dark:border-zinc-700">Charge</th>
                                                        <th className="px-4 py-2 border-b dark:border-zinc-700">Coverage</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewData.slice(0, 10).map((row, i) => (
                                                        <tr key={i} className="border-b last:border-0 dark:border-zinc-700">
                                                            <td className="px-4 py-2">{row["Branch"]}</td>
                                                            <td className="px-4 py-2">{row["Delivery Charge"]}</td>
                                                            <td className="px-4 py-2 text-gray-500">{row["Cover Area"]}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {previewData.length > 10 && (
                                                <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-zinc-900 border-t dark:border-zinc-700">
                                                    And {previewData.length - 10} more rows...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                                <Check size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">Upload Successful!</h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Successfully imported {successCount} locations.
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50 shrink-0 flex justify-end gap-3 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-600 dark:hover:bg-zinc-700"
                    >
                        Close
                    </button>
                    {previewData.length > 0 && !successCount && (
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isUploading ? "Importing..." : "Import Locations"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
