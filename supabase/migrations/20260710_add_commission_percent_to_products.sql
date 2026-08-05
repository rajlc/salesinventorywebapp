-- Add commission_percent column to products table to store historical rates
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2) DEFAULT 25.00;

-- Update existing products to have default 25.00 if it is null
UPDATE public.products SET commission_percent = 25.00 WHERE commission_percent IS NULL;
