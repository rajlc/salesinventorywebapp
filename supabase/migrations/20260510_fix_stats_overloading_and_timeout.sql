-- Optimized Fix for statement timeout and function overloading

-- 1. Aggressively drop old functions to clear any overloading confusion
DO $$ 
BEGIN
    -- Drop get_cached_daily_profit_summary variations
    DROP FUNCTION IF EXISTS public.get_cached_daily_profit_summary(text, text, text, text, text);
    DROP FUNCTION IF EXISTS public.get_cached_daily_profit_summary(text, text, date, date, text);
    
    -- Drop get_daily_profit_stats variations
    DROP FUNCTION IF EXISTS public.get_daily_profit_stats(text, text, date, date);
    DROP FUNCTION IF EXISTS public.get_daily_profit_stats(text, text, date, date, text);
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- 2. Create high-performance get_daily_profit_stats function
-- This avoids the heavy daraz_order_report_view and queries base tables directly
CREATE OR REPLACE FUNCTION public.get_daily_profit_stats(
    search_term_param TEXT DEFAULT '',
    sync_status_param TEXT DEFAULT 'all',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL,
    seller_account_param TEXT DEFAULT 'All'
)
RETURNS TABLE(
    date TEXT,
    seller TEXT,
    profit NUMERIC,
    revenue NUMERIC,
    cost NUMERIC,
    missing INTEGER,
    order_count BIGINT,
    order_numbers TEXT[]
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH base_orders AS (
        -- Efficiently filter base orders first
        SELECT 
            o.id,
            o.order_number,
            COALESCE(o.delivered_by_daraz, o.delivered_at) as delivery_date,
            o.daraz_fees
        FROM daraz_orders o
        WHERE o.order_status = 'Delivered'
          AND (search_term_param = '' OR o.order_number ILIKE '%' || search_term_param || '%')
          AND (start_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE >= start_date_param)
          AND (end_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE <= end_date_param)
    ),
    item_costs AS (
        -- Group items by order to get revenue and costs
        SELECT 
            doi.order_id,
            doi.seller_account,
            SUM(doi.total_amount) as revenue,
            SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            ) as purchase_cost,
            COUNT(*) FILTER (WHERE doi.purchase_cost IS NULL OR doi.purchase_cost = 0) as missing_item_count
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        GROUP BY doi.order_id, doi.seller_account
    ),
    order_summaries AS (
        -- Join orders with their item summaries and apply remaining filters
        SELECT 
            bo.delivery_date,
            ic.seller_account,
            bo.order_number,
            ic.revenue,
            ic.purchase_cost,
            bo.daraz_fees,
            (COALESCE(ic.revenue, 0) - COALESCE(ic.purchase_cost, 0) - COALESCE(bo.daraz_fees, 0) - 30) as calculated_profit,
            ic.missing_item_count
        FROM base_orders bo
        JOIN item_costs ic ON bo.id = ic.order_id
        WHERE (seller_account_param = 'All' OR ic.seller_account = seller_account_param)
          AND (
            sync_status_param = 'all' OR
            (sync_status_param = 'synced' AND bo.daraz_fees IS NOT NULL AND ic.purchase_cost > 0) OR
            (sync_status_param = 'not_synced' AND (bo.daraz_fees IS NULL OR ic.purchase_cost = 0))
          )
    )
    -- Final aggregation by date and seller
    SELECT 
        TO_CHAR(os.delivery_date::DATE, 'YYYY-MM-DD')::TEXT as date_str,
        COALESCE(os.seller_account, 'Unknown')::TEXT as seller_str,
        SUM(COALESCE(os.calculated_profit, 0))::NUMERIC as total_profit,
        SUM(COALESCE(os.revenue, 0))::NUMERIC as total_revenue,
        SUM(COALESCE(os.purchase_cost, 0))::NUMERIC as total_cost,
        SUM(os.missing_item_count)::INTEGER as total_missing,
        COUNT(*)::BIGINT as total_order_count,
        ARRAY_AGG(os.order_number::TEXT) as all_order_numbers
    FROM order_summaries os
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2;
END;
$$;

-- 3. Create a wrapper function to maintain compatibility with existing JS code
CREATE OR REPLACE FUNCTION public.get_cached_daily_profit_summary(
    search_term TEXT DEFAULT '',
    sync_status_param TEXT DEFAULT 'all',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL,
    seller_account_param TEXT DEFAULT 'All'
)
RETURNS TABLE(
    date TEXT,
    seller TEXT,
    profit NUMERIC,
    revenue NUMERIC,
    cost NUMERIC,
    missing INTEGER,
    order_count BIGINT,
    order_numbers TEXT[]
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.get_daily_profit_stats(search_term, sync_status_param, start_date_param, end_date_param, seller_account_param);
END;
$$;

-- 4. Re-grant permissions
GRANT EXECUTE ON FUNCTION public.get_daily_profit_stats(text, text, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_daily_profit_summary(text, text, date, date, text) TO authenticated;
