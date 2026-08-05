-- Create sales_bills table
CREATE TABLE IF NOT EXISTS sales_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Bill Dates
    bill_date_ad DATE NOT NULL,
    bill_date_bs TEXT NOT NULL,
    
    -- Seller Information (Our Company)
    seller_company_id UUID REFERENCES company_details(id),
    
    -- Invoice Details
    invoice_no TEXT NOT NULL,
    
    -- Customer Information
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    customer_pan_vat TEXT,
    
    -- Totals
    sub_total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Fiscal Year (optional but good practice if we want to filter by FY later)
    fiscal_year_id UUID REFERENCES fiscal_years(id),
    
    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create sales_bill_items table
CREATE TABLE IF NOT EXISTS sales_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES sales_bills(id) ON DELETE CASCADE,
    
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
CREATE INDEX IF NOT EXISTS idx_sales_bills_date_ad ON sales_bills(bill_date_ad);
CREATE INDEX IF NOT EXISTS idx_sales_bills_customer ON sales_bills(customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_bills_invoice ON sales_bills(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_bill_items_bill_id ON sales_bill_items(bill_id);

-- Enable RLS
ALTER TABLE sales_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_bill_items ENABLE ROW LEVEL SECURITY;

-- Create policies (open for authenticated users for now)
CREATE POLICY "Allow all operations for authenticated users" ON sales_bills
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON sales_bill_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
