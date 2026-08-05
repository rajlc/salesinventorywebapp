-- Drop the old constraint and add a new check constraint that allows 'Pending Confirmation'
ALTER TABLE purchase_plans DROP CONSTRAINT IF EXISTS purchase_plans_status_check;
ALTER TABLE purchase_plans ADD CONSTRAINT purchase_plans_status_check CHECK (status IN ('Pending', 'Complete', 'Cancel', 'Pending Confirmation'));
