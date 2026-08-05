const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testViewCounts() {
  const now = new Date()
  const nepalTime = new Date(now.getTime() + (345 + now.getTimezoneOffset()) * 60000)
  const todayStr = nepalTime.toISOString().split('T')[0]
  console.log('Today:', todayStr)

  const getStatusCount = async (status, dateField = null) => {
    let query = supabase
      .from('daraz_orders_with_totals')
      .select('id', { count: 'exact', head: true })
      .or('deleted.is.null,deleted.eq.false')
      .or(`order_status.eq."${status}",statuses.cs.{${status}}`)

    if (dateField) {
      query = query.gte(dateField, `${todayStr}T00:00:00.000Z`)
    }

    const { count, error } = await query
    if (error) console.error(`Error for ${status}:`, error)
    return count || 0
  }

  const pending = await getStatusCount('Pending')
  const packed = await getStatusCount('Packed')
  const readyToShip = await getStatusCount('Ready to Ship')
  const shipped = await getStatusCount('Shipped', 'shipped_at')
  const returnedDelivered = await getStatusCount('Returned Delivered', 'returned_delivered_at')
  const customerReturnDelivered = await getStatusCount('Customer Return Delivered', 'customer_return_delivered_at')

  console.log('--- VIEW COUNTS ---')
  console.log('Pending (ALL):', pending)
  console.log('Packed (ALL):', packed)
  console.log('Ready to Ship (ALL):', readyToShip)
  console.log('Shipped (Today):', shipped)
  console.log('Returned Delivered (Today):', returnedDelivered)
  console.log('Customer Return Delivered (Today):', customerReturnDelivered)

  // Also check without date filter for Shipped/Returned/Customer Return to see historical totals
  const shippedAll = await getStatusCount('Shipped')
  const returnedAll = await getStatusCount('Returned Delivered')
  const custReturnAll = await getStatusCount('Customer Return Delivered')
  console.log('\n--- HISTORICAL TOTALS (ALL DATES) ---')
  console.log('Shipped (All):', shippedAll)
  console.log('Returned Delivered (All):', returnedAll)
  console.log('Customer Return Delivered (All):', custReturnAll)
}

testViewCounts().catch(console.error)
