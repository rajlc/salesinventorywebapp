-- Alter daraz_api_tokens to support separate tokens for multiple apps
ALTER TABLE public.daraz_api_tokens ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'order';

-- Drop the existing primary key constraint
-- The constraint is usually named 'daraz_api_tokens_pkey'
ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS daraz_api_tokens_pkey;

-- Re-add the composite primary key
ALTER TABLE public.daraz_api_tokens ADD PRIMARY KEY (store_id, app_type);
