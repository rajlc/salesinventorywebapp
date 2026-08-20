-- Migration: Replace 40-query N×M loop in getOrderStatusSummary() with a single RPC
-- This reduces dashboard load from 40+ DB hits to 1 DB hit

CREATE OR REPLACE FUNCTION get_order_status_summary()
RETURNS TABLE (
    seller_account TEXT,
    pending        BIGINT,
    packed         BIGINT,
    ready_to_ship  BIGINT,
    shipped        BIGINT,
    delivered      BIGINT,
    returning_to_seller BIGINT,
    returned_delivered  BIGINT,
    customer_return     BIGINT,
    customer_return_delivered BIGINT,
    unpaid         BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COALESCE(i.seller_account, o.seller_account, 'Unknown') AS seller_account,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'pending')                        AS pending,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'packed')                         AS packed,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'ready to ship')                  AS ready_to_ship,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'shipped')                        AS shipped,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'delivered')                      AS delivered,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'returning to seller')            AS returning_to_seller,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'returned delivered')             AS returned_delivered,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'customer return')                AS customer_return,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'customer return delivered')      AS customer_return_delivered,
        COUNT(*) FILTER (WHERE LOWER(o.order_status) = 'unpaid')                         AS unpaid
    FROM daraz_orders o
    LEFT JOIN LATERAL (
        SELECT seller_account
        FROM daraz_order_items
        WHERE order_id = o.id
        LIMIT 1
    ) i ON true
    WHERE (o.deleted IS NULL OR o.deleted = false)
    GROUP BY COALESCE(i.seller_account, o.seller_account, 'Unknown')
    ORDER BY 1
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_order_status_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_status_summary() TO anon;
