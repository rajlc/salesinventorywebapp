-- =============================================================
-- Migration: Add is_new_pushed and pushed_at to products table
-- Purpose: Track newly pushed products to order them first in dashboards
-- =============================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new_pushed BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for sorting performance
CREATE INDEX IF NOT EXISTS idx_products_is_new_pushed ON public.products (is_new_pushed DESC, pushed_at DESC NULLS LAST);
