-- ============================================================
-- Migration: Create Daraz Product Review & AI Reply Tables
-- Purpose : Support product review syncing, bulk replies, and AI auto-responses.
-- ============================================================

-- 1. Review Settings Table (One configuration per store)
CREATE TABLE IF NOT EXISTS public.daraz_review_settings (
    store_id            UUID        PRIMARY KEY REFERENCES public.online_stores(id) ON DELETE CASCADE,
    ai_reply_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
    cutoff_time         TIMESTAMPTZ,
    ai_instruction      TEXT,
    star1_template      TEXT        NOT NULL DEFAULT 'We are extremely sorry for the bad experience. We will investigate and improve this.',
    star2_template      TEXT        NOT NULL DEFAULT 'We apologize for the inconvenience. We are working to make it better.',
    star3_template      TEXT        NOT NULL DEFAULT 'Thank you for your feedback. We will work to improve our service.',
    star4_template      TEXT        NOT NULL DEFAULT 'Thank you for your rating! We hope you shop with us again.',
    star5_template      TEXT        NOT NULL DEFAULT 'Thank you so much for the 5-star review! We are thrilled to serve you.',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Reviews Table (Caches Daraz customer reviews)
CREATE TABLE IF NOT EXISTS public.daraz_reviews (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id           TEXT        UNIQUE NOT NULL,
    store_id            UUID        NOT NULL REFERENCES public.online_stores(id) ON DELETE CASCADE,
    order_id            TEXT,
    item_id             TEXT        NOT NULL,
    product_name        TEXT,
    product_image       TEXT,
    rating              INT         NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_content      TEXT,
    buyer_name          TEXT,
    reply_content       TEXT,
    reply_status        TEXT        NOT NULL DEFAULT 'pending' CHECK (reply_status IN ('pending', 'replied', 'failed')),
    replied_at          TIMESTAMPTZ,
    auto_replied        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daraz_reviews_store ON public.daraz_reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_reviews_rating ON public.daraz_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_daraz_reviews_reply_status ON public.daraz_reviews(reply_status);
CREATE INDEX IF NOT EXISTS idx_daraz_reviews_created_at ON public.daraz_reviews(created_at);

-- RLS Configuration
ALTER TABLE public.daraz_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_reviews ENABLE ROW LEVEL SECURITY;

-- Auth policies (allowing authenticated staff/admin users full access)
CREATE POLICY "auth_full_access_review_settings" ON public.daraz_review_settings FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full_access_reviews" ON public.daraz_reviews FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Trigger to keep updated_at columns in sync
CREATE TRIGGER update_daraz_review_settings_modtime BEFORE UPDATE ON public.daraz_review_settings FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- Add table to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.daraz_reviews;

