-- Create table for Daraz Finance Transactions (Full Ledger)
-- Reference: GetTransactionDetails API from Daraz

CREATE TABLE IF NOT EXISTS "daraz_finance_transactions" (
    "transaction_number" TEXT PRIMARY KEY, -- Unique ID from Daraz
    "store_id" UUID NOT NULL REFERENCES "online_stores"("id") ON DELETE CASCADE,
    "transaction_type" TEXT NOT NULL, -- e.g., "Orders", "Refunds", "Payout"
    "fee_name" TEXT NOT NULL, -- e.g., "Commission", "Payment Fee"
    "amount" NUMERIC NOT NULL, -- Can be positive (Credit) or negative (Debit)
    "vat_amount" NUMERIC DEFAULT 0,
    "wht_amount" NUMERIC DEFAULT 0,
    "statement" TEXT, -- Weekly statement ID if provided
    "transaction_date" DATE NOT NULL,
    "order_no" TEXT, -- Can be null for payouts/adjustments
    "details" JSONB DEFAULT '{}'::jsonb, -- Store full raw object for audit
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast efficient syncing and querying by store/date
CREATE INDEX IF NOT EXISTS "daraz_finance_transactions_store_date_idx" 
ON "daraz_finance_transactions" ("store_id", "transaction_date");

-- Index for searching by order number (audit)
CREATE INDEX IF NOT EXISTS "daraz_finance_transactions_order_no_idx" 
ON "daraz_finance_transactions" ("order_no");

-- Enable RLS
ALTER TABLE "daraz_finance_transactions" ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated users (internal app)
CREATE POLICY "Enable all for authenticated users" 
ON "daraz_finance_transactions" 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
