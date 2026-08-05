-- Create the missing materialized view for daily profit summary cache

-- First, make sure the function exists
CREATE OR REPLACE FUNCTION refresh_daily_profit_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW IF EXISTS daily_profit_summary_cache;
END;
$$;

-- Create the materialized view if it doesn't exist
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_profit_summary_cache AS
SELECT 
    TO_CHAR(COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE, 'YYYY-MM-DD') AS date_str,
    COALESCE(
        (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id LIMIT 1), 
        'Unknown'
    ) AS seller,
    COUNT(*) AS order_count,
    SUM(
        (SELECT COALESCE(SUM(total_amount), 0) FROM daraz_order_items WHERE order_id = o.id)
    ) AS total_revenue,
    SUM(
        COALESCE((
            SELECT SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            )
            FROM daraz_order_items doi
            LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
            WHERE doi.order_id = o.id
        ), 0)
    ) AS total_cost,
    SUM(
        (SELECT COALESCE(SUM(total_amount), 0) FROM daraz_order_items WHERE order_id = o.id) - 
        COALESCE((
            SELECT SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            )
            FROM daraz_order_items doi
            LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
            WHERE doi.order_id = o.id
        ), 0) - 
        COALESCE(o.daraz_fees, 0) - 30
    ) AS total_profit
FROM daraz_orders o
LEFT JOIN daraz_order_items doi ON doi.order_id = o.id
LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
WHERE o.order_status = 'Delivered'
  AND o.delivered_by_daraz IS NOT NULL
GROUP BY date_str, seller
ORDER BY date_str DESC, seller;

-- Create index on the materialized view for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_profit_summary_date_seller ON daily_profit_summary_cache(date_str, seller);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW daily_profit_summary_cache;

-- Grant permissions on materialized view
GRANT SELECT ON daily_profit_summary_cache TO authenticated;