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
    const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini')
    const [model, setModel] = useState('gemini-3.6-flash')
    const [geminiApiKey, setGeminiApiKey] = useState('')
    const [openaiApiKey, setOpenaiApiKey] = useState('')
    const [listingPrompt, setListingPrompt] = useState('')
    const [promptLoaded, setPromptLoaded] = useState(false)
    const [testingKey, setTestingKey] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings/ai-integration')
            const data = await res.json()
            if (data.model) {
                // Normalize legacy model names
                const normalized = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(data.model)
                    ? 'gemini-3.6-flash'
                    : data.model
                setModel(normalized)
                setProvider(normalized.startsWith('gemini') ? 'gemini' : 'openai')
            }
            if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey)
            if (data.openaiApiKey) setOpenaiApiKey(data.openaiApiKey)
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
                body: JSON.stringify({
                    provider,
                    model,
                    geminiApiKey,
                    openaiApiKey,
                    apiKey: provider === 'gemini' ? geminiApiKey : openaiApiKey,
                    listingPrompt
                }),
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

    const handleTestKey = async () => {
        const keyToTest = provider === 'gemini' ? geminiApiKey : openaiApiKey
        if (!keyToTest.trim()) {
            return toast.error(`Please enter your ${provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key first`)
        }
        setTestingKey(true)
        try {
            if (provider === 'gemini') {
                const targetModel = model.startsWith('gemini') && !model.includes('1.5') ? model : 'gemini-3.6-flash'
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-goog-api-key': keyToTest.trim()
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Reply with JSON: {"status":"connected","provider":"gemini"}' }] }],
                        generationConfig: { responseMimeType: 'application/json' }
                    })
                })
                const json = await res.json()
                if (res.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
                    toast.success('✅ Google Gemini API Key verified successfully! Connection is working.')
                } else {
                    throw new Error(json.error?.message || 'Invalid Gemini API response')
                }
            } else {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${keyToTest.trim()}` }
                })
                if (res.ok) {
                    toast.success('✅ OpenAI API Key verified successfully!')
                } else {
                    const err = await res.json()
                    throw new Error(err.error?.message || 'OpenAI authentication failed')
                }
            }
        } catch (err: any) {
            toast.error(`❌ Verification failed: ${err.message}`)
        } finally {
            setTestingKey(false)
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Integration</h1>
                <p className="text-sm text-gray-500">Configure your AI provider, API credentials, and listing generation prompt used for Daraz product listings.</p>
            </div>

            {/* AI Provider & Model */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Brain size={18} className="text-orange-600" />
                    <CardTitle className="text-base font-semibold">AI Provider &amp; Model</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Provider Toggle Tabs */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg max-w-sm">
                        <button
                            type="button"
                            onClick={() => {
                                setProvider('gemini')
                                if (!model.startsWith('gemini')) setModel('gemini-3.6-flash')
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                                provider === 'gemini'
                                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ✨ Google Gemini (Free Tier)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setProvider('openai')
                                if (model.startsWith('gemini')) setModel('gpt-4o-mini')
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                                provider === 'openai'
                                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            OpenAI (GPT-4o)
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <Cpu size={14} className="text-gray-400" />
                            Default AI Generation Model
                        </label>
                        <div className="text-xs text-gray-500 mb-2">
                            {provider === 'gemini' 
                                ? 'Google Gemini models include native image vision for analyzing raw product photos, extracting variations, and generating listings for free.' 
                                : 'Choose an OpenAI model. GPT-4o supports vision and image analysis.'}
                        </div>
                        <select
                            value={model}
                            onChange={(e) => {
                                setModel(e.target.value)
                                setProvider(e.target.value.startsWith('gemini') ? 'gemini' : 'openai')
                            }}
                            className="w-full sm:w-[420px] p-2 border rounded-md text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                            {provider === 'gemini' ? (
                                <>
                                    <option value="gemini-3.6-flash">Gemini 3.6 Flash (100% Free Tier — Fast Multimodal Vision)</option>
                                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (100% Free Tier — Ultra-Fast &amp; High Volume)</option>
                                    <option value="gemini-3.7-flash">Gemini 3.7 Flash (100% Free Tier — Advanced Reasoning &amp; Vision)</option>
                                    <option value="gemini-flash-latest">Gemini Flash Latest (Auto-Updating Latest Free Flash)</option>
                                </>
                            ) : (
                                <>
                                    <option value="gpt-4o-mini">GPT-4o Mini (Fast &amp; Cost Efficient)</option>
                                    <option value="gpt-4o">GPT-4o (High-quality Copy &amp; Vision / Image Reading)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo (Balanced Quality)</option>
                                </>
                            )}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* API Key */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Key className="text-orange-500" size={20} />
                    <CardTitle className="text-base">
                        {provider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {provider === 'gemini' ? (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-zinc-800 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-400 space-y-1.5">
                            <p className="font-semibold flex items-center gap-1.5">
                                <ShieldCheck size={14} className="text-emerald-600" />
                                Google Gemini is 100% Free (No Credit Card Required)
                            </p>
                            <p>
                                Google AI Studio provides 15 requests/minute and 1,500 requests/day for free. You can generate a free key with your regular Google account in 10 seconds.
                            </p>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 mt-1"
                            >
                                👉 Click here to get your Free Gemini API Key at Google AI Studio &rarr;
                            </a>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 mb-2">
                            Enter your OpenAI API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline">platform.openai.com</a>.
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {provider === 'gemini' ? 'Gemini API Key' : 'OpenAI Secret Key'}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                type="password"
                                placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                                value={provider === 'gemini' ? geminiApiKey : openaiApiKey}
                                onChange={(e) => {
                                    if (provider === 'gemini') setGeminiApiKey(e.target.value)
                                    else setOpenaiApiKey(e.target.value)
                                }}
                                className="w-full sm:w-[450px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestKey}
                                disabled={testingKey}
                                className="text-xs whitespace-nowrap"
                            >
                                {testingKey ? 'Testing...' : 'Test Key ⚡'}
                            </Button>
                        </div>
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
