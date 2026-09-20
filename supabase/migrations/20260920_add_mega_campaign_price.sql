-- Migration: Add mega_campaign_price to daraz_avg_prices table
ALTER TABLE public.daraz_avg_prices 
ADD COLUMN IF NOT EXISTS mega_campaign_price NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.daraz_avg_prices.mega_campaign_price IS 'Mega Campaign promotional sales price for Daraz';
