CREATE TABLE IF NOT EXISTS daraz_avg_prices (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    market_price NUMERIC DEFAULT 0,
    campaign_price NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE daraz_avg_prices ENABLE ROW LEVEL SECURITY;

-- Allow all access for authenticated users (Staff Panel)
CREATE POLICY "Enable all for authenticated users" 
ON daraz_avg_prices FOR ALL 
USING (auth.role() = 'authenticated');

-- Function and Trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_daraz_avg_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daraz_avg_prices_updated_at ON daraz_avg_prices;
CREATE TRIGGER trg_daraz_avg_prices_updated_at
BEFORE UPDATE ON daraz_avg_prices
FOR EACH ROW
EXECUTE FUNCTION update_daraz_avg_prices_updated_at();
