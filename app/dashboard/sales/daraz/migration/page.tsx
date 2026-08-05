'use client'

import { useState } from 'react'
import { fixHistoricalProductLinks } from '@/features/sales/actions/migration-actions'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui-shim'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function MigrationPage() {
    const [isRunning, setIsRunning] = useState(false)
    const [result, setResult] = useState<any>(null)

    const handleMigration = async () => {
        if (!confirm('This will re-match all order items to products. Continue?')) {
            return
        }

        setIsRunning(true)
        setResult(null)

        try {
            const response = await fixHistoricalProductLinks()
            setResult(response)
        } catch (error: any) {
            setResult({ success: false, error: error.message })
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 p-6">
            <div className="max-w-2xl mx-auto w-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            Product Link Migration
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Fix historical order product links
                        </p>
                    </div>
                    <Link
                        href="/dashboard/sales/daraz/profit-tracker"
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        ← Back to Profit Tracker
                    </Link>
                </div>

                {/* Migration Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Re-match Order Items to Products</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p>This migration will:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Scan all order items in the database</li>
                                <li>Match each item to a product by SKU</li>
                                <li>Update the product_id foreign key</li>
                                <li>Fix incorrect or missing product links</li>
                            </ul>
                            <p className="text-amber-600 dark:text-amber-400 mt-4">
                                <strong>Note:</strong> This is safe to run multiple times
                            </p>
                        </div>

                        <Button
                            onClick={handleMigration}
                            disabled={isRunning}
                            className="w-full"
                        >
                            {isRunning ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Running Migration...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Run Migration
                                </>
                            )}
                        </Button>

                        {/* Results */}
                        {result && (
                            <div className={`mt-4 p-4 rounded-lg border ${result.success
                                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {result.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <h3 className={`font-semibold ${result.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                                            }`}>
                                            {result.success ? 'Migration Successful' : 'Migration Failed'}
                                        </h3>
                                        <p className={`text-sm mt-1 ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                            }`}>
                                            {result.message || result.error}
                                        </p>
                                        {result.success && (
                                            <div className="mt-3 text-sm space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">Total Items:</span>
                                                    <span className="font-medium">{result.total}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">Matched:</span>
                                                    <span className="font-medium text-green-600 dark:text-green-400">{result.matched}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                                                    <span className="font-medium text-blue-600 dark:text-blue-400">{result.updated}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">Unmatched:</span>
                                                    <span className="font-medium text-amber-600 dark:text-amber-400">{result.unmatched}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">After Migration</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Go to the Profit Tracker page</li>
                            <li>Verify Product IDs are now correct</li>
                            <li>Check that Purchase Costs are calculated</li>
                            <li>Review any unmatched items (if shown)</li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
