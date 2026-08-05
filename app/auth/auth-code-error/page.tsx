export default function AuthCodeError() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-8 border-t-4 border-t-red-500">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
                <p className="mb-4 text-gray-700 dark:text-gray-300">
                    There was a problem with the Google sign-in process. This usually happens due to a configuration mismatch.
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 mb-4">
                    <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Technical Details:</strong> OAuth callback received tokens in URL hash instead of authorization code.
                    </p>
                </div>
                <a
                    href="/request-access"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-center transition-colors"
                >
                    Try Again
                </a>
            </div>
        </div>
    )
}
