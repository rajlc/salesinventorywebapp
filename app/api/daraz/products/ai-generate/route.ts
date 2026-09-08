import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { fetchAndOptimizeImage } from '@/lib/claude/image-helper'
import { resolveBestCategory } from '@/lib/daraz/category-service'

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
    } catch (err: any) {
        console.error('[DarazCategorySuggestionHelper] Error:', err.message)
    }
    return null
}

async function getMandatoryAttributes(categoryId: number, accessToken: string) {
    try {
        const params = buildSignedParams('/category/attributes/get', accessToken, {
            primary_category_id: categoryId,
            language_code: 'en_US'
        })
        const res = await axios.get(`${API_URL}/category/attributes/get`, { params })
        if (res.data?.code === '0' || res.data?.code === 0) {
            const allAttributes = res.data?.data || []
            const EXCLUDED_SYSTEM_KEYS = new Set([
                'name', 'title', 'short_description', 'description', 
                'price', 'special_price', 'quantity', 'sellersku', 'seller_sku', 
                'package_weight', 'package_length', 'package_width', 'package_height', 
                'package_content', 'images', 'video', 'primary_category', 'warranty_type', 'brand'
            ])
            return allAttributes.filter((a: any) => {
                const isMandatory = a.is_mandatory === '1' || a.is_mandatory === 1
                const isSystem = EXCLUDED_SYSTEM_KEYS.has(a.name.toLowerCase())
                return isMandatory && !isSystem
            })
        }
    } catch (err: any) {
        console.error('[DarazMandatoryAttributes] Error:', err.message)
    }
    return []
}

async function fillMandatoryAttributes(
    productName: string,
    description: string,
    mandatoryAttrs: any[],
    apiKey: string,
    model: string,
    isGemini: boolean = false
) {
    if (mandatoryAttrs.length === 0) return {}

    const schemaStr = JSON.stringify(
        mandatoryAttrs.map((a: any) => ({
            name: a.name,
            label: a.label,
            input_type: a.input_type,
            options: a.options?.slice(0, 20).map((o: any) => o.name)
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
        } else {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: model,
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
    } catch (err: any) {
        console.error('[FillMandatoryAttributes] Error:', err.message)
    }
    return {}
}

// Default prompt template (used if none is saved in DB yet)
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
   - Below the list, if a product image is available, add the image using: "<p><img src=\"{imageUrl}\" alt=\"{productName}\" /></p>". (Use the primary image from the added images represented by {imageUrl}).
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
  "description": "<p><strong>Perfect for:</strong></p><ul><li>Use Case 1</li><li>Use Case 2</li><li>Use Case 3</li></ul><p><img src=\"{imageUrl}\" alt=\"Product\" /></p><p>Beautifully written description here...</p>",
  "highlights": ["• Highlight sentence 1.", "• Highlight sentence 2.", "..."],
  "attributes": { "brand": "No Brand", "other_attr": "value" }
}`

export async function POST(req: NextRequest) {
    try {
        const {
            productName,
            price,
            imageUrl,
            storeNames,       // string[] — array of store account names (e.g. ["BagmatiTraders_Main"])
            categoryPath,
            attributesSchema, // Attribute[] from /api/daraz/categories/attributes
            model             // optional override
        } = await req.json()

        if (!productName && !imageUrl) {
            return NextResponse.json({ error: 'productName or imageUrl is required' }, { status: 400 })
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
        const provider = aiSettings.provider || (aiSettings.geminiApiKey ? 'gemini' : 'openai')
        const rawModel = model || aiSettings.model || (provider === 'gemini' ? 'gemini-3.6-flash' : 'gpt-4o-mini')
        const isGemini = rawModel.startsWith('gemini') || provider === 'gemini'

        // Normalize legacy or deprecated Gemini model names to active Google AI Studio models
        let preferredModel = rawModel
        if (isGemini) {
            if (['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(rawModel)) {
                preferredModel = 'gemini-3.6-flash'
            } else if (['gemini-1.5-pro', 'gemini-2.0-pro', 'gemini-2.5-pro'].includes(rawModel)) {
                preferredModel = 'gemini-3.7-flash'
            } else if (!rawModel.startsWith('gemini')) {
                preferredModel = 'gemini-3.6-flash'
            }
        }

        const geminiApiKey = aiSettings.geminiApiKey || process.env.GEMINI_API_KEY || ''
        const openaiApiKey = aiSettings.openaiApiKey || aiSettings.apiKey || process.env.OPENAI_API_KEY || ''

        if (isGemini && !geminiApiKey) {
            return NextResponse.json({
                error: 'Google Gemini API key not configured. Please enter your free key in Settings > AI Integration (free at aistudio.google.com/app/apikey).'
            }, { status: 400 })
        }

        if (!isGemini && !openaiApiKey) {
            return NextResponse.json({
                error: 'OpenAI API key not configured. Please configure it in Settings > AI Integration or switch to Free Google Gemini.'
            }, { status: 400 })
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
                attributesSchema.map((a: any) => ({
                    name: a.name,
                    label: a.label,
                    input_type: a.input_type,
                    is_mandatory: a.is_mandatory,
                    options: a.options?.slice(0, 20).map((o: any) => o.name) // Limit options to avoid token overflow
                })),
                null,
                2
            )
        }

        // ── Substitute template variables ────────────────────────────────────
        const storeNamesStr = storeNames && storeNames.length > 0
            ? storeNames.join(', ')
            : 'Default Store'

        const filledPrompt = promptTemplate
            .replace(/{productName}/g, effectiveProductName)
            .replace(/{price}/g, String(price || 'Not specified'))
            .replace(/{storeNames}/g, storeNamesStr)
            .replace(/{categoryPath}/g, categoryPath || 'General')
            .replace(/{attributesSchema}/g, attributesSchemaStr)
            .replace(/{hasImage}/g, imageUrl ? 'Yes' : 'No')
            .replace(/{imageUrl}/g, imageUrl || '')

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

        // ── Call AI Provider (Google Gemini or OpenAI) ───────────────────────
        if (isGemini) {
            const geminiParts: any[] = [{ text: filledPrompt }]
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
                'gemini-3.6-flash',
                'gemini-3.5-flash-lite',
                'gemini-3.7-flash',
                'gemini-flash-latest'
            ]))

            let success = false
            let lastError = ''

            for (const candModel of candidateModels) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candModel}:generateContent`
                    const geminiRes = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-goog-api-key': geminiApiKey
                        },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: geminiParts }],
                            systemInstruction: {
                                parts: [{ text: "You are a professional Daraz Nepal product listing expert. You ALWAYS respond with valid JSON only — no markdown code fences, no extra commentary. Your JSON keys for 'titles' must exactly match the store account names provided." }]
                            },
                            generationConfig: {
                                temperature: 0.3,
                                responseMimeType: "application/json"
                            }
                        })
                    })

                    if (geminiRes.ok) {
                        const geminiData = await geminiRes.json()
                        rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
                        success = true
                        break
                    } else {
                        const errData = await geminiRes.json().catch(() => ({}))
                        lastError = errData.error?.message || `Google Gemini error (${geminiRes.status})`
                        console.warn(`[Gemini] Model ${candModel} returned ${geminiRes.status}. Trying next fallback candidate...`)
                    }
                } catch (candErr: any) {
                    lastError = candErr.message
                    console.warn(`[Gemini] Model ${candModel} fetch error:`, candErr.message)
                }
            }

            if (!success) {
                return NextResponse.json({ error: lastError || 'Google Gemini API error' }, { status: 500 })
            }
        } else {
            const systemMessage = `You are a professional Daraz Nepal product listing expert. You ALWAYS respond with valid JSON only — no markdown code fences, no extra commentary. Your JSON keys for "titles" must exactly match the store account names provided.`
            const userContent: any[] = [{ type: 'text', text: filledPrompt }]

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
                return NextResponse.json(
                    { error: errData.error?.message || 'OpenAI API error' },
                    { status: response.status }
                )
            }

            const result = await response.json()
            rawContent = result.choices?.[0]?.message?.content || '{}'
        }

        let parsed: any = {}
        try {
            // Strip markdown code fences if model added them despite instructions
            const cleaned = rawContent
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim()
            parsed = JSON.parse(cleaned)
        } catch {
            return NextResponse.json({ error: 'AI returned invalid JSON. Try again.' }, { status: 500 })
        }

        // ── Enforce brand = "No Brand" ───────────────────────────────────────
        if (parsed.attributes) {
            parsed.attributes.brand = 'No Brand'
        } else {
            parsed.attributes = { brand: 'No Brand' }
        }

        // ── Normalize titles if model returned array instead of object ────────
        if (Array.isArray(parsed.titles)) {
            const titlesObj: Record<string, string> = {}
            storeNames?.forEach((name: string, i: number) => {
                titlesObj[name] = parsed.titles[i] || parsed.titles[0] || effectiveProductName
            })
            parsed.titles = titlesObj
        }

        // ── Ensure highlights is an array of strings prefixed with '• ' ──────
        if (!Array.isArray(parsed.highlights)) {
            parsed.highlights = []
        } else {
            parsed.highlights = parsed.highlights.map((h: any) => {
                const str = String(h || '').trim()
                if (!str) return ''
                return str.startsWith('•') ? str : `• ${str.replace(/^[-*•\s]+/, '')}`
            }).filter(Boolean)
        }

        // ── Fetch actual category recommendation from Daraz & resolve mandatory attributes ──
        const primaryTitle = Object.values(parsed.titles || {})[0] as string || effectiveProductName
        let categoryId: number | null = null
        let resolvedCategoryPath = ''
        let mandatoryAttributesFilled = {}

        try {
            // Find first active store to query Daraz open platform APIs
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

                    // Fetch mandatory attributes schema
                    const mandatoryAttrs = await getMandatoryAttributes(categoryId, accessToken)
                    if (mandatoryAttrs.length > 0) {
                        mandatoryAttributesFilled = await fillMandatoryAttributes(
                            primaryTitle,
                            parsed.description || '',
                            mandatoryAttrs,
                            isGemini ? geminiApiKey : openaiApiKey,
                            preferredModel,
                            isGemini
                        )
                    }
                }
            }
        } catch (catErr: any) {
            console.error('[DarazAIGenerate] Category suggestion/attribute resolution failed:', catErr.message)
        }

        // Fallback category matching if Daraz token is not available or didn't match
        if (!categoryId) {
            try {
                const localMatch = await resolveBestCategory(primaryTitle, parsed.category_suggestion)
                if (localMatch) {
                    categoryId = localMatch.id
                    resolvedCategoryPath = localMatch.path
                }
            } catch (resolveErr: any) {
                console.error('[DarazAIGenerate] Local category resolution failed:', resolveErr.message)
            }
        }

        // Override the suggested category path and include category_id
        if (categoryId) {
            parsed.category_id = categoryId
        }
        if (resolvedCategoryPath) {
            parsed.category_suggestion = resolvedCategoryPath
        }

        // Merge mandatory filled attributes
        parsed.attributes = {
            ...parsed.attributes,
            ...mandatoryAttributesFilled
        }

        return NextResponse.json({ success: true, ...parsed })

    } catch (err: any) {
        console.error('[DarazAIGenerate] Error:', err)
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
    }
}
