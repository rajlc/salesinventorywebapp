'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

interface Attribute {
    name: string
    label: string
    input_type: string
    is_mandatory: string | number
    options?: Array<{ name: string }>
    advanced?: {
        is_key_prop?: number
    }
}

interface DynamicAttributesFormProps {
    categoryId: number
    values: Record<string, string>
    onChange: (key: string, value: string) => void
    onLoadSaleProps: (saleProps: Attribute[]) => void
    onLoadAttributesSchema?: (schema: Attribute[]) => void
}

export default function DynamicAttributesForm({ categoryId, values, onChange, onLoadSaleProps, onLoadAttributesSchema }: DynamicAttributesFormProps) {
    const [attributes, setAttributes] = useState<Attribute[]>([])
    const [loading, setLoading] = useState(false)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        if (!categoryId) return

        const fetchAttributes = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/daraz/categories/attributes?category_id=${categoryId}`)
                const json = await res.json()
                if (json.success) {
                    const allAttrs: Attribute[] = json.data || []
                    setAttributes(allAttrs)
                    onLoadSaleProps(json.saleProps || [])
                    // Also expose the full schema for AI generation
                    if (onLoadAttributesSchema) {
                        onLoadAttributesSchema(allAttrs)
                    }
                }
            } catch (err) {
                console.error('Failed to load attributes:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchAttributes()
    }, [categoryId])

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw className="animate-spin text-orange-500" size={16} />
                Loading dynamic specifications for this category...
            </div>
        )
    }

    if (attributes.length === 0) {
        return (
            <p className="text-sm text-gray-400 italic">No specifications required for this category.</p>
        )
    }

    // Sort: mandatory and key properties first
    const sortedAttributes = [...attributes].sort((a, b) => {
        const aMandatory = a.is_mandatory === '1' || a.is_mandatory === 1 ? 1 : 0
        const bMandatory = b.is_mandatory === '1' || b.is_mandatory === 1 ? 1 : 0
        if (aMandatory !== bMandatory) return bMandatory - aMandatory

        const aKey = a.advanced?.is_key_prop === 1 ? 1 : 0
        const bKey = b.advanced?.is_key_prop === 1 ? 1 : 0
        return bKey - aKey
    })

    // Limit visible fields initially
    const visibleAttributes = showAll ? sortedAttributes : sortedAttributes.slice(0, 6)

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleAttributes.map((attr) => {
                    const isMandatory = attr.is_mandatory === '1' || attr.is_mandatory === 1
                    const isKey = attr.advanced?.is_key_prop === 1
                    const value = values[attr.name] || ''

                    return (
                        <div key={attr.name} className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-1.5">
                                {isMandatory && <span className="text-red-500">*</span>}
                                {attr.label || attr.name}
                                {isKey && (
                                    <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                                        KEY
                                    </span>
                                )}
                            </label>

                            {/* Dropdown Select Attributes */}
                            {attr.input_type === 'singleSelect' && attr.options ? (
                                <select
                                    value={value}
                                    onChange={(e) => onChange(attr.name, e.target.value)}
                                    className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                >
                                    <option value="">Please Select</option>
                                    {attr.options.map(opt => (
                                        <option key={opt.name} value={opt.name}>{opt.name}</option>
                                    ))}
                                </select>
                            ) : (
                                /* Free Text Input Attributes */
                                <input
                                    type="text"
                                    placeholder="Please Input or select option"
                                    value={value}
                                    onChange={(e) => onChange(attr.name, e.target.value)}
                                    className="w-full py-1.5 px-3 border rounded text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Toggle visibility */}
            {sortedAttributes.length > 6 && (
                <div className="text-center pt-2">
                    <button
                        type="button"
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs font-bold text-orange-600 hover:underline"
                    >
                        {showAll ? 'Show Less ∧' : `Show More (${sortedAttributes.length - 6} fields) ∨`}
                    </button>
                </div>
            )}
        </div>
    )
}
