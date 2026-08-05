"use client"

import { useState } from "react"
import { MapPin, Edit2, Check, X } from "lucide-react"
import { updateUserLocation } from "../actions/staff-actions"

interface LocationEditorProps {
    userId: string
    currentLocation: {
        location_type: 'all' | 'specific'
        location_name?: string | null
        latitude?: number | null
        longitude?: number | null
        radius_km?: number | null
    } | null
    onUpdate: () => void
}

export function LocationEditor({ userId, currentLocation, onUpdate }: LocationEditorProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [locationType, setLocationType] = useState<'all' | 'specific'>(
        currentLocation?.location_type || 'all'
    )
    const [locationName, setLocationName] = useState(currentLocation?.location_name || '')
    const [latitude, setLatitude] = useState(currentLocation?.latitude?.toString() || '')
    const [longitude, setLongitude] = useState(currentLocation?.longitude?.toString() || '')
    const [radiusKm, setRadiusKm] = useState(currentLocation?.radius_km?.toString() || '')
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        try {
            setIsSaving(true)

            await updateUserLocation(userId, {
                location_type: locationType,
                location_name: locationType === 'specific' ? locationName : undefined,
                latitude: locationType === 'specific' && latitude ? parseFloat(latitude) : undefined,
                longitude: locationType === 'specific' && longitude ? parseFloat(longitude) : undefined,
                radius_km: locationType === 'specific' && radiusKm ? parseFloat(radiusKm) : undefined,
            })

            setIsEditing(false)
            onUpdate()
        } catch (error) {
            console.error('Failed to update location:', error)
            alert('Failed to update location settings')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        // Reset to current values
        setLocationType(currentLocation?.location_type || 'all')
        setLocationName(currentLocation?.location_name || '')
        setLatitude(currentLocation?.latitude?.toString() || '')
        setLongitude(currentLocation?.longitude?.toString() || '')
        setRadiusKm(currentLocation?.radius_km?.toString() || '')
        setIsEditing(false)
    }

    if (!isEditing) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-sm text-gray-500">Location Type</label>
                        <p className="font-medium capitalize">
                            <span className={`px-2 py-1 text-xs rounded border ${currentLocation?.location_type === 'all'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                }`}>
                                {currentLocation?.location_type === 'all' ? 'All Locations' : 'Specific Location'}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                    >
                        <Edit2 size={16} />
                    </button>
                </div>

                {currentLocation?.location_type === 'specific' && (
                    <>
                        <div>
                            <label className="text-sm text-gray-500">Location Name</label>
                            <p className="font-medium">{currentLocation.location_name || '-'}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Latitude</label>
                                <p className="font-medium">{currentLocation.latitude || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Longitude</label>
                                <p className="font-medium">{currentLocation.longitude || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Radius (km)</label>
                                <p className="font-medium">{currentLocation.radius_km || '-'}</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-gray-50 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Edit Location Settings</h4>
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                        disabled={isSaving}
                    >
                        <X size={16} />
                    </button>
                    <button
                        onClick={handleSave}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-md"
                        disabled={isSaving}
                    >
                        <Check size={16} />
                    </button>
                </div>
            </div>

            <div>
                <label className="text-sm font-medium mb-2 block">Location Type</label>
                <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as 'all' | 'specific')}
                    className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                    disabled={isSaving}
                >
                    <option value="all">All Locations</option>
                    <option value="specific">Specific Location</option>
                </select>
            </div>

            {locationType === 'specific' && (
                <>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Location Name</label>
                        <input
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                            placeholder="e.g. Main Office"
                            disabled={isSaving}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Latitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="27.7172"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Longitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="85.3240"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Radius (km)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={radiusKm}
                                onChange={(e) => setRadiusKm(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                placeholder="5"
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    <p className="text-xs text-gray-500">
                        💡 Tip: You can get coordinates by right-clicking on Google Maps and selecting the coordinates.
                    </p>
                </>
            )}
        </div>
    )
}
