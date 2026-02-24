import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const callerId = user.id

    // Admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if caller is admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders })
    }

    const { action, ...params } = await req.json()

    if (action === 'create') {
      const { username, password, fullName } = params
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required' }), { status: 400, headers: corsHeaders })
      }

      const email = `${username.toLowerCase()}@app.internal`

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName || username }
      })

      if (authError) {
        if (authError.message?.includes('already been registered')) {
          return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 400, headers: corsHeaders })
        }
        throw authError
      }

      const userId = authData.user.id

      // Create profile
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({ id: userId, username: username.toLowerCase(), full_name: fullName || username })

      if (profileError) throw profileError

      // Assign 'user' role
      const { error: roleError } = await adminClient
        .from('user_roles')
        .insert({ user_id: userId, role: 'user' })

      if (roleError) throw roleError

      return new Response(JSON.stringify({ success: true, userId }), { headers: corsHeaders })
    }

    if (action === 'list') {
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, username, full_name, created_at')
        .order('created_at', { ascending: true })

      if (profilesError) throw profilesError

      const { data: roles, error: rolesError } = await adminClient
        .from('user_roles')
        .select('user_id, role')

      if (rolesError) throw rolesError

      const users = (profiles || []).map(p => ({
        ...p,
        roles: (roles || []).filter(r => r.user_id === p.id).map(r => r.role)
      }))

      return new Response(JSON.stringify({ users }), { headers: corsHeaders })
    }

    if (action === 'reset-password') {
      const { userId, newPassword } = params
      if (!userId || !newPassword) {
        return new Response(JSON.stringify({ error: 'userId and newPassword required' }), { status: 400, headers: corsHeaders })
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) throw error

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    if (action === 'delete') {
      const { userId } = params
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: corsHeaders })
      }

      // Prevent self-deletion
      if (userId === callerId) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers: corsHeaders })
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw error

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    if (action === 'setup-admin') {
      // One-time: create the first admin account if no users exist
      const { data: existingProfiles } = await adminClient
        .from('profiles')
        .select('id')
        .limit(1)

      if (existingProfiles && existingProfiles.length > 0) {
        return new Response(JSON.stringify({ error: 'Admin already set up' }), { status: 400, headers: corsHeaders })
      }

      // For setup-admin, we don't require admin role (no users exist yet)
      // But we still need a valid auth token - we'll handle this differently
      // Actually, for initial setup we need a special flow
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error('manage-users error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
