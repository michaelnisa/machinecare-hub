import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header. You must be signed in to accept an invite.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // 1. Authenticate caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User not recognized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token } = await req.json()
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing invite token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Admin client to check invite & assign role
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: invite, error: inviteError } = await adminClient
      .from('org_invites')
      .select('*, organisations:organisation_id(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: 'This invite link is invalid, already accepted, or revoked.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This invite has expired. Please ask your administrator to send a new one.' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify email match (case-insensitive)
    if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: `This invite was issued to ${invite.email}, but you are currently signed in as ${user.email}.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = invite.organisation_id
    const orgName = (invite.organisations as any)?.name || 'the organisation'
    const assignedRole = invite.role

    // 3. Update or create user profile
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      await adminClient
        .from('profiles')
        .update({
          organisation_id: orgId,
          department: invite.department || undefined,
        })
        .eq('id', user.id)
    } else {
      await adminClient
        .from('profiles')
        .insert({
          id: user.id,
          organisation_id: orgId,
          department: invite.department || null,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        })
    }

    // 4. Upsert user role in user_roles table
    const { error: roleError } = await adminClient
      .from('user_roles')
      .upsert(
        {
          user_id: user.id,
          organisation_id: orgId,
          role: assignedRole,
        },
        { onConflict: 'user_id,organisation_id' }
      )

    if (roleError) {
      console.warn('user_roles upsert warning:', roleError.message)
    }

    // 5. Mark invite as accepted
    await adminClient
      .from('org_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        accepted_by_name: existingProfile?.full_name || user.email,
      })
      .eq('id', invite.id)

    return new Response(
      JSON.stringify({
        success: true,
        organisation_id: orgId,
        organisation_name: orgName,
        role: assignedRole,
        department: invite.department,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('accept-invite edge function error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error while accepting invite.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
