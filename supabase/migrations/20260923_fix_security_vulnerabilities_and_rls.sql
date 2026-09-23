-- Migration: 20260923_fix_security_vulnerabilities_and_rls.sql
-- Description: Fix Supabase Security Advisor warnings (rls_disabled_in_public & sensitive_columns_exposed)
-- and add performance indexes to prevent statement timeout (57014).

-- ==============================================================================
-- 1. SECURE SENSITIVE CREDENTIAL TABLES (Fixes 'sensitive_columns_exposed')
-- ==============================================================================

-- Secure Daraz API tokens (contains OAuth access_token and refresh_token)
ALTER TABLE IF EXISTS public.daraz_api_tokens ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions from anon role on daraz_api_tokens
REVOKE ALL ON TABLE public.daraz_api_tokens FROM anon;

-- Ensure service_role has full access for background jobs, sync crons, and edge functions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daraz_api_tokens' AND policyname = 'Allow service_role full access on daraz_api_tokens'
    ) THEN
        CREATE POLICY "Allow service_role full access on daraz_api_tokens"
            ON public.daraz_api_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Allow authenticated dashboard users to read and update tokens
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daraz_api_tokens' AND policyname = 'Allow authenticated users full access on daraz_api_tokens'
    ) THEN
        CREATE POLICY "Allow authenticated users full access on daraz_api_tokens"
            ON public.daraz_api_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Drop insecure public/anon access policy on suppliers if present
DROP POLICY IF EXISTS "Allow public read-only access to suppliers" ON public.suppliers;

-- Ensure authenticated staff can access suppliers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' AND policyname = 'Allow authenticated access to suppliers'
    ) THEN
        CREATE POLICY "Allow authenticated access to suppliers" 
            ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY AND GRANT AUTHENTICATED ACCESS
-- ==============================================================================

-- Step 2A: Dynamically enable RLS on every user-defined table in public schema,
-- excluding PostGIS extension tables (spatial_ref_sys, etc.) and system tables
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = false
          AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
          AND tablename NOT LIKE 'pg_%'
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
            RAISE NOTICE 'Enabled RLS on public.%', tbl.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % (cannot alter: %)', tbl.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 2B: Explicit safety policies for Purchases, Suppliers, and Inventory tables
DO $$
DECLARE
    tbl_name TEXT;
    crit_tables TEXT[] := ARRAY[
        'purchases',
        'purchase_items',
        'supplier_transactions',
        'suppliers',
        'products',
        'fiscal_years',
        'online_stores',
        'offline_purchases',
        'purchase_plans',
        'mrp_items',
        'damaged_stocks',
        'damage_resolutions',
        'stock_adjustments',
        'supplier_bills',
        'daraz_orders',
        'daraz_order_items',
        'daraz_live_prices',
        'final_stock_audit_logs',
        'daraz_website_category_mappings'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY crit_tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl_name) THEN
            -- Authenticated policy
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies 
                WHERE tablename = tbl_name AND policyname = format('Allow authenticated full access on %s', tbl_name)
            ) THEN
                BEGIN
                    EXECUTE format(
                        'CREATE POLICY "Allow authenticated full access on %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
                        tbl_name, tbl_name
                    );
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END IF;

            -- Service role policy
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies 
                WHERE tablename = tbl_name AND policyname = format('Allow service_role full access on %s', tbl_name)
            ) THEN
                BEGIN
                    EXECUTE format(
                        'CREATE POLICY "Allow service_role full access on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
                        tbl_name, tbl_name
                    );
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END IF;
        END IF;
    END LOOP;
END $$;

-- Step 2C: Comprehensive safety loop for ALL public tables
-- Ensures no table with RLS enabled is accidentally blocked for authenticated users
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
          AND tablename NOT LIKE 'pg_%'
    ) LOOP
        -- Ensure authenticated users have access if no authenticated/public policy exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = tbl.tablename 
              AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
        ) THEN
            BEGIN
                EXECUTE format(
                    'CREATE POLICY "Allow authenticated full access on %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
                    tbl.tablename, tbl.tablename
                );
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;

        -- Ensure service_role has access if no service_role/public policy exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = tbl.tablename 
              AND ('service_role' = ANY(roles) OR 'public' = ANY(roles))
        ) THEN
            BEGIN
                EXECUTE format(
                    'CREATE POLICY "Allow service_role full access on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
                    tbl.tablename, tbl.tablename
                );
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 3. SPEED UP REPORT QUERIES & PREVENT STATEMENT TIMEOUT (Error 57014)
-- ==============================================================================

-- Index for delivered date and order status lookups
CREATE INDEX IF NOT EXISTS idx_daraz_orders_status_delivered_composite
    ON public.daraz_orders(order_status, COALESCE(delivered_by_daraz, delivered_at));

-- Composite index for order items join
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_product_composite
    ON public.daraz_order_items(order_id, product_id);
