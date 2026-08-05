"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui-shim'
import { supabase } from '@/lib/supabase/client'
import { Loader2, MapPinOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Helper to calculate distance (Haversine Formula)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

interface LocationGuardProps {
    children: React.ReactNode
}

export function LocationGuard({ children }: LocationGuardProps) {
    const [loading, setLoading] = useState(true)
    const [denied, setDenied] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Hardcoded for Phase 1 - In real app, fetch from `profile.assigned_store`
    // We can simulate fetching user profile here
    useEffect(() => {
        async function checkLocation() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return // Middleware handles this

                // TODO: Fetch profile's assigned store location
                // const { data: profile } = await supabase.from('profiles').select('...').eq('id', user.id).single()

                // Mock Config: Admin didn't set location yet? Allow all.
                const mockStoreLat = 27.7172 // Kathmandu
                const mockStoreLng = 85.3240
                const mockRadiusKm = 1.0
                const isLocationRestricted = false // Set to TRUE to test blocking

                if (!isLocationRestricted) {
                    setLoading(false)
                    return
                }

                if (!navigator.geolocation) {
                    setDenied(true)
                    setErrorMsg("Geolocation is not supported by your browser.")
                    return
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const dist = getDistanceFromLatLonInKm(
                            mockStoreLat, mockStoreLng,
                            position.coords.latitude, position.coords.longitude
                        )

                        if (dist > mockRadiusKm) {
                            setDenied(true)
                            setErrorMsg(`You are ${dist.toFixed(2)}km away from your assigned location. Max allowed: ${mockRadiusKm}km.`)
                        } else {
                            setDenied(false)
                        }
                        setLoading(false)
                    },
                    (err) => {
                        console.error(err)
                        setDenied(true)
                        setErrorMsg("We could not verify your location. Please enable GPS permissions.")
                        setLoading(false)
                    }
                )

            } catch (err) {
                console.error(err)
                setLoading(false)
            }
        }

        checkLocation()
    }, [])

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
                    <p className="text-sm text-gray-500">Verifying Location...</p>
                </div>
            </div>
        )
    }

    if (denied) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-red-50 p-4">
                <Card className="w-[400px] border-red-500 shadow-xl">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <MapPinOff className="h-12 w-12 text-red-500" />
                        </div>
                        <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-gray-700 font-medium">Out of Location Bounds</p>
                        <p className="text-sm text-gray-500">{errorMsg}</p>
                        <Button onClick={() => window.location.reload()}>Retry Location</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <>{children}</>
}
