-- Add is_price_locked column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_price_locked BOOLEAN DEFAULT FALSE;

-- Update existing products to have is_price_locked as false if null
UPDATE public.products SET is_price_locked = FALSE WHERE is_price_locked IS NULL;
