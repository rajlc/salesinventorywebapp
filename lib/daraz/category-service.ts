import axios from 'axios'
import { getValidAccessToken, buildSignedParams, API_URL } from './client'
import { createAdminClient } from '@/lib/supabase/server'

export interface DarazCategoryLeaf {
    id: number
    name: string
    path: string
}

let cachedLeaves: DarazCategoryLeaf[] | null = null
let cacheExpiry = 0
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours

/**
 * Fetch and flatten the full Daraz Category Tree for Nepal into leaf nodes.
 */
export async function getDarazLeafCategories(): Promise<DarazCategoryLeaf[]> {
    const now = Date.now()
    if (cachedLeaves && now < cacheExpiry) {
        return cachedLeaves
    }

    try {
        const supabase = await createAdminClient()
        const { data: stores } = await supabase
            .from('online_stores')
            .select('id')
            .eq('is_active', true)
            .limit(1)

        if (!stores || stores.length === 0) {
            return cachedLeaves || []
        }

        const accessToken = await getValidAccessToken(stores[0].id, 'order')
        const params = buildSignedParams('/category/tree/get', accessToken)

        const response = await axios.get(`${API_URL}/category/tree/get`, {
            params,
            timeout: 20000
        })

        if (response.data?.code === '0' || response.data?.code === 0) {
            const rawTree = response.data?.data || []
            const leaves: DarazCategoryLeaf[] = []

            function traverse(nodes: any[], parentPath = '') {
                for (const node of nodes) {
                    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name
                    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
                        traverse(node.children, currentPath)
                    } else if (node.leaf) {
                        leaves.push({
                            id: Number(node.category_id),
                            name: node.name,
                            path: currentPath
                        })
                    }
                }
            }

            traverse(rawTree)
            if (leaves.length > 0) {
                cachedLeaves = leaves
                cacheExpiry = now + CACHE_DURATION_MS
                return leaves
            }
        }
    } catch (err: any) {
        console.warn('[CategoryService] Failed to load category tree from Daraz API:', err.message)
    }

    return cachedLeaves || []
}

function normalizeStem(word: string): string {
    if (!word) return ''
    let w = word.toLowerCase().trim()
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
    if (w.endsWith('es') && w.length > 4) return w.slice(0, -2)
    if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) return w.slice(0, -1)
    return w
}

/**
 * Search official Daraz leaf categories by keyword, category path, or product title.
 */
export async function searchDarazCategories(
    query: string,
    limit: number = 6
): Promise<Array<DarazCategoryLeaf & { score: number }>> {
    if (!query || !query.trim()) return []

    const leaves = await getDarazLeafCategories()
    if (leaves.length === 0) return []

    const cleanQuery = query.toLowerCase().trim()
    const isPathQuery = cleanQuery.includes('>') || cleanQuery.includes('/')

    const querySegments = isPathQuery
        ? cleanQuery.split(/[>/]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : []

    const rawTokens = cleanQuery
        .replace(/[>/&|,\-_()]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2)
    const queryStems = Array.from(new Set(rawTokens.map(normalizeStem)))

    const scored: Array<DarazCategoryLeaf & { score: number }> = []

    for (const item of leaves) {
        const pathLower = item.path.toLowerCase()
        const nameLower = item.name.toLowerCase()

        let score = 0

        // ── 1. EXACT & HIERARCHY MATCHES ─────────────
        if (pathLower === cleanQuery || nameLower === cleanQuery) {
            score += 5000
        }

        if (isPathQuery && querySegments.length > 0) {
            const itemSegments = pathLower.split('>').map(s => s.trim())
            let segmentMatches = 0
            for (const qSeg of querySegments) {
                if (itemSegments.some(iSeg => iSeg === qSeg || iSeg.includes(qSeg))) {
                    segmentMatches++
                }
            }
            if (segmentMatches === querySegments.length) {
                score += 3000 + (itemSegments.length * 10)
            } else if (segmentMatches > 0) {
                score += segmentMatches * 600
            }
        } else {
            if (pathLower.endsWith(`> ${cleanQuery}`)) {
                score += 2500
            } else if (pathLower.includes(`> ${cleanQuery} >`) || pathLower.startsWith(`${cleanQuery} >`)) {
                score += 2000
            }
        }

        // ── 2. KEYWORD / EXACT STEM MATCHING ─────────────
        const nameWords = item.name
            .toLowerCase()
            .replace(/[&|,\-_()]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2)
        const nameStems = nameWords.map(normalizeStem)

        const pathWords = item.path
            .toLowerCase()
            .replace(/[&|,\-_()]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2)
        const pathStems = pathWords.map(normalizeStem)

        let matchedNameCount = 0
        let matchedPathCount = 0

        for (const qStem of queryStems) {
            if (nameStems.includes(qStem)) {
                score += 150
                matchedNameCount++
            } else if (pathStems.includes(qStem)) {
                score += 30
                matchedPathCount++
            }
        }

        if (matchedNameCount > 1) {
            score += matchedNameCount * 250
        }
        if (matchedNameCount > 0 && matchedPathCount > 0) {
            score += 80
        }

        if (score > 0) {
            scored.push({ ...item, score })
        }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
}

/**
 * Auto-resolves the best matching leaf category for a product.
 * If a categoryHint (from user or AI) is provided, it prioritizes matching categories
 * within that path/name and refines them using the product's keywords.
 */
export async function resolveBestCategory(
    productName: string,
    categoryHint?: string
): Promise<{ id: number; path: string } | null> {
    if (categoryHint && categoryHint.trim()) {
        const hintMatches = await searchDarazCategories(categoryHint, 15)
        if (hintMatches.length > 0) {
            if (productName && productName.trim() && hintMatches.length > 1) {
                const prodTokens = productName
                    .toLowerCase()
                    .replace(/[>/&|,\-_()]/g, ' ')
                    .split(/\s+/)
                    .filter(t => t.length >= 2)
                    .map(normalizeStem)

                let bestCandidate = hintMatches[0]
                let maxBonus = 0

                for (const cand of hintMatches) {
                    const candStems = cand.name
                        .toLowerCase()
                        .replace(/[&|,\-_()]/g, ' ')
                        .split(/\s+/)
                        .map(normalizeStem)

                    let bonus = 0
                    for (const pt of prodTokens) {
                        if (candStems.includes(pt)) {
                            bonus += 500
                        }
                    }

                    if (bonus > maxBonus) {
                        maxBonus = bonus
                        bestCandidate = cand
                    }
                }

                if (maxBonus > 0) {
                    return { id: bestCandidate.id, path: bestCandidate.path }
                }
            }

            return { id: hintMatches[0].id, path: hintMatches[0].path }
        }
    }

    const prodMatches = await searchDarazCategories(productName, 1)
    if (prodMatches.length > 0) {
        return {
            id: prodMatches[0].id,
            path: prodMatches[0].path
        }
    }
    return null
}
