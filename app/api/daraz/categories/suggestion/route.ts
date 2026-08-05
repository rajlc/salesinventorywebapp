import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const productName = searchParams.get('productName')
        if (!productName) {
            return NextResponse.json({ error: 'productName is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // Load AI Settings
        const { data: aiSettingsRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_ai_settings')
            .maybeSingle()

        const aiSettings = aiSettingsRow?.value || {}
        const apiKey = aiSettings.apiKey || process.env.OPENAI_API_KEY || ''
        const preferredModel = aiSettings.model || 'gpt-4o-mini'

        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
        }

        const prompt = `You are a product categorization expert for Daraz Nepal (Lazada).
Identify the e-commerce category paths for the following product.
PRODUCT: "${productName}"

Suggest the top 3 most relevant leaf category paths. Output ONLY a valid JSON object with a "suggestions" key containing an array of strings (using ' > ' as separator). No markdown code fences.

Example response:
{
  "suggestions": [
    "Fashion > Men > Shoes > Shoes Accessories",
    "Health & Beauty > Bath & Body > Foot Care > Foot Deodorant"
  ]
}`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: preferredModel,
                messages: [
                    { role: 'system', content: 'You always return a JSON object with a suggestions array of strings.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            })
        })

        if (!response.ok) {
            return NextResponse.json({ success: true, paths: [] })
        }

        const result = await response.json()
        const rawContent = result.choices?.[0]?.message?.content || '{}'
        
        let parsed: any = {}
        try {
            parsed = JSON.parse(rawContent)
        } catch {
            parsed = {}
        }

        const paths = parsed.suggestions || []
        return NextResponse.json({
            success: true,
            paths
        })

    } catch (error: any) {
        console.error('[DarazCategorySuggestion] Error:', error.message)
        return NextResponse.json({ success: true, paths: [] })
    }
}
