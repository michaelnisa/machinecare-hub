// Sends an SMS via Africa's Talking (https://africastalking.com). Server-to-server
// only — every caller in this codebase is an edge function passing its own
// service-role key, exactly like send-transactional-email's trust model.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AT_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME')
const AT_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY')
const AT_SENDER_ID = Deno.env.get('AFRICASTALKING_SENDER_ID')

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

function toTanzaniaE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('255')) return `+${digits}`
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`
  return `+255${digits}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
  const isServiceRole = token === SERVICE_KEY || parseJwtClaims(token ?? '')?.role === 'service_role'
  if (!isServiceRole) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let to: string
  let message: string
  try {
    const body = await req.json()
    to = body.to
    message = body.message
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!to || !message) {
    return new Response(JSON.stringify({ error: 'to and message are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  to = toTanzaniaE164(to)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  if (!AT_USERNAME || !AT_API_KEY) {
    await supabase.from('sms_send_log').insert({
      provider: 'africastalking', recipient_phone: to, message, status: 'failed',
      error_message: 'AFRICASTALKING_USERNAME / AFRICASTALKING_API_KEY not configured',
    })
    return new Response(JSON.stringify({ ok: false, error: 'SMS is not configured for this project' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = AT_USERNAME === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'

  // Attempt 1: With AT_SENDER_ID if configured
  let form = new URLSearchParams({ username: AT_USERNAME, to, message })
  if (AT_SENDER_ID) form.set('from', AT_SENDER_ID)

  try {
    let atRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        apiKey: AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    })

    let payload = await atRes.json().catch(() => null)
    let recipient = payload?.SMSMessageData?.Recipients?.[0]
    let ok = atRes.ok && recipient?.status === 'Success'

    // Fallback: If failed with custom AT_SENDER_ID, retry without sender ID
    if (!ok && AT_SENDER_ID) {
      console.log("Sender ID attempt failed, retrying without custom AT_SENDER_ID...")
      const fallbackForm = new URLSearchParams({ username: AT_USERNAME, to, message })
      atRes = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          apiKey: AT_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: fallbackForm.toString(),
      })
      payload = await atRes.json().catch(() => null)
      recipient = payload?.SMSMessageData?.Recipients?.[0]
      ok = atRes.ok && recipient?.status === 'Success'
    }

    await supabase.from('sms_send_log').insert({
      provider: 'africastalking',
      recipient_phone: to,
      message,
      status: ok ? 'sent' : 'failed',
      error_message: ok ? null : (recipient?.status ?? payload?.SMSMessageData?.Message ?? `HTTP ${atRes.status}`),
      metadata: payload ?? null,
    })

    if (!ok) {
      console.error('Africa\'s Talking send failed', payload ?? atRes.status)
      return new Response(JSON.stringify({ ok: false, error: recipient?.status || 'SMS send failed', detail: payload }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, messageId: recipient?.messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Africa\'s Talking request threw', e)
    await supabase.from('sms_send_log').insert({
      provider: 'africastalking', recipient_phone: to, message, status: 'failed',
      error_message: String((e as Error).message ?? e),
    })
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
