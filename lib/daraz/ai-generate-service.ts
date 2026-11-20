import { createAdminClient } from '@/lib/supabase/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { fetchAndOptimizeImage } from '@/lib/claude/image-helper'
import { resolveBestCategory } from '@/lib/daraz/category-service'

export interface CategoryAttributeSchema {
    name: string
    label?: string
    input_type?: string
    is_mandatory?: string | number | boolean
    options?: Array<{ name: string }>
}

export interface GenerateDarazListingInput {
    productName?: string | null
    price?: number | string | null
    imageUrl?: string | null
    storeNames?: string[]
    categoryPath?: string | null
    attributesSchema?: CategoryAttributeSchema[]
    model?: string | null
}

export interface GenerateDarazListingResult {
    success: true
    titles: Record<string, string>
    descriptions?: Record<string, string>
    highlights_per_store?: Record<string, string[]>
    description: string
    highlights: string[]
    attributes: Record<string, unknown>
    category_id?: number | null
    category_suggestion?: string
    usedProvider: 'gemini' | 'openai'
    usedKeyIndex?: number
}

export class AiGenerationError extends Error {
    statusCode: number
    isRateLimited: boolean

    constructor(message: string, statusCode = 500, isRateLimited = false) {
        super(message)
        this.name = 'AiGenerationError'
        this.statusCode = statusCode
        this.isRateLimited = isRateLimited
    }
}

async function getDarazCategorySuggestion(productName: string, accessToken: string) {
    try {
        const params = buildSignedParams('/product/category/suggestion/get', accessToken, {
            product_name: productName
        })
        const res = await axios.get(`${API_URL}/product/category/suggestion/get`, { params })
        const suggestions = res.data?.data?.categorySuggestions || []
        if (suggestions.length > 0) {
            return {
                categoryId: Number(suggestions[0].categoryId),
                categoryPath: suggestions[0].categoryPath
            }
        }
    } catch (err: unknown) {
        console.error('[DarazCategorySuggestionHelper] Error:', err instanceof Error ? err.message : err)
    }
    return null
}

async function getMandatoryAttributes(categoryId: number, accessToken: string): Promise<CategoryAttributeSchema[]> {
    try {
        const params = buildSignedParams('/category/attributes/get', accessToken, {
            primary_category_id: categoryId,
            language_code: 'en_US'
        })
        const res = await axios.get(`${API_URL}/category/attributes/get`, { params })
        if (res.data?.code === '0' || res.data?.code === 0) {
            const allAttributes: CategoryAttributeSchema[] = res.data?.data || []
            const EXCLUDED_SYSTEM_KEYS = new Set([
                'name', 'title', 'short_description', 'description',
                'price', 'special_price', 'quantity', 'sellersku', 'seller_sku',
                'package_weight', 'package_length', 'package_width', 'package_height',
                'package_content', 'images', 'video', 'primary_category', 'warranty_type', 'brand'
            ])
            return allAttributes.filter((a) => {
                const isMandatory = a.is_mandatory === '1' || a.is_mandatory === 1
                const isSystem = EXCLUDED_SYSTEM_KEYS.has(a.name.toLowerCase())
                return isMandatory && !isSystem
            })
        }
    } catch (err: unknown) {
        console.error('[DarazMandatoryAttributes] Error:', err instanceof Error ? err.message : err)
    }
    return []
}

async function fillMandatoryAttributes(
    productName: string,
    description: string,
    mandatoryAttrs: CategoryAttributeSchema[],
    apiKeys: string[],
    model: string,
    isGemini: boolean
): Promise<Record<string, unknown>> {
    if (mandatoryAttrs.length === 0 || apiKeys.length === 0) return {}

    const schemaStr = JSON.stringify(
        mandatoryAttrs.map((a) => ({
            name: a.name,
            label: a.label,
            input_type: a.input_type,
            options: a.options?.slice(0, 20).map((o) => o.name)
        })),
        null,
        2
    )

    const prompt = `You are a product attribute extraction expert for Daraz Nepal.
Given the product name and description, select or fill the correct value for each of the following required attributes.

PRODUCT: ${productName}
DESCRIPTION SUMMARY: ${description.replace(/<[^>]*>/g, '').slice(0, 500)}

REQUIRED ATTRIBUTES SCHEMA:
${schemaStr}

INSTRUCTIONS:
1. For singleSelect attributes, choose exactly one option from the provided options array.
2. For text attributes, infer a concise appropriate value from the product details.
3. Return ONLY a valid JSON object mapping the attribute "name" to its filled value:
{
  "attribute_name_1": "selected_option_or_text_value"
}`

    try {
        if (isGemini) {
            const resolvedModel = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(model)
                ? 'gemini-3.6-flash'
                : (model.startsWith('gemini') ? model : 'gemini-3.6-flash')
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`

            for (const apiKey of apiKeys) {
                try {
                    const res = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey
                        },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.1,
                                responseMimeType: 'application/json'
                            }
                        })
                    })
                    if (res.ok) {
                        const result = await res.json()
                        const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
                        return JSON.parse(rawContent)
                    }
                } catch {
                    // try next key
                }
            }
        } else {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys[0]}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: 'You always return valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    response_format: { type: 'json_object' }
                })
            })

            if (response.ok) {
                const result = await response.json()
                const rawContent = result.choices?.[0]?.message?.content || '{}'
                return JSON.parse(rawContent)
            }
        }
    } catch (err: unknown) {
        console.error('[FillMandatoryAttributes] Error:', err instanceof Error ? err.message : err)
    }
    return {}
}

const DEFAULT_PROMPT_TEMPLATE = `You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details and image (if provided), generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}
IMAGE URL: {imageUrl}

CRITICAL FOR IMAGE-ONLY OR MINIMAL INPUT:
If the product name is generic (such as "[Image Only]", "New Product", "Product from uploaded image", or similar), carefully analyze the attached product image. Determine what the product is (item type, design, materials, color, branding if any, key features), and generate a real, high-converting product title, description, bullet points, and category suggestion directly reflecting the image!

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store account name listed in "STORE ACCOUNTS". Each title must be different — use different keyword arrangements, keyword-rich descriptors, and angles. Max 255 characters each. Use the "|" character to separate title segments/keywords. Key format: exact store account name as the JSON key.
2. CATEGORY: Suggest the best matching Daraz category path from common Daraz Nepal categories (e.g. "Men's Shoes & Clothing > Men's Bags > Wallets & Accessories > Wallets").
3. DESCRIPTION: Generate a beautiful, rich product description using clean HTML tags.
   Structure:
   - Start with "<p><strong>Perfect for:</strong></p>"
   - Follow with an HTML unordered list "<ul>" containing exactly 3 bullet points "<li>" describing the ideal buyer or use case.
   - Below the list, if a product image is available, add the image using: "<p><img src=\\"{imageUrl}\\" alt=\\"{productName}\\" /></p>". (Use the primary image from the added images represented by {imageUrl}).
   - Underneath the image, write approximately 200 words of a compelling, beautifully-written product description using paragraphs "<p>" and lists "<ul><li>" where appropriate to highlight details.
4. HIGHLIGHTS: Write exactly 8 to 10 specific bullet points as complete sentences. Each point MUST start with the bullet symbol '• ' (e.g. "• Premium durable material designed for everyday resilience."). Cover: product material/quality, key design features, dimensions/weight if relevant, use cases, compatibility, care instructions, and value proposition. Make each point unique and informative.
5. ATTRIBUTES: Fill values for ALL provided category attributes. Rules: (a) "brand" attribute MUST always be "No Brand", (b) for singleSelect attributes, choose the most appropriate option from the provided options array, (c) for text attributes, infer a concise appropriate value from the product context.

CRITICAL RULES:
- Absolutely DO NOT use direct promotional phrases or sales pitches in the titles, description, or highlights.
- Forbidden words/phrases to NEVER use: "buy now", "buy", "online shopping", "cash on delivery", "daraz", "order now", "free shipping", "cod", "delivery charge".
- Do not pressure or force the buyer to purchase; focus purely on the product features, quality, and organic content.

Return ONLY a valid JSON object — no markdown, no extra text, no code fences:
{
  "titles": { "StoreName1": "Unique SEO title | Key Features | Store 1", "StoreName2": "Different SEO title | Key Features | Store 2" },
  "category_suggestion": "Parent Category > Sub Category > Leaf Category",
  "description": "<p><strong>Perfect for:</strong></p><ul><li>Use Case 1</li><li>Use Case 2</li><li>Use Case 3</li></ul><p><img src=\\"{imageUrl}\\" alt=\\"Product\\" /></p><p>Beautifully written description here...</p>",
  "highlights": ["• Highlight sentence 1.", "• Highlight sentence 2.", "..."],
  "attributes": { "brand": "No Brand", "other_attr": "value" }
}`

export function resolveGeminiApiKeys(aiSettings: Record<string, unknown>): string[] {
    const rawList: string[] = []
    if (Array.isArray(aiSettings.geminiApiKeys)) {
        for (const k of aiSettings.geminiApiKeys) {
            if (typeof k === 'string' && k.trim()) rawList.push(k.trim())
        }
    }
    if (typeof aiSettings.geminiApiKey === 'string' && aiSettings.geminiApiKey.trim()) {
        rawList.push(aiSettings.geminiApiKey.trim())
    }
    if (typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.trim()) {
        rawList.push(process.env.GEMINI_API_KEY.trim())
    }
    return Array.from(new Set(rawList))
}

export async function generateDarazListingContent(
    input: GenerateDarazListingInput
): Promise<GenerateDarazListingResult> {
    const {
        productName,
        price,
        imageUrl,
        storeNames,
        categoryPath,
        attributesSchema,
        model
    } = input

    if (!productName && !imageUrl) {
        throw new AiGenerationError('productName or imageUrl is required', 400)
    }

    const effectiveProductName = productName?.trim() || 'Product from uploaded image'
    const supabase = await createAdminClient()

    // ── Load AI settings (provider, api keys + default model) ─────────────
    const { data: aiSettingsRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_ai_settings')
        .maybeSingle()

    const aiSettings = aiSettingsRow?.value || {}

    // Strict provider isolation:
    // Respect configured provider first so selecting OpenAI NEVER calls Gemini API.
    const configuredProvider: 'gemini' | 'openai' =
        aiSettings.provider === 'openai'
            ? 'openai'
            : aiSettings.provider === 'gemini'
                ? 'gemini'
                : (aiSettings.model?.startsWith('gpt') ? 'openai' : 'gemini')

    const isGemini = configuredProvider === 'gemini'

    // Resolve model strictly within the selected provider
    const rawModel = isGemini
        ? (model && model.startsWith('gemini') ? model : (aiSettings.model?.startsWith('gemini') ? aiSettings.model : 'gemini-3.5-flash'))
        : (model && !model.startsWith('gemini') ? model : (aiSettings.model && !aiSettings.model.startsWith('gemini') ? aiSettings.model : 'gpt-4o-mini'))

    let preferredModel = rawModel
    if (isGemini) {
        if (['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(rawModel)) {
            preferredModel = 'gemini-3.5-flash'
        } else if (['gemini-1.5-pro', 'gemini-2.0-pro', 'gemini-2.5-pro'].includes(rawModel)) {
            preferredModel = 'gemini-3.7-flash'
        }
    }

    const geminiKeys = isGemini ? resolveGeminiApiKeys(aiSettings) : []
    const openaiApiKey = !isGemini
        ? (aiSettings.openaiApiKey || aiSettings.apiKey || process.env.OPENAI_API_KEY || '').trim()
        : ''

    if (isGemini && geminiKeys.length === 0) {
        throw new AiGenerationError(
            'Google Gemini API key not configured. Please enter your free key in Settings > AI Integration (free at aistudio.google.com/app/apikey).',
            400
        )
    }

    if (!isGemini && !openaiApiKey) {
        throw new AiGenerationError(
            'OpenAI API key not configured. Please configure it in Settings > AI Integration or switch to Free Google Gemini.',
            400
        )
    }

    // ── Load editable prompt template from DB ────────────────────────────
    const { data: promptRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_listing_prompt')
        .maybeSingle()

    const promptTemplate: string = promptRow?.value?.prompt || DEFAULT_PROMPT_TEMPLATE

    // ── Build attributes schema string ───────────────────────────────────
    let attributesSchemaStr = 'No specific attributes required.'
    if (attributesSchema && attributesSchema.length > 0) {
        attributesSchemaStr = JSON.stringify(
            attributesSchema.map((a) => ({
                name: a.name,
                label: a.label,
                input_type: a.input_type,
                is_mandatory: a.is_mandatory,
                options: a.options?.slice(0, 20).map((o) => o.name)
            })),
            null,
            2
        )
    }

    // ── Substitute template variables ────────────────────────────────────
    const storeNamesStr = storeNames && storeNames.length > 0
        ? storeNames.join(', ')
        : 'Default Store'

    let filledPrompt = promptTemplate
        .replace(/{productName}/g, effectiveProductName)
        .replace(/{price}/g, String(price || 'Not specified'))
        .replace(/{storeNames}/g, storeNamesStr)
        .replace(/{categoryPath}/g, categoryPath || 'General')
        .replace(/{attributesSchema}/g, attributesSchemaStr)
        .replace(/{hasImage}/g, imageUrl ? 'Yes' : 'No')
        .replace(/{imageUrl}/g, imageUrl || '')

    if (Array.isArray(storeNames) && storeNames.length > 1) {
        filledPrompt += `\n\nMULTI-STORE REQUIREMENT:
Because multiple stores are listed in STORE ACCOUNTS (${storeNamesStr}), you MUST ALSO generate a UNIQUE HTML "description" and UNIQUE 8-10 "highlights" for EACH store account (using different wording, structure, and buyer angles so the stores do not have duplicate content).
Include these additional keys in your JSON response (using the exact store account names as keys):
- "descriptions": { "${storeNames[0]}": "<p>...</p>", ... }
- "highlights_per_store": { "${storeNames[0]}": ["Highlight 1.", ...], ... }
Keep "description" and "highlights" populated with the first store's content as well.`
    }

    // ── Optimize image if provided for multimodal vision ─────────────────
    let optImg = null
    if (imageUrl) {
        try {
            optImg = await fetchAndOptimizeImage(imageUrl)
        } catch (imgErr) {
            console.warn('[DarazAIGenerate] Image fetch warning:', imgErr)
        }
    }

    let rawContent = '{}'
    let workingGeminiKey = geminiKeys[0] || ''
    let usedKeyIndex = 0

    // ── Call AI Provider (Strict Provider Isolation) ─────────────────────
    if (isGemini) {
        const geminiParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: filledPrompt }]
        if (optImg) {
            geminiParts.push({
                inlineData: {
                    mimeType: optImg.mimeType,
                    data: optImg.base64
                }
            })
        }

        const candidateModels = Array.from(new Set([
            preferredModel,
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-3-flash-preview',
            'gemini-3.6-flash',
            'gemini-3.7-flash',
            'gemini-flash-latest'
        ]))

        let success = false
        let lastError = ''
        let sawRateLimit = false

        // Outer loop: rotate across configured Gemini API keys!
        for (let kIdx = 0; kIdx < geminiKeys.length && !success; kIdx++) {
            const currentKey = geminiKeys[kIdx]

            for (const candModel of candidateModels) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candModel}:generateContent`
                    const geminiRes = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': currentKey
                        },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: geminiParts }],
                            systemInstruction: {
                                parts: [{ text: "You are a professional Daraz Nepal product listing expert. You ALWAYS respond with valid JSON only — no markdown code fences, no extra commentary. Your JSON keys for 'titles' must exactly match the store account names provided." }]
                            },
                            generationConfig: {
                                temperature: 0.3,
                                responseMimeType: 'application/json'
                            }
                        })
                    })

                    if (geminiRes.ok) {
                        const geminiData = await geminiRes.json()
                        rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
                        workingGeminiKey = currentKey
                        usedKeyIndex = kIdx
                        success = true
                        break
                    } else {
                        const errData = await geminiRes.json().catch(() => ({}))
                        const msg = errData.error?.message || `Google Gemini error (${geminiRes.status})`
                        lastError = msg

                        // If rate-limited (429) or auth/quota error (401/403), immediately jump to the NEXT Gemini API key
                        if (geminiRes.status === 429 || geminiRes.status === 401 || geminiRes.status === 403) {
                            if (geminiRes.status === 429 || /quota|rate|limit/i.test(msg)) {
                                sawRateLimit = true
                            }
                            console.warn(`[Gemini] Key #${kIdx + 1} failed (${geminiRes.status}: ${msg}). Switching to next Gemini API key...`)
                            break
                        }

                        console.warn(`[Gemini] Key #${kIdx + 1} model ${candModel} returned ${geminiRes.status}. Trying next fallback model...`)
                    }
                } catch (candErr: unknown) {
                    lastError = candErr instanceof Error ? candErr.message : String(candErr)
                    console.warn(`[Gemini] Key #${kIdx + 1} model ${candModel} fetch error:`, lastError)
                }
            }
        }

        if (!success) {
            throw new AiGenerationError(
                lastError || 'Google Gemini API error across all configured keys',
                sawRateLimit ? 429 : 500,
                sawRateLimit
            )
        }
    } else {
        // Strictly OpenAI — NEVER calls Gemini API
        const systemMessage = `You are a professional Daraz Nepal product listing expert. You ALWAYS respond with valid JSON only — no markdown code fences, no extra commentary. Your JSON keys for "titles" must exactly match the store account names provided.`
        const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'low' } }> = [{ type: 'text', text: filledPrompt }]

        if (optImg && preferredModel.includes('gpt-4o')) {
            userContent.push({
                type: 'image_url',
                image_url: { url: optImg.dataUrl, detail: 'low' }
            })
        } else if (imageUrl && preferredModel.includes('gpt-4o')) {
            userContent.push({
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' }
            })
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
                model: preferredModel,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.75,
                response_format: { type: 'json_object' },
                max_tokens: 2000,
            }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new AiGenerationError(
                errData.error?.message || 'OpenAI API error',
                response.status,
                response.status === 429
            )
        }

        const result = await response.json()
        rawContent = result.choices?.[0]?.message?.content || '{}'
    }

    interface ParsedAiPayload {
        titles?: Record<string, string> | string[]
        descriptions?: Record<string, string>
        highlights_per_store?: Record<string, string[]>
        description?: string
        highlights?: string[]
        attributes?: Record<string, unknown>
        category_id?: number
        category_suggestion?: string
    }

    let parsed: ParsedAiPayload = {}
    try {
        const cleaned = rawContent
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim()
        parsed = JSON.parse(cleaned) as ParsedAiPayload
    } catch {
        throw new AiGenerationError('AI returned invalid JSON. Try again.', 500)
    }

    // ── Enforce brand = "No Brand" ───────────────────────────────────────
    if (parsed.attributes) {
        parsed.attributes.brand = 'No Brand'
    } else {
        parsed.attributes = { brand: 'No Brand' }
    }

    // ── Normalize titles if model returned array instead of object ────────
    if (Array.isArray(parsed.titles)) {
        const titlesArr = parsed.titles
        const titlesObj: Record<string, string> = {}
        storeNames?.forEach((name: string, i: number) => {
            titlesObj[name] = titlesArr[i] || titlesArr[0] || effectiveProductName
        })
        parsed.titles = titlesObj
    }

    const normalizeHighlightList = (arr: unknown): string[] => {
        if (!Array.isArray(arr)) return []
        return arr.map((h: unknown) => {
            const str = String(h || '').trim()
            if (!str) return ''
            return str.startsWith('•') ? str : `• ${str.replace(/^[-*•\s]+/, '')}`
        }).filter(Boolean)
    }

    // ── Normalize per-store descriptions & highlights ─────────────────────
    if (parsed.descriptions && typeof parsed.descriptions === 'object' && !Array.isArray(parsed.descriptions)) {
        if (!parsed.description) {
            parsed.description = Object.values(parsed.descriptions).find(v => typeof v === 'string' && v.trim()) || ''
        }
    }
    if (parsed.highlights_per_store && typeof parsed.highlights_per_store === 'object' && !Array.isArray(parsed.highlights_per_store)) {
        const normalizedPerStore: Record<string, string[]> = {}
        Object.entries(parsed.highlights_per_store).forEach(([k, v]) => {
            normalizedPerStore[k] = normalizeHighlightList(v)
        })
        parsed.highlights_per_store = normalizedPerStore
        if (!Array.isArray(parsed.highlights) || parsed.highlights.length === 0) {
            parsed.highlights = Object.values(normalizedPerStore).find(v => v.length > 0) || []
        }
    }

    parsed.highlights = normalizeHighlightList(parsed.highlights)

    // ── Fetch actual category recommendation from Daraz & resolve mandatory attributes ──
    const primaryTitle = (Object.values(parsed.titles || {})[0] as string) || effectiveProductName
    let categoryId: number | null = null
    let resolvedCategoryPath = ''
    let mandatoryAttributesFilled = {}

    try {
        const { data: activeStores } = await supabase
            .from('online_stores')
            .select('id')
            .eq('is_active', true)
            .limit(1)

        if (activeStores && activeStores.length > 0) {
            const accessToken = await getValidAccessToken(activeStores[0].id, 'order')
            const categorySuggestion = await getDarazCategorySuggestion(primaryTitle, accessToken)
            if (categorySuggestion) {
                categoryId = categorySuggestion.categoryId
                resolvedCategoryPath = categorySuggestion.categoryPath

                const mandatoryAttrs = await getMandatoryAttributes(categoryId, accessToken)
                if (mandatoryAttrs.length > 0) {
                    const orderedKeys = isGemini
                        ? [workingGeminiKey, ...geminiKeys.filter(k => k !== workingGeminiKey)]
                        : [openaiApiKey]
                    mandatoryAttributesFilled = await fillMandatoryAttributes(
                        primaryTitle,
                        parsed.description || '',
                        mandatoryAttrs,
                        orderedKeys,
                        preferredModel,
                        isGemini
                    )
                }
            }
        }
    } catch (catErr: unknown) {
        console.error('[DarazAIGenerate] Category suggestion/attribute resolution failed:', catErr instanceof Error ? catErr.message : catErr)
    }

    // Fallback category matching if Daraz token is not available or didn't match
    if (!categoryId) {
        try {
            const localMatch = await resolveBestCategory(primaryTitle, parsed.category_suggestion)
            if (localMatch) {
                categoryId = localMatch.id
                resolvedCategoryPath = localMatch.path
            }
        } catch (resolveErr: unknown) {
            console.error('[DarazAIGenerate] Local category resolution failed:', resolveErr instanceof Error ? resolveErr.message : resolveErr)
        }
    }

    if (categoryId) {
        parsed.category_id = categoryId
    }
    if (resolvedCategoryPath) {
        parsed.category_suggestion = resolvedCategoryPath
    }

    parsed.attributes = {
        ...parsed.attributes,
        ...mandatoryAttributesFilled
    }

    return {
        success: true,
        titles: (parsed.titles && !Array.isArray(parsed.titles) ? parsed.titles : {}) as Record<string, string>,
        descriptions: parsed.descriptions,
        highlights_per_store: parsed.highlights_per_store,
        description: parsed.description || '',
        highlights: parsed.highlights || [],
        attributes: parsed.attributes,
        category_id: parsed.category_id ?? null,
        category_suggestion: parsed.category_suggestion,
        usedProvider: configuredProvider,
        usedKeyIndex: isGemini ? usedKeyIndex : undefined,
    }
}
