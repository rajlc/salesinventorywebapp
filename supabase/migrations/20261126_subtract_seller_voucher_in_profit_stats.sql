-- Subtract seller-funded vouchers (voucher_seller from items_detail) from order revenue
-- so Daily/Weekly/Monthly Profit Tracker totals match the Profit Tracker List and Order Details page.

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
        SELECT 
            o.id,
            o.order_number,
            COALESCE(o.delivered_by_daraz, o.delivered_at) as delivery_date,
            o.daraz_fees,
            COALESCE((
                SELECT SUM(
                    CASE
                        WHEN (elem->>'voucher_seller') ~ '^-?[0-9]+(\.[0-9]+)?$'
                        THEN (elem->>'voucher_seller')::NUMERIC
                        ELSE 0
                    END
                )
                FROM jsonb_array_elements(
                    CASE
                        WHEN o.items_detail IS NOT NULL AND jsonb_typeof(o.items_detail::jsonb) = 'array'
                        THEN o.items_detail::jsonb
                        ELSE '[]'::jsonb
                    END
                ) elem
                WHERE COALESCE(LOWER(elem->>'status'), 'delivered') = 'delivered'
            ), 0) as seller_voucher
        FROM daraz_orders o
        WHERE o.order_status = 'Delivered'
          AND (o.deleted IS NULL OR o.deleted = FALSE)
          AND (search_term_param = '' OR o.order_number ILIKE '%' || search_term_param || '%')
          AND (start_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE >= start_date_param)
          AND (end_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE <= end_date_param)
    ),
    item_costs AS (
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
        SELECT 
            bo.delivery_date,
            ic.seller_account,
            bo.order_number,
            GREATEST(0, COALESCE(ic.revenue, 0) - COALESCE(bo.seller_voucher, 0)) as revenue,
            ic.purchase_cost,
            bo.daraz_fees,
            (GREATEST(0, COALESCE(ic.revenue, 0) - COALESCE(bo.seller_voucher, 0)) - COALESCE(ic.purchase_cost, 0) - COALESCE(bo.daraz_fees, 0) - 30) as calculated_profit,
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
    SELECT 
        TO_CHAR(os.delivery_date::DATE, 'YYYY-MM-DD')::TEXT as date_str,
        COALESCE(os.seller_account, 'Unknown')::TEXT as seller_str,
        ROUND(SUM(COALESCE(os.calculated_profit, 0)), 2)::NUMERIC as total_profit,
        ROUND(SUM(COALESCE(os.revenue, 0)), 2)::NUMERIC as total_revenue,
        ROUND(SUM(COALESCE(os.purchase_cost, 0)), 2)::NUMERIC as total_cost,
        SUM(os.missing_item_count)::INTEGER as total_missing,
        COUNT(*)::BIGINT as total_order_count,
        ARRAY_AGG(os.order_number::TEXT) as all_order_numbers
    FROM order_summaries os
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_profit_stats(text, text, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_daily_profit_summary(text, text, date, date, text) TO authenticated;
