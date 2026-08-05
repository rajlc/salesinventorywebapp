-- Migration to add cheque_image_url to supplier_transactions
ALTER TABLE public.supplier_transactions ADD COLUMN IF NOT EXISTS cheque_image_url TEXT;
