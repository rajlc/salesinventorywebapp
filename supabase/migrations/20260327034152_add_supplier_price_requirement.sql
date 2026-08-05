-- Add price_requirement column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN price_requirement BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.suppliers.price_requirement IS 'If true (Yes), unit_amount is required in purchase entry. If false (No), it is optional.';
;
