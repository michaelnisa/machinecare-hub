// Sends a real "certificate expiring" email for an induction record, triggered
// by an authenticated user clicking "Send reminder" in the Induction dashboard.
//
// Auth model: verify_jwt = true (see supabase/config.toml), so this only runs
// for a signed-in user. We forward that user's own JWT into a Supabase client
// so RLS does the authorization for us (org isolation via the "ir select"
// policy on induction_records, write permission via the can_write() RPC) —
// no need to reimplement those checks here.
//
// Sending itself still requires the service-role key, since
// send-transactional-email only accepts service-role callers.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let recordId: string
  try {
    const body = await req.json()
    recordId = body.recordId || body.record_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!recordId) {
    return new Response(JSON.stringify({ error: 'recordId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Caller-scoped client — RLS enforces this user can only reach their own org's record.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: record, error: recordError } = await callerClient
    .from('induction_records')
    .select(
      'id, organisation_id, expires_at, inductee_id, programme_id, inductees(full_name, email), induction_programmes(name), organisations(name)',
    )
    .eq('id', recordId)
    .maybeSingle()

  if (recordError) {
    return new Response(JSON.stringify({ error: recordError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!record) {
    return new Response(JSON.stringify({ error: 'Induction record not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: canWrite, error: canWriteError } = await callerClient.rpc('can_write', {
    _org_id: record.organisation_id,
  })
  if (canWriteError || !canWrite) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const inductee = record.inductees as unknown as { full_name: string | null; email: string | null } | null
  const programme = record.induction_programmes as unknown as { name: string | null } | null
  const org = record.organisations as unknown as { name: string | null } | null

  if (!inductee?.email) {
    return new Response(JSON.stringify({ error: 'No email on file for this person' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const daysAway = record.expires_at
    ? Math.ceil((new Date(record.expires_at).getTime() - now.getTime()) / 86400000)
    : undefined
  const todayStr = now.toISOString().slice(0, 10)

  const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      templateName: 'document-expiring',
      recipientEmail: inductee.email,
      idempotencyKey: `induction-reminder-${recordId}-${todayStr}`,
      templateData: {
        recipientName: inductee.full_name ?? undefined,
        orgName: org?.name ?? undefined,
        subjectLabel: programme?.name ?? 'Induction certificate',
        docType: 'Induction certificate',
        holderLabel: inductee.full_name ?? undefined,
        expiresOn: record.expires_at ?? undefined,
        daysAway,
      },
    }),
  })

  if (!sendRes.ok) {
    const detail = await sendRes.text()
    console.error('send-transactional-email failed', detail)
    return new Response(JSON.stringify({ error: 'Failed to send reminder email' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: logError } = await callerClient.from('induction_reminders').insert({
    organisation_id: record.organisation_id,
    induction_record_id: recordId,
    channel: 'email',
  })
  if (logError) console.error('failed to log induction reminder', logError)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
