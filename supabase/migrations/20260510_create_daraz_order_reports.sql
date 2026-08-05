-- Create daraz_order_reports table
CREATE TABLE IF NOT EXISTS daraz_order_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create daraz_order_report_items table
CREATE TABLE IF NOT EXISTS daraz_order_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES daraz_order_reports(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE daraz_order_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daraz_order_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select on daraz_order_reports"
    ON daraz_order_reports FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow authenticated insert on daraz_order_reports"
    ON daraz_order_reports FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated update on daraz_order_reports"
    ON daraz_order_reports FOR UPDATE
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow authenticated select on daraz_order_report_items"
    ON daraz_order_report_items FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow authenticated insert on daraz_order_report_items"
    ON daraz_order_report_items FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated delete on daraz_order_report_items"
    ON daraz_order_report_items FOR DELETE
    TO authenticated
    USING (TRUE);
