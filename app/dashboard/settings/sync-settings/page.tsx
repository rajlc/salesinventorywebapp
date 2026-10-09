'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui-shim'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

export default function SyncSettingsPage() {
    const [loading, setLoading] = useState(false)
    const [cutoffDate, setCutoffDate] = useState('')
    const [productCutoffDate, setProductCutoffDate] = useState('')
    const [autoAddPurchaseList, setAutoAddPurchaseList] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings/sync-rules')
            const data = await res.json()
            if (data.cutoff_date) {
                // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
                const date = new Date(data.cutoff_date)
                // Adjust for local timezone input
                const localISOTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                setCutoffDate(localISOTime)
            }
            if (data.product_cutoff_date) {
                // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
                const date = new Date(data.product_cutoff_date)
                // Adjust for local timezone input
                const localISOTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                setProductCutoffDate(localISOTime)
            }
            if (data.auto_add_purchase_list !== undefined) {
                setAutoAddPurchaseList(Boolean(data.auto_add_purchase_list))
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Save as ISO string
            const isoDate = cutoffDate ? new Date(cutoffDate).toISOString() : null
            const isoProductDate = productCutoffDate ? new Date(productCutoffDate).toISOString() : null

            const res = await fetch('/api/settings/sync-rules', {
                method: 'POST',
                body: JSON.stringify({ 
                    cutoff_date: isoDate,
                    product_cutoff_date: isoProductDate,
                    auto_add_purchase_list: autoAddPurchaseList
                }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) throw new Error('Failed to save')

            toast.success('Settings saved successfully')
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sync Settings</h1>
                <p className="text-sm text-gray-500">Configure global rules for Daraz integration.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Order Sync Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Order Cutoff Date</label>
                        <div className="text-xs text-gray-500 mb-2">
                            Orders created <strong>before</strong> this date will NOT be added to Sales Entry effectively (they will be skipped during auto-booking).
                        </div>
                        <Input
                            type="datetime-local"
                            value={cutoffDate}
                            onChange={(e) => setCutoffDate(e.target.value)}
                            className="w-full sm:w-[300px]"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Daraz Product Sync Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Product Cutoff Date & Time</label>
                        <div className="text-xs text-gray-500 mb-2">
                            Products listed/created on Daraz <strong>before</strong> this date will NOT be added to our inventory (they will be ignored during sync).
                        </div>
                        <Input
                            type="datetime-local"
                            value={productCutoffDate}
                            onChange={(e) => setProductCutoffDate(e.target.value)}
                            className="w-full sm:w-[300px]"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Automatic Purchase List Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium">Automatic add purchase list</label>
                            <div className="text-xs text-gray-500 mt-1">
                                When enabled, new orders received in the system (e.g. Daraz sales) check stock and automatically add missing items to the purchase list. When disabled, automatic addition to the purchase list is paused.
                            </div>
                        </div>

                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setAutoAddPurchaseList(!autoAddPurchaseList)}
                                className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border font-medium text-sm transition-all shadow-sm ${
                                    autoAddPurchaseList
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                                }`}
                            >
                                <span
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                        autoAddPurchaseList ? 'bg-emerald-600' : 'bg-zinc-400'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            autoAddPurchaseList ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </span>
                                <span>
                                    Automatic add purchase list: <strong className="font-semibold">{autoAddPurchaseList ? 'Enabled' : 'Disabled'}</strong>
                                </span>
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="pt-2">
                <Button onClick={handleSave} disabled={loading} className="gap-2">
                    <Save size={16} />
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    )
}
