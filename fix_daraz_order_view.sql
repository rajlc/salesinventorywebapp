-- Fix for daraz_order_report_view - add missing columns
-- Run this SQL in your Supabase SQL editor

-- First, let's check what the current view structure is
-- SELECT * FROM daraz_order_report_view LIMIT 1;

-- Drop and recreate the view with all required columns
DROP VIEW IF EXISTS daraz_order_report_view;

CREATE OR REPLACE VIEW daraz_order_report_view AS
SELECT 
    o.id as order_primary_id,
    o.order_number,
    o.invoice_number,
    o.order_status,
    o.delivered_at,
    o.delivered_by_daraz,
    o.created_at,
    o.daraz_fees,
    
    (SELECT seller_account FROM daraz_order_items 
     WHERE order_id = o.id 
     LIMIT 1) as seller_account,

    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_name', doi.product_name,
                'quantity', doi.quantity,
                'purchase_cost', (
                    CASE 
                        WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                        ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                    END
                ),
                'amount', doi.total_amount
            )
        )
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        WHERE doi.order_id = o.id
    ) as items_summary,

    (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_revenue,
    
    (
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
    ) as total_purchase_cost,

    -- Optimized profit calculation
    (
        (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) - 
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
    ) as estimated_profit,

    -- Add profit percentage
    (
        SELECT 
        CASE 
            WHEN calc.total_amount > 0 THEN 
                ROUND(((calc.total_amount - COALESCE(calc.total_cost, 0) - COALESCE(o.daraz_fees, 0) - 30) / calc.total_amount) * 100, 2)
            ELSE 0
        END
        FROM (
            SELECT 
                (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_amount,
                (
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
                ) as total_cost
        ) calc
    ) as profit_percentage

FROM daraz_orders o
WHERE o.order_status = 'Delivered';

-- Grant permissions
GRANT SELECT ON daraz_order_report_view TO authenticated;

-- Test the view
-- SELECT order_number, delivered_by_daraz, profit_percentage FROM daraz_order_report_view LIMIT 5;