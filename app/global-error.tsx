'use client'

import { useEffect } from 'react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[GlobalError]', error?.digest ?? '', error?.message ?? '')
    }, [error])

    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', background: '#09090b', color: '#f4f4f5' }}>
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ maxWidth: '400px', width: '100%' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Application Error</h1>
                        <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '1.5rem' }}>
                            A critical error occurred while loading the application.
                        </p>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
