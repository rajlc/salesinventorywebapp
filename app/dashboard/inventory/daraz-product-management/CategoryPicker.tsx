'use client'

import { useState, useEffect } from 'react'
import { Folder, Search, ChevronRight, Sparkles, Loader2 } from 'lucide-react'

interface Category {
    category_id: number
    name: string
    leaf: boolean
    children?: Category[]
}

interface CategoryPickerProps {
    productName: string
    selectedCategoryId: number | null
    onSelectCategory: (categoryId: number, path: string) => void
    // When set, the AI-suggested path — used to BOTH show top suggestion AND auto-select
    autoSelectCategoryPath?: string | null
}

export default function CategoryPicker({ productName, selectedCategoryId, onSelectCategory, autoSelectCategoryPath }: CategoryPickerProps) {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Array<{ id: number; path: string }>>([])
    const [suggestions, setSuggestions] = useState<Array<{ id: number; path: string; isAiSuggested?: boolean }>>([])
    const [fetchingSuggestions, setFetchingSuggestions] = useState(false)

    const [isBrowsing, setIsBrowsing] = useState(false)
    const [currentPath, setCurrentPath] = useState<Category[]>([])

    // Load category tree (cached in sessionStorage)
    useEffect(() => {
        const loadCategories = async () => {
            const cached = sessionStorage.getItem('daraz_categories_tree')
            if (cached) {
                setCategories(JSON.parse(cached))
                return
            }
            setLoading(true)
            try {
                const res = await fetch('/api/daraz/categories')
                const json = await res.json()
                if (json.success && json.data) {
                    setCategories(json.data)
                    sessionStorage.setItem('daraz_categories_tree', JSON.stringify(json.data))
                }
            } catch (err) {
                console.error('Failed to load categories tree:', err)
            } finally {
                setLoading(false)
            }
        }
        loadCategories()
    }, [])

    // Core tree-traversal scoring function
    // Returns best matching candidates from the category tree
    const findBestMatches = (searchPath: string, limit = 6): Array<{ id: number; path: string; score: number }> => {
        if (categories.length === 0) return []

        const segments = searchPath.toLowerCase().split('>').map(s => s.trim())
        const leafName = segments[segments.length - 1]
        const leafTokens = leafName.split(/\s+/).filter(t => t.length > 2)

        const candidates: Array<{ id: number; path: string; score: number }> = []

        const traverse = (node: Category, parentPath: string = '') => {
            const currentPathName = parentPath ? `${parentPath} > ${node.name}` : node.name
            if (node.leaf) {
                const nodeLower = node.name.toLowerCase()
                const nodePathLower = currentPathName.toLowerCase()
                let score = 0

                // Exact leaf name match = highest score
                if (nodeLower === leafName) {
                    score = 200
                }
                // Leaf name contains or is contained in the target leaf
                else if (nodeLower.includes(leafName) || leafName.includes(nodeLower)) {
                    score = 100
                }
                else {
                    // Token-level matching on the leaf node name
                    leafTokens.forEach(token => {
                        const regex = new RegExp(`\\b${token}s?\\b`, 'i')
                        if (regex.test(nodeLower)) score += 20
                        else if (nodeLower.includes(token)) score += 8
                    })
                }

                // Bonus: parent path segment matching (improves disambiguation)
                segments.slice(0, -1).forEach((seg, idx) => {
                    const segTokens = seg.split(/\s+/).filter(t => t.length > 2)
                    segTokens.forEach(token => {
                        if (nodePathLower.includes(token)) {
                            // Higher weight for closer parent segments
                            score += (idx === segments.length - 2) ? 15 : 5
                        }
                    })
                })

                if (score > 0) {
                    candidates.push({ id: node.category_id, path: currentPathName, score })
                }
            } else if (node.children) {
                node.children.forEach(child => traverse(child, currentPathName))
            }
        }

        categories.forEach(root => traverse(root))
        return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
    }

    // Fetch category suggestions from Daraz open platform API
    useEffect(() => {
        if (!productName || productName.trim().length < 3 || categories.length === 0) {
            setSuggestions([])
            return
        }

        const fetchSuggestions = async () => {
            setFetchingSuggestions(true)
            try {
                const res = await fetch(`/api/daraz/categories/suggestion?productName=${encodeURIComponent(productName)}`)
                const json = await res.json()
                if (json.success && json.paths && json.paths.length > 0) {
                    const matchedSuggestions: Array<{ id: number; path: string; isAiSuggested: boolean }> = []
                    const matchedIds = new Set<number>()

                    json.paths.forEach((p: string) => {
                        const matches = findBestMatches(p, 3)
                        matches.forEach(m => {
                            if (!matchedIds.has(m.id)) {
                                matchedIds.add(m.id)
                                matchedSuggestions.push({
                                    id: m.id,
                                    path: m.path,
                                    isAiSuggested: true
                                })
                            }
                        })
                    })

                    setSuggestions(matchedSuggestions)

                    // Auto-select the top matching category if nothing is selected
                    if (!selectedCategoryId && matchedSuggestions.length > 0) {
                        onSelectCategory(matchedSuggestions[0].id, matchedSuggestions[0].path)
                    }
                } else {
                    // Fallback to client-side match
                    const enrichedSearch = enrichProductName(productName)
                    const candidates = findBestMatches(enrichedSearch, 6)
                    const mapped = candidates.map(c => ({ id: c.id, path: c.path, isAiSuggested: false }))
                    setSuggestions(mapped)
                    if (!selectedCategoryId && mapped.length > 0) {
                        onSelectCategory(mapped[0].id, mapped[0].path)
                    }
                }
            } catch (err) {
                console.error('Failed to fetch category suggestions from Daraz API:', err)
                // Fallback to client-side match
                const enrichedSearch = enrichProductName(productName)
                const candidates = findBestMatches(enrichedSearch, 6)
                const mapped = candidates.map(c => ({ id: c.id, path: c.path, isAiSuggested: false }))
                setSuggestions(mapped)
                if (!selectedCategoryId && mapped.length > 0) {
                    onSelectCategory(mapped[0].id, mapped[0].path)
                }
            } finally {
                setFetchingSuggestions(false)
            }
        }

        // Debounce calls slightly to prevent excessive API requests while typing
        const timer = setTimeout(fetchSuggestions, 500)
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productName, categories])

    // Enrich a raw product name with category context clues for better matching
    const enrichProductName = (name: string): string => {
        const lower = name.toLowerCase()
        // Add explicit category path hints based on known product types
        if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('wireless') || lower.includes('adapter') || lower.includes('dongle')) {
            return 'Computers Laptops > Network Components > Wireless USB Adapters'
        }
        if (lower.includes('bracelet') || lower.includes('bangle')) {
            return 'Jewellery > Bracelets'
        }
        if (lower.includes('watch')) {
            return 'Watches > Fashion Watches'
        }
        if (lower.includes('lamp') || lower.includes('light') || lower.includes('led')) {
            return 'Home Lighting > LED Lamps'
        }
        if (lower.includes('charger') || lower.includes('power bank') || lower.includes('powerbank')) {
            return 'Mobile Accessories > Chargers & Power Banks'
        }
        if (lower.includes('earphone') || lower.includes('earbuds') || lower.includes('headphone')) {
            return 'Audio > Headphones & Earphones'
        }
        if (lower.includes('bluetooth') && lower.includes('speaker')) {
            return 'Audio > Bluetooth Speakers'
        }
        if (lower.includes('keyboard') || lower.includes('mouse')) {
            return 'Computers Laptops > Computer Accessories > Keyboard Mouse'
        }
        if (lower.includes('scale') || lower.includes('weighing')) {
            return 'Health > Weighing Scales > Bathroom Scales'
        }
        if (lower.includes('hair') && (lower.includes('dryer') || lower.includes('straightener') || lower.includes('curler'))) {
            return 'Beauty Personal Care > Hair Care > Hair Styling Tools'
        }
        if (lower.includes('bag') || lower.includes('backpack') || lower.includes('wallet')) {
            return 'Bags Wallets Luggage'
        }
        if (lower.includes('phone case') || lower.includes('cover') || lower.includes('screen protector')) {
            return 'Mobile Accessories > Cases & Covers'
        }
        // Fallback: return original name for generic token matching
        return name
    }

    // Fuzzy search when typing in search box
    const handleSearch = (query: string) => {
        setSearchQuery(query)
        if (!query || categories.length === 0) {
            setSearchResults([])
            return
        }
        const lowerQuery = query.toLowerCase()
        const matches: Array<{ id: number; path: string }> = []
        const traverse = (node: Category, parentPath: string = '') => {
            const currentPathName = parentPath ? `${parentPath} > ${node.name}` : node.name
            if (node.leaf) {
                if (node.name.toLowerCase().includes(lowerQuery) || currentPathName.toLowerCase().includes(lowerQuery)) {
                    matches.push({ id: node.category_id, path: currentPathName })
                }
            } else if (node.children) {
                node.children.forEach(child => traverse(child, currentPathName))
            }
        }
        categories.forEach(root => traverse(root))
        setSearchResults(matches.slice(0, 15))
    }

    const handleNodeClick = (node: Category) => {
        if (node.leaf) {
            const pathStr = [...currentPath, node].map(n => n.name).join(' > ')
            onSelectCategory(node.category_id, pathStr)
            setIsBrowsing(false)
        } else {
            setCurrentPath([...currentPath, node])
        }
    }

    const handleBackNode = (index: number) => setCurrentPath(currentPath.slice(0, index + 1))
    const handleResetTree = () => setCurrentPath([])
    const activeList = currentPath.length > 0 ? currentPath[currentPath.length - 1].children || [] : categories

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300">
                    Category <span className="text-red-500">*</span>
                </label>
                <button
                    type="button"
                    onClick={() => { setIsBrowsing(!isBrowsing); setCurrentPath([]) }}
                    className="text-xs text-orange-600 font-semibold hover:underline"
                >
                    {isBrowsing ? 'Cancel Browsing' : 'Browse Category Tree'}
                </button>
            </div>

            {/* Category Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-lg border dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-orange-700 dark:text-orange-400 font-bold flex items-center gap-1.5">
                            Category Suggestions
                            {fetchingSuggestions && <Loader2 className="animate-spin text-orange-500" size={10} />}
                        </span>
                        {suggestions.some(s => s.isAiSuggested) && (
                            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                                <Sparkles size={9} /> AI Suggested
                            </span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {suggestions.map(sug => (
                            <label
                                key={sug.id}
                                className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer hover:text-orange-600 transition-colors"
                            >
                                <input
                                    type="radio"
                                    name="category_suggestion"
                                    checked={selectedCategoryId === sug.id}
                                    onChange={() => onSelectCategory(sug.id, sug.path)}
                                    className="mt-0.5 text-orange-600 border-gray-300 focus:ring-orange-500"
                                />
                                <span className={`${selectedCategoryId === sug.id ? 'font-bold text-orange-600' : ''} ${sug.isAiSuggested ? 'font-medium' : ''}`}>
                                    {sug.path}
                                    {sug.isAiSuggested && selectedCategoryId === sug.id && (
                                        <span className="ml-1 text-[9px] bg-orange-100 text-orange-500 px-1 py-0.5 rounded">AI Pick</span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Tree Browser */}
            {isBrowsing ? (
                <div className="border dark:border-zinc-800 rounded-lg p-3 bg-gray-50 dark:bg-zinc-800/40 space-y-2">
                    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <button type="button" onClick={handleResetTree} className="hover:underline hover:text-orange-500">Root</button>
                        {currentPath.map((node, i) => (
                            <span key={node.category_id} className="flex items-center gap-1">
                                <ChevronRight size={12} />
                                <button type="button" onClick={() => handleBackNode(i)} className="hover:underline hover:text-orange-500">{node.name}</button>
                            </span>
                        ))}
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y dark:divide-zinc-800 text-sm">
                        {loading ? (
                            <div className="p-4 text-center text-gray-400">Loading categories...</div>
                        ) : activeList.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">No child categories.</div>
                        ) : (
                            activeList.map(node => (
                                <button
                                    key={node.category_id}
                                    type="button"
                                    onClick={() => handleNodeClick(node)}
                                    className="w-full text-left p-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 flex justify-between items-center rounded"
                                >
                                    <span className="flex items-center gap-2">
                                        <Folder size={16} className="text-gray-400" />
                                        {node.name}
                                    </span>
                                    {!node.leaf && <ChevronRight size={14} className="text-gray-400" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        <Search size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search category path (e.g. Bracelet, Wireless Adapter...)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-md text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    {searchResults.length > 0 && searchQuery && (
                        <div className="absolute w-full z-50 mt-1 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md shadow-lg max-h-52 overflow-y-auto divide-y dark:divide-zinc-800 text-xs">
                            {searchResults.map(res => (
                                <button
                                    key={res.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectCategory(res.id, res.path)
                                        setSearchQuery('')
                                        setSearchResults([])
                                    }}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300"
                                >
                                    {res.path}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
