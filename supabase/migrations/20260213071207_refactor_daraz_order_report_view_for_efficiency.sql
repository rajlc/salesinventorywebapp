-- Refactor daraz_order_report_view to be MUCH more efficient
CREATE OR REPLACE VIEW daraz_order_report_view AS
SELECT 
    o.id AS order_primary_id,
    o.order_number,
    o.invoice_number,
    o.order_status,
    o.delivered_at,
    o.delivered_by_daraz,
    o.created_at,
    o.daraz_fees,
    (SELECT doi_inner.seller_account FROM daraz_order_items doi_inner WHERE doi_inner.order_id = o.id LIMIT 1) AS seller_account,
    calc.items_summary,
    calc.total_revenue,
    calc.total_purchase_cost,
    ((calc.total_revenue - COALESCE(calc.total_purchase_cost, 0)) - COALESCE(o.daraz_fees, 0)) - 30 AS estimated_profit,
    CASE 
        WHEN calc.total_revenue > 0 THEN 
            ROUND(((((calc.total_revenue - COALESCE(calc.total_purchase_cost, 0)) - COALESCE(o.daraz_fees, 0)) - 30) / calc.total_revenue) * 100, 2)
        ELSE 0 
    END AS profit_percentage
FROM daraz_orders o
CROSS JOIN LATERAL (
    SELECT 
        jsonb_agg(jsonb_build_object(
            'product_name', doi.product_name,
            'quantity', doi.quantity,
            'purchase_cost', COALESCE(NULLIF(doi.purchase_cost, 0), pp.last_price, pp.est_price, 0),
            'amount', doi.total_amount
        )) AS items_summary,
        SUM(doi.total_amount) AS total_revenue,
        SUM(doi.quantity * COALESCE(NULLIF(doi.purchase_cost, 0), pp.last_price, pp.est_price, 0)) AS total_purchase_cost
    FROM daraz_order_items doi
    LEFT JOIN product_prices_view pp ON doi.product_id = pp.product_id
    WHERE doi.order_id = o.id
) calc
WHERE o.order_status = 'Delivered';
;
