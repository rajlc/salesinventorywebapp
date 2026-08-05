'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui-shim'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

export default function SyncSettingsPage() {
    const [loading, setLoading] = useState(false)
    const [cutoffDate, setCutoffDate] = useState('')
    const [productCutoffDate, setProductCutoffDate] = useState('')

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
                    product_cutoff_date: isoProductDate
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

            <div className="pt-2">
                <Button onClick={handleSave} disabled={loading} className="gap-2">
                    <Save size={16} />
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    )
}
