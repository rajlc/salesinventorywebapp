-- Migration: Add audit trail columns to daraz_orders table
-- Date: 2026-01-19
-- Description: Adds comprehensive audit trail tracking for all order status changes

-- Add audit columns for all status changes
ALTER TABLE daraz_orders

-- Delivered status (add name/email, timestamp already exists)
ADD COLUMN IF NOT EXISTS delivered_by_name TEXT,
ADD COLUMN IF NOT EXISTS delivered_by_email TEXT,

-- Shipped status (add name/email, timestamp already exists)
ADD COLUMN IF NOT EXISTS shipped_by_name TEXT,
ADD COLUMN IF NOT EXISTS shipped_by_email TEXT,

-- Delivery Failed status
ADD COLUMN IF NOT EXISTS delivery_failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_failed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS delivery_failed_by_name TEXT,
ADD COLUMN IF NOT EXISTS delivery_failed_by_email TEXT,

-- Failed Delivered status (alternative naming)
ADD COLUMN IF NOT EXISTS failed_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fail_delivered_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fail_delivered_by_name TEXT,
ADD COLUMN IF NOT EXISTS fail_delivered_by_email TEXT,

-- Returning to Seller status
ADD COLUMN IF NOT EXISTS returning_to_seller_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS returning_to_seller_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS returning_to_seller_by_name TEXT,
ADD COLUMN IF NOT EXISTS returning_to_seller_by_email TEXT,

-- Customer Return status
ADD COLUMN IF NOT EXISTS customer_return_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_return_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_return_by_name TEXT,
ADD COLUMN IF NOT EXISTS customer_return_by_email TEXT,

-- Customer Return Delivered status
ADD COLUMN IF NOT EXISTS customer_return_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_return_delivered_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_return_delivered_by_name TEXT,
ADD COLUMN IF NOT EXISTS customer_return_delivered_by_email TEXT,

-- Customer Returned status (legacy/alternative)
ADD COLUMN IF NOT EXISTS customer_returned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_returned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_returned_by_name TEXT,
ADD COLUMN IF NOT EXISTS customer_returned_by_email TEXT,

-- Cancelled status
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT;

-- Add comments for documentation
COMMENT ON COLUMN daraz_orders.delivery_failed_at IS 'Timestamp when order delivery failed';
COMMENT ON COLUMN daraz_orders.delivery_failed_by IS 'User ID who marked delivery as failed';
COMMENT ON COLUMN daraz_orders.delivery_failed_by_name IS 'Name of user who marked delivery as failed';
COMMENT ON COLUMN daraz_orders.delivery_failed_by_email IS 'Email of user who marked delivery as failed';

COMMENT ON COLUMN daraz_orders.returning_to_seller_at IS 'Timestamp when order started returning to seller';
COMMENT ON COLUMN daraz_orders.returning_to_seller_by IS 'User ID who marked order as returning to seller';
COMMENT ON COLUMN daraz_orders.returning_to_seller_by_name IS 'Name of user who marked order as returning to seller';
COMMENT ON COLUMN daraz_orders.returning_to_seller_by_email IS 'Email of user who marked order as returning to seller';

COMMENT ON COLUMN daraz_orders.customer_return_at IS 'Timestamp when customer initiated return';
COMMENT ON COLUMN daraz_orders.customer_return_by IS 'User ID who processed customer return';
COMMENT ON COLUMN daraz_orders.customer_return_by_name IS 'Name of user who processed customer return';
COMMENT ON COLUMN daraz_orders.customer_return_by_email IS 'Email of user who processed customer return';

COMMENT ON COLUMN daraz_orders.customer_return_delivered_at IS 'Timestamp when returned item was delivered back to seller';
COMMENT ON COLUMN daraz_orders.customer_return_delivered_by IS 'User ID who confirmed return delivery';
COMMENT ON COLUMN daraz_orders.customer_return_delivered_by_name IS 'Name of user who confirmed return delivery';
COMMENT ON COLUMN daraz_orders.customer_return_delivered_by_email IS 'Email of user who confirmed return delivery';

COMMENT ON COLUMN daraz_orders.cancelled_at IS 'Timestamp when order was cancelled';
COMMENT ON COLUMN daraz_orders.cancelled_by IS 'User ID who cancelled the order';
COMMENT ON COLUMN daraz_orders.cancelled_by_name IS 'Name of user who cancelled the order';
COMMENT ON COLUMN daraz_orders.cancelled_by_email IS 'Email of user who cancelled the order';
