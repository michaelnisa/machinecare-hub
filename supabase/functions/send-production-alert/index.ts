// Sends a real email (and, for critical breaches, an SMS via Africa's
// Talking) the moment a production log crosses the org's configured
// attainment/downtime alert thresholds — triggered client-side right after
// Production.tsx saves the log, so delivery is immediate rather than
// waiting for the next daily digest.
//
// Auth model: verify_jwt = true (see supabase/config.toml). We forward the
// caller's own JWT into a Supabase client so RLS/can_write() decide whether
// they're allowed to see this production_kpi row at all — the same pattern
// as send-induction-reminder. Breach/severity are always recomputed here
// from the org's stored thresholds, never trusted from the client.
//
// The in-app bell notification (maintenance_notifications) is written
// independently by the check_production_thresholds() DB trigger, so it
// still appears even if this function or the email/SMS send fails.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function sendEmail(recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ templateName: 'fleet-alert', recipientEmail, idempotencyKey, templateData }),
  })
  if (!res.ok) console.error('send-transactional-email failed', recipientEmail, await res.text())
  return res.ok
}

async function sendSms(to: string, message: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ to, message }),
  })
  if (!res.ok) console.error('send-sms failed', to, await res.text())
  return res.ok
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

  let productionKpiId: string
  try {
    const body = await req.json()
    productionKpiId = body.productionKpiId || body.production_kpi_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!productionKpiId) {
    return new Response(JSON.stringify({ error: 'productionKpiId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Caller-scoped client — RLS ("pk select") enforces this user can only reach
  // their own org's production log, and only if they have production
  // department access, exactly as the Production page itself requires.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: kpi, error: kpiError } = await callerClient
    .from('production_kpis')
    .select('id, organisation_id, machine_id, record_date, shift, target_units, actual_units, downtime_minutes, attainment_percent, machines(name)')
    .eq('id', productionKpiId)
    .maybeSingle()

  if (kpiError) {
    return new Response(JSON.stringify({ error: kpiError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!kpi) {
    return new Response(JSON.stringify({ error: 'Production log not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Service-role client from here on: resolving recipients' emails/phones
  // needs auth.admin access that RLS can't grant to an ordinary user.
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: org } = await supabase
    .from('organisations')
    .select('name, production_alert_attainment_threshold, production_alert_downtime_minutes, production_alerts_sms_enabled')
    .eq('id', kpi.organisation_id)
    .maybeSingle()

  if (!org) {
    return new Response(JSON.stringify({ error: 'Organisation not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const attThreshold = org.production_alert_attainment_threshold as number | null
  const downtimeThreshold = org.production_alert_downtime_minutes as number | null
  const attainment = Number(kpi.attainment_percent ?? 0)
  const downtime = Number(kpi.downtime_minutes ?? 0)

  const attainmentBreached = attThreshold != null && (kpi.target_units ?? 0) > 0 && attainment < attThreshold
  const downtimeBreached = downtimeThreshold != null && downtime > downtimeThreshold
  if (!attainmentBreached && !downtimeBreached) {
    return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no threshold breached' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Critical = well past the threshold, not just over it — mirrors the
  // severity split shown on the in-app notification.
  const isCritical =
    (attThreshold != null && attainmentBreached && attainment < attThreshold * 0.5) ||
    (downtimeThreshold != null && downtimeBreached && downtime > downtimeThreshold * 2)
  const severity: 'critical' | 'high' = isCritical ? 'critical' : 'high'

  const machineName = (kpi.machines as any)?.name ?? 'Unassigned machine'
  const shiftLabel = kpi.shift ? ` (${kpi.shift})` : ''

  // Recipients: production-department staff + every owner/manager.
  const { data: prodProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('organisation_id', kpi.organisation_id)
    .eq('department', 'production')
  const { data: managerRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('organisation_id', kpi.organisation_id)
    .in('role', ['owner', 'manager'])
  const managerIds = [...new Set((managerRoles ?? []).map((r: any) => r.user_id))]
  const { data: managerProfiles } = managerIds.length
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', managerIds)
    : { data: [] }

  const byId = new Map<string, { full_name: string | null; phone: string | null }>()
  for (const p of [...(prodProfiles ?? []), ...(managerProfiles ?? [])]) byId.set(p.id, p)

  const rows = [
    { label: 'Date', value: kpi.record_date },
    { label: 'Shift', value: kpi.shift ?? '—' },
    { label: 'Machine', value: machineName },
    { label: 'Target', value: String(kpi.target_units ?? 0) },
    { label: 'Actual', value: String(kpi.actual_units ?? 0) },
    { label: 'Attainment', value: `${attainment.toFixed(1)}%` },
    { label: 'Downtime', value: `${downtime} min` },
  ]
  const heading = `Production shortfall — ${machineName}${shiftLabel}`
  const message = [
    attainmentBreached ? `Attainment fell to ${attainment.toFixed(1)}% (alert threshold ${attThreshold}%).` : null,
    downtimeBreached ? `Downtime hit ${downtime} minutes (alert threshold ${downtimeThreshold} min).` : null,
  ].filter(Boolean).join(' ')

  const smsText = `MachineCare: ${heading}. ${message}`.slice(0, 300)

  let emailsSent = 0
  let smsSent = 0
  const idempotencyBase = `production-alert-${kpi.id}`

  for (const [userId, profile] of byId.entries()) {
    const { data: u } = await supabase.auth.admin.getUserById(userId)
    const email = u?.user?.email
    if (email) {
      const ok = await sendEmail(email, `${idempotencyBase}-${email}`, {
        recipientName: profile.full_name ?? undefined,
        orgName: org.name ?? undefined,
        emoji: severity === 'critical' ? '🔴' : '🟠',
        heading,
        message,
        rows,
      })
      if (ok) emailsSent++
    }
    if (severity === 'critical' && org.production_alerts_sms_enabled && profile.phone) {
      const ok = await sendSms(profile.phone, smsText)
      if (ok) smsSent++
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: true, severity, emailsSent, smsSent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
