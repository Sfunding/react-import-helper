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
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if any users exist already
    const { data: existingProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .limit(1)

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(JSON.stringify({ error: 'Admin already exists. Setup is complete.' }), { status: 400, headers: corsHeaders })
    }

    const { username, password, fullName } = await req.json()
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

    if (authError) throw authError

    const userId = authData.user.id

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({ id: userId, username: username.toLowerCase(), full_name: fullName || username })

    if (profileError) throw profileError

    // Assign admin role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' })

    if (roleError) throw roleError

    return new Response(JSON.stringify({ success: true, userId }), { headers: corsHeaders })
  } catch (err) {
    console.error('setup-admin error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
