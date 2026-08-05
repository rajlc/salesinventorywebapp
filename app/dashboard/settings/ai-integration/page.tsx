'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui-shim'
import { toast } from 'sonner'
import { Save, Brain, Key, Cpu, ShieldCheck, FileText, RefreshCw, Info } from 'lucide-react'

const TEMPLATE_VARIABLES = [
    { key: '{productName}', desc: 'Raw product name entered by user' },
    { key: '{price}', desc: 'Selling price in NPR' },
    { key: '{storeNames}', desc: 'Comma-separated list of selected store account names' },
    { key: '{categoryPath}', desc: 'Selected category breadcrumb path' },
    { key: '{attributesSchema}', desc: 'JSON schema of category attributes to fill' },
    { key: '{hasImage}', desc: '"Yes" or "No" — whether a product image was uploaded' },
    { key: '{imageUrl}', desc: 'URL of the first product image' },
]

export default function AiIntegrationPage() {
    const [loading, setLoading] = useState(false)
    const [model, setModel] = useState('gpt-4o-mini')
    const [apiKey, setApiKey] = useState('')
    const [listingPrompt, setListingPrompt] = useState('')
    const [promptLoaded, setPromptLoaded] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings/ai-integration')
            const data = await res.json()
            if (data.model) setModel(data.model)
            if (data.apiKey) setApiKey(data.apiKey)
            if (data.listingPrompt) {
                setListingPrompt(data.listingPrompt)
                setPromptLoaded(true)
            }
        } catch (error) {
            console.error('Failed to load AI settings:', error)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/settings/ai-integration', {
                method: 'POST',
                body: JSON.stringify({ model, apiKey, listingPrompt }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) throw new Error('Failed to save settings')
            toast.success('AI Integration settings saved successfully')
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Integration</h1>
                <p className="text-sm text-gray-500">Configure your global AI model, credentials, and the listing generation prompt used for Daraz product listings.</p>
            </div>

            {/* Model Preferences */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Brain className="text-orange-500" size={20} />
                    <CardTitle className="text-base">Model Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <Cpu size={14} className="text-gray-400" />
                            Default AI Generation Model
                        </label>
                        <div className="text-xs text-gray-500 mb-2">
                            Choose which AI model is used when generating product titles, descriptions, and attributes.
                            GPT-4o supports image analysis for image-aware generation.
                        </div>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full sm:w-[320px] p-2 border rounded-md text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                            <option value="gpt-4o-mini">GPT-4o Mini (Fast &amp; Cost Efficient)</option>
                            <option value="gpt-4o">GPT-4o (High-quality Copy &amp; Vision / Image Reading)</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo (Balanced Quality)</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* API Key */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Key className="text-orange-500" size={20} />
                    <CardTitle className="text-base">API Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            AI Provider API Key
                        </label>
                        <div className="text-xs text-gray-500 mb-2">
                            Enter your OpenAI API key. Leave blank to fall back on system-configured keys.
                        </div>
                        <Input
                            type="password"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full sm:w-[450px]"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Listing Prompt Template */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <FileText className="text-orange-500" size={20} />
                    <CardTitle className="text-base">Daraz Listing Generation Prompt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-zinc-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400 flex gap-2">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">This prompt is sent to the AI when generating product listings.</p>
                            <p>Edit it to change the tone, language, content structure, or SEO strategy. Changes apply immediately on the next generate click — no code change needed.</p>
                        </div>
                    </div>

                    {/* Template Variables Reference */}
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Available Template Variables:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {TEMPLATE_VARIABLES.map(v => (
                                <div key={v.key} className="flex gap-1.5 text-xs">
                                    <code className="text-orange-600 dark:text-orange-400 font-mono bg-orange-50 dark:bg-orange-950/20 px-1 rounded shrink-0">{v.key}</code>
                                    <span className="text-gray-500">{v.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Prompt Template</label>
                            {!promptLoaded && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <RefreshCw size={12} className="animate-spin" /> Loading...
                                </span>
                            )}
                        </div>
                        <textarea
                            value={listingPrompt}
                            onChange={(e) => setListingPrompt(e.target.value)}
                            rows={24}
                            className="w-full p-3 border rounded-md text-xs font-mono bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-y leading-relaxed"
                            placeholder="Loading prompt template..."
                        />
                        <p className="text-xs text-gray-400">{listingPrompt.length} characters</p>
                    </div>
                </CardContent>
            </Card>

            {/* Security Note */}
            <div className="bg-orange-50/50 dark:bg-orange-950/10 p-3 rounded-lg border border-orange-100 dark:border-zinc-800 flex gap-2 text-xs text-orange-700 dark:text-orange-400">
                <ShieldCheck className="shrink-0 mt-0.5" size={16} />
                <p>
                    All credentials are encrypted and stored securely. Your API keys are strictly accessed on the backend server to make generation requests on behalf of your accounts.
                </p>
            </div>

            <div className="pt-2">
                <Button onClick={handleSave} disabled={loading} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                    <Save size={16} />
                    {loading ? 'Saving...' : 'Save All Settings'}
                </Button>
            </div>
        </div>
    )
}
