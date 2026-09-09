-- Migration: Add campaign_price to daraz_draft_listings
-- Purpose: Store optional campaign price with raw listing drafts

ALTER TABLE public.daraz_draft_listings 
ADD COLUMN IF NOT EXISTS campaign_price numeric(12, 2);
