-- Create pan_vat_bills table
CREATE TABLE IF NOT EXISTS pan_vat_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Bill Dates
    issue_bill_date_ad DATE NOT NULL,
    issue_bill_date_bs TEXT NOT NULL,
    
    -- Supplier Information
    supplier_company_id UUID REFERENCES pan_vat_companies(id),
    supplier_company_name TEXT,
    supplier_pan_vat TEXT,
    
    -- Invoice Details
    invoice_no TEXT NOT NULL,
    
    -- Buyer Information
    buyer_company_id UUID REFERENCES company_details(id),
    buyer_company_name TEXT,
    buyer_pan_vat TEXT,
    
    -- Totals
    sub_total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    taxable_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    vat_13_percent DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Fiscal Year
    fiscal_year_id UUID REFERENCES fiscal_years(id),
    
    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create pan_vat_bill_items table
CREATE TABLE IF NOT EXISTS pan_vat_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES pan_vat_bills(id) ON DELETE CASCADE,
    
    -- Item Details
    hs_code TEXT,
    particulars TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(15, 2) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    
    -- Display Order
    line_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_issue_date_ad ON pan_vat_bills(issue_bill_date_ad);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_supplier_company_id ON pan_vat_bills(supplier_company_id);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_buyer_company_id ON pan_vat_bills(buyer_company_id);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_fiscal_year_id ON pan_vat_bills(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_invoice_no ON pan_vat_bills(invoice_no);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bills_is_deleted ON pan_vat_bills(is_deleted);
CREATE INDEX IF NOT EXISTS idx_pan_vat_bill_items_bill_id ON pan_vat_bill_items(bill_id);

-- Enable RLS
ALTER TABLE pan_vat_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pan_vat_bill_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for authenticated users" ON pan_vat_bills
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON pan_vat_bill_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
