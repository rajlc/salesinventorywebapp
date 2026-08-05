-- =============================================================
-- Migration: Create daraz_draft_listings table
-- Purpose: Persistent draft product listings (replaces localStorage)
--          Stores raw product names, AI-generated content, and push status
-- =============================================================

CREATE TABLE IF NOT EXISTS daraz_draft_listings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name            text NOT NULL,
    title               text,                          -- primary/default SEO title
    titles_per_store    jsonb DEFAULT '{}',            -- { "storeId": "SEO title for this store" }
    description         text,
    highlights          text[] DEFAULT '{}',
    category_id         bigint,
    category_path       text,
    images              text[] DEFAULT '{}',           -- Supabase storage public URLs
    attributes          jsonb DEFAULT '{}',            -- dynamic category attributes
    target_stores       text[] DEFAULT '{}',           -- array of online_stores.id
    price               numeric(12, 2),
    special_price       numeric(12, 2),
    special_price_from  date,
    special_price_to    date,
    weight              numeric(6, 3) DEFAULT 0.1,
    pkg_length          numeric(6, 1) DEFAULT 1,
    pkg_width           numeric(6, 1) DEFAULT 1,
    pkg_height          numeric(6, 1) DEFAULT 1,
    status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'generating', 'generated', 'pushing', 'pushed', 'failed')),
    error               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_daraz_draft_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daraz_draft_listings_updated_at
    BEFORE UPDATE ON daraz_draft_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_daraz_draft_listings_updated_at();

-- Indexes for common query patterns
CREATE INDEX idx_daraz_draft_listings_status   ON daraz_draft_listings (status);
CREATE INDEX idx_daraz_draft_listings_created  ON daraz_draft_listings (created_at DESC);

-- Enable RLS (table accessed only via service role from backend routes)
ALTER TABLE daraz_draft_listings ENABLE ROW LEVEL SECURITY;

-- Only service role (used by Next.js API routes with createAdminClient) has access.
-- No public/authenticated policies needed — all access via server-side admin client.
CREATE POLICY "Service role full access on daraz_draft_listings"
    ON daraz_draft_listings
    USING (true)
    WITH CHECK (true);

-- Also seed the default daraz_listing_prompt in app_settings if it doesn't exist yet
INSERT INTO app_settings (key, value, updated_at)
VALUES (
    'daraz_listing_prompt',
    jsonb_build_object(
        'prompt', 'You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details, generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store name listed. Titles must be different — use different keyword arrangements, descriptors, and angles. Max 255 chars each.
2. CATEGORY: Suggest the best matching Daraz category path from common Daraz Nepal categories.
3. DESCRIPTION: Start with "Perfect for:" followed by 3 lines describing the ideal buyer/use case. Then write ~200 words of compelling product description in HTML format (<p> tags). Mention fast delivery and cash on delivery available in Nepal.
4. HIGHLIGHTS: Write 8-10 specific bullet points covering product specifications, key benefits, material, use cases, and care instructions. Each bullet should be a complete, informative sentence.
5. ATTRIBUTES: Fill all provided category attributes. For "brand" always use "No Brand". For other attributes, infer appropriate values from the product name and context. Only include attributes from the schema.

Return ONLY valid JSON, no extra text:
{
  "titles": { "store_name_1": "title for store 1", "store_name_2": "title for store 2" },
  "category_suggestion": "Parent Category > Sub Category > Leaf Category",
  "description": "<p>Perfect for: ...</p><p>...</p>",
  "highlights": ["Complete sentence highlight 1", "...", "..."],
  "attributes": { "brand": "No Brand", "attribute_name": "value" }
}'
    ),
    now()
)
ON CONFLICT (key) DO NOTHING;
