-- Create global stock_frozen_products table
-- Freeze state is global (no fiscal year scoping)
CREATE TABLE IF NOT EXISTS stock_frozen_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    particulars TEXT NOT NULL UNIQUE,
    is_frozen BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE stock_frozen_products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read on stock_frozen_products"
    ON stock_frozen_products FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated write on stock_frozen_products"
    ON stock_frozen_products FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_stock_frozen_products_particulars
    ON stock_frozen_products (particulars);
