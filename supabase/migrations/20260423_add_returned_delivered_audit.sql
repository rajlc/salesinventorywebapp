-- Migration: Add returned_delivered audit trail columns to daraz_orders table
-- Date: 2026-04-23
-- Description: Adds audit trail tracking for "Returned Delivered" status

ALTER TABLE daraz_orders
ADD COLUMN IF NOT EXISTS returned_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS returned_delivered_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS returned_delivered_by_name TEXT,
ADD COLUMN IF NOT EXISTS returned_delivered_by_email TEXT,
ADD COLUMN IF NOT EXISTS edited_by_name TEXT,
ADD COLUMN IF NOT EXISTS edited_by_email TEXT;

COMMENT ON COLUMN daraz_orders.returned_delivered_at IS 'Timestamp when order was delivered back to seller (Returned Delivered)';
COMMENT ON COLUMN daraz_orders.returned_delivered_by IS 'User ID who marked order as returned delivered';
COMMENT ON COLUMN daraz_orders.returned_delivered_by_name IS 'Name of user who marked order as returned delivered';
COMMENT ON COLUMN daraz_orders.returned_delivered_by_email IS 'Email of user who marked order as returned delivered';

-- Recreate the view to include the newly added columns
-- IMPORTANT: PostgreSQL views do not automatically include new columns from parent tables
DROP VIEW IF EXISTS daraz_orders_with_totals;

CREATE OR REPLACE VIEW daraz_orders_with_totals AS
SELECT 
    o.*,
    
    -- Sum totals from items
    COALESCE(SUM(i.quantity), 0) AS total_quantity,
    COALESCE(SUM(i.quantity * i.amount), 0) AS grand_total,
    COUNT(i.id) AS item_count,
    
    -- First product name for display
    (SELECT product_name FROM daraz_order_items WHERE order_id = o.id ORDER BY item_sequence LIMIT 1) AS first_product_name,
    
    -- Seller account from first item
    (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id ORDER BY item_sequence LIMIT 1) AS seller_account,
    
    -- Computed profit metrics
    (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) AS total_revenue,
    
    (SELECT SUM(
        quantity * 
        CASE 
            WHEN purchase_cost IS NOT NULL AND purchase_cost > 0 THEN purchase_cost
            ELSE COALESCE(
                (SELECT COALESCE(last_price, est_price, 0) 
                 FROM inventory_price_reports_view ipr 
                 WHERE ipr.product_id = daraz_order_items.product_id 
                 LIMIT 1), 0)
        END
    ) FROM daraz_order_items WHERE order_id = o.id) AS total_purchase_cost,
    
    (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) - 
    COALESCE((
        SELECT SUM(
            quantity * 
            CASE 
                WHEN purchase_cost IS NOT NULL AND purchase_cost > 0 THEN purchase_cost
                ELSE COALESCE(
                    (SELECT COALESCE(last_price, est_price, 0) 
                     FROM inventory_price_reports_view ipr 
                     WHERE ipr.product_id = daraz_order_items.product_id 
                     LIMIT 1), 0)
            END
        ) FROM daraz_order_items WHERE order_id = o.id
    ), 0) - 
    COALESCE(o.daraz_fees, 0) - 30 AS estimated_profit

FROM daraz_orders o
LEFT JOIN daraz_order_items i ON o.id = i.order_id
GROUP BY o.id;

-- Grant permissions again
GRANT SELECT ON daraz_orders_with_totals TO authenticated;
GRANT SELECT ON daraz_orders_with_totals TO service_role;
