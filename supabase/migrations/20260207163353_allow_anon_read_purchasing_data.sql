-- Allow anonymous read access to products
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Allow public read-only access to products'
    ) THEN
        CREATE POLICY "Allow public read-only access to products" ON products FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Allow anonymous read access to suppliers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' AND policyname = 'Allow public read-only access to suppliers'
    ) THEN
        CREATE POLICY "Allow public read-only access to suppliers" ON suppliers FOR SELECT TO anon USING (true);
    END IF;
END $$;
;
