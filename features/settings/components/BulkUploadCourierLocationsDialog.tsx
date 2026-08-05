"use client"

import { useState } from "react"
import { X, Upload, Download } from "lucide-react"
import { bulkCreateCourierLocations } from "../actions/courier-location-actions"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

interface BulkUploadCourierLocationsDialogProps {
    isOpen: boolean
    onClose: () => void
    courierId: string
}

export default function BulkUploadCourierLocationsDialog({ isOpen, onClose, courierId }: BulkUploadCourierLocationsDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const queryClient = useQueryClient()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && selectedFile.type === "text/csv") {
            setFile(selectedFile)
        } else {
            toast.error("Please select a valid CSV file")
            e.target.value = ""
        }
    }

    const downloadTemplate = () => {
        const csvContent = "Branch,Delivery Charge,Cover Area\nKATHMANDU,100,Thamel\nPOKHARA,150,Lakeside"
        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "courier_locations_template.csv"
        a.click()
        window.URL.revokeObjectURL(url)
    }

    const parseCSV = (text: string) => {
        const lines = text.split("\n").filter(line => line.trim())
        const headers = lines[0].split(",").map(h => h.trim())

        // Validate headers
        if (!headers.includes("Branch") || !headers.includes("Delivery Charge")) {
            throw new Error("CSV must include 'Branch' and 'Delivery Charge' columns")
        }

        const branchIndex = headers.indexOf("Branch")
        const chargeIndex = headers.indexOf("Delivery Charge")
        const coverAreaIndex = headers.indexOf("Cover Area")

        const locations = []
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => v.trim())

            if (values.length < 2) continue

            const branch = values[branchIndex]
            const charge = parseFloat(values[chargeIndex])

            if (!branch || isNaN(charge)) {
                throw new Error(`Invalid data at row ${i + 1}`)
            }

            locations.push({
                branch_name: branch,
                delivery_charge: charge,
                cover_area: coverAreaIndex >= 0 ? values[coverAreaIndex] : undefined
            })
        }

        return locations
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!file) {
            toast.error("Please select a CSV file")
            return
        }

        setIsSubmitting(true)

        try {
            const text = await file.text()
            const locations = parseCSV(text)

            if (locations.length === 0) {
                toast.error("No valid locations found in CSV")
                return
            }

            await bulkCreateCourierLocations(courierId, locations)
            toast.success(`Successfully imported ${locations.length} location(s)`)
            queryClient.invalidateQueries({ queryKey: ['courier-locations', courierId] })
            setFile(null)
            onClose()
        } catch (error: any) {
            console.error("Failed to upload locations:", error)
            toast.error(error.message || "Failed to upload CSV. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-semibold">Bulk Upload Locations</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Upload CSV File</label>
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                                <Download size={14} />
                                Download Template
                            </button>
                        </div>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                        />
                        {file && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                                Selected: {file.name}
                            </p>
                        )}
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <h4 className="text-sm font-medium mb-2">Required CSV Format:</h4>
                        <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                            <li>• <strong>Branch</strong> (required)</li>
                            <li>• <strong>Delivery Charge</strong> (required, number)</li>
                            <li>• <strong>Cover Area</strong> (optional)</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !file}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            <Upload size={16} />
                            {isSubmitting ? "Uploading..." : "Upload"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
