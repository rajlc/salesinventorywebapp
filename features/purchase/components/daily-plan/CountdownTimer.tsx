'use client'

import { useState, useEffect } from 'react'

export function CountdownTimer({ targetDate }: { targetDate: string }) {
    const [timeLeft, setTimeLeft] = useState('')
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date()

            if (difference > 0) {
                const hours = Math.floor(difference / (1000 * 60 * 60))
                const minutes = Math.floor((difference / 1000 / 60) % 60)
                const seconds = Math.floor((difference / 1000) % 60)

                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
                setIsExpired(false)
            } else {
                setTimeLeft('Expired')
                setIsExpired(true)
            }
        }

        calculateTimeLeft()
        const timer = setInterval(calculateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [targetDate])

    return (
        <span className={`font-mono text-xs ${isExpired ? 'text-red-500 font-bold' : 'text-blue-600 dark:text-white'}`}>
            {timeLeft}
        </span>
    )
}
