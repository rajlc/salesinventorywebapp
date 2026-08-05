-- Migration: Add cheque_type and cheque_name columns to supplier_transactions
ALTER TABLE public.supplier_transactions ADD COLUMN IF NOT EXISTS cheque_type VARCHAR(50);
ALTER TABLE public.supplier_transactions ADD COLUMN IF NOT EXISTS cheque_name VARCHAR(255);
