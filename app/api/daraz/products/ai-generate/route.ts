import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'

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
    model: string
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
    } catch (err: any) {
        console.error('[FillMandatoryAttributes] Error:', err.message)
    }
    return {}
}

// Default prompt template (used if none is saved in DB yet)
const DEFAULT_PROMPT_TEMPLATE = `You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details, generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}
IMAGE URL: {imageUrl}

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store account name listed in "STORE ACCOUNTS". Each title must be different — use different keyword arrangements, keyword-rich descriptors, and angles. Max 255 characters each. Use the "|" character to separate title segments/keywords. Key format: exact store account name as the JSON key.
2. CATEGORY: Suggest the best matching Daraz category path from common Daraz Nepal categories.
3. DESCRIPTION: Generate a beautiful, rich product description using clean HTML tags.
   Structure:
   - Start with "<p><strong>Perfect for:</strong></p>"
   - Follow with an HTML unordered list "<ul>" containing exactly 3 bullet points "<li>" describing the ideal buyer or use case.
   - Below the list, if a product image is available, add the image using: "<p><img src=\"{imageUrl}\" alt=\"{productName}\" /></p>". (Use the primary image from the added images represented by {imageUrl}).
   - Underneath the image, write approximately 200 words of a compelling, beautifully-written product description using paragraphs "<p>" and lists "<ul><li>" where appropriate to highlight details.
4. HIGHLIGHTS: Write exactly 8 to 10 specific bullet points as complete sentences. Cover: product material/quality, key design features, dimensions/weight if relevant, use cases, compatibility, care instructions, and value proposition. Make each point unique and informative.
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
  "highlights": ["Highlight sentence 1.", "Highlight sentence 2.", "..."],
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

        if (!productName) {
            return NextResponse.json({ error: 'productName is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // ── Load AI settings (api key + default model) ──────────────────────
        const { data: aiSettingsRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_ai_settings')
            .maybeSingle()

        const aiSettings = aiSettingsRow?.value || {}
        const apiKey = aiSettings.apiKey || process.env.OPENAI_API_KEY || ''
        const preferredModel = model || aiSettings.model || 'gpt-4o-mini'

        if (!apiKey) {
            return NextResponse.json({
                error: 'OpenAI API key not configured. Please configure it in Settings > AI Integration.'
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
            .replace(/{productName}/g, productName)
            .replace(/{price}/g, String(price || 'Not specified'))
            .replace(/{storeNames}/g, storeNamesStr)
            .replace(/{categoryPath}/g, categoryPath || 'General')
            .replace(/{attributesSchema}/g, attributesSchemaStr)
            .replace(/{hasImage}/g, imageUrl ? 'Yes' : 'No')
            .replace(/{imageUrl}/g, imageUrl || '')

        // ── Build messages ───────────────────────────────────────────────────
        const systemMessage = `You are a professional Daraz Nepal product listing expert. You ALWAYS respond with valid JSON only — no markdown code fences, no extra commentary. Your JSON keys for "titles" must exactly match the store account names provided.`

        const userContent: any[] = [{ type: 'text', text: filledPrompt }]

        // Add image if using a vision-capable model and imageUrl is provided
        if (preferredModel.includes('gpt-4o') && imageUrl) {
            userContent.push({
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' }
            })
        }

        // ── Call OpenAI ──────────────────────────────────────────────────────
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
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
            const errData = await response.json()
            return NextResponse.json(
                { error: errData.error?.message || 'OpenAI API error' },
                { status: response.status }
            )
        }

        const result = await response.json()
        const rawContent = result.choices?.[0]?.message?.content || '{}'

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
                titlesObj[name] = parsed.titles[i] || parsed.titles[0] || productName
            })
            parsed.titles = titlesObj
        }

        // ── Ensure highlights is an array of strings ─────────────────────────
        if (!Array.isArray(parsed.highlights)) {
            parsed.highlights = []
        }

        // ── Fetch actual category recommendation from Daraz & resolve mandatory attributes ──
        const primaryTitle = Object.values(parsed.titles || {})[0] as string || productName
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
                            apiKey,
                            preferredModel
                        )
                    }
                }
            }
        } catch (catErr: any) {
            console.error('[DarazAIGenerate] Category suggestion/attribute resolution failed:', catErr.message)
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
