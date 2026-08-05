"use client"

import { useState, useEffect } from "react"
import { MapPin, X, Trash2 } from "lucide-react"
import { updateUserLocation } from "../actions/staff-actions"

interface LocationMapPickerProps {
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

export function LocationMapPicker({ userId, currentLocation, onUpdate }: LocationMapPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [locationName, setLocationName] = useState(currentLocation?.location_name || '')
    const [latitude, setLatitude] = useState(currentLocation?.latitude || 27.7172)
    const [longitude, setLongitude] = useState(currentLocation?.longitude || 85.3240)
    const [radiusKm, setRadiusKm] = useState(currentLocation?.radius_km || 5)
    const [isSaving, setIsSaving] = useState(false)
    const [mapUrl, setMapUrl] = useState('')

    useEffect(() => {
        // Update map URL when coordinates change
        setMapUrl(`https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`)
    }, [latitude, longitude])

    const handleSave = async () => {
        try {
            setIsSaving(true)

            await updateUserLocation(userId, {
                location_type: 'specific',
                location_name: locationName || `Location ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                latitude: latitude,
                longitude: longitude,
                radius_km: radiusKm,
            })

            setIsOpen(false)
            onUpdate()
            alert('✅ Location saved successfully!')
        } catch (error) {
            console.error('Failed to save location:', error)
            alert('❌ Failed to save location')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSetAllLocations = async () => {
        try {
            setIsSaving(true)

            await updateUserLocation(userId, {
                location_type: 'all'
            })

            onUpdate()
            alert('✅ Location deleted! Staff now has access to All Locations.')
        } catch (error) {
            console.error('Failed to update location:', error)
            alert('❌ Failed to update location')
        } finally {
            setIsSaving(false)
        }
    }

    const openGoogleMaps = () => {
        // Open Google Maps in new tab so user can pick location and copy coordinates
        const url = `https://www.google.com/maps/@${latitude},${longitude},15z`
        window.open(url, '_blank')
    }

    return (
        <div className="space-y-4">
            {/* Current Location Display */}
            <div>
                <label className="text-sm text-gray-500">Location Type</label>
                <p className="font-medium">
                    <span className={`px-2 py-1 text-xs rounded border ${currentLocation?.location_type === 'all'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }`}>
                        {currentLocation?.location_type === 'all' ? 'All Locations' : 'Specific Location'}
                    </span>
                </p>
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
                    {/* Show on Google Maps */}
                    <div className="aspect-video w-full rounded-lg overflow-hidden border dark:border-zinc-700">
                        <iframe
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            src={`https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}&z=15&output=embed`}
                        ></iframe>
                    </div>
                </>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                    <MapPin size={16} />
                    {currentLocation?.location_type === 'specific' ? 'Edit Location' : 'Set Location'}
                </button>

                {currentLocation?.location_type === 'specific' && (
                    <button
                        onClick={handleSetAllLocations}
                        className="p-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md border border-red-200 transition-colors"
                        disabled={isSaving}
                        title="Delete location (reset to All Locations)"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>

            {/* Map Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 flex items-center justify-between p-4 border-b dark:border-zinc-800 z-10">
                            <h3 className="text-lg font-semibold">Pick Location</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* Instructions */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                    📍 How to pick a location:
                                </p>
                                <ol className="text-sm text-blue-800 dark:text-blue-300 list-decimal list-inside space-y-1">
                                    <li>Click "Open in Google Maps" button below</li>
                                    <li><strong>Right-click or long-press</strong> on your desired location</li>
                                    <li>Click the coordinates that appear (e.g., "27.7172, 85.3240")</li>
                                    <li>Paste them in the fields below</li>
                                    <li>Click "Save Location"</li>
                                </ol>
                            </div>

                            {/* Open in Google Maps Button */}
                            <button
                                onClick={openGoogleMaps}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                            >
                                🗺️ Open in Google Maps (New Tab)
                            </button>

                            {/* Current Map Preview */}
                            <div className="w-full h-64 bg-gray-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    allowFullScreen
                                    src={mapUrl}
                                ></iframe>
                            </div>

                            {/* Location Input Fields */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Location Name <span className="text-gray-400">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={locationName}
                                        onChange={(e) => setLocationName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                        placeholder="e.g. Main Office, Kathmandu"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Latitude <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={latitude}
                                            onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 font-mono"
                                            placeholder="27.7172"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Longitude <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={longitude}
                                            onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 font-mono"
                                            placeholder="85.3240"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Radius (km) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={radiusKm}
                                        onChange={(e) => setRadiusKm(parseFloat(e.target.value) || 1)}
                                        className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                        placeholder="5"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Staff can access from within this radius</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 flex items-center justify-end gap-3 p-4 border-t dark:border-zinc-800">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : '💾 Save Location'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
