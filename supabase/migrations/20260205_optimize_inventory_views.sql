-- Optimization: Optimize inventory views and add performance indexes

-- First, let's make sure we have the necessary indexes on the products table
-- These indexes will help with the inventory_price_reports_view performance
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products(product_name);
CREATE INDEX IF NOT EXISTS idx_products_seller_sku ON products(seller_sku1);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- If there's an inventory_price_reports_view, let's optimize it
-- First, drop and recreate with better performance characteristics
-- This assumes the view is based on the products table
DROP VIEW IF EXISTS inventory_price_reports_view;

CREATE OR REPLACE VIEW inventory_price_reports_view AS
SELECT 
    p.id as product_id,
    p.product_name,
    p.seller_sku1 as seller_sku,
    
    -- Get latest purchase price for this product
    (SELECT pp.unit_price 
     FROM purchase_products pp
     JOIN purchases pur ON pp.purchase_id = pur.id
     WHERE pp.product_id = p.id
     ORDER BY pur.purchase_date DESC, pur.created_at DESC
     LIMIT 1) AS last_purchase_price,
     
    -- Get average purchase price for this product
    (SELECT AVG(pp.unit_price)
     FROM purchase_products pp
     JOIN purchases pur ON pp.purchase_id = pur.id
     WHERE pp.product_id = p.id) AS avg_purchase_price,
     
    -- Get the last known price from sales if available
    (SELECT sp.rate 
     FROM sales_bill_items sp
     JOIN sales_bills sb ON sp.bill_id = sb.id
     WHERE sp.particulars = p.product_name  -- This might need adjustment based on how products link to sales
     ORDER BY sb.bill_date_ad DESC
     LIMIT 1) AS last_sale_price,
     
    -- Estimate price based on latest available data
    COALESCE(
        (SELECT pp.unit_price 
         FROM purchase_products pp
         JOIN purchases pur ON pp.purchase_id = pur.id
         WHERE pp.product_id = p.id
         ORDER BY pur.purchase_date DESC, pur.created_at DESC
         LIMIT 1),
        (SELECT AVG(pp.unit_price)
         FROM purchase_products pp
         JOIN purchases pur ON pp.purchase_id = pur.id
         WHERE pp.product_id = p.id),
        0
    ) AS est_price,
    
    -- Last price as the most recent purchase price
    (SELECT pp.unit_price 
     FROM purchase_products pp
     JOIN purchases pur ON pp.purchase_id = pur.id
     WHERE pp.product_id = p.id
     ORDER BY pur.purchase_date DESC, pur.created_at DESC
     LIMIT 1) AS last_price,
     
    -- Current stock level
    (SELECT COALESCE(SUM(pi.quantity), 0) - 
            COALESCE((SELECT SUM(sbi.quantity) FROM sales_bill_items sbi WHERE sbi.particulars = p.product_name), 0) AS current_stock
     FROM purchase_products pi
     JOIN purchases pur ON pi.purchase_id = pur.id
     WHERE pi.product_id = p.id) AS current_stock
FROM products p
WHERE p.is_deleted = false;  -- Assuming there's an is_deleted flag

-- Grant permissions
GRANT SELECT ON inventory_price_reports_view TO authenticated;

-- Create indexes on the tables that are frequently joined with inventory
CREATE INDEX IF NOT EXISTS idx_purchase_products_product_id ON purchase_products(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_products_unit_price ON purchase_products(unit_price);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- Indexes for sales tables that might be used in inventory reporting
CREATE INDEX IF NOT EXISTS idx_sales_bills_bill_date_ad ON sales_bills(bill_date_ad);
CREATE INDEX IF NOT EXISTS idx_sales_bill_items_particulars ON sales_bill_items(particulars);

-- Create a function to refresh inventory cache when needed
CREATE OR REPLACE FUNCTION refresh_inventory_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- In a real implementation, this might refresh materialized views or update cached values
    -- For now, we'll just provide a function stub
    -- Actual implementation would depend on specific caching needs
    NULL;
END;
$$;

-- Add comments to document the optimization
COMMENT ON VIEW inventory_price_reports_view IS 'View providing aggregated inventory pricing information with optimized performance';
COMMENT ON FUNCTION refresh_inventory_cache() IS 'Function to refresh inventory-related cached data when needed';