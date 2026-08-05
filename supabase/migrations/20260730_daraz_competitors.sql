-- Migration: Daraz Competitor Tracking System
-- Description: Stores up to 4 competitor Daraz URLs per product with live price, unit sold counts, price update timestamps, and snapshot logs for sales velocity analysis.

CREATE TABLE IF NOT EXISTS public.daraz_competitor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    competitor_index INT NOT NULL CHECK (competitor_index BETWEEN 1 AND 4),
    competitor_url TEXT NOT NULL,
    title TEXT,
    current_price NUMERIC(12, 2),
    previous_price NUMERIC(12, 2),
    price_changed_at TIMESTAMPTZ,
    total_sold INT DEFAULT 0,
    review_count INT DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT daraz_competitor_products_product_idx UNIQUE (product_id, competitor_index)
);

CREATE TABLE IF NOT EXISTS public.daraz_competitor_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID REFERENCES public.daraz_competitor_products(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    competitor_index INT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    total_sold INT DEFAULT 0,
    review_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid querying and filtering
CREATE INDEX IF NOT EXISTS idx_daraz_competitor_products_pid ON public.daraz_competitor_products(product_id);
CREATE INDEX IF NOT EXISTS idx_daraz_competitor_products_price_changed ON public.daraz_competitor_products(price_changed_at);
CREATE INDEX IF NOT EXISTS idx_daraz_competitor_snapshots_pid_created ON public.daraz_competitor_snapshots(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_daraz_competitor_snapshots_comp_created ON public.daraz_competitor_snapshots(competitor_id, created_at);

-- Enable RLS and grant access
ALTER TABLE public.daraz_competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to daraz_competitor_products"
    ON public.daraz_competitor_products FOR SELECT USING (true);

CREATE POLICY "Allow public write access to daraz_competitor_products"
    ON public.daraz_competitor_products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to daraz_competitor_snapshots"
    ON public.daraz_competitor_snapshots FOR SELECT USING (true);

CREATE POLICY "Allow public write access to daraz_competitor_snapshots"
    ON public.daraz_competitor_snapshots FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.daraz_competitor_products TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.daraz_competitor_snapshots TO postgres, anon, authenticated, service_role;
