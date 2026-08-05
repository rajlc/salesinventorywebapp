-- Create pan_vat_companies table
CREATE TABLE IF NOT EXISTS pan_vat_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    pan_vat_no TEXT NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pan_vat_companies_company_name ON pan_vat_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_pan_vat_companies_supplier_id ON pan_vat_companies(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pan_vat_companies_is_deleted ON pan_vat_companies(is_deleted);

-- Enable RLS
ALTER TABLE pan_vat_companies ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON pan_vat_companies
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
