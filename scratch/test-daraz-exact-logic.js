const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testDarazExactLogic() {
  const now = new Date()
  const nepalTime = new Date(now.getTime() + (345 + now.getTimezoneOffset()) * 60000)
  const todayStr = nepalTime.toISOString().split('T')[0]
  console.log('Local Today Date:', todayStr)

  // Fetch all non-deleted daraz_orders
  const { data: orders, error } = await supabase
    .from('daraz_orders')
    .select('order_status, order_date, shipped_at, returned_delivered_at, customer_return_delivered_at, customer_returned_at, updated_at, created_at')
    .or('deleted.is.null,deleted.eq.false')

  if (error) {
    console.error('Error fetching daraz_orders:', error)
    return
  }

  let pending = 0
  let packed = 0
  let readyToShip = 0
  let shipped = 0
  let returnedDelivered = 0
  let customerReturnDelivered = 0

  orders.forEach(o => {
    const st = (o.order_status || '').trim().toLowerCase()
    
    // Check dates for today matching
    const isShippedToday = (o.shipped_at && o.shipped_at.startsWith(todayStr)) || (o.updated_at && o.updated_at.startsWith(todayStr)) || o.order_date === todayStr
    const isReturnedDeliveredToday = (o.returned_delivered_at && o.returned_delivered_at.startsWith(todayStr)) || (o.updated_at && o.updated_at.startsWith(todayStr)) || o.order_date === todayStr
    const isCustomerReturnDeliveredToday = (o.customer_return_delivered_at && o.customer_return_delivered_at.startsWith(todayStr)) || (o.customer_returned_at && o.customer_returned_at.startsWith(todayStr)) || (o.updated_at && o.updated_at.startsWith(todayStr)) || o.order_date === todayStr

    if (st === 'pending') {
      pending++
    } else if (st === 'packed') {
      packed++
    } else if (st === 'ready to ship' || st === 'ready_to_ship') {
      readyToShip++
    } else if (st === 'shipped' && isShippedToday) {
      shipped++
    } else if ((st === 'returned delivered' || st === 'returned_delivered') && isReturnedDeliveredToday) {
      returnedDelivered++
    } else if ((st === 'customer return delivered' || st === 'customer_return_delivered' || st.includes('customer return')) && isCustomerReturnDeliveredToday) {
      customerReturnDelivered++
    }
  })

  console.log('--- EXACT DARAZ COUNTS ---')
  console.log('Pending (ALL):', pending)
  console.log('Packed (ALL):', packed)
  console.log('Ready to Ship (ALL):', readyToShip)
  console.log('Shipped (Today):', shipped)
  console.log('Returned Delivered (Today):', returnedDelivered)
  console.log('Customer Return Delivered (Today):', customerReturnDelivered)
  console.log('Total Count:', pending + packed + readyToShip + shipped + returnedDelivered + customerReturnDelivered)
}

testDarazExactLogic().catch(console.error)
