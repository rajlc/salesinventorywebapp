
-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('General', 'Important')),
    reminder TEXT NOT NULL,
    reminder_datetime TIMESTAMPTZ, -- Only for Important type
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Close')),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reminders_created_by ON reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date DESC);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own reminders
CREATE POLICY "Users can view own reminders"
    ON reminders FOR SELECT
    USING (
        auth.uid() = created_by
        OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- RLS Policy: Users can insert their own reminders
CREATE POLICY "Users can insert own reminders"
    ON reminders FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can update their own reminders
CREATE POLICY "Users can update own reminders"
    ON reminders FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can delete their own reminders
CREATE POLICY "Users can delete own reminders"
    ON reminders FOR DELETE
    USING (auth.uid() = created_by);

-- Add comment
COMMENT ON TABLE reminders IS 'Stores user reminders with type-based datetime fields and status tracking';
;
