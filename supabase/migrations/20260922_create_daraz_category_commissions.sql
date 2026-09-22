-- Migration: 20260922_create_daraz_category_commissions.sql

CREATE TABLE IF NOT EXISTS public.daraz_category_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_1 TEXT NOT NULL,
    category_2 TEXT,
    category_3 TEXT,
    category_4 TEXT,
    category_5 TEXT,
    category_6 TEXT,
    leaf_category TEXT NOT NULL,
    category_path TEXT NOT NULL,
    commission_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast category lookups and search
CREATE INDEX IF NOT EXISTS idx_daraz_cat_comm_leaf ON public.daraz_category_commissions (LOWER(TRIM(leaf_category)));
CREATE INDEX IF NOT EXISTS idx_daraz_cat_comm_cat1 ON public.daraz_category_commissions (category_1);
CREATE INDEX IF NOT EXISTS idx_daraz_cat_comm_rate ON public.daraz_category_commissions (commission_rate);

-- Safe Unique constraint on category_path for clean UPSERT on re-upload
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daraz_category_commissions_category_path_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'daraz_category_commissions_category_path_key' AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.daraz_category_commissions 
            ADD CONSTRAINT daraz_category_commissions_category_path_key UNIQUE (category_path);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.daraz_category_commissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view, insert, update, delete
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daraz_category_commissions' AND policyname = 'Allow authenticated read on daraz_category_commissions') THEN
        CREATE POLICY "Allow authenticated read on daraz_category_commissions"
            ON public.daraz_category_commissions FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daraz_category_commissions' AND policyname = 'Allow authenticated insert on daraz_category_commissions') THEN
        CREATE POLICY "Allow authenticated insert on daraz_category_commissions"
            ON public.daraz_category_commissions FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daraz_category_commissions' AND policyname = 'Allow authenticated update on daraz_category_commissions') THEN
        CREATE POLICY "Allow authenticated update on daraz_category_commissions"
            ON public.daraz_category_commissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daraz_category_commissions' AND policyname = 'Allow authenticated delete on daraz_category_commissions') THEN
        CREATE POLICY "Allow authenticated delete on daraz_category_commissions"
            ON public.daraz_category_commissions FOR DELETE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daraz_category_commissions' AND policyname = 'Allow service_role full access on daraz_category_commissions') THEN
        CREATE POLICY "Allow service_role full access on daraz_category_commissions"
            ON public.daraz_category_commissions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
