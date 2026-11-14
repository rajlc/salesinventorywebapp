-- Daraz Listing store-scoped permissions + per-staff connector tokens

-- 1. Track who created each draft (used to scope drafts that have no target store yet)
ALTER TABLE public.daraz_draft_listings
    ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_daraz_draft_listings_created_by
    ON public.daraz_draft_listings (created_by);

-- 2. Per-staff connector tokens (ChatGPT / Claude / Gemini). Only the SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS public.connector_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL DEFAULT 'Connector',
    token_hash text NOT NULL UNIQUE,
    token_prefix text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_connector_tokens_user ON public.connector_tokens (user_id);

-- 3. Short-lived OAuth authorization codes (Claude custom connector flow)
CREATE TABLE IF NOT EXISTS public.connector_oauth_codes (
    code_hash text PRIMARY KEY,
    user_id uuid NOT NULL,
    raw_token text NOT NULL,
    code_challenge text,
    code_challenge_method text,
    redirect_uri text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only (no policies => anon/authenticated clients have no access)
ALTER TABLE public.connector_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_oauth_codes ENABLE ROW LEVEL SECURITY;

