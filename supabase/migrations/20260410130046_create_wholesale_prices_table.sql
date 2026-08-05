CREATE TABLE public.product_wholesale_prices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
    wholesale_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.product_wholesale_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to wholesale_prices"
ON public.product_wholesale_prices FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow authenticated full access to wholesale_prices"
ON public.product_wholesale_prices FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add indexes
CREATE INDEX idx_wholesale_prices_product_id ON public.product_wholesale_prices(product_id);
CREATE INDEX idx_wholesale_prices_supplier_id ON public.product_wholesale_prices(supplier_id);;
