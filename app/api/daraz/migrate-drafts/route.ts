import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/daraz/migrate-drafts
// Creates the daraz_draft_listings table if it doesn't exist
export async function GET() {
    try {
        const supabase = await createAdminClient()

        // Ensure columns exist even if table already exists
        const { error: checkError } = await supabase
            .from('daraz_draft_listings')
            .select('supplier_id, wholesale_price')
            .limit(1)

        if (!checkError) {
            return NextResponse.json({ success: true, message: 'Table and columns already exist' })
        }

        // Table or columns missing — create via Supabase Management API
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!projectRef || !serviceKey) {
            return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
        }

        const sql = `
CREATE TABLE IF NOT EXISTS daraz_draft_listings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name            text NOT NULL,
    title               text,
    titles_per_store    jsonb DEFAULT '{}',
    description         text,
    highlights          text[] DEFAULT '{}',
    category_id         bigint,
    category_path       text,
    images              text[] DEFAULT '{}',
    attributes          jsonb DEFAULT '{}',
    target_stores       text[] DEFAULT '{}',
    price               numeric(12, 2),
    special_price       numeric(12, 2),
    special_price_from  date,
    special_price_to    date,
    weight              numeric(6, 3) DEFAULT 0.1,
    pkg_length          numeric(6, 1) DEFAULT 1,
    pkg_width           numeric(6, 1) DEFAULT 1,
    pkg_height          numeric(6, 1) DEFAULT 1,
    supplier_id         uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    wholesale_price     numeric(12, 2),
    status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'generated', 'pushing', 'pushed', 'failed')),
    error               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE daraz_draft_listings ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE daraz_draft_listings ADD COLUMN IF NOT EXISTS wholesale_price numeric(12, 2);
CREATE INDEX IF NOT EXISTS idx_daraz_draft_listings_status ON daraz_draft_listings (status);
CREATE INDEX IF NOT EXISTS idx_daraz_draft_listings_created ON daraz_draft_listings (created_at DESC);
ALTER TABLE daraz_draft_listings ENABLE ROW LEVEL SECURITY;
`
        const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({ query: sql })
        })

        const respText = await resp.text()
        let respData: any = {}
        try { respData = JSON.parse(respText) } catch { respData = { raw: respText } }

        if (!resp.ok) {
            // Try alternative: create using Supabase DB REST as a workaround
            return NextResponse.json({
                error: 'Could not create table via API. Please create it manually.',
                sql_to_run: sql,
                api_response: respData
            }, { status: 500 })
        }

        // Seed default AI prompt if not already there
        const { data: existingPrompt } = await supabase
            .from('app_settings')
            .select('key')
            .eq('key', 'daraz_listing_prompt')
            .maybeSingle()

        if (!existingPrompt) {
            await supabase.from('app_settings').insert({
                key: 'daraz_listing_prompt',
                value: { prompt: DEFAULT_PROMPT },
                updated_at: new Date().toISOString()
            })
        }

        return NextResponse.json({ success: true, message: 'Table created successfully' })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

const DEFAULT_PROMPT = `You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details, generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store account name listed. Each title must be different. Max 255 chars each. JSON key = exact store account name.
2. CATEGORY: Suggest the best matching Daraz Nepal category path.
3. DESCRIPTION: Start with "<p><strong>Perfect for:</strong>" followed by 3 lines describing the ideal buyer. Then write approximately 200 words using HTML <p> tags. Mention fast delivery and cash on delivery across Nepal.
4. HIGHLIGHTS: Write exactly 8 to 10 specific bullet points as complete sentences covering material, features, use cases, care instructions, and value proposition.
5. ATTRIBUTES: Fill all provided category attributes. Brand MUST always be "No Brand".

Return ONLY valid JSON:
{
  "titles": { "StoreName1": "Unique title 1", "StoreName2": "Different title 2" },
  "category_suggestion": "Parent > Sub > Leaf",
  "description": "<p><strong>Perfect for:</strong><br/>...</p><p>...</p>",
  "highlights": ["Point 1.", "Point 2.", "..."],
  "attributes": { "brand": "No Brand", "attr": "value" }
}`
