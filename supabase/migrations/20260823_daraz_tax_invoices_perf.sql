-- Migration: Add unique constraint and indexes for daraz_tax_invoices
-- Fixes ON CONFLICT upsert requirement

-- 1. Remove any duplicate rows if any exist
DELETE FROM daraz_tax_invoices a USING daraz_tax_invoices b
WHERE a.ctid < b.ctid 
  AND a.statement_number IS NOT NULL 
  AND a.statement_number = b.statement_number 
  AND a.store_name = b.store_name 
  AND a.description = b.description;

-- 2. Drop old non-matching partial or plain indexes
DROP INDEX IF EXISTS idx_daraz_tax_invoices_unique_auto;
DROP INDEX IF EXISTS idx_daraz_tax_invoices_upsert_key;

-- 3. Create non-partial UNIQUE index matching ON CONFLICT (statement_number, store_name, description)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_tax_invoices_stmt_store_desc_unique 
    ON daraz_tax_invoices(statement_number, store_name, description);

-- 4. Additional lookup performance indexes
CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_stmt_number
    ON daraz_tax_invoices(statement_number)
    WHERE statement_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daraz_tax_invoices_stmt_source_verified
    ON daraz_tax_invoices(statement_number, source, is_verified)
    WHERE statement_number IS NOT NULL;
