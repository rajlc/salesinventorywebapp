-- ==============================================================================
-- Migration: Reclaim 550+ MB Disk Space (Table Rebuild Method)
-- ==============================================================================
-- Why this works:
-- The Supabase SQL Editor automatically wraps queries in a transaction block, 
-- which blocks PostgreSQL's VACUUM command (ERROR 25001).
--
-- Instead, this script creates a clean, unbloated table with all 184k rows, 
-- drops the 603 MB bloated table (which immediately releases disk space to the OS),
-- and swaps in the new table. 
--
-- Total execution time: ~10 to 20 seconds.
-- ==============================================================================

-- 1. Create a clean, compact table structure
CREATE TABLE IF NOT EXISTS public.daraz_finance_transactions_compact (
    transaction_number TEXT PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.online_stores(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    fee_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    vat_amount NUMERIC DEFAULT 0,
    wht_amount NUMERIC DEFAULT 0,
    statement TEXT,
    transaction_date DATE NOT NULL,
    order_no TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Copy all rows, leaving out the bloated 130MB duplicate details JSON
INSERT INTO public.daraz_finance_transactions_compact (
    transaction_number, store_id, transaction_type, fee_name,
    amount, vat_amount, wht_amount, statement,
    transaction_date, order_no, details, created_at
)
SELECT 
    transaction_number, store_id, transaction_type, fee_name,
    amount, vat_amount, wht_amount, statement,
    transaction_date, order_no, '{}'::jsonb, created_at
FROM public.daraz_finance_transactions;

-- 3. Create necessary performance indexes on the compact table
CREATE INDEX IF NOT EXISTS daraz_finance_transactions_compact_store_date_idx 
    ON public.daraz_finance_transactions_compact (store_id, transaction_date);

CREATE INDEX IF NOT EXISTS daraz_finance_transactions_compact_order_no_idx 
    ON public.daraz_finance_transactions_compact (order_no);

CREATE INDEX IF NOT EXISTS daraz_finance_transactions_compact_statement_idx 
    ON public.daraz_finance_transactions_compact (statement);

CREATE INDEX IF NOT EXISTS daraz_finance_transactions_compact_store_statement_idx 
    ON public.daraz_finance_transactions_compact (store_id, statement);

-- 4. Enable Row Level Security and grant permissions
ALTER TABLE public.daraz_finance_transactions_compact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" 
    ON public.daraz_finance_transactions_compact 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service_role" 
    ON public.daraz_finance_transactions_compact 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.daraz_finance_transactions_compact TO authenticated;
GRANT ALL ON public.daraz_finance_transactions_compact TO service_role;
GRANT ALL ON public.daraz_finance_transactions_compact TO anon;

-- 5. Drop the old bloated 603 MB table (this immediately deallocates the disk bloat)
DROP TABLE public.daraz_finance_transactions;

-- 6. Rename the compact table and its indexes to original names
ALTER TABLE public.daraz_finance_transactions_compact 
    RENAME TO daraz_finance_transactions;

ALTER INDEX daraz_finance_transactions_compact_pkey 
    RENAME TO daraz_finance_transactions_pkey;

ALTER INDEX daraz_finance_transactions_compact_store_date_idx 
    RENAME TO daraz_finance_transactions_store_date_idx;

ALTER INDEX daraz_finance_transactions_compact_order_no_idx 
    RENAME TO daraz_finance_transactions_order_no_idx;

ALTER INDEX daraz_finance_transactions_compact_statement_idx 
    RENAME TO daraz_finance_transactions_statement_idx;

ALTER INDEX daraz_finance_transactions_compact_store_statement_idx 
    RENAME TO daraz_finance_transactions_store_statement_idx;
