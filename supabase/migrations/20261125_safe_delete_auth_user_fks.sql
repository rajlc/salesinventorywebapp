-- ============================================================================
-- Allow deleting disabled auth.users cleanly without FK constraint failures
-- Converts any public.* FK referencing auth.users(id) with NO ACTION/RESTRICT
-- to ON DELETE SET NULL (for nullable columns) or ON DELETE CASCADE (NOT NULL)
-- ============================================================================

DO $$
DECLARE
    fk RECORD;
    on_del TEXT;
BEGIN
    FOR fk IN
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            cols.is_nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
            ON rc.constraint_name = tc.constraint_name
            AND rc.constraint_schema = tc.table_schema
        JOIN information_schema.columns cols
            ON cols.table_schema = tc.table_schema
            AND cols.table_name = tc.table_name
            AND cols.column_name = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND ccu.table_schema = 'auth'
            AND ccu.table_name = 'users'
            AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
    LOOP
        on_del := CASE WHEN fk.is_nullable = 'YES' THEN 'SET NULL' ELSE 'CASCADE' END;
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
            fk.table_schema,
            fk.table_name,
            fk.constraint_name,
            fk.constraint_name,
            fk.column_name,
            on_del
        );
    END LOOP;
END $$;
