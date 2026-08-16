-- Migration: Create daraz_tax_invoices table for persistent tax invoices & verification tracking
CREATE TABLE IF NOT EXISTS daraz_tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number TEXT,
    date DATE NOT NULL,
    date_period TEXT NOT NULL,
    store_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    invoice_number TEXT,
    description TEXT NOT NULL,
    taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
    notes TEXT,
    fiscal_year_id UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint for auto-generated items to prevent duplicate syncs per statement & category
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_tax_invoices_unique_auto 
ON daraz_tax_invoices (statement_number, store_name, description) 
WHERE source = 'auto' AND statement_number IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_date ON daraz_tax_invoices(date);
CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_fiscal_year ON daraz_tax_invoices(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_store ON daraz_tax_invoices(store_name);
CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_verified ON daraz_tax_invoices(is_verified);

-- Enable RLS
ALTER TABLE daraz_tax_invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and service_role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'daraz_tax_invoices' AND policyname = 'daraz_tax_invoices_all_policy'
    ) THEN
        CREATE POLICY daraz_tax_invoices_all_policy ON daraz_tax_invoices
        FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
