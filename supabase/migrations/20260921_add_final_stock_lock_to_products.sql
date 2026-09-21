-- Migration: Add Final Stock / Stock Lock columns to products and create audit logs
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_final_stock_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS final_stock_qty INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_stock_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_stock_locked_at TIMESTAMPTZ DEFAULT NULL;

-- Create audit log table for Final Stock actions
CREATE TABLE IF NOT EXISTS public.final_stock_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    order_number TEXT,
    seller_sku TEXT,
    previous_qty INTEGER,
    new_qty INTEGER,
    zeroed_out BOOLEAN DEFAULT FALSE,
    daraz_api_result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_final_stock_locked ON public.products(is_final_stock_locked) WHERE is_final_stock_locked = TRUE;
CREATE INDEX IF NOT EXISTS idx_final_stock_audit_product ON public.final_stock_audit_logs(product_id);
