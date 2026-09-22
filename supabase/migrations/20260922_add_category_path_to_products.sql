-- Migration: Add category_path to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_path TEXT;

-- Index for fast lookup by category_path
CREATE INDEX IF NOT EXISTS idx_products_category_path ON public.products (category_path);
