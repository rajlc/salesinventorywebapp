CREATE TABLE IF NOT EXISTS public.daraz_live_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.daraz_api_tokens(store_id) ON DELETE CASCADE,
    store_name TEXT,
    seller_sku TEXT NOT NULL,
    price NUMERIC,
    special_price NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, seller_sku)
);
