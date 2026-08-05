-- Stock Ledger Optimization View
-- This view consolidates multiple table aggregations into a single queryable source.
-- Use this to replace multiple parallel/sequential queries in the stock-ledger-service.

CREATE OR REPLACE VIEW public.stock_ledger_view AS
WITH 
  opening AS (
    SELECT product_id, SUM(quantity) as qty 
    FROM public.opening_stocks 
    GROUP BY product_id
  ),
  manual AS (
    SELECT product_id, SUM(quantity) as qty 
    FROM public.manual_adjustments 
    GROUP BY product_id
  ),
  damage AS (
    SELECT product_id, SUM(quantity) as qty 
    FROM public.damaged_stocks 
    WHERE status = 'Damaged' 
    GROUP BY product_id
  ),
  purchase AS (
    SELECT product_id, SUM(quantity) as qty 
    FROM public.purchases 
    GROUP BY product_id
  ),
  -- Combine all sales sources
  daraz_sales AS (
    SELECT 
      doi.product_id,
      SUM(CASE WHEN TRIM(LOWER(COALESCE(doi.item_status, d.order_status))) IN ('shipped', 'delivered', 'returning to seller', 'returning_to_seller', 'shipped_back', 'failed_delivery', 'delivery_failed', 'customer return', 'customer_return', 'returned', 'returned delivered', 'returned_delivered', 'shipped_back_success', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'fail delivered', 'delivery failed') THEN doi.quantity ELSE 0 END) as sales,
      SUM(CASE WHEN TRIM(LOWER(COALESCE(doi.item_status, d.order_status))) IN ('returned delivered', 'returned_delivered', 'shipped_back_success', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed') THEN doi.quantity ELSE 0 END) as returns
    FROM public.daraz_order_items doi
    JOIN public.daraz_orders d ON doi.order_id = d.id
    GROUP BY doi.product_id
  ),
  marketplace_sales AS (
    SELECT 
      moi.product_id,
      SUM(CASE WHEN TRIM(LOWER(m.order_status)) IN ('shipped', 'delivered', 'fail delivered', 'delivery failed', 'returning to seller') THEN moi.quantity ELSE 0 END) as sales,
      SUM(CASE WHEN TRIM(LOWER(m.order_status)) IN ('fail delivered', 'delivery failed', 'returning to seller') THEN moi.quantity ELSE 0 END) as returns
    FROM public.marketplace_order_items moi
    JOIN public.marketplace_orders m ON moi.order_id = m.id
    GROUP BY moi.product_id
  ),
  website_sales AS (
    SELECT 
      woi.product_id,
      -- website_shipped includes all except delivered, returned, cancelled
      SUM(CASE WHEN TRIM(LOWER(w.order_status)) NOT IN ('delivered', 'returned delivered', 'returned_delivered', 'shipped_back_success', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed', 'cancelled', 'canceled') THEN woi.quantity ELSE 0 END) as website_shipped,
      -- website_delivered
      SUM(CASE WHEN TRIM(LOWER(w.order_status)) = 'delivered' THEN woi.quantity ELSE 0 END) as website_delivered,
      -- ecommerce_sales (matches website_shipped + website_delivered)
      SUM(CASE WHEN TRIM(LOWER(w.order_status)) NOT IN ('returned delivered', 'returned_delivered', 'shipped_back_success', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed', 'cancelled', 'canceled') THEN woi.quantity ELSE 0 END) as ecommerce_sales
    FROM public.website_order_items woi
    JOIN public.website_orders w ON woi.order_id = w.id
    GROUP BY woi.product_id
  ),
  store_sales AS (
    SELECT product_id, SUM(qty) as sales 
    FROM public.store_sales_items 
    GROUP BY product_id
  ),
  -- Auto Adjustments for Combo Components
  combo_sales_data AS (
    -- Daraz Combo Sales
    SELECT doi.product_id as parent_id, doi.quantity, d.order_status as status, 'daraz' as platform
    FROM public.daraz_order_items doi
    JOIN public.daraz_orders d ON doi.order_id = d.id
    UNION ALL
    -- Marketplace Combo Sales
    SELECT moi.product_id as parent_id, moi.quantity, m.order_status as status, 'marketplace' as platform
    FROM public.marketplace_order_items moi
    JOIN public.marketplace_orders m ON moi.order_id = m.id
    UNION ALL
    -- Website Combo Sales
    SELECT woi.product_id as parent_id, woi.quantity, w.order_status as status, 'website' as platform
    FROM public.website_order_items woi
    JOIN public.website_orders w ON woi.order_id = w.id
    UNION ALL
    -- Store Sales
    SELECT ssi.product_id as parent_id, ssi.qty as quantity, 'Completed' as status, 'store' as platform
    FROM public.store_sales_items ssi
  ),
  auto_adjust AS (
    SELECT 
      pc.child_product_id as product_id,
      SUM(
        CASE 
          WHEN (platform = 'store') OR (TRIM(LOWER(status)) IN ('shipped', 'delivered', 'returning to seller', 'returning_to_seller')) THEN -(cs.quantity * pc.quantity)
          ELSE 0
        END
      ) as qty
    FROM combo_sales_data cs
    JOIN public.product_combos pc ON cs.parent_id = pc.parent_product_id
    GROUP BY pc.child_product_id
  )
SELECT 
  p.id,
  p.product_name,
  p.product_type,
  COALESCE(opening.qty, 0) + COALESCE(manual.qty, 0) as store_stock,
  COALESCE(auto_adjust.qty, 0) as auto_adjust,
  COALESCE(damage.qty, 0) as damage_stock,
  COALESCE(purchase.qty, 0) as purchase,
  COALESCE(daraz.sales, 0) + COALESCE(mkt.sales, 0) + COALESCE(store.sales, 0) as sales,
  COALESCE(daraz.returns, 0) + COALESCE(mkt.returns, 0) as sales_return,
  -- FINAL CALCULATION
  (COALESCE(opening.qty, 0) + COALESCE(manual.qty, 0)) + 
  COALESCE(auto_adjust.qty, 0) - 
  COALESCE(damage.qty, 0) + 
  COALESCE(purchase.qty, 0) - 
  (COALESCE(daraz.sales, 0) + COALESCE(mkt.sales, 0) + COALESCE(store.sales, 0)) + 
  (COALESCE(daraz.returns, 0) + COALESCE(mkt.returns, 0)) -
  (COALESCE(web.website_shipped, 0) + COALESCE(web.website_delivered, 0)) as total_stock,
  -- New columns must be added at the end of the view
  COALESCE(web.ecommerce_sales, 0) as ecommerce_sales
FROM public.products p
LEFT JOIN opening ON p.id = opening.product_id
LEFT JOIN manual ON p.id = manual.product_id
LEFT JOIN auto_adjust ON p.id = auto_adjust.product_id
LEFT JOIN damage ON p.id = damage.product_id
LEFT JOIN purchase ON p.id = purchase.product_id
LEFT JOIN daraz_sales daraz ON p.id = daraz.product_id
LEFT JOIN marketplace_sales mkt ON p.id = mkt.product_id
LEFT JOIN website_sales web ON p.id = web.product_id
LEFT JOIN store_sales store ON p.id = store.product_id
WHERE p.is_deleted = false;
