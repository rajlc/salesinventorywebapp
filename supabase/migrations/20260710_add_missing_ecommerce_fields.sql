-- DDL Migration to add missing fields in ecommerce_products table
ALTER TABLE ecommerce_products
ADD COLUMN IF NOT EXISTS sub_category TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'No Brand',
ADD COLUMN IF NOT EXISTS warehouse_product_id TEXT;

-- Comments explaining the new columns in ecommerce_products table
COMMENT ON COLUMN ecommerce_products.sub_category IS 'The sub-category name synced or selected for the storefront';
COMMENT ON COLUMN ecommerce_products.brand IS 'The brand name of the product (defaults to No Brand)';
COMMENT ON COLUMN ecommerce_products.warehouse_product_id IS 'The readable warehouse inventory ID linking back to products.product_id';
