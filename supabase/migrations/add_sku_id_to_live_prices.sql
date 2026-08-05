-- Add sku_id column to daraz_live_prices so we can use SkuId for price updates
ALTER TABLE public.daraz_live_prices ADD COLUMN IF NOT EXISTS sku_id TEXT;
