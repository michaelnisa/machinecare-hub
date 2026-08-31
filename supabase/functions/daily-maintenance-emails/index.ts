// Daily maintenance email job. Scans every org for due-soon / overdue services
// and overdue work orders, then dispatches emails via send-transactional-email.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Org = {
  id: string
  name: string
  notifications_enabled: boolean
  notifications_system_inbox: string | null
  notifications_lead_days: number
  notifications_notify_managers: boolean
  notifications_notify_technicians: boolean
  notifications_notify_engineers: boolean
  maintenance_alerts_sms_enabled: boolean
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Mirrors src/lib/pm-prediction.ts. Duplicated (not imported) because this
// runs in Deno, a separate runtime/bundle from the Vite app — keep the two
// in sync if the blending logic changes. Blends the calendar interval with
// a usage rate derived from meter-reading history, since a pure hours
// interval is only as good as how often someone logs a reading, and a pure
// date interval ignores how hard the machine is actually being run.
function estimateUsageRate(readings: { reading: number; reading_date: string }[]): number | null {
  const sorted = [...readings].sort((a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime())
  if (sorted.length < 2) return null
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = (new Date(last.reading_date).getTime() - new Date(first.reading_date).getTime()) / 86400000
  if (days <= 0) return null
  const rate = (last.reading - first.reading) / days
  return rate > 0 ? rate : null
}

function predictDueDate(params: {
  nextDueDate: string | null
  nextDueHours: number | null
  currentHours: number | null
  ratePerDay: number | null
}): { dueDate: string; daysRemaining: number } | null {
  const { nextDueDate, nextDueHours, currentHours, ratePerDay } = params
  const now = new Date()

  const calendarDays = nextDueDate != null ? (new Date(nextDueDate).getTime() - now.getTime()) / 86400000 : null
  const usageDays =
    nextDueHours != null && currentHours != null && ratePerDay
      ? (nextDueHours - currentHours) / ratePerDay
      : null

  let daysRemaining: number | null = null
  if (calendarDays != null && usageDays != null) daysRemaining = Math.min(calendarDays, usageDays)
  else if (calendarDays != null) daysRemaining = calendarDays
  else if (usageDays != null) daysRemaining = usageDays

  if (daysRemaining == null) return null
  const dueDate = new Date(now.getTime() + daysRemaining * 86400000).toISOString().slice(0, 10)
  return { dueDate, daysRemaining }
}

async function send(templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
    })
    if (!res.ok) console.error('send failed', templateName, recipientEmail, await res.text())
    return res.ok
  } catch (e) {
    console.error('send threw', e)
    return false
  }
}

async function sendSms(to: string, message: string) {
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

async function getOrgRecipients(orgId: string, includeManagers: boolean, includeEngineers: boolean) {
  // Roles live in user_roles, not profiles (profiles.role was dropped).
  const roles: string[] = []
  if (includeManagers) roles.push('owner', 'manager')
  if (includeEngineers) roles.push('engineer')
  if (roles.length === 0) return []

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('organisation_id', orgId)
    .in('role', roles)

  if (!userRoles?.length) return []
  const userIds = [...new Set(userRoles.map((r) => r.user_id))]
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)
  const profById = new Map((profs ?? []).map((p) => [p.id, p]))

  const out: { email: string; name: string; phone: string | null }[] = []
  for (const userId of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(userId)
    const prof = profById.get(userId)
    if (u?.user?.email) out.push({ email: u.user.email, name: prof?.full_name ?? u.user.email, phone: prof?.phone ?? null })
  }
  return out
}

async function getTechnicianEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const { data: p } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  const { data: u } = await supabase.auth.admin.getUserById(userId)
  if (!u?.user?.email) return null
  return { email: u.user.email, name: p?.full_name ?? u.user.email }
}

async function processOrg(org: Org) {
  if (!org.notifications_enabled) return { dueSoon: 0, overdue: 0, sent: 0, smsSent: 0 }
  const today = new Date().toISOString().slice(0, 10)
  const lead = new Date(); lead.setDate(lead.getDate() + (org.notifications_lead_days ?? 8))
  const leadDate = lead.toISOString().slice(0, 10)

  // Service schedules: due soon / overdue, predicted from the blend of the
  // calendar interval and each machine's actual usage rate (see
  // estimateUsageRate/predictDueDate above) rather than next_due_date alone.
  const { data: machines } = await supabase
    .from('machines').select('id, name, current_hours').eq('organisation_id', org.id)
  const machineMap = new Map((machines ?? []).map(m => [m.id, m.name]))
  const machineHoursMap = new Map((machines ?? []).map(m => [m.id, m.current_hours]))
  const machineIds = (machines ?? []).map(m => m.id)

  const dueSoon: { machine: string; name: string; due: string }[] = []
  const overdue: { machine: string; name: string; due: string }[] = []

  if (machineIds.length) {
    const [{ data: schedules }, { data: readingsRaw }] = await Promise.all([
      supabase
        .from('service_schedules')
        .select('machine_id, name, next_due_date, next_due_hours')
        .in('machine_id', machineIds),
      supabase
        .from('meter_readings')
        .select('machine_id, reading, reading_date')
        .in('machine_id', machineIds)
        .order('reading_date', { ascending: false })
        .limit(2000),
    ])

    const readingsByMachine: Record<string, { reading: number; reading_date: string }[]> = {}
    for (const r of readingsRaw ?? []) {
      ;(readingsByMachine[r.machine_id] ||= []).push({ reading: r.reading, reading_date: r.reading_date })
    }

    for (const s of schedules ?? []) {
      const mname = machineMap.get(s.machine_id) ?? 'Machine'
      const ratePerDay = estimateUsageRate(readingsByMachine[s.machine_id] ?? [])
      const predicted = predictDueDate({
        nextDueDate: s.next_due_date,
        nextDueHours: s.next_due_hours,
        currentHours: machineHoursMap.get(s.machine_id) ?? null,
        ratePerDay,
      })
      if (!predicted) continue
      const { dueDate, daysRemaining } = predicted
      if (daysRemaining < 0) overdue.push({ machine: mname, name: s.name, due: dueDate })
      else if (dueDate <= leadDate) dueSoon.push({ machine: mname, name: s.name, due: dueDate })
    }
  }

  // Open work orders
  const { data: openWos } = await supabase
    .from('work_orders')
    .select('id, wo_number, wo_year, title, priority, due_date, status, assignee_id, machine_id')
    .eq('organisation_id', org.id)
    .not('status', 'in', '("done","closed")')

  let sent = 0

  // 1. Digest -> managers/owners + engineers + system inbox
  const recipients = await getOrgRecipients(org.id, org.notifications_notify_managers, org.notifications_notify_engineers)
  const digestKey = `digest-${org.id}-${today}`
  for (const r of recipients) {
    const ok = await send('maintenance-digest', r.email, `${digestKey}-${r.email}`, {
      recipientName: r.name, orgName: org.name,
      overdue, dueSoon, openWorkOrders: openWos?.length ?? 0,
    })
    if (ok) sent++
  }
  if (org.notifications_system_inbox) {
    const ok = await send('maintenance-digest', org.notifications_system_inbox, `${digestKey}-sys`, {
      recipientName: 'MachineCare System', orgName: org.name,
      overdue, dueSoon, openWorkOrders: openWos?.length ?? 0,
    })
    if (ok) sent++
  }

  // 1b. Overdue PM -> SMS to managers/owners with a phone on file (opt-in
  // per org). Only fires for overdue items, not due-soon, to keep it to
  // genuinely urgent texts.
  let smsSent = 0
  if (org.maintenance_alerts_sms_enabled && overdue.length > 0) {
    const smsRecipients = recipients.filter((r) => r.phone)
    const shown = overdue.slice(0, 3).map((o) => `${o.machine}: ${o.name}`).join('; ')
    const more = overdue.length > 3 ? ` +${overdue.length - 3} more` : ''
    const smsText = `MachineCare: ${overdue.length} overdue PM service${overdue.length === 1 ? '' : 's'} at ${org.name}. ${shown}${more}`
    for (const r of smsRecipients) {
      const ok = await sendSms(r.phone!, smsText)
      if (ok) smsSent++
    }
  }

  // 2. Per-technician overdue work-order email (only assignees)
  if (org.notifications_notify_technicians && openWos) {
    const overdueWos = openWos.filter(w => w.due_date && (w.due_date as string) < today && w.assignee_id)
    const byTech: Record<string, typeof overdueWos> = {}
    for (const w of overdueWos) {
      const key = w.assignee_id!
      ;(byTech[key] ||= []).push(w)
    }
    for (const [techId, wos] of Object.entries(byTech)) {
      const t = await getTechnicianEmail(techId)
      if (!t) continue
      for (const w of wos) {
        const woNum = w.wo_year && w.wo_number ? `WO-${w.wo_year}-${String(w.wo_number).padStart(4, '0')}` : `WO-${w.id.slice(0, 8)}`
        const ok = await send('wo-assigned', t.email, `wo-${w.id}-${today}`, {
          recipientName: t.name, orgName: org.name,
          woNumber: woNum, title: w.title, machineName: machineMap.get(w.machine_id) ?? '',
          priority: w.priority, dueDate: w.due_date,
        })
        if (ok) sent++
      }
    }
  }

  // 3. Inventory low-stock email to managers + owners (throttled to once per 24h per org)
  try {
    const { data: lowItems } = await supabase
      .from('inventory_items')
      .select('id, name, part_number, quantity, unit, reorder_level, order_status, last_low_stock_notified_at')
      .eq('organisation_id', org.id)
      .filter('quantity', 'lte', 'reorder_level' as any)

    // Supabase doesn't support column-to-column compare via filter; fetch + filter in JS:
    const { data: invAll } = await supabase
      .from('inventory_items')
      .select('id, name, part_number, quantity, unit, reorder_level, order_status, last_low_stock_notified_at')
      .eq('organisation_id', org.id)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const low = (invAll ?? []).filter((i: any) =>
      Number(i.quantity ?? 0) <= Number(i.reorder_level ?? 0) &&
      (i.reorder_level ?? 0) > 0 &&
      (!i.last_low_stock_notified_at || new Date(i.last_low_stock_notified_at).getTime() < dayAgo)
    )

    if (low.length > 0) {
      const mgrs = await getOrgRecipients(org.id, true, false)
      const items = low.map((i: any) => ({
        name: i.name, partNumber: i.part_number, quantity: Number(i.quantity ?? 0),
        unit: i.unit ?? '', reorderLevel: Number(i.reorder_level ?? 0), orderStatus: i.order_status,
      }))
      const key = `lowstock-${org.id}-${today}`
      for (const r of mgrs) {
        const ok = await send('inventory-low-stock', r.email, `${key}-${r.email}`, {
          recipientName: r.name, orgName: org.name, items,
        })
        if (ok) sent++
      }
      if (mgrs.length > 0) {
        await supabase
          .from('inventory_items')
          .update({ last_low_stock_notified_at: new Date().toISOString() })
          .in('id', low.map((i: any) => i.id))
      }
    }
  } catch (e) {
    console.error('inventory low-stock failed', e)
  }

  // 4. Fleet: vehicle documents expiring (per-document reminder_days window) -> managers
  try {
    const { data: docs } = await supabase
      .from('vehicle_documents')
      .select('id, machine_id, doc_type, expires_on, reminder_days')
      .eq('organisation_id', org.id)
      .not('expires_on', 'is', null)

    const expiringDocs = (docs ?? []).filter((d: any) => {
      const daysAway = Math.floor((new Date(d.expires_on).getTime() - Date.now()) / 86400000)
      return daysAway >= 0 && daysAway <= (d.reminder_days ?? 30)
    })

    if (expiringDocs.length > 0) {
      const mgrs = await getOrgRecipients(org.id, true, false)
      const key = `vehicledoc-${org.id}-${today}`
      for (const d of expiringDocs as any[]) {
        const vehicleLabel = machineMap.get(d.machine_id) ?? 'Vehicle'
        const daysAway = Math.floor((new Date(d.expires_on).getTime() - Date.now()) / 86400000)
        for (const r of mgrs) {
          const ok = await send('document-expiring', r.email, `${key}-${d.id}-${r.email}`, {
            recipientName: r.name, orgName: org.name,
            subjectLabel: `${d.doc_type} for ${vehicleLabel}`,
            docType: d.doc_type, holderLabel: vehicleLabel,
            expiresOn: d.expires_on, daysAway,
          })
          if (ok) sent++
        }
      }
    }
  } catch (e) {
    console.error('vehicle document expiry failed', e)
  }

  // 5. Fleet: driver licence/medical expiring -> the driver (if they have an email) + managers
  try {
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, full_name, email, licence_expiry, medical_expiry')
      .eq('organisation_id', org.id)
      .eq('status', 'active')

    const withinWindow = (dateStr: string | null) => {
      if (!dateStr) return null
      const daysAway = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
      return daysAway >= 0 && daysAway <= (org.notifications_lead_days ?? 8) ? daysAway : null
    }

    const expiringDriverDocs: { driver: any; docType: string; expiresOn: string; daysAway: number }[] = []
    for (const d of (drivers ?? []) as any[]) {
      const licDays = withinWindow(d.licence_expiry)
      if (licDays !== null) expiringDriverDocs.push({ driver: d, docType: 'Driving licence', expiresOn: d.licence_expiry, daysAway: licDays })
      const medDays = withinWindow(d.medical_expiry)
      if (medDays !== null) expiringDriverDocs.push({ driver: d, docType: 'Medical certificate', expiresOn: d.medical_expiry, daysAway: medDays })
    }

    if (expiringDriverDocs.length > 0) {
      const mgrs = await getOrgRecipients(org.id, true, false)
      const key = `driverdoc-${org.id}-${today}`
      for (const item of expiringDriverDocs) {
        const recipients = [...mgrs]
        if (item.driver.email) recipients.push({ email: item.driver.email, name: item.driver.full_name })
        for (const r of recipients) {
          const ok = await send('document-expiring', r.email, `${key}-${item.driver.id}-${item.docType}-${r.email}`, {
            recipientName: r.name, orgName: org.name,
            subjectLabel: `${item.docType} for ${item.driver.full_name}`,
            docType: item.docType, holderLabel: item.driver.full_name,
            expiresOn: item.expiresOn, daysAway: item.daysAway,
          })
          if (ok) sent++
        }
      }
    }
  } catch (e) {
    console.error('driver document expiry failed', e)
  }

  // 6. Fleet: tyres past their target replacement distance -> managers
  try {
    const { data: tyres } = await supabase
      .from('tyres')
      .select('id, machine_id, position, brand, target_replace_km, fitted_odo')
      .eq('organisation_id', org.id)
      .is('removed_at', null)
      .not('target_replace_km', 'is', null)
      .not('fitted_odo', 'is', null)

    const { data: machinesForOdo } = await supabase
      .from('machines')
      .select('id, current_odometer_km')
      .eq('organisation_id', org.id)
    const odoMap = new Map((machinesForOdo ?? []).map((m: any) => [m.id, m.current_odometer_km]))

    const overdueTyres = (tyres ?? []).filter((t: any) => {
      const odo = odoMap.get(t.machine_id)
      if (odo == null) return false
      return (Number(odo) - Number(t.fitted_odo)) >= Number(t.target_replace_km)
    })

    if (overdueTyres.length > 0) {
      const mgrs = await getOrgRecipients(org.id, true, false)
      const key = `tyre-${org.id}-${today}`
      for (const t of overdueTyres as any[]) {
        const vehicleLabel = machineMap.get(t.machine_id) ?? 'Vehicle'
        const rows = [
          { label: 'Vehicle', value: vehicleLabel },
          { label: 'Position', value: t.position },
          ...(t.brand ? [{ label: 'Brand', value: t.brand }] : []),
          { label: 'Target replace', value: `${t.target_replace_km} km` },
          { label: 'Current odometer', value: `${odoMap.get(t.machine_id)} km` },
        ]
        for (const r of mgrs) {
          const ok = await send('fleet-alert', r.email, `${key}-${t.id}-${r.email}`, {
            recipientName: r.name, orgName: org.name,
            emoji: '🛞', heading: `Tyre replacement due: ${vehicleLabel}`,
            message: 'A tyre on this vehicle has passed its target replacement distance.',
            rows,
          })
          if (ok) sent++
        }
      }
    }
  } catch (e) {
    console.error('tyre replacement check failed', e)
  }

  // 7. Fleet: trips overdue (planned end passed, still in progress) -> managers
  try {
    const { data: overdueTrips } = await supabase
      .from('trips')
      .select('id, machine_id, driver_id, end_at, purpose')
      .eq('organisation_id', org.id)
      .eq('status', 'in_progress')
      .not('end_at', 'is', null)
      .lt('end_at', new Date().toISOString())

    if (overdueTrips && overdueTrips.length > 0) {
      const mgrs = await getOrgRecipients(org.id, true, false)
      const driverIds = [...new Set(overdueTrips.map((t: any) => t.driver_id).filter(Boolean))]
      const { data: driversData } = driverIds.length
        ? await supabase.from('drivers').select('id, full_name').in('id', driverIds)
        : { data: [] }
      const driverNameMap = new Map((driversData ?? []).map((d: any) => [d.id, d.full_name]))
      const key = `tripoverdue-${org.id}-${today}`
      for (const t of overdueTrips as any[]) {
        const vehicleLabel = machineMap.get(t.machine_id) ?? 'Vehicle'
        const rows = [
          { label: 'Vehicle', value: vehicleLabel },
          { label: 'Driver', value: t.driver_id ? (driverNameMap.get(t.driver_id) ?? '—') : '—' },
          { label: 'Purpose', value: t.purpose ?? '—' },
          { label: 'Expected end', value: t.end_at },
        ]
        for (const r of mgrs) {
          const ok = await send('fleet-alert', r.email, `${key}-${t.id}-${r.email}`, {
            recipientName: r.name, orgName: org.name,
            emoji: '⏰', heading: `Trip overdue: ${vehicleLabel}`,
            message: 'This trip was expected to end but is still marked in progress.',
            rows,
          })
          if (ok) sent++
        }
      }
    }
  } catch (e) {
    console.error('trip overdue check failed', e)
  }

  // 8. Fleet: pre-start inspection not submitted today by an active vehicle -> managers
  try {
    const { data: templates } = await supabase
      .from('checklist_templates')
      .select('id')
      .eq('organisation_id', org.id)
      .eq('is_fleet_pre_start', true)
      .eq('status', 'approved')
    const templateIds = (templates ?? []).map((t: any) => t.id)

    if (templateIds.length > 0 && machineIds.length > 0) {
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)

      const { data: activeMachines } = await supabase
        .from('machines')
        .select('id, name')
        .eq('organisation_id', org.id)
        .eq('status', 'active')

      const { data: todaysExecs } = await supabase
        .from('checklist_executions')
        .select('machine_id')
        .in('template_id', templateIds)
        .gte('performed_at', startOfDay.toISOString())

      const submittedIds = new Set((todaysExecs ?? []).map((e: any) => e.machine_id))
      const missing = (activeMachines ?? []).filter((m: any) => !submittedIds.has(m.id))

      if (missing.length > 0) {
        const mgrs = await getOrgRecipients(org.id, true, false)
        const key = `inspectionmissing-${org.id}-${today}`
        for (const r of mgrs) {
          const ok = await send('fleet-alert', r.email, `${key}-${r.email}`, {
            recipientName: r.name, orgName: org.name,
            emoji: '📋', heading: `${missing.length} vehicle(s) missing today's pre-start inspection`,
            message: 'These active vehicles have not had a pre-start inspection submitted today.',
            rows: missing.map((m: any) => ({ label: 'Vehicle', value: m.name })),
          })
          if (ok) sent++
        }
      }
    }
  } catch (e) {
    console.error('inspection completion check failed', e)
  }

  // Log run
  await supabase.from('maintenance_email_runs').insert({
    organisation_id: org.id,
    due_soon_count: dueSoon.length,
    overdue_count: overdue.length,
    emails_sent: sent,
    sms_sent: smsSent,
    status: 'success',
  })

  return { dueSoon: dueSoon.length, overdue: overdue.length, sent, smsSent }
}

// This function iterates every organisation, reads across their fleet/maintenance
// data with a service-role client, and sends real emails — it must only run on
// a schedule (cron) or a trusted manual trigger, never on an arbitrary public
// request. verify_jwt is false here (so the cron invoker doesn't need a user
// session) — so this function does its own gate: either the shared cron
// secret (processes every org), or a logged-in owner/manager's session
// token self-triggering their own org only (the "Send now" button in
// Settings -> Notifications).
const CRON_SECRET = Deno.env.get('CRON_SECRET')

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET

  // Optionally allow targeting a single org for manual triggers
  let onlyOrgId: string | undefined
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      onlyOrgId = body?.organisation_id
    }
  } catch {
    // malformed body; fall through
  }

  if (!isCron) {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
    const claims = token ? parseJwtClaims(token) : null
    const userId = claims?.sub as string | undefined

    if (!userId || !onlyOrgId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('organisation_id', onlyOrgId)
      .in('role', ['owner', 'manager'])
      .maybeSingle()
    if (!role) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const { data: orgs, error } = await supabase
    .from('organisations')
    .select('id, name, notifications_enabled, notifications_system_inbox, notifications_lead_days, notifications_notify_managers, notifications_notify_technicians, notifications_notify_engineers, maintenance_alerts_sms_enabled')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const targetOrgs = (orgs ?? []).filter((o: any) => !onlyOrgId || o.id === onlyOrgId) as Org[]
  const results: any[] = []

  // Process organizations in concurrent batches of 5 to stay well within Deno execution limits
  const BATCH_SIZE = 5
  for (let i = 0; i < targetOrgs.length; i += BATCH_SIZE) {
    const batch = targetOrgs.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (org) => {
        try {
          const r = await processOrg(org)
          return { org: org.name, ...r }
        } catch (e) {
          console.error('org failed', org.id, e)
          await supabase.from('maintenance_email_runs').insert({
            organisation_id: org.id,
            status: 'error',
            error_message: String((e as Error).message ?? e),
          })
          return { org: org.name, error: String((e as Error).message ?? e) }
        }
      })
    )

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        results.push(res.value)
      } else {
        results.push({ error: String(res.reason) })
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
