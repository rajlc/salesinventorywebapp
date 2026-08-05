-- Add 'Redirected' to allowed statuses
ALTER TABLE "public"."marketplace_orders" DROP CONSTRAINT IF EXISTS "marketplace_orders_order_status_check";

ALTER TABLE "public"."marketplace_orders" 
ADD CONSTRAINT "marketplace_orders_order_status_check" 
CHECK (order_status IN (
    'Pending', 
    'Shipped', 
    'Delivered', 
    'Fail Delivered', 
    'Cancel', 
    'Returning to Seller', 
    'Customer Return', 
    'Return Delivered',
    'Redirected'
));

-- Add redirect_related_order_id column
ALTER TABLE "public"."marketplace_orders"
ADD COLUMN IF NOT EXISTS "redirect_related_order_id" uuid REFERENCES "public"."marketplace_orders"("id");

-- Add index for performance
CREATE INDEX IF NOT EXISTS "idx_marketplace_orders_redirect_related_id" ON "public"."marketplace_orders"("redirect_related_order_id");
