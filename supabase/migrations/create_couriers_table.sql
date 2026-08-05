-- Create couriers table
CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id TEXT UNIQUE NOT NULL,
    courier_name TEXT NOT NULL,
    additional_details TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on courier_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_couriers_courier_id ON couriers(courier_id);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_couriers_is_active ON couriers(is_active);

-- Enable Row Level Security
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read
CREATE POLICY "Allow authenticated users to read couriers"
    ON couriers
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert couriers"
    ON couriers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow authenticated users to update couriers"
    ON couriers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete couriers"
    ON couriers
    FOR DELETE
    TO authenticated
    USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_couriers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_couriers_updated_at
    BEFORE UPDATE ON couriers
    FOR EACH ROW
    EXECUTE FUNCTION update_couriers_updated_at();
