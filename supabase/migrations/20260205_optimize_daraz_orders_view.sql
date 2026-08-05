-- Optimization: Enhance daraz_orders_with_totals view with additional computed fields and better indexing

-- Drop and recreate the daraz_orders_with_totals view with additional computed fields
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
    
    -- Computed profit metrics using direct calculations
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
    
    -- Estimated profit calculation
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

-- Add comment
COMMENT ON VIEW daraz_orders_with_totals IS 'Aggregated view of Daraz orders with totals, item counts, and computed profit metrics';

-- Grant permissions
GRANT SELECT ON daraz_orders_with_totals TO authenticated;

-- Add additional indexes for better performance on commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_daraz_orders_status_created_at ON daraz_orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_date_status ON daraz_orders(order_date, order_status);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_customer_name ON daraz_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_invoice_number ON daraz_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_tracking_number ON daraz_orders(tracking_number);

-- Index for daraz_order_items to improve join performance
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id_amount ON daraz_order_items(order_id, total_amount);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_product_id_amount ON daraz_order_items(product_id, total_amount);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_seller_account_amount ON daraz_order_items(seller_account, total_amount);

-- Create index for inventory_price_reports_view to improve join performance
-- Note: This assumes the underlying products table has these columns
-- CREATE INDEX IF NOT EXISTS idx_inventory_price_reports_product_id ON inventory_price_reports_view(product_id);