-- Add Audit Trail Columns to marketplace_orders
-- Run this in your Supabase SQL Editor

ALTER TABLE marketplace_orders
ADD COLUMN IF NOT EXISTS returned_to_seller_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS returned_to_seller_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS customer_return_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_return_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS return_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_delivered_by UUID REFERENCES user_profiles(id);

-- Explicitly Creating Constraints to match the hints used in the code
-- Note: Postgres usually names them auto-generatedly, but we can verify or rename.
-- The error "Searched for a foreign key relationship ... using the hint 'marketplace_orders_returned_to_seller_by_fkey'"
-- implies we should name them exactly that.

ALTER TABLE marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_returned_to_seller_by_fkey;
ALTER TABLE marketplace_orders
ADD CONSTRAINT marketplace_orders_returned_to_seller_by_fkey
FOREIGN KEY (returned_to_seller_by) REFERENCES user_profiles(id);

ALTER TABLE marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_customer_return_by_fkey;
ALTER TABLE marketplace_orders
ADD CONSTRAINT marketplace_orders_customer_return_by_fkey
FOREIGN KEY (customer_return_by) REFERENCES user_profiles(id);

ALTER TABLE marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_return_delivered_by_fkey;
ALTER TABLE marketplace_orders
ADD CONSTRAINT marketplace_orders_return_delivered_by_fkey
FOREIGN KEY (return_delivered_by) REFERENCES user_profiles(id);

-- Also ensuring fail_delivered exists and has correct FK name if needed (optional but good for consistency)
-- If failed_delivered_by already exists, we leave it. If not, this adds it.
ALTER TABLE marketplace_orders
ADD COLUMN IF NOT EXISTS failed_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_delivered_by UUID REFERENCES user_profiles(id);

-- If constraint doesn't exist with that name:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_orders_failed_delivered_by_fkey') THEN
        ALTER TABLE marketplace_orders
        ADD CONSTRAINT marketplace_orders_failed_delivered_by_fkey
        FOREIGN KEY (failed_delivered_by) REFERENCES user_profiles(id);
    END IF;
END $$;
