-- Migration to add category matching support
CREATE TABLE IF NOT EXISTS daraz_website_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daraz_category TEXT NOT NULL UNIQUE,
    website_category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add website_category to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS website_category TEXT;
COMMENT ON COLUMN products.website_category IS 'The matched ecommerce website category for the product';

-- Function to bulk sync website categories on products table from mappings
CREATE OR REPLACE FUNCTION sync_all_product_website_categories()
RETURNS void AS $$
BEGIN
    UPDATE products p
    SET website_category = m.website_category
    FROM daraz_website_category_mappings m
    WHERE p.category_name = m.daraz_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
