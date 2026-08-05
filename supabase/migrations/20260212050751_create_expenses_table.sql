
-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Vehicle Expenses', 'Office Expenses', 'Rent', 'Personal Expenses', 'Others')),
    expense_item TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    remarks TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edit_count INTEGER DEFAULT 0,
    last_edited_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own expenses
CREATE POLICY "Users can view own expenses"
    ON expenses FOR SELECT
    USING (
        auth.uid() = created_by
        OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- RLS Policy: Users can insert their own expenses
CREATE POLICY "Users can insert own expenses"
    ON expenses FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can update their own expenses (with restrictions handled in app logic)
CREATE POLICY "Users can update own expenses"
    ON expenses FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can delete their own expenses
CREATE POLICY "Users can delete own expenses"
    ON expenses FOR DELETE
    USING (auth.uid() = created_by);

-- Add comment
COMMENT ON TABLE expenses IS 'Stores user expenses with category-based validation and edit restrictions';
;
