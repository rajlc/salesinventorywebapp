-- Drop and recreate inventory_price_reports_view with combo bottleneck logic
DROP VIEW IF EXISTS public.inventory_price_reports_view CASCADE;

CREATE VIEW public.inventory_price_reports_view AS
WITH product_base AS (
    SELECT 
        p.id,
        p.product_id AS product_code,
        p.product_name,
        p.image_url,
        p.product_type,
        p.est_price,
        COALESCE(p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4) as seller_sku,
        p.updated_at
    FROM products p
    WHERE p.is_deleted = false
),
opening_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) as qty
    FROM opening_stocks
    GROUP BY product_id
),
manual_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) as qty
    FROM manual_adjustments
    GROUP BY product_id
),
purchase_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) as qty
    FROM purchases
    GROUP BY product_id
),
damage_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) as qty
    FROM damaged_stocks
    WHERE status = 'Damaged'
    GROUP BY product_id
),
daraz_sales AS (
    SELECT 
        doi.product_id,
        COALESCE(SUM(CASE 
            WHEN LOWER(TRIM(COALESCE(doi.item_status, o.order_status))) IN (
                'shipped', 'delivered', 'returning to seller', 'returning_to_seller', 
                'customer return', 'customer_return', 'returned', 'returned delivered', 
                'returned_delivered', 'customer return delivered', 'customer_return_delivered', 
                'return delivered', 'fail delivered', 'delivery failed'
            ) THEN doi.quantity ELSE 0 END), 0) as sales_qty,
        COALESCE(SUM(CASE 
            WHEN LOWER(TRIM(COALESCE(doi.item_status, o.order_status))) IN (
                'returned delivered', 'returned_delivered', 'customer return delivered', 
                'customer_return_delivered', 'return delivered', 'returned', 
                'fail delivered', 'delivery failed'
            ) THEN doi.quantity ELSE 0 END), 0) as return_qty
    FROM daraz_order_items doi
    JOIN daraz_orders o ON doi.order_id = o.id
    GROUP BY doi.product_id
),
marketplace_sales AS (
    SELECT 
        moi.product_id,
        COALESCE(SUM(CASE 
            WHEN LOWER(TRIM(o.order_status)) IN ('shipped', 'delivered', 'fail delivered', 'delivery failed', 'returned to seller') 
            THEN moi.quantity ELSE 0 END), 0) as sales_qty,
        COALESCE(SUM(CASE 
            WHEN LOWER(TRIM(o.order_status)) IN ('fail delivered', 'delivery failed', 'returned to seller') 
            THEN moi.quantity ELSE 0 END), 0) as return_qty
    FROM marketplace_order_items moi
    JOIN marketplace_orders o ON moi.order_id = o.id
    GROUP BY moi.product_id
),
store_sales AS (
    SELECT product_id, COALESCE(SUM(qty), 0) as sales_qty
    FROM store_sales_items
    GROUP BY product_id
),
combo_adjustments AS (
    SELECT 
        pc.child_product_id as product_id,
        SUM(
            CASE 
                WHEN LOWER(TRIM(COALESCE(doi.item_status, daraz_o.order_status))) IN (
                    'fail delivered', 'delivery failed', 'returned delivered', 'returned_delivered', 
                    'customer return', 'customer_return', 'customer return delivered', 
                    'customer_return_delivered', 'return delivered', 'returned'
                ) THEN doi.quantity * pc.quantity
                WHEN LOWER(TRIM(COALESCE(doi.item_status, daraz_o.order_status))) IN (
                    'shipped', 'delivered', 'returning to seller', 'returning_to_seller'
                ) THEN -1 * doi.quantity * pc.quantity
                ELSE 0 
            END
        ) as daraz_adj,
        SUM(
            CASE 
                WHEN LOWER(TRIM(mo.order_status)) IN ('shipped', 'delivered')
                THEN -1 * moi.quantity * pc.quantity
                WHEN LOWER(TRIM(mo.order_status)) IN ('fail delivered', 'delivery failed', 'returned to seller')
                THEN moi.quantity * pc.quantity
                ELSE 0
            END
        ) as marketplace_adj,
        SUM(
            -1 * ssi.qty * pc.quantity
        ) as store_adj
    FROM product_combos pc
    LEFT JOIN daraz_order_items doi ON doi.product_id = pc.parent_product_id
    LEFT JOIN daraz_orders daraz_o ON doi.order_id = daraz_o.id
    LEFT JOIN marketplace_order_items moi ON moi.product_id = pc.parent_product_id
    LEFT JOIN marketplace_orders mo ON moi.order_id = mo.id
    LEFT JOIN store_sales_items ssi ON ssi.product_id = pc.parent_product_id
    GROUP BY pc.child_product_id
),
base_stock_calc AS (
    SELECT 
        pb.id as product_id,
        (
            COALESCE(os.qty, 0.0) + 
            COALESCE(ms.qty, 0.0) + 
            COALESCE(ps.qty, 0.0) + 
            COALESCE(ds.qty, 0.0) + 
            COALESCE(ca.daraz_adj, 0.0) + 
            COALESCE(ca.marketplace_adj, 0.0) + 
            COALESCE(ca.store_adj, 0.0) +
            COALESCE(d_sales.return_qty, 0.0) +
            COALESCE(m_sales.return_qty, 0.0) -
            COALESCE(d_sales.sales_qty, 0.0) -
            COALESCE(m_sales.sales_qty, 0.0) -
            COALESCE(s_sales.sales_qty, 0.0)
        ) as stock
    FROM product_base pb
    LEFT JOIN opening_stats os ON pb.id = os.product_id
    LEFT JOIN manual_stats ms ON pb.id = ms.product_id
    LEFT JOIN purchase_stats ps ON pb.id = ps.product_id
    LEFT JOIN damage_stats ds ON pb.id = ds.product_id
    LEFT JOIN daraz_sales d_sales ON pb.id = d_sales.product_id
    LEFT JOIN marketplace_sales m_sales ON pb.id = m_sales.product_id
    LEFT JOIN store_sales s_sales ON pb.id = s_sales.product_id
    LEFT JOIN combo_adjustments ca ON pb.id = ca.product_id
),
combo_bottleneck AS (
    SELECT 
        pc.parent_product_id as product_id,
        MIN(FLOOR(COALESCE(bsc.stock, 0) / pc.quantity)) as bottleneck_stock
    FROM product_combos pc
    JOIN base_stock_calc bsc ON pc.child_product_id = bsc.product_id
    GROUP BY pc.parent_product_id
)
SELECT 
    pb.id as product_id,
    pb.product_code,
    pb.product_name,
    pb.image_url,
    pb.product_type,
    pb.est_price,
    pb.seller_sku,
    pb.updated_at,
    (SELECT unit_amount FROM purchases WHERE product_id = pb.id ORDER BY purchase_date DESC, created_at DESC LIMIT 1) as last_price,
    (SELECT min(unit_amount) FROM purchases WHERE product_id = pb.id) as low_price,
    (SELECT max(unit_amount) FROM purchases WHERE product_id = pb.id) as high_price,
    (SELECT (min(unit_amount) + max(unit_amount)) / 2.0 FROM purchases WHERE product_id = pb.id) as average_price,
    COALESCE(
        CASE 
            WHEN pb.product_type = 'combo' THEN cb.bottleneck_stock
            ELSE bsc.stock
        END, 
        0
    ) as current_stock
FROM product_base pb
LEFT JOIN base_stock_calc bsc ON pb.id = bsc.product_id
LEFT JOIN combo_bottleneck cb ON pb.id = cb.product_id;

-- 3. Recreate daraz_orders_with_totals
CREATE OR REPLACE VIEW daraz_orders_with_totals AS
SELECT 
    o.*,
    COALESCE(SUM(i.quantity), 0) AS total_quantity,
    COALESCE(SUM(i.quantity * i.amount), 0) AS grand_total,
    COUNT(i.id) AS item_count,
    (SELECT product_name FROM daraz_order_items WHERE order_id = o.id ORDER BY item_sequence LIMIT 1) AS first_product_name,
    (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id ORDER BY item_sequence LIMIT 1) AS seller_account,
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

-- 4. Recreate daraz_order_report_view
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
    (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id LIMIT 1) as seller_account,
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
    (
        SELECT (total_amount - COALESCE(total_cost, 0) - COALESCE(o.daraz_fees, 0) - 30)
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
    ) as estimated_profit,
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

GRANT SELECT ON public.inventory_price_reports_view TO authenticated;
GRANT SELECT ON public.inventory_price_reports_view TO anon;
GRANT SELECT ON public.inventory_price_reports_view TO service_role;

GRANT SELECT ON daraz_orders_with_totals TO authenticated;
GRANT SELECT ON daraz_orders_with_totals TO anon;
GRANT SELECT ON daraz_orders_with_totals TO service_role;

GRANT SELECT ON daraz_order_report_view TO authenticated;
GRANT SELECT ON daraz_order_report_view TO anon;
GRANT SELECT ON daraz_order_report_view TO service_role;
;
