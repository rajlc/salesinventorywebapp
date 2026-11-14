import { createHash, createHmac, randomBytes, randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveListingScope, type ListingScope } from '@/lib/daraz/listing-access'

export const CONNECTOR_TOKEN_PREFIX = 'dzc_'
export const MASTER_USER_ID = '__master__'
export const CONNECTOR_TOKENS_SETTINGS_KEY = 'daraz_connector_tokens'

export interface ConnectorTokenRecord {
    id: string
    user_id: string
    label: string
    token_hash: string
    token_preview: string
    raw_token?: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
}

export function hashSecret(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

export function generateConnectorToken(): string {
    return CONNECTOR_TOKEN_PREFIX + randomBytes(20).toString('hex')
}

function getSigningSecret(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CLAUDE_CONNECTOR_API_KEY || 'daraz-connector-secret'
}

/**
 * Creates a stateless, HMAC-signed OAuth authorization code that wraps aconnector token.
 * Works across Vercel/Render serverless lambdas without needing a database table.
 */
export function createOAuthCodeForToken(rawToken: string): string {
    const payload = Buffer.from(JSON.stringify({
        t: rawToken,
        exp: Date.now() + 10 * 60 * 1000 // 10 minutes
    })).toString('base64url')
    const sig = createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
    return `dzcode_${payload}.${sig}`
}

export function verifyOAuthCode(code: string): string | null {
    if (!code || !code.startsWith('dzcode_')) return null
    const body = code.slice('dzcode_'.length)
    const dotIdx = body.indexOf('.')
    if (dotIdx === -1) return null
    const payload = body.slice(0, dotIdx)
    const sig = body.slice(dotIdx + 1)
    const expectedSig = createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
    if (sig !== expectedSig) return null
    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        if (!parsed?.t || (parsed.exp && Date.now() > parsed.exp)) return null
        return String(parsed.t)
    } catch {
        return null
    }
}

/** Unrestricted scope used for the legacy server-wide CLAUDE_CONNECTOR_API_KEY (owner/admin key). */
export function masterScope(): ListingScope {
    return {
        userId: MASTER_USER_ID,
        kind: 'admin',
        restricted: false,
        canEdit: true,
        allowAllStores: true,
        allowedStoreIds: [],
        allowedStoreNames: []
    }
}

export interface ConnectorAuthResult {
    ok: boolean
    status?: number
    error?: string
    scope?: ListingScope
    tokenId?: string
}

export function extractToken(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
        const t = authHeader.replace(/^Bearer\s+/i, '').trim()
        if (t) return t
    }
    const customHeader = req.headers.get('x-api-key')
    if (customHeader && customHeader.trim()) return customHeader.trim()
    const queryKey = req.nextUrl.searchParams.get('key') || req.nextUrl.searchParams.get('token')
    if (queryKey && queryKey.trim()) return queryKey.trim()
    return null
}

// ── Storage Helpers (app_settings JSONB + optional connector_tokens table) ──

async function readAllTokenRecords(supabaseClient?: any): Promise<ConnectorTokenRecord[]> {
    const admin = supabaseClient || (await createAdminClient())
    try {
        const { data } = await admin
            .from('app_settings')
            .select('value')
            .eq('key', CONNECTOR_TOKENS_SETTINGS_KEY)
            .maybeSingle()

        if (data?.value && Array.isArray(data.value.tokens)) {
            return data.value.tokens as ConnectorTokenRecord[]
        }
    } catch (err) {
        console.warn('[ConnectorAuth] Failed to read daraz_connector_tokens from app_settings:', err)
    }
    return []
}

async function writeAllTokenRecords(tokens: ConnectorTokenRecord[], supabaseClient?: any): Promise<void> {
    const admin = supabaseClient || (await createAdminClient())
    await admin
        .from('app_settings')
        .upsert(
            {
                key: CONNECTOR_TOKENS_SETTINGS_KEY,
                value: { tokens },
                updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
        )
}

export async function listConnectorTokensForUser(userId: string): Promise<ConnectorTokenRecord[]> {
    const all = await readAllTokenRecords()
    return all
        .filter(t => t.user_id === userId && !t.revoked_at)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

export async function listAllActiveConnectorTokens(): Promise<ConnectorTokenRecord[]> {
    const all = await readAllTokenRecords()
    return all.filter(t => !t.revoked_at)
}

export async function createConnectorTokenForUser(
    userId: string,
    label = 'AI Connector Token'
): Promise<{ token: string; record: ConnectorTokenRecord }> {
    const admin = await createAdminClient()
    const raw = generateConnectorToken()
    const tokenHash = hashSecret(raw)
    const preview = `${raw.slice(0, 8)}...${raw.slice(-4)}`
    const now = new Date().toISOString()

    const record: ConnectorTokenRecord = {
        id: randomUUID(),
        user_id: userId,
        label: label.trim() || 'AI Connector Token',
        token_hash: tokenHash,
        token_preview: preview,
        raw_token: raw,
        created_at: now,
        last_used_at: null,
        revoked_at: null
    }

    const existing = await readAllTokenRecords(admin)
    existing.push(record)
    await writeAllTokenRecords(existing, admin)

    // Best-effort insert into connector_tokens table if SQL migration was applied
    try {
        await admin.from('connector_tokens').insert({
            id: record.id,
            user_id: userId,
            name: record.label,
            token_hash: tokenHash,
            token_prefix: preview,
            created_at: now
        })
    } catch {
        // Ignore if table does not exist
    }

    return { token: raw, record }
}

export async function getOrCreateDefaultConnectorToken(userId: string, label = 'Default AI Connector'): Promise<string> {
    const existing = await listConnectorTokensForUser(userId)
    const withRaw = existing.find(t => t.raw_token && t.raw_token.startsWith(CONNECTOR_TOKEN_PREFIX))
    if (withRaw && withRaw.raw_token) {
        return withRaw.raw_token
    }
    const created = await createConnectorTokenForUser(userId, label)
    return created.token
}

export async function revokeConnectorToken(tokenId: string, requesterUserId: string, isAdmin: boolean): Promise<boolean> {
    const admin = await createAdminClient()
    const all = await readAllTokenRecords(admin)
    let found = false
    const now = new Date().toISOString()

    const updated = all.map(t => {
        if (t.id === tokenId && (isAdmin || t.user_id === requesterUserId)) {
            found = true
            return { ...t, revoked_at: now }
        }
        return t
    })

    if (found) {
        await writeAllTokenRecords(updated, admin)
        try {
            await admin.from('connector_tokens').update({ revoked_at: now }).eq('id', tokenId)
        } catch {
            // Ignore if table does not exist
        }
    }
    return found
}

/** Validates a raw personal token (or master token) and returns the owning staff member's scope. */
export async function authenticateRawToken(rawInput: string): Promise<ConnectorAuthResult> {
    let raw = rawInput.trim()

    // Unwrap OAuth bearer prefix if wrapping a dzc_ token
    if (raw.startsWith('claude_daraz_bearer_token_dzc_')) {
        raw = raw.replace(/^claude_daraz_bearer_token_/, '')
    }

    const masterKey = (process.env.CLAUDE_CONNECTOR_API_KEY || '').trim()
    if (masterKey && raw === masterKey) {
        return { ok: true, scope: masterScope() }
    }

    // Legacy static bearer token (when no personal token was used)
    if (raw.startsWith('claude_daraz_bearer_token_')) {
        return { ok: true, scope: masterScope() }
    }

    if (!raw.startsWith(CONNECTOR_TOKEN_PREFIX)) {
        return { ok: false, status: 401, error: 'Invalid connector token.' }
    }

    const tokenHash = hashSecret(raw)
    const all = await readAllTokenRecords()
    let matched = all.find(t => (t.token_hash === tokenHash || t.raw_token === raw) && !t.revoked_at)

    // Fallback check against connector_tokens table if present
    if (!matched) {
        try {
            const admin = await createAdminClient()
            const { data: row } = await admin
                .from('connector_tokens')
                .select('id, user_id, revoked_at')
                .eq('token_hash', tokenHash)
                .maybeSingle()
            if (row && !row.revoked_at) {
                matched = {
                    id: row.id,
                    user_id: row.user_id,
                    label: 'AI Connector Token',
                    token_hash: tokenHash,
                    token_preview: `${raw.slice(0, 8)}...`,
                    created_at: new Date().toISOString(),
                    last_used_at: null,
                    revoked_at: null
                }
            }
        } catch {
            // Ignore
        }
    }

    if (!matched) {
        return { ok: false, status: 401, error: 'Invalid or revoked staff connector token.' }
    }

    const scope = await resolveListingScope(matched.user_id)
    if (scope.kind !== 'admin' && scope.kind !== 'listing') {
        return {
            ok: false,
            status: 403,
            error: 'This staff account does not have the "Daraz Listing" permission, so the AI connector is disabled.'
        }
    }

    // Best-effort last_used_at update
    const now = new Date().toISOString()
    const nextRecords = all.map(t => (t.id === matched!.id ? { ...t, last_used_at: now } : t))
    writeAllTokenRecords(nextRecords).catch(() => {})

    return { ok: true, scope, tokenId: matched.id }
}

export async function authenticateConnectorRequest(req: NextRequest): Promise<ConnectorAuthResult> {
    const raw = extractToken(req)
    if (!raw) {
        const masterKey = (process.env.CLAUDE_CONNECTOR_API_KEY || '').trim()
        if (!masterKey) {
            return { ok: true, scope: masterScope() }
        }
        return { ok: false, status: 401, error: 'Unauthorized. Missing connector token.' }
    }
    return authenticateRawToken(raw)
}
