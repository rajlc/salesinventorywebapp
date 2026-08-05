// Date conversion utilities for AD/BS using nepali-date-converter library
import NepaliDate from 'nepali-date-converter'

export function adToBS(adDate: string): string {
    try {
        const date = new Date(adDate)
        const nepaliDate = new NepaliDate(date)
        const year = nepaliDate.getYear()
        const month = String(nepaliDate.getMonth() + 1).padStart(2, '0')
        const day = String(nepaliDate.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    } catch (error) {
        console.error('Error converting AD to BS:', error)
        return ''
    }
}

export function bsToAD(bsDate: string): string {
    try {
        const [year, month, day] = bsDate.split('-').map(Number)
        const nepaliDate = new NepaliDate(year, month - 1, day)
        const adDate = nepaliDate.toJsDate()
        const adYear = adDate.getFullYear()
        const adMonth = String(adDate.getMonth() + 1).padStart(2, '0')
        const adDay = String(adDate.getDate()).padStart(2, '0')
        return `${adYear}-${adMonth}-${adDay}`
    } catch (error) {
        console.error('Error converting BS to AD:', error)
        return ''
    }
}

// Format Nepali date for display (e.g., "2081-09-15" -> "२०८१ साल ०९ महिना १५ गते")
export function formatNepaliDate(bsDate: string): string {
    try {
        const [year, month, day] = bsDate.split('-')
        return `${year}-${month}-${day}`
    } catch (error) {
        return bsDate
    }
}

// Format currency for Nepali Rupees
export function formatNepaliCurrency(amount: number): string {
    return `Rs. ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
