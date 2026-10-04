-- ============================================================
-- Migration: Daraz Chat AI Analysis, Product Q&A, and Urgency Flags
-- Purpose  : Support Product Knowledge Base (Q&A), dynamic AI analysis,
--            urgent customer intent detection, and AI cooldowns.
-- ============================================================

-- 1. Create Product Q&A Knowledge Base Table
CREATE TABLE IF NOT EXISTS public.product_qa (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id       UUID        REFERENCES public.online_stores(id) ON DELETE CASCADE,
    product_id     UUID        REFERENCES public.products(id) ON DELETE SET NULL,
    daraz_item_id  TEXT        NOT NULL,
    seller_sku     TEXT,
    question       TEXT        NOT NULL,
    answer         TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast lookups during chat sessions
CREATE INDEX IF NOT EXISTS idx_product_qa_daraz_item_id ON public.product_qa(daraz_item_id);
CREATE INDEX IF NOT EXISTS idx_product_qa_seller_sku ON public.product_qa(seller_sku);
CREATE INDEX IF NOT EXISTS idx_product_qa_product_id ON public.product_qa(product_id);
CREATE INDEX IF NOT EXISTS idx_product_qa_store_id ON public.product_qa(store_id);

-- Enable RLS and add authenticated policy
ALTER TABLE public.product_qa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access_product_qa" ON public.product_qa FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 2. Extend daraz_chat_settings Table
ALTER TABLE public.daraz_chat_settings
ADD COLUMN IF NOT EXISTS ai_analysis_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_agent_instructions TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS ai_cooldown_hours NUMERIC NOT NULL DEFAULT 2;

-- 3. Extend daraz_chat_sessions Table
ALTER TABLE public.daraz_chat_sessions
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS urgent_reason TEXT,
ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_daraz_chat_sessions_is_urgent ON public.daraz_chat_sessions(is_urgent);
CREATE INDEX IF NOT EXISTS idx_daraz_chat_sessions_paused_until ON public.daraz_chat_sessions(ai_paused_until);

-- Trigger for product_qa updated_at
CREATE TRIGGER update_product_qa_modtime 
BEFORE UPDATE ON public.product_qa 
FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
