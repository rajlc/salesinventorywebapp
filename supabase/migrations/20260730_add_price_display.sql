-- Migration: Add price_display column for multi-variation price range formatting (e.g. "Rs 371 / Rs 449")
ALTER TABLE public.daraz_competitor_products 
ADD COLUMN IF NOT EXISTS price_display TEXT;
