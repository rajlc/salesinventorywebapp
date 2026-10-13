-- Update Daraz Chat message retention policy to 30 days
-- Previous policy: untagged 48 hours, tagged 15 days
-- New policy: untagged 30 days, tagged 60 days

CREATE OR REPLACE FUNCTION public.clean_daraz_chat_messages()
RETURNS VOID AS $$
BEGIN
    -- Delete untagged messages older than 30 days
    DELETE FROM public.daraz_chat_messages
    WHERE (tags IS NULL OR cardinality(tags) = 0)
      AND send_time < NOW() - INTERVAL '30 days';

    -- Delete tagged messages older than 60 days
    DELETE FROM public.daraz_chat_messages
    WHERE (tags IS NOT NULL AND cardinality(tags) > 0)
      AND send_time < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;
