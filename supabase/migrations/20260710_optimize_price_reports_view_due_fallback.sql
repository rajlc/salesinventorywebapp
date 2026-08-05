-- Optimize inventory_price_reports_view to exclude 0 (unpaid/due) unit amounts from price stats
CREATE OR REPLACE VIEW inventory_price_reports_view AS
WITH product_base AS (
    SELECT 
        p.id AS product_id,
        p.product_id AS product_code,
        p.product_name,
        p.image_url,
        p.product_type,
        p.est_price,
        COALESCE(p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4) AS seller_sku,
        p.updated_at
    FROM products p
    WHERE p.is_deleted = false
), 
price_stats AS (
    SELECT 
        p.id as product_id,
        (SELECT unit_amount FROM purchases WHERE product_id = p.id AND unit_amount > 0 ORDER BY purchase_date DESC, created_at DESC LIMIT 1) as last_price,
        (SELECT MIN(unit_amount) FROM purchases WHERE product_id = p.id AND unit_amount > 0) as low_price,
        (SELECT MAX(unit_amount) FROM purchases WHERE product_id = p.id AND unit_amount > 0) as high_price,
        (SELECT (MIN(unit_amount) + MAX(unit_amount)) / 2.0 FROM purchases WHERE product_id = p.id AND unit_amount > 0) as average_price
    FROM products p
),
opening_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) AS qty FROM opening_stocks GROUP BY product_id
), manual_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) AS qty FROM manual_adjustments GROUP BY product_id
), purchase_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) AS qty FROM purchases GROUP BY product_id
), damage_stats AS (
    SELECT product_id, COALESCE(SUM(quantity), 0) AS qty FROM damaged_stocks WHERE status = 'Damaged' GROUP BY product_id
), daraz_sales AS (
    SELECT doi.product_id,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(doi.item_status, o.order_status))) IN ('shipped', 'delivered', 'returning to seller', 'returning_to_seller', 'customer return', 'customer_return', 'returned', 'returned delivered', 'returned_delivered', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'fail delivered', 'delivery failed') THEN doi.quantity ELSE 0 END), 0) AS sales_qty,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(doi.item_status, o.order_status))) IN ('returned delivered', 'returned_delivered', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed') THEN doi.quantity ELSE 0 END), 0) AS return_qty
    FROM daraz_order_items doi JOIN daraz_orders o ON doi.order_id = o.id GROUP BY doi.product_id
), marketplace_sales AS (
    SELECT moi.product_id,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(o.order_status)) IN ('shipped', 'delivered', 'fail delivered', 'delivery failed', 'returned to seller') THEN moi.quantity ELSE 0 END), 0) AS sales_qty,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(o.order_status)) IN ('fail delivered', 'delivery failed', 'returned to seller') THEN moi.quantity ELSE 0 END), 0) AS return_qty
    FROM marketplace_order_items moi JOIN marketplace_orders o ON moi.order_id = o.id GROUP BY moi.product_id
), store_sales AS (
    SELECT product_id, COALESCE(SUM(qty), 0) AS sales_qty FROM store_sales_items GROUP BY product_id
), combo_adjustments AS (
    SELECT pc.child_product_id AS product_id,
        SUM(CASE 
            WHEN LOWER(TRIM(COALESCE(doi.item_status, daraz_o.order_status))) IN ('fail delivered', 'delivery failed', 'returned delivered', 'returned_delivered', 'customer return', 'customer_return', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned') THEN (doi.quantity * pc.quantity)
            WHEN LOWER(TRIM(COALESCE(doi.item_status, daraz_o.order_status))) IN ('shipped', 'delivered', 'returning to seller', 'returning_to_seller') THEN (-1 * doi.quantity * pc.quantity)
            ELSE 0
        END) AS daraz_adj,
        SUM(CASE 
            WHEN LOWER(TRIM(mo.order_status)) IN ('shipped', 'delivered') THEN (-1 * moi.quantity * pc.quantity)
            WHEN LOWER(TRIM(mo.order_status)) IN ('fail delivered', 'delivery failed', 'returned to seller') THEN (moi.quantity * pc.quantity)
            ELSE 0
        END) AS marketplace_adj,
        SUM(-1 * ssi.qty * pc.quantity) AS store_adj
    FROM product_combos pc
    LEFT JOIN daraz_order_items doi ON doi.product_id = pc.parent_product_id
    LEFT JOIN daraz_orders daraz_o ON doi.order_id = daraz_o.id
    LEFT JOIN marketplace_order_items moi ON moi.product_id = pc.parent_product_id
    LEFT JOIN marketplace_orders mo ON moi.order_id = mo.id
    LEFT JOIN store_sales_items ssi ON ssi.product_id = pc.parent_product_id
    GROUP BY pc.child_product_id
), base_stock_calc AS (
    SELECT pb.product_id,
        COALESCE(os.qty, 0) + COALESCE(ms.qty, 0) + COALESCE(ps.qty, 0) + COALESCE(ds.qty, 0) +
        COALESCE(ca.daraz_adj, 0) + COALESCE(ca.marketplace_adj, 0) + COALESCE(ca.store_adj, 0) +
        COALESCE(d_sales.return_qty, 0) + COALESCE(m_sales.return_qty, 0) -
        COALESCE(d_sales.sales_qty, 0) - COALESCE(m_sales.sales_qty, 0) -
        COALESCE(s_sales.sales_qty, 0) AS stock
    FROM product_base pb
    LEFT JOIN opening_stats os ON pb.product_id = os.product_id
    LEFT JOIN manual_stats ms ON pb.product_id = ms.product_id
    LEFT JOIN purchase_stats ps ON pb.product_id = ps.product_id
    LEFT JOIN damage_stats ds ON pb.product_id = ds.product_id
    LEFT JOIN daraz_sales d_sales ON pb.product_id = d_sales.product_id
    LEFT JOIN marketplace_sales m_sales ON pb.product_id = m_sales.product_id
    LEFT JOIN store_sales s_sales ON pb.product_id = s_sales.product_id
    LEFT JOIN combo_adjustments ca ON pb.product_id = ca.product_id
), combo_bottleneck AS (
    SELECT pc.parent_product_id AS product_id,
        MIN(FLOOR(COALESCE(bsc.stock, 0) / pc.quantity)) AS bottleneck_stock
    FROM product_combos pc
    JOIN base_stock_calc bsc ON pc.child_product_id = bsc.product_id
    GROUP BY pc.parent_product_id
)
SELECT 
    pb.product_id,
    pb.product_code,
    pb.product_name,
    pb.image_url,
    pb.product_type,
    pb.est_price,
    pb.seller_sku,
    pb.updated_at,
    ps.last_price,
    ps.low_price,
    ps.high_price,
    ps.average_price,
    COALESCE(
        CASE WHEN pb.product_type = 'combo' THEN cb.bottleneck_stock ELSE bsc.stock END,
        0
    ) AS current_stock
FROM product_base pb
LEFT JOIN price_stats ps ON pb.product_id = ps.product_id
LEFT JOIN base_stock_calc bsc ON pb.product_id = bsc.product_id
LEFT JOIN combo_bottleneck cb ON pb.product_id = cb.product_id;
