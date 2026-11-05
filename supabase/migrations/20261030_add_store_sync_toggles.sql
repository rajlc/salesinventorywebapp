-- Add modular sync toggles for Daraz online stores
-- order_sync_enabled: controls whether orders & financial statements are synced and shown in Sales Entry / Finance
-- chat_review_enabled: controls whether store is shown in Chat AI & Customer Reviews and processed by chat webhooks / review cron

ALTER TABLE public.online_stores
ADD COLUMN IF NOT EXISTS order_sync_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS chat_review_enabled BOOLEAN NOT NULL DEFAULT true;
