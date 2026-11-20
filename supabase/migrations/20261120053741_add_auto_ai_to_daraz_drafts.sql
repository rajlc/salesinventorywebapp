-- ============================================================
-- Migration: Add Auto-AI 5-Minute Queue Columns to daraz_draft_listings
-- Purpose  : Automatically schedule AI generation 5 minutes after
--            any new draft is created (mobile capture, web single,
--            or web bulk add) without triggering on historical drafts.
-- ============================================================

-- 1. Add columns without default first so existing historical rows stay NULL
ALTER TABLE public.daraz_draft_listings
    ADD COLUMN IF NOT EXISTS auto_ai_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_ai_attempts INTEGER NOT NULL DEFAULT 0;

-- 2. Set 5-minute default for ALL newly inserted drafts (including mobile app direct inserts)
ALTER TABLE public.daraz_draft_listings
    ALTER COLUMN auto_ai_scheduled_at SET DEFAULT (NOW() + INTERVAL '5 minutes');

-- 3. Fast partial index for the background cron queue (Free-tier friendly)
CREATE INDEX IF NOT EXISTS idx_daraz_drafts_auto_ai_queue
    ON public.daraz_draft_listings (auto_ai_scheduled_at)
    WHERE status = 'draft' AND auto_ai_scheduled_at IS NOT NULL;
