-- Add 'Confirmed Order' to allowed statuses
ALTER TABLE "public"."marketplace_orders" DROP CONSTRAINT IF EXISTS "marketplace_orders_order_status_check";

ALTER TABLE "public"."marketplace_orders" 
ADD CONSTRAINT "marketplace_orders_order_status_check" 
CHECK (order_status IN (
    'Pending', 
    'Confirmed Order',
    'Shipped', 
    'Delivered', 
    'Fail Delivered', 
    'Cancel', 
    'Returning to Seller', 
    'Customer Return', 
    'Return Delivered',
    'Redirected'
));