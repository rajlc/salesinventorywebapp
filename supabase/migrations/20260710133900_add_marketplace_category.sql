-- Add marketplace_category column to daraz_website_category_mappings table
ALTER TABLE daraz_website_category_mappings
    ADD COLUMN IF NOT EXISTS marketplace_category TEXT;

-- Also add marketplace_category to the products table if it doesn't exist
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS marketplace_category TEXT;
