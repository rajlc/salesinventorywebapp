-- Drop all restrictive own-user policies
DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;

-- Re-create for SELECT (Admins see all, Users see own)
CREATE POLICY "reminders_select" ON reminders FOR SELECT 
USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Re-create for INSERT (Users can insert as themselves, Admins can insert as anyone)
CREATE POLICY "reminders_insert" ON reminders FOR INSERT 
WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Re-create for UPDATE (Users can update own, Admins can update any)
CREATE POLICY "reminders_update" ON reminders FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Re-create for DELETE (Users can delete own, Admins can delete any)
CREATE POLICY "reminders_delete" ON reminders FOR DELETE 
USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
;
