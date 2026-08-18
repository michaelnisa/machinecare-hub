// Sends an immediate SMS when someone manually raises a "critical" floor
// issue on the Notifications page (NotificationDialog in Notifications.tsx)
// — triggered client-side right after the insert, same pattern as
// send-production-alert.
//
// Auth model: verify_jwt = true. We forward the caller's own JWT so RLS
// ("mn select org") decides whether they can even see this notification —
// only then do we switch to a service-role client to resolve recipients and
// send. The composed SMS text is written back onto the row (sms_text) so it
// shows up directly in the Notifications table, not just on the recipient's
// phone.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let notificationId: string
  try {
    const body = await req.json()
    notificationId = body.notificationId || body.notification_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!notificationId) {
    return new Response(JSON.stringify({ error: 'notificationId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Caller-scoped client — RLS ("mn select org") enforces this user can only
  // reach their own org's notification.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: notif, error: notifError } = await callerClient
    .from('maintenance_notifications')
    .select('id, organisation_id, machine_id, title, description, severity, sms_alert_sent_at, sms_text, machines(name)')
    .eq('id', notificationId)
    .maybeSingle()

  if (notifError) {
    return new Response(JSON.stringify({ error: notifError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!notif) {
    return new Response(JSON.stringify({ error: 'Notification not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (notif.severity !== 'critical') {
    return new Response(JSON.stringify({ error: 'Only critical notifications page out an SMS' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (notif.sms_alert_sent_at) {
    return new Response(JSON.stringify({ ok: true, alreadySent: true, smsText: notif.sms_text ?? null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { error: rateLimitError } = await supabase.rpc('enforce_rate_limit', {
    _bucket: `critical_notification_sms_org:${notif.organisation_id}`,
    _max_count: 30,
    _window_minutes: 60,
  })
  if (rateLimitError) {
    return new Response(JSON.stringify({ error: 'Too many critical alerts for this organisation right now' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', notif.organisation_id)
    .maybeSingle()

  // Recipients: every owner/manager with a phone on file — this inbox is
  // the manager-facing "floor issues" list, so it isn't department-scoped
  // the way the accident-report alert is.
  const { data: managerRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('organisation_id', notif.organisation_id)
    .in('role', ['owner', 'manager'])
  const managerIds = [...new Set((managerRoles ?? []).map((r: any) => r.user_id))]
  const { data: managerProfiles } = managerIds.length
    ? await supabase.from('profiles').select('phone').in('id', managerIds)
    : { data: [] }

  const phones = new Set<string>()
  for (const p of managerProfiles ?? []) {
    if (p.phone) phones.add(p.phone)
  }

  const machineName = (notif.machines as any)?.name
  const heading = machineName ? `${notif.title} — ${machineName}` : notif.title
  const smsText = `MachineCare CRITICAL: ${heading}. ${notif.description ?? ''} (${org?.name ?? 'your site'})`.slice(0, 300)

  let smsSent = 0
  for (const phone of phones) {
    const ok = await sendSms(phone, smsText)
    if (ok) smsSent++
  }

  await supabase
    .from('maintenance_notifications')
    .update({ sms_alert_sent_at: new Date().toISOString(), sms_text: smsText, sms_recipients_count: phones.size })
    .eq('id', notificationId)

  return new Response(JSON.stringify({ ok: true, recipients: phones.size, smsSent, smsText }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
