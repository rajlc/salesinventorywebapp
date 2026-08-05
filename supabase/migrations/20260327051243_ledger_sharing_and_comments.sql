-- Migration: Ledger Sharing & Comments
CREATE TABLE IF NOT EXISTS public.supplier_ledger_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    fiscal_year_id UUID REFERENCES public.fiscal_years(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ledger_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.supplier_transactions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author TEXT NOT NULL, -- 'Supplier' or 'Admin'
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT comment_target_check CHECK (
        (purchase_id IS NULL OR transaction_id IS NULL)
    )
);

-- Enable RLS
ALTER TABLE public.supplier_ledger_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_comments ENABLE ROW LEVEL SECURITY;

-- Policies for supplier_ledger_shares
-- 1. Anyone with the link can READ the share info
CREATE POLICY "Public read by token" ON public.supplier_ledger_shares
    FOR SELECT USING (true);

-- 2. Authenticated users (Admins) can manage shares
CREATE POLICY "Admins manage shares" ON public.supplier_ledger_shares
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for ledger_comments
-- 1. Anyone can read comments (restricted by app logic)
CREATE POLICY "Anyone can read comments" ON public.ledger_comments
    FOR SELECT USING (true);

-- 2. Anyone can insert comments (restricted by app logic / 15-day rule)
CREATE POLICY "Anyone can insert comments" ON public.ledger_comments
    FOR INSERT WITH CHECK (true);

-- 3. Authenticated users (Admins) can delete comments
CREATE POLICY "Admins delete comments" ON public.ledger_comments
    FOR DELETE TO authenticated USING (true);
;
