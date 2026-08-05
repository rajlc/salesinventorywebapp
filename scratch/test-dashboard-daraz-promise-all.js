const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testDarazCounts() {
  const now = new Date()
  const nepalTime = new Date(now.getTime() + (345 + now.getTimezoneOffset()) * 60000)
  const todayStr = nepalTime.toISOString().split('T')[0]
  const todayStartIso = `${todayStr}T00:00:00.000Z`

  const getCount = async (status, todayOnlyDateField = null) => {
    let query = supabase
      .from('daraz_orders_with_totals')
      .select('id', { count: 'exact', head: true })
      .or('deleted.is.null,deleted.eq.false')
      .or(`order_status.eq."${status}",statuses.cs.{${status}}`)

    if (todayOnlyDateField) {
      query = query.or(`${todayOnlyDateField}.gte.${todayStartIso},order_date.eq.${todayStr}`)
    }

    const { count, error } = await query
    if (error) {
      console.error(`Error for ${status}:`, error)
      return 0
    }
    return count || 0
  }

  const [pending, packed, readyToShip, shipped, returnedDelivered, customerReturnDelivered] = await Promise.all([
    getCount('Pending'),
    getCount('Packed'),
    getCount('Ready to Ship'),
    getCount('Shipped', 'shipped_at'),
    getCount('Returned Delivered', 'returned_delivered_at'),
    getCount('Customer Return Delivered', 'customer_return_delivered_at')
  ])

  const total = pending + packed + readyToShip + shipped + returnedDelivered + customerReturnDelivered

  console.log('--- TEST RESULTS ---')
  console.log('Pending:', pending)
  console.log('Packed:', packed)
  console.log('Ready to Ship:', readyToShip)
  console.log('Shipped (Today):', shipped)
  console.log('Returned Delivered (Today):', returnedDelivered)
  console.log('Customer Return Delivered (Today):', customerReturnDelivered)
  console.log('Total Orders Today/Active:', total)
}

testDarazCounts().catch(console.error)
