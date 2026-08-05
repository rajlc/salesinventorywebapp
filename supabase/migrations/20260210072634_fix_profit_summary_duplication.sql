-- Drop and recreate the materialized view to fix duplication
DROP MATERIALIZED VIEW IF EXISTS daily_profit_summary_cache;

CREATE MATERIALIZED VIEW daily_profit_summary_cache AS
WITH order_level_data AS (
    SELECT 
        o.id as order_primary_id,
        to_char((COALESCE(o.delivered_by_daraz, o.delivered_at))::date, 'YYYY-MM-DD') AS date_str,
        (SELECT doi.seller_account FROM daraz_order_items doi WHERE doi.order_id = o.id LIMIT 1) AS seller,
        (SELECT COALESCE(sum(doi.total_amount), 0) FROM daraz_order_items doi WHERE doi.order_id = o.id) AS revenue,
        (SELECT COALESCE(sum(doi.quantity * COALESCE(doi.purchase_cost, 0)), 0) FROM daraz_order_items doi WHERE doi.order_id = o.id) AS cost,
        COALESCE(o.daraz_fees, 0) AS fees
    FROM daraz_orders o
    WHERE o.order_status = 'Delivered' AND o.delivered_by_daraz IS NOT NULL
)
SELECT 
    date_str,
    COALESCE(seller, 'Unknown') as seller,
    count(*) as order_count,
    sum(revenue) as total_revenue,
    sum(cost) as total_cost,
    sum(revenue - cost - fees - 30) as total_profit
FROM order_level_data
GROUP BY date_str, seller
ORDER BY date_str DESC, seller;

CREATE INDEX idx_profit_summary_date_seller ON daily_profit_summary_cache(date_str, seller);
;
