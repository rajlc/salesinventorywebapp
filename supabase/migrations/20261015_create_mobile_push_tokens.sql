-- ============================================================
-- Migration: Create Mobile Push Tokens Table
-- Purpose : Store Expo Push Tokens for Mobile Devices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    push_token TEXT UNIQUE NOT NULL,
    device_name TEXT,
    platform TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rapid lookup when broadcasting urgent notifications
CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_active ON public.mobile_push_tokens(is_active) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow insert/update/select for all authorized clients
DROP POLICY IF EXISTS "Allow all for mobile_push_tokens" ON public.mobile_push_tokens;
CREATE POLICY "Allow all for mobile_push_tokens"
ON public.mobile_push_tokens
FOR ALL
USING (true)
WITH CHECK (true);
