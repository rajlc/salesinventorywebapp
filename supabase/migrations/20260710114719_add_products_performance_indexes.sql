-- Index to optimize products sorting & filtering on the inventory list page
CREATE INDEX IF NOT EXISTS idx_products_status_sync_sort 
ON public.products(approval_status DESC, marketplace_sync_status DESC, website_sync_status DESC, product_name ASC) 
WHERE is_deleted = false;

-- Index to optimize live prices lookup by sku
CREATE INDEX IF NOT EXISTS idx_daraz_live_prices_seller_sku 
ON public.daraz_live_prices(seller_sku);
