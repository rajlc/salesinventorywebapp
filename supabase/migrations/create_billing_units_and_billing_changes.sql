-- Create billing_units table
CREATE TABLE IF NOT EXISTS billing_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default units
INSERT INTO billing_units (name, is_primary) VALUES 
('Pcs', true),
('kg', false),
('Doz', false)
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE billing_units ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for authenticated users on billing_units
DROP POLICY IF EXISTS "Allow all operations for authenticated users on billing_units" ON billing_units;
CREATE POLICY "Allow all operations for authenticated users on billing_units" 
    ON billing_units
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Add unit column to pan_vat_bill_items
ALTER TABLE pan_vat_bill_items 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pcs';

-- Add discount and excise_duty columns to pan_vat_bills
ALTER TABLE pan_vat_bills 
ADD COLUMN IF NOT EXISTS discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS excise_duty DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Add unit column to sales_bill_items
ALTER TABLE sales_bill_items 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pcs';

-- Add discount and taxable_amount columns to sales_bills
ALTER TABLE sales_bills 
ADD COLUMN IF NOT EXISTS discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxable_amount DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Update taxable_amount for previous purchase bills (using the formula: sub_total - discount + excise_duty)
UPDATE pan_vat_bills 
SET taxable_amount = sub_total_amount - COALESCE(discount, 0) + COALESCE(excise_duty, 0)
WHERE taxable_amount IS NULL OR taxable_amount = 0;

-- Update taxable_amount for previous sales bills (using the formula: sub_total - discount)
UPDATE sales_bills 
SET taxable_amount = sub_total_amount - COALESCE(discount, 0)
WHERE taxable_amount IS NULL OR taxable_amount = 0;
