import { useState, useEffect, useRef } from 'react'
import { Folder, Search, ChevronRight, Loader2 } from 'lucide-react'

interface Category {
    category_id: number
    name: string
    leaf: boolean
    children?: Category[]
}

interface CategoryPickerProps {
    productName: string
    selectedCategoryId: number | null
    selectedCategoryPath?: string | null
    onSelectCategory: (categoryId: number, path: string) => void
    autoSelectCategoryPath?: string | null
}

export default function CategoryPicker({ productName, selectedCategoryId, selectedCategoryPath, onSelectCategory, autoSelectCategoryPath }: CategoryPickerProps) {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Array<{ id: number; path: string }>>([])
    const [suggestions, setSuggestions] = useState<Array<{ id: number; path: string }>>([])
    const [fetchingSuggestions, setFetchingSuggestions] = useState(false)

    const [isBrowsing, setIsBrowsing] = useState(false)
    const [currentPath, setCurrentPath] = useState<Category[]>([])
    const lastAutoSelectedTitleRef = useRef<string>('')
    const initialCategoryMountedRef = useRef<boolean>(false)

    // Preserve existing category on mount when editing an existing product
    useEffect(() => {
        if (!initialCategoryMountedRef.current && selectedCategoryId) {
            initialCategoryMountedRef.current = true
            lastAutoSelectedTitleRef.current = productName ? productName.trim() : ''
        }
    }, [selectedCategoryId, productName])

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
    const findBestMatches = (searchPath: string, limit = 6): Array<{ id: number; path: string; score: number }> => {
        if (categories.length === 0) return []

        const segments = searchPath.toLowerCase().split('>').map(s => s.trim())
        const leafName = segments[segments.length - 1] || ''
        const leafTokens = leafName.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 2)

        const candidates: Array<{ id: number; path: string; score: number }> = []

        const traverse = (node: Category, parentPath: string = '') => {
            const currentPathName = parentPath ? `${parentPath} > ${node.name}` : node.name
            if (node.leaf) {
                const nodeLower = node.name.toLowerCase()
                const nodePathLower = currentPathName.toLowerCase()
                let score = 0

                if (nodeLower === leafName) {
                    score = 200
                } else if (leafName && (nodeLower.includes(leafName) || leafName.includes(nodeLower))) {
                    score = 100
                } else {
                    leafTokens.forEach(token => {
                        try {
                            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            const regex = new RegExp(`\\b${escaped}s?\\b`, 'i')
                            if (regex.test(nodeLower)) score += 20
                            else if (nodeLower.includes(token)) score += 8
                        } catch {
                            if (nodeLower.includes(token)) score += 8
                        }
                    })
                }

                segments.slice(0, -1).forEach((seg, idx) => {
                    const segTokens = seg.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 2)
                    segTokens.forEach(token => {
                        if (nodePathLower.includes(token)) {
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

    // Fetch fast category suggestions from Daraz category service
    useEffect(() => {
        const cleanName = productName ? productName.trim() : ''
        if (!cleanName || cleanName.length < 2 || cleanName.startsWith('[Image Only]')) {
            setSuggestions([])
            return
        }

        const fetchSuggestions = async () => {
            setFetchingSuggestions(true)
            try {
                const res = await fetch(`/api/daraz/categories/suggestion?productName=${encodeURIComponent(cleanName)}`)
                const json = await res.json()
                if (json.success && json.suggestions && json.suggestions.length > 0) {
                    const idToPath = new Map<number, string>()
                    const walk = (node: Category, parent = '') => {
                        const p = parent ? `${parent} > ${node.name}` : node.name
                        if (node.leaf) idToPath.set(Number(node.category_id), p)
                        else node.children?.forEach(c => walk(c, p))
                    }
                    categories.forEach(r => walk(r))

                    const darazSuggestions = json.suggestions.map((s: { id: number; path: string }) => ({
                        id: Number(s.id),
                        path: idToPath.get(Number(s.id)) || String(s.path).split('>').map(x => x.trim()).join(' > '),
                    }))
                    setSuggestions(darazSuggestions)

                    // Auto-select the top matching category if nothing is selected OR if product title changed
                    if (darazSuggestions.length > 0) {
                        const isNewTitle = lastAutoSelectedTitleRef.current !== cleanName
                        if (!selectedCategoryId || isNewTitle) {
                            lastAutoSelectedTitleRef.current = cleanName
                            onSelectCategory(darazSuggestions[0].id, darazSuggestions[0].path)
                        }
                    }
                } else if (categories.length > 0) {
                    // Fallback to client-side match
                    const enrichedSearch = enrichProductName(cleanName)
                    const candidates = findBestMatches(enrichedSearch, 4)
                    const mapped = candidates.map(c => ({ id: c.id, path: c.path }))
                    setSuggestions(mapped)
                    if (mapped.length > 0) {
                        const isNewTitle = lastAutoSelectedTitleRef.current !== cleanName
                        if (!selectedCategoryId || isNewTitle) {
                            lastAutoSelectedTitleRef.current = cleanName
                            onSelectCategory(mapped[0].id, mapped[0].path)
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch category suggestions:', err)
                if (categories.length > 0) {
                    const enrichedSearch = enrichProductName(cleanName)
                    const candidates = findBestMatches(enrichedSearch, 4)
                    const mapped = candidates.map(c => ({ id: c.id, path: c.path }))
                    setSuggestions(mapped)
                    if (mapped.length > 0 && !selectedCategoryId) {
                        onSelectCategory(mapped[0].id, mapped[0].path)
                    }
                }
            } finally {
                setFetchingSuggestions(false)
            }
        }

        // Fast debounce: 200ms
        const timer = setTimeout(fetchSuggestions, 200)
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
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    Category <span className="text-red-500 font-bold">*</span>
                </label>
                <button
                    type="button"
                    onClick={() => { setIsBrowsing(!isBrowsing); setCurrentPath([]) }}
                    className="text-xs text-orange-600 font-semibold hover:underline"
                >
                    {isBrowsing ? 'Cancel Browsing' : 'Browse Category Tree'}
                </button>
            </div>

            {/* Currently Selected Category Banner */}
            {selectedCategoryPath && (
                <div className="flex items-center justify-between p-3 bg-[#f8f9fa] dark:bg-zinc-850/50 border border-gray-200/90 dark:border-zinc-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Selected:</span>
                        <span className="font-medium text-gray-800 dark:text-zinc-200">{selectedCategoryPath}</span>
                    </div>
                    <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-900/40">
                        Saved ✓
                    </span>
                </div>
            )}

            {/* Category Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-[#f8f9fa] dark:bg-zinc-850/50 p-4 rounded-lg border border-gray-200/90 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 dark:text-zinc-300 font-bold flex items-center gap-1.5">
                            Category Suggestions
                            {fetchingSuggestions && <Loader2 className="animate-spin text-orange-500" size={12} />}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                            Daraz Categories
                        </span>
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
                                    className="mt-0.5 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className={`${selectedCategoryId === sug.id ? 'font-semibold text-orange-600 dark:text-orange-400' : 'font-normal'}`}>
                                    {sug.path}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Tree Browser */}
            {isBrowsing ? (
                <div className="border border-gray-200/90 dark:border-zinc-800 rounded-lg p-3.5 bg-[#f8f9fa] dark:bg-zinc-850/50 space-y-2">
                    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <button type="button" onClick={handleResetTree} className="hover:underline hover:text-orange-500 font-medium">Root</button>
                        {currentPath.map((node, i) => (
                            <span key={node.category_id} className="flex items-center gap-1">
                                <ChevronRight size={12} />
                                <button type="button" onClick={() => handleBackNode(i)} className="hover:underline hover:text-orange-500 font-medium">{node.name}</button>
                            </span>
                        ))}
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800 text-xs bg-white dark:bg-zinc-900 rounded-md border border-gray-200 dark:border-zinc-700">
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
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 flex justify-between items-center transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Folder size={14} className="text-gray-400" />
                                        {node.name}
                                    </span>
                                    {!node.leaf && <ChevronRight size={13} className="text-gray-400" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                        <Search size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search category path (e.g. Bracelet, Wireless Adapter...)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-9 pr-4 h-9 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 bg-white dark:bg-zinc-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                    />
                    {searchResults.length > 0 && searchQuery && (
                        <div className="absolute w-full z-50 mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800 text-xs">
                            {searchResults.map(res => (
                                <button
                                    key={res.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectCategory(res.id, res.path)
                                        setSearchQuery('')
                                        setSearchResults([])
                                    }}
                                    className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-gray-700 dark:text-zinc-300 transition-colors"
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
