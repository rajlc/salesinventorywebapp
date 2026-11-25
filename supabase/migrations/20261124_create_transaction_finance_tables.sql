-- ============================================================================
-- Transaction Finance Module: CashFlow, Bank Statement, Settlements & Net Worth
-- ============================================================================

-- 1. Financial Accounts (Company Banks, Personal Banks, Cash in Hand, Wallets)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'cash', 'wallet')),
    owner_scope TEXT NOT NULL CHECK (owner_scope IN ('business', 'personal')),
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    account_last4 TEXT,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_scope
    ON public.financial_accounts (owner_scope, account_type)
    WHERE is_active = TRUE;

-- 2. Unified CashFlow & Bank Statement Ledger
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    transfer_to_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'transfer')),
    scope TEXT NOT NULL DEFAULT 'business' CHECK (scope IN ('business', 'personal')),
    category TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    party_or_particular TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_date
    ON public.cash_transactions (transaction_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_account
    ON public.cash_transactions (account_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_transfer_to
    ON public.cash_transactions (transfer_to_account_id, transaction_date DESC)
    WHERE transfer_to_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_source
    ON public.cash_transactions (source_type, source_id)
    WHERE source_id IS NOT NULL;

-- 3. Daraz Weekly (Mon-Sun) Payout Settlements
CREATE TABLE IF NOT EXISTS public.daraz_payout_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    store_id UUID,
    seller_account TEXT NOT NULL,
    expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    received_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unsettled_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    variance_type TEXT NOT NULL DEFAULT 'exact' CHECK (variance_type IN ('exact', 'penalty_fee', 'carry_forward')),
    status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified')),
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_payout_settlements_week
    ON public.daraz_payout_settlements (week_start DESC, seller_account);

-- 4. Daraz Split-Bank Payout Allocations
CREATE TABLE IF NOT EXISTS public.daraz_payout_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES public.daraz_payout_settlements(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    cash_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Courier / Logistics COD Settlements
CREATE TABLE IF NOT EXISTS public.courier_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_name TEXT NOT NULL,
    courier_id UUID,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    received_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unsettled_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    variance_type TEXT NOT NULL DEFAULT 'exact' CHECK (variance_type IN ('exact', 'delivery_rto_fee', 'carry_forward')),
    order_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified')),
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_settlements_date
    ON public.courier_settlements (settlement_date DESC, courier_name);

-- 6. Courier Split-Bank Payout Allocations
CREATE TABLE IF NOT EXISTS public.courier_settlement_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES public.courier_settlements(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    cash_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Other Liabilities (Loans / Unpaid Fixed Bills)
CREATE TABLE IF NOT EXISTS public.other_liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'loan' CHECK (category IN ('loan', 'unpaid_bill', 'other')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    due_date DATE,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. 15-Day Net Worth Report Snapshots
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE,
    period_label TEXT,
    company_banks_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    personal_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cash_in_hand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    warehouse_stock_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    daraz_in_transit_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    daraz_pending_payout NUMERIC(15, 2) NOT NULL DEFAULT 0,
    courier_in_transit_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    courier_pending_cod NUMERIC(15, 2) NOT NULL DEFAULT 0,
    party_receivables NUMERIC(15, 2) NOT NULL DEFAULT 0,
    party_payables NUMERIC(15, 2) NOT NULL DEFAULT 0,
    pending_cheques_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    other_liabilities_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    damaged_goods_loss NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_assets NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_liabilities NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_worth NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Pending Bank SMS Alerts (Android Auto-Detect Approval Queue)
CREATE TABLE IF NOT EXISTS public.pending_bank_sms_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    account_last4 TEXT,
    matched_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    raw_message TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ignored')),
    cash_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
    handled_by UUID REFERENCES auth.users(id),
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_bank_sms_alerts_status
    ON public.pending_bank_sms_alerts (status, received_at DESC);

-- ============================================================================
-- Additive Nullable Columns on Existing Tables (Zero Breaking Changes)
-- ============================================================================

ALTER TABLE IF EXISTS public.marketplace_orders
    ADD COLUMN IF NOT EXISTS cod_settlement_status TEXT NOT NULL DEFAULT 'unsettled',
    ADD COLUMN IF NOT EXISTS cod_settlement_id UUID REFERENCES public.courier_settlements(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.website_orders
    ADD COLUMN IF NOT EXISTS cod_settlement_status TEXT NOT NULL DEFAULT 'unsettled',
    ADD COLUMN IF NOT EXISTS cod_settlement_id UUID REFERENCES public.courier_settlements(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.daraz_orders
    ADD COLUMN IF NOT EXISTS payout_settlement_id UUID REFERENCES public.daraz_payout_settlements(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.expenses
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.purchases
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.supplier_transactions
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cheque_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cheque_cleared_at TIMESTAMPTZ;

-- ============================================================================
-- RLS & Grants (Matching Existing Authenticated Policy Pattern)
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'financial_accounts',
        'cash_transactions',
        'daraz_payout_settlements',
        'daraz_payout_allocations',
        'courier_settlements',
        'courier_settlement_allocations',
        'other_liabilities',
        'net_worth_snapshots',
        'pending_bank_sms_alerts'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.%I', tbl);
        EXECUTE format(
            'CREATE POLICY "Allow all operations for authenticated users" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            tbl
        );
    END LOOP;
END $$;
