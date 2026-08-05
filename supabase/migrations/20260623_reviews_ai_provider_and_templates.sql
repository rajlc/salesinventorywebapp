-- ============================================================
-- Migration: Add OpenAI support & Keyword-based templates
-- ============================================================

-- 1. Alter daraz_review_settings table
ALTER TABLE public.daraz_review_settings 
ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'gemini',
ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS positive_keywords TEXT[] NOT NULL DEFAULT ARRAY['good', 'ramro xa', 'man paryo', 'great', 'nice', 'excellent', 'love', 'perfect', 'satisfied', 'happy', 'best', 'sweet'],
ADD COLUMN IF NOT EXISTS positive_templates TEXT[] NOT NULL DEFAULT ARRAY['Thank you so much for the review! We are thrilled to serve you.'],
ADD COLUMN IF NOT EXISTS neutral_keywords TEXT[] NOT NULL DEFAULT ARRAY['okay', 'thik thikai', 'average', 'medium', 'fair'],
ADD COLUMN IF NOT EXISTS neutral_templates TEXT[] NOT NULL DEFAULT ARRAY['Thank you for your honest feedback. We will work to make it better.'],
ADD COLUMN IF NOT EXISTS negative_keywords TEXT[] NOT NULL DEFAULT ARRAY['bad', 'poor', 'damage', 'broke', 'fake', 'late', 'worst', 'defect', 'waste', 'cheat', 'delay', 'slow', 'wrong'],
ADD COLUMN IF NOT EXISTS negative_templates TEXT[] NOT NULL DEFAULT ARRAY['We are extremely sorry for the bad experience. We will investigate and improve this.'];

-- 2. Migrate existing data from star templates (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daraz_review_settings' AND column_name='star5_template') THEN
        UPDATE public.daraz_review_settings
        SET 
          positive_templates = ARRAY[star5_template, star4_template],
          neutral_templates = ARRAY[star3_template],
          negative_templates = ARRAY[star2_template, star1_template];
          
        -- Drop the old template columns
        ALTER TABLE public.daraz_review_settings
        DROP COLUMN IF EXISTS star1_template,
        DROP COLUMN IF EXISTS star2_template,
        DROP COLUMN IF EXISTS star3_template,
        DROP COLUMN IF EXISTS star4_template,
        DROP COLUMN IF EXISTS star5_template;
    END IF;
END $$;

-- 3. Alter daraz_chat_settings table
ALTER TABLE public.daraz_chat_settings
ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'gemini',
ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini';

-- 4. Alter daraz_reviews table
ALTER TABLE public.daraz_reviews
ADD COLUMN IF NOT EXISTS suggested_reply TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS suggested_reply_source TEXT DEFAULT NULL;
