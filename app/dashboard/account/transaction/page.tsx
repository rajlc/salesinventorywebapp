import { redirect } from 'next/navigation'

export default function TransactionIndexPage() {
    redirect('/dashboard/account/transaction/cash-flow')
}
