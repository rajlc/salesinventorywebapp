-- Create table for Daraz weekly transactions
CREATE TABLE IF NOT EXISTS public.daraz_weekly_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Date Range (Monday to Sunday)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Store information
    seller_account TEXT NOT NULL,
    company_name TEXT NOT NULL,
    
    -- Financial fields
    estimated_sales_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sales_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Daraz Commission & Fees
    cofunded_voucher_max DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
    daraz_coins_discount_participation_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
    free_shipping_max_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
    commission_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
    general_sales_tax_withholding DECIMAL(15, 2) NOT NULL DEFAULT 0,
    handling_fee DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Computed field
    total_commission_fees DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Relationship
    fiscal_year_id UUID REFERENCES public.fiscal_years(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    
    -- Prevent duplicate records for the same week and account
    CONSTRAINT unique_week_seller UNIQUE (start_date, end_date, seller_account)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daraz_weekly_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
DROP POLICY IF EXISTS "Allow all operations for authenticated users on daraz_weekly_transactions" ON public.daraz_weekly_transactions;
CREATE POLICY "Allow all operations for authenticated users on daraz_weekly_transactions" 
ON public.daraz_weekly_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE public.daraz_weekly_transactions TO postgres;
GRANT ALL ON TABLE public.daraz_weekly_transactions TO anon;
GRANT ALL ON TABLE public.daraz_weekly_transactions TO authenticated;
GRANT ALL ON TABLE public.daraz_weekly_transactions TO service_role;
