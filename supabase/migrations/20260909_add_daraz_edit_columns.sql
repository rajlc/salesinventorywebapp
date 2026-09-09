-- Migration: Add columns to products table for Daraz product editing and draft persistence
ALTER TABLE products ADD COLUMN IF NOT EXISTS daraz_edit_draft jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS daraz_push_status text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS daraz_item_id text;

-- Index for querying push status
CREATE INDEX IF NOT EXISTS idx_products_daraz_push_status ON products(daraz_push_status);
CREATE INDEX IF NOT EXISTS idx_products_daraz_item_id ON products(daraz_item_id);
