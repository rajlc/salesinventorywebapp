-- DDL Migration to add extra fields from Daraz API
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_title TEXT,
ADD COLUMN IF NOT EXISTS other_images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS highlights TEXT,
ADD COLUMN IF NOT EXISTS special_price NUMERIC,
ADD COLUMN IF NOT EXISTS regular_price NUMERIC,
ADD COLUMN IF NOT EXISTS category_name TEXT;

-- Comments explaining the new columns
COMMENT ON COLUMN products.product_title IS 'The original raw product title/name synced from Daraz';
COMMENT ON COLUMN products.other_images IS 'A JSON array of strings containing additional image URLs for the product';
COMMENT ON COLUMN products.description IS 'Detailed long description of the product (HTML)';
COMMENT ON COLUMN products.highlights IS 'Highlights of the product (usually short description/bullets HTML)';
COMMENT ON COLUMN products.special_price IS 'Discounted/Promo price of the product sku from Daraz';
COMMENT ON COLUMN products.regular_price IS 'Regular listing price of the product sku from Daraz';
COMMENT ON COLUMN products.category_name IS 'The primary category ID or name from Daraz';
