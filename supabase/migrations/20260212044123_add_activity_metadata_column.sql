
-- Add metadata column to user_activity_logs table
ALTER TABLE user_activity_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the new column
COMMENT ON COLUMN user_activity_logs.metadata IS 'Additional context for activities: customer_name, amount, product_name, etc.';

-- Create index for better query performance on metadata
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_metadata ON user_activity_logs USING gin(metadata);
;
