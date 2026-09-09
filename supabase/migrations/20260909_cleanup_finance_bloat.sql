-- ==============================================================================
-- Migration: Reclaim Database Disk Space (Free up ~600+ MB)
-- ==============================================================================
-- Problem: 
-- 1) daraz_finance_transactions table is 603 MB (75% of DB) due to 184k rows 
--    storing full duplicate raw API JSON inside "details" + dead tuple bloat from UPSERTs.
-- 2) daraz_orders table is 115 MB due to items_detail JSON + dead tuple bloat.
--
-- Instructions:
-- Run the statements below in your Supabase SQL Editor (Dashboard > SQL Editor):
-- ==============================================================================

-- 1. Strip redundant duplicate JSON from daraz_finance_transactions (all data is already in columns)
UPDATE public.daraz_finance_transactions
SET details = '{}'::jsonb
WHERE details != '{}'::jsonb;

-- 2. Reclaim all dead disk space and compact the tables
-- (Run individually in Supabase SQL Editor as VACUUM cannot run inside a transaction block)
VACUUM FULL public.daraz_finance_transactions;
VACUUM FULL public.daraz_orders;
VACUUM FULL public.daraz_order_items;
