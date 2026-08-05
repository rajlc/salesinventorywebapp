import { getDarazAvgPrices } from '../features/sales/actions/avg-price-actions'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run() {
    console.log('Running getDarazAvgPrices()...')
    const result = await getDarazAvgPrices(60)
    console.log('Total products returned:', result.length)

    const ems = result.find(r => r.product_name.includes('EMS Neck'))
    const personal = result.find(r => r.product_name.includes('Personal Weighing'))
    const bluetooth = result.find(r => r.product_name.includes('Bluetooth Weighing'))

    console.log('\nElectric EMS Neck details:')
    console.log(JSON.stringify(ems ? {
        product_name: ems.product_name,
        commission_percent: ems.commission_percent,
        is_default_commission: ems.is_default_commission
    } : null, null, 2))

    console.log('\nPersonal Weighing Scale details:')
    console.log(JSON.stringify(personal ? {
        product_name: personal.product_name,
        commission_percent: personal.commission_percent,
        is_default_commission: personal.is_default_commission
    } : null, null, 2))

    console.log('\nBluetooth Weighing Scale details:')
    console.log(JSON.stringify(bluetooth ? {
        product_name: bluetooth.product_name,
        commission_percent: bluetooth.commission_percent,
        is_default_commission: bluetooth.is_default_commission
    } : null, null, 2))
}

run()
