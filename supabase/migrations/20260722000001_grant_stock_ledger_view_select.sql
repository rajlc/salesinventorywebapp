-- Grant SELECT permissions on stock_ledger_view to anonymous and authenticated users
-- to prevent permission errors during product stock synchronization in the mobile application

GRANT SELECT ON public.stock_ledger_view TO authenticated;
GRANT SELECT ON public.stock_ledger_view TO anon;
GRANT SELECT ON public.stock_ledger_view TO service_role;
