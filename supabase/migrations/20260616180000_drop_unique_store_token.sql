-- Drop the unique constraint on store_id to allow multiple rows (different app_types) per store
ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS unique_store_token;
ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS daraz_api_tokens_store_id_key;
