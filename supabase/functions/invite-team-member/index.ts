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
      JSON.stringify({ error: 'Missing Authorization header' }),
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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

    // 2. Verify caller has organization permissions
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, organisation_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.organisation_id) {
      return new Response(
        JSON.stringify({ error: 'No organisation found for caller' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const rawEmail = body.email
    const role = body.role || 'technician'
    const department = body.department || null
    const safetyRole = body.safety_role || body.safetyRole || (department === 'safety' ? 'officer' : null)
    const fullName = body.full_name || body.fullName || ''
    const appOrigin = body.origin || 'https://machinecarehub.com'

    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = rawEmail.trim().toLowerCase()

    // 3. Fetch organisation name for metadata
    const { data: org } = await adminClient
      .from('organisations')
      .select('name')
      .eq('id', profile.organisation_id)
      .single()
    const orgName = org?.name || 'your organisation'

    // 4. Generate unique invite token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const inviteLink = `${appOrigin}/accept-invite/${token}`

    // 5. Upsert into org_invites table
    // Delete any previous pending invite for this email in this org
    await adminClient
      .from('org_invites')
      .delete()
      .eq('organisation_id', profile.organisation_id)
      .eq('email', normalizedEmail)

    const { error: insertError } = await adminClient
      .from('org_invites')
      .insert({
        organisation_id: profile.organisation_id,
        email: normalizedEmail,
        role,
        department,
        safety_role: safetyRole,
        invited_by: profile.id,
        token,
      })

    if (insertError) {
      console.error('Failed to create org_invites record:', insertError)
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Trigger automated email via Supabase Auth Admin invite
    let emailSent = false
    let alreadyRegistered = false
    let warningMsg: string | null = null

    try {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          redirectTo: inviteLink,
          data: {
            organisation_id: profile.organisation_id,
            role,
            department,
            safety_role: safetyRole,
            invited_by: profile.id,
            invite_token: token,
            organisation_name: orgName,
            full_name: fullName,
          },
        }
      )

      if (inviteError) {
        console.warn('Supabase auth.admin.inviteUserByEmail notice:', inviteError.message)
        if (inviteError.message.toLowerCase().includes('already registered') || inviteError.status === 422) {
          alreadyRegistered = true
          warningMsg = 'This user already has a Supabase account. The invite link has been created so they can join your organisation.'
        } else {
          warningMsg = inviteError.message
        }
      } else {
        emailSent = true
      }
    } catch (inviteErr: any) {
      console.warn('inviteUserByEmail exception:', inviteErr.message)
      warningMsg = inviteErr.message
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        alreadyRegistered,
        token,
        inviteLink,
        email: normalizedEmail,
        role,
        organisationName: orgName,
        warning: warningMsg,
        message: emailSent
          ? `Automated invitation email sent to ${normalizedEmail}!`
          : `Invite link created! ${warningMsg ? `(${warningMsg})` : ''}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('invite-team-member handler error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
