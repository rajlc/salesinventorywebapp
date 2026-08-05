import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function Forbidden403() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-zinc-900 h-full min-h-[400px]">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Access Denied</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-[15px] mb-6">
                    You do not have permission to view this page. If you believe this is an error, please contact your administrator.
                </p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}
