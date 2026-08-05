
import { Client } from 'pg'

const ports = [5432, 54322, 6543, 5433]
const sql = `
DROP VIEW IF EXISTS daraz_order_report_view;

CREATE OR REPLACE VIEW daraz_order_report_view AS
SELECT 
    o.id as order_primary_id,
    o.order_number,
    o.invoice_number,
    o.order_status,
    o.delivered_at,
    o.created_at,
    
    (SELECT seller_account FROM daraz_order_items 
     WHERE order_id = o.id 
     LIMIT 1) as seller_account,

    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_name', doi.product_name,
                'quantity', doi.quantity,
                'purchase_cost', (
                    CASE 
                        WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                        ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                    END
                )
            )
        )
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        WHERE doi.order_id = o.id
    ) as items_summary,

    (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_revenue,
    
    (
        SELECT SUM(
            doi.quantity * 
            CASE 
                WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
            END
        )
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        WHERE doi.order_id = o.id
    ) as total_purchase_cost,

    (
        (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) - 
        
        (
            SELECT SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            )
            FROM daraz_order_items doi
            LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
            WHERE doi.order_id = o.id
        ) - 

        COALESCE(o.daraz_fees, 0) -
        
        -- Item Level Deductions (Shipping & Vouchers)
        -- Columns don't exist in DB, using Frontend Estimation Logic
        -- 4.52% Shipping (4% + 13% VAT) + 3.00% Voucher = 7.52% of Revenue
        (
            (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) * 0.0752
        ) -

        -- Fixed Extra Charge per order
        30 
    ) as estimated_profit
    
FROM daraz_orders o
WHERE o.order_status = 'Delivered';

GRANT SELECT ON daraz_order_report_view TO authenticated;
`

async function run() {
    for (const port of ports) {
        const connectionString = `postgres://postgres:postgres@localhost:${port}/postgres`
        console.log(`Trying port ${port}...`)
        const client = new Client({ connectionString })
        try {
            await client.connect()
            console.log(`Connected to port ${port}! Running SQL...`)
            await client.query(sql)
            console.log('Success! View Updated.')
            await client.end()
            return
        } catch (err: any) {
            console.log(`Failed port ${port}: ${err.message}`)
            await client.end().catch(() => { })
        }
    }
    console.error('All ports failed.')
    process.exit(1)
}

run()
