-- Create company_details table
CREATE TABLE IF NOT EXISTS company_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    pan_vat_details TEXT,
    address TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_company_details_company_name ON company_details(company_name);
CREATE INDEX IF NOT EXISTS idx_company_details_is_deleted ON company_details(is_deleted);

-- Enable RLS
ALTER TABLE company_details ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON company_details
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
