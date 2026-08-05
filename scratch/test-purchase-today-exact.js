const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testExactPurchases() {
  const targetDate = '2026-08-02' // Testing on sample date from screenshot

  console.log('Target Date:', targetDate)

  const { data: rows, error } = await supabase
    .from('purchases')
    .select('id, purchase_date, purchase_type, payment_type, total_amount, quantity')
    .eq('purchase_date', targetDate)

  if (error) {
    console.error(error)
    return
  }

  let buyItemCount = 0
  let buyTotalAmount = 0
  let sellTotalAmount = 0

  let onlineAmount = 0
  let cashAmount = 0
  let dueAmount = 0
  let othersAmount = 0

  const list = rows || []
  list.forEach(r => {
    const pt = (r.purchase_type || '').trim().toLowerCase()
    const pay = (r.payment_type || '').trim().toLowerCase()
    const amt = Number(r.total_amount) || 0

    if (pt === 'buy') {
      buyItemCount += 1
      buyTotalAmount += amt

      if (pay === 'online') {
        onlineAmount += amt
      } else if (pay === 'cash') {
        cashAmount += amt
      } else if (pay === 'due') {
        dueAmount += amt
      } else {
        othersAmount += amt
      }
    } else if (pt === 'sell' || pt === 'sales') {
      sellTotalAmount += amt
    }
  })

  console.log('--- PURCHASES METRICS FOR 2026-08-02 ---')
  console.log('Purchases Today Items (Buy count):', buyItemCount)
  console.log('Purchase Amount (Buy cost):', buyTotalAmount)
  console.log('Sales Amount (Sell amount):', sellTotalAmount)
  console.log('Transaction Breakdown:')
  console.log('  Online:', onlineAmount)
  console.log('  Cash:', cashAmount)
  console.log('  Due:', dueAmount)
  console.log('  Others:', othersAmount)
}

testExactPurchases().catch(console.error)
