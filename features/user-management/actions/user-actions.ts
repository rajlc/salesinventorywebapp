'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserProfile {
    id: string
    full_name: string | null
    email: string
    role: 'admin' | 'user'
    status: 'pending' | 'active' | 'disable'
    created_at: string
    updated_at: string
}

export interface UserPermission {
    id: string
    user_id: string
    main_page_role: string | null
    sub_page_role: string | null
    permission_type: 'view' | 'edit' | 'all'
    created_at: string
}

export interface UserActivityLog {
    id: string
    user_id: string
    action: 'login' | 'logout'
    browser: string | null
    ip_address: string | null
    created_at: string
}

export interface UserLocation {
    id: string
    user_id: string
    location_type: 'all' | 'specific'
    location_name: string | null
    latitude: number | null
    longitude: number | null
    radius_km: number | null
    created_at: string
    updated_at: string
}

// Get all users with their profiles
export async function getUsers() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can view all users')
    }

    // Get all auth users (Use Admin Client)
    const adminSupabase = await createAdminClient()
    const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers()

    if (usersError) throw new Error(usersError.message)

    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')

    if (profilesError) throw new Error(profilesError.message)

    // Combine auth user data with profiles
    const combinedUsers = users.users.map(authUser => {
        const profile = profiles?.find(p => p.id === authUser.id)
        return {
            id: authUser.id,
            email: authUser.email || '',
            full_name: profile?.full_name || null,
            role: profile?.role || 'user',
            status: profile?.status || 'pending',
            created_at: profile?.created_at || authUser.created_at,
            updated_at: profile?.updated_at || authUser.created_at,
        } as UserProfile
    })

    return combinedUsers
}

// Update user status (admin only)
export async function updateUserStatus(userId: string, status: 'pending' | 'active' | 'disable') {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can update user status')
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/user-management')
}

// Update user role (admin only)
export async function updateUserRole(userId: string, role: 'admin' | 'user') {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can update user roles')
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/user-management')
}

// Get user profile with all details
export async function getUserProfile(userId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Users can view own profile, admins can view any
    const { data: requesterProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && user.id !== userId) {
        throw new Error('Unauthorized')
    }

    // Get auth user (Use Admin Client)
    const adminSupabase = await createAdminClient()
    const { data: { user: authUser }, error: authError } = await adminSupabase.auth.admin.getUserById(userId)

    if (authError) throw new Error(authError.message)

    // Get profile
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (profileError) throw new Error(profileError.message)

    // Get permissions
    const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (permissionsError) throw new Error(permissionsError.message)

    // Get location settings
    const { data: location, error: locationError } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (locationError && locationError.code !== 'PGRST116') { // PGRST116 = no rows
        throw new Error(locationError.message)
    }

    if (!authUser) throw new Error('User not found')

    return {
        ...profile,
        email: authUser.email || '',
        permissions: permissions || [],
        location: location || null,
    }
}

// Add user permission
export async function addUserPermission(
    userId: string,
    mainPageRole: string | null,
    subPageRole: string | null,
    permissionType: 'view' | 'edit' | 'all'
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can manage permissions')
    }

    const { error } = await supabase
        .from('user_permissions')
        .insert({
            user_id: userId,
            main_page_role: mainPageRole,
            sub_page_role: subPageRole,
            permission_type: permissionType,
        })

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/user-management')
    revalidatePath(`/dashboard/user-management/${userId}`)
}

// Remove user permission
export async function removeUserPermission(permissionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can manage permissions')
    }

    const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('id', permissionId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/user-management')
}

// Get user's permissions (used for access control)
export async function getUserPermissions(userId?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const targetUserId = userId || user.id

    const { data: permissions, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', targetUserId)

    if (error) throw new Error(error.message)

    return permissions as UserPermission[]
}

// Log user activity
export async function logUserActivity(
    action: 'login' | 'logout',
    browser?: string,
    ipAddress?: string
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // Silent fail if not authenticated

    await supabase.from('user_activity_logs').insert({
        user_id: user.id,
        action,
        browser,
        ip_address: ipAddress,
    })
}

// Get user activity logs
export async function getUserActivityLogs(userId: string, limit = 50) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Users can view own logs, admins can view any
    const { data: requesterProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (requesterProfile?.role !== 'admin' && user.id !== userId) {
        throw new Error('Unauthorized')
    }

    const { data: logs, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw new Error(error.message)

    return logs as UserActivityLog[]
}

// Update user location settings
export async function updateUserLocation(
    userId: string,
    settings: {
        location_type: 'all' | 'specific'
        location_name?: string
        latitude?: number
        longitude?: number
        radius_km?: number
    }
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can update location settings')
    }

    const { error } = await supabase
        .from('user_locations')
        .upsert({
            user_id: userId,
            ...settings,
            updated_at: new Date().toISOString(),
        })

    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/user-management/${userId}`)
}

// Check user status for login
export async function checkUserStatus(email: string) {
    const supabase = await createClient()

    // Get user by email (Use Admin Client)
    const adminSupabase = await createAdminClient()
    const { data: { users }, error: usersError } = await adminSupabase.auth.admin.listUsers()

    if (usersError) throw new Error(usersError.message)

    const authUser = users.find(u => u.email === email)
    if (!authUser) return { exists: false, status: null }

    // Get profile
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('id', authUser.id)
        .single()

    if (profileError) {
        if (profileError.code === 'PGRST116') { // No profile found
            return { exists: true, status: 'pending' }
        }
        throw new Error(profileError.message)
    }

    return {
        exists: true,
        status: profile.status as 'pending' | 'active' | 'disable',
    }
}
