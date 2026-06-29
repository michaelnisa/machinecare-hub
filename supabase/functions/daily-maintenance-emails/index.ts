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
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

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

async function getOrgRecipients(orgId: string, includeManagers: boolean, includeEngineers: boolean) {
  // Pull profiles in org, then look up auth emails for them.
  const roles: string[] = []
  if (includeManagers) roles.push('owner', 'manager')
  if (includeEngineers) roles.push('engineer')
  if (roles.length === 0) return []

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('organisation_id', orgId)
    .in('role', roles)

  if (!profs?.length) return []
  const out: { email: string; name: string }[] = []
  for (const p of profs) {
    const { data: u } = await supabase.auth.admin.getUserById(p.id)
    if (u?.user?.email) out.push({ email: u.user.email, name: p.full_name ?? u.user.email })
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
  if (!org.notifications_enabled) return { dueSoon: 0, overdue: 0, sent: 0 }
  const today = new Date().toISOString().slice(0, 10)
  const lead = new Date(); lead.setDate(lead.getDate() + (org.notifications_lead_days ?? 8))
  const leadDate = lead.toISOString().slice(0, 10)

  // Service schedules: due soon (today < next_due_date <= today+lead) and overdue
  const { data: machines } = await supabase
    .from('machines').select('id, name').eq('organisation_id', org.id)
  const machineMap = new Map((machines ?? []).map(m => [m.id, m.name]))
  const machineIds = (machines ?? []).map(m => m.id)

  let dueSoon: { machine: string; name: string; due: string }[] = []
  let overdue: { machine: string; name: string; due: string }[] = []

  if (machineIds.length) {
    const { data: schedules } = await supabase
      .from('service_schedules')
      .select('machine_id, name, next_due_date')
      .in('machine_id', machineIds)
      .not('next_due_date', 'is', null)

    for (const s of schedules ?? []) {
      const mname = machineMap.get(s.machine_id) ?? 'Machine'
      const due = s.next_due_date as string
      if (due < today) overdue.push({ machine: mname, name: s.name, due })
      else if (due <= leadDate) dueSoon.push({ machine: mname, name: s.name, due })
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

  // Log run
  await supabase.from('maintenance_email_runs').insert({
    organisation_id: org.id,
    due_soon_count: dueSoon.length,
    overdue_count: overdue.length,
    emails_sent: sent,
    status: 'success',
  })

  return { dueSoon: dueSoon.length, overdue: overdue.length, sent }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Optionally allow targeting a single org for manual triggers
  let onlyOrgId: string | undefined
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      onlyOrgId = body?.organisation_id
    }
  } catch {}

  const { data: orgs, error } = await supabase
    .from('organisations')
    .select('id, name, notifications_enabled, notifications_system_inbox, notifications_lead_days, notifications_notify_managers, notifications_notify_technicians, notifications_notify_engineers')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const results: any[] = []
  for (const org of (orgs ?? []) as Org[]) {
    if (onlyOrgId && org.id !== onlyOrgId) continue
    try {
      const r = await processOrg(org)
      results.push({ org: org.name, ...r })
    } catch (e) {
      console.error('org failed', org.id, e)
      await supabase.from('maintenance_email_runs').insert({
        organisation_id: org.id, status: 'error', error_message: String((e as Error).message ?? e),
      })
      results.push({ org: org.name, error: String((e as Error).message ?? e) })
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
