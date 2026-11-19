-- Add optional address column to pan_vat_companies for Balance Confirmation letters
ALTER TABLE public.pan_vat_companies
    ADD COLUMN IF NOT EXISTS address TEXT;

-- Create balance_confirmations table
CREATE TABLE IF NOT EXISTS public.balance_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_company_id UUID REFERENCES public.pan_vat_companies(id) ON DELETE CASCADE,
    buyer_company_id UUID REFERENCES public.company_details(id) ON DELETE CASCADE,
    fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
    supplier_company_name TEXT,
    buyer_company_name TEXT,
    party_address TEXT,
    letter_date_ad TEXT,
    letter_date_bs TEXT,
    taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    exempted_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_bill_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_balance_type TEXT NOT NULL DEFAULT 'Cr' CHECK (opening_balance_type IN ('Dr', 'Cr')),
    closing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    closing_balance_type TEXT NOT NULL DEFAULT 'Cr' CHECK (closing_balance_type IN ('Dr', 'Cr')),
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Unique index per (supplier_company_id, buyer_company_id, fiscal_year_id) handling nullable FKs safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_confirmations_unique_party_fy
    ON public.balance_confirmations (
        COALESCE(supplier_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(buyer_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        fiscal_year_id
    );

CREATE INDEX IF NOT EXISTS idx_balance_confirmations_fiscal_year
    ON public.balance_confirmations (fiscal_year_id);

CREATE INDEX IF NOT EXISTS idx_balance_confirmations_verified
    ON public.balance_confirmations (fiscal_year_id, is_verified)
    WHERE is_verified = TRUE;

-- Enable Row Level Security
ALTER TABLE public.balance_confirmations ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (Supabase Data API exposure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balance_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balance_confirmations TO service_role;

-- RLS Policy for authenticated users (matches pan_vat_companies & company_details)
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.balance_confirmations;
CREATE POLICY "Allow all operations for authenticated users"
    ON public.balance_confirmations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
