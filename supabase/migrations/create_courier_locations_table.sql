-- Create courier_locations table
CREATE TABLE IF NOT EXISTS courier_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    delivery_charge NUMERIC(10, 2) NOT NULL,
    cover_area TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on courier_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_courier_locations_courier_id ON courier_locations(courier_id);

-- Create index on branch_name for searching
CREATE INDEX IF NOT EXISTS idx_courier_locations_branch_name ON courier_locations(branch_name);

-- Enable Row Level Security
ALTER TABLE courier_locations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read
CREATE POLICY "Allow authenticated users to read courier_locations"
    ON courier_locations
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert courier_locations"
    ON courier_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow authenticated users to update courier_locations"
    ON courier_locations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete courier_locations"
    ON courier_locations
    FOR DELETE
    TO authenticated
    USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_courier_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_courier_locations_updated_at
    BEFORE UPDATE ON courier_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_courier_locations_updated_at();
