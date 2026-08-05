-- Migration: Update daraz_orders_with_totals view to include audit trail columns
-- Date: 2026-01-19
-- Description: Recreates the view to include all audit trail fields for order status changes

-- Drop the existing view
DROP VIEW IF EXISTS daraz_orders_with_totals CASCADE;

-- Recreate the view with all audit columns
-- Note: o.* includes ALL columns from daraz_orders, including the new audit columns
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
    (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id ORDER BY item_sequence LIMIT 1) AS seller_account

FROM daraz_orders o
LEFT JOIN daraz_order_items i ON o.id = i.order_id
GROUP BY o.id;

-- Add comment
COMMENT ON VIEW daraz_orders_with_totals IS 'Aggregated view of Daraz orders with totals, item counts, and user information. Includes all audit trail columns from the base table via o.*';

-- Grant permissions (adjust based on your RLS policies)
GRANT SELECT ON daraz_orders_with_totals TO authenticated;
