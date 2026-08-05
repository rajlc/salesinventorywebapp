-- Migration: Add supplier_id and wholesale_price to daraz_draft_listings
-- Purpose: Store optional wholesale price and supplier info with raw listing drafts (internal only)

ALTER TABLE public.daraz_draft_listings 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS wholesale_price numeric(12, 2);
