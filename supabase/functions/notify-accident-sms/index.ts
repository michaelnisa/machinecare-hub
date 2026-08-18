// Fires an immediate SMS to owners/managers and safety-department staff
// when an accident/incident report comes in from the public QR page
// (/m/:id — no login). Called right after the client's insert into
// safety_incidents succeeds; verify_jwt = false because the reporter is
// anonymous, but every action here is still gated by looking up the real
// row with a service-role client first, same trust model as
// complete-induction-public.
//
// This is a caller of send-sms, not send-sms itself — it passes its own
// service-role key server-to-server, matching send-production-alert's
// trust model (see send-sms's own header comment).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function sendSms(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, message }),
    })
    if (!res.ok) console.error('send-sms failed', to, await res.text())
    return res.ok
  } catch (e) {
    console.error('send-sms threw', e)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  let incidentId: string
  try {
    const body = await req.json()
    incidentId = body.incidentId || body.incident_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!incidentId) {
    return new Response(JSON.stringify({ error: 'incidentId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Rate limit per-org so a guessed/enumerated incidentId can't be replayed
  // to run up SMS cost — this caps total accident-SMS volume, independent
  // of the per-incident idempotency check below.
  const { data: incident, error: incidentError } = await supabase
    .from('safety_incidents')
    .select('id, organisation_id, machine_id, incident_type, severity, description, reporter_name, reporter_phone, sms_alert_sent_at, reported_by')
    .eq('id', incidentId)
    .maybeSingle()

  if (incidentError) {
    return new Response(JSON.stringify({ error: incidentError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!incident) {
    return new Response(JSON.stringify({ error: 'Incident not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (incident.sms_alert_sent_at) {
    return new Response(JSON.stringify({ ok: true, alreadySent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: rateLimitError } = await supabase.rpc('enforce_rate_limit', {
    _bucket: `accident_sms_org:${incident.organisation_id}`,
    _max_count: 30,
    _window_minutes: 60,
  })
  if (rateLimitError) {
    return new Response(JSON.stringify({ error: 'Too many alerts for this organisation right now' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', incident.organisation_id)
    .maybeSingle()

  const { data: machine } = incident.machine_id
    ? await supabase.from('machines').select('name').eq('id', incident.machine_id).maybeSingle()
    : { data: null }

  // Recipients: safety-department staff + every owner/manager with a phone on file.
  const { data: safetyProfiles } = await supabase
    .from('profiles')
    .select('id, phone')
    .eq('organisation_id', incident.organisation_id)
    .eq('department', 'safety')
  const { data: managerRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('organisation_id', incident.organisation_id)
    .in('role', ['owner', 'manager'])
  const managerIds = [...new Set((managerRoles ?? []).map((r: any) => r.user_id))]
  const { data: managerProfiles } = managerIds.length
    ? await supabase.from('profiles').select('id, phone').in('id', managerIds)
    : { data: [] }

  const phones = new Set<string>()
  for (const p of [...(safetyProfiles ?? []), ...(managerProfiles ?? [])]) {
    if (p.phone) phones.add(p.phone)
  }

  const incidentLabel = String(incident.incident_type ?? 'incident').replace(/_/g, ' ')
  const heading = `${incidentLabel.charAt(0).toUpperCase()}${incidentLabel.slice(1)} reported — ${machine?.name ?? 'unknown machine'}`
  const smsText = `MachineCare ALERT: ${heading} at ${org?.name ?? 'your site'}. ${incident.description} (by ${incident.reporter_name ?? 'anonymous'}, ${incident.reporter_phone ?? 'no phone'})`.slice(0, 300)

  let smsSent = 0
  for (const phone of phones) {
    const ok = await sendSms(phone, smsText)
    if (ok) smsSent++
  }

  await supabase.from('safety_incidents').update({ sms_alert_sent_at: new Date().toISOString() }).eq('id', incidentId)

  return new Response(JSON.stringify({ ok: true, recipients: phones.size, smsSent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
