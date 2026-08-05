-- ============================================================
-- Migration: Create damage_resolutions table
-- Purpose : Track partial resolutions (Repair / Exchange / Non-Repairable)
--           for damaged stock per product.
-- Linked to: products.id (product level, not per damage event)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.damage_resolutions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    date            DATE        NOT NULL DEFAULT CURRENT_DATE,
    resolved_qty    INT         NOT NULL CHECK (resolved_qty > 0),
    resolution_type TEXT        NOT NULL CHECK (resolution_type IN ('Repaired', 'Exchanged', 'Non-Repairable')),
    remarks         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_damage_resolutions_product_id
    ON public.damage_resolutions(product_id);

CREATE INDEX IF NOT EXISTS idx_damage_resolutions_resolution_type
    ON public.damage_resolutions(resolution_type);

CREATE INDEX IF NOT EXISTS idx_damage_resolutions_date
    ON public.damage_resolutions(date);

-- Row Level Security
ALTER TABLE public.damage_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access_damage_resolutions"
    ON public.damage_resolutions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.damage_resolutions IS
    'Tracks partial resolutions (Repaired / Exchanged / Non-Repairable) against the total damaged stock of a product.
     - Repaired: units fixed and returned to usable stock
     - Exchanged: units replaced by supplier, returned to stock
     - Non-Repairable: units permanently lost / written off (do NOT return to stock)
     resolution_type IN (Repaired, Exchanged) → adds back to stock
     resolution_type = Non-Repairable → stays as permanent damage/loss';
