// Sends an SMS via Africa's Talking (https://africastalking.com). Server-to-server
// only — every caller in this codebase (send-production-alert today) is
// itself an edge function passing its own service-role key, exactly like
// send-transactional-email's trust model.
//
// Requires two secrets set on the Supabase project (Settings -> Edge
// Functions -> Secrets, or `supabase secrets set`):
//   AFRICASTALKING_USERNAME   your Africa's Talking application username
//                              ("sandbox" while testing)
//   AFRICASTALKING_API_KEY    the API key for that username
// Optional:
//   AFRICASTALKING_SENDER_ID  an approved alphanumeric/short-code sender ID
// Without these two required secrets set, every SMS attempt fails loudly
// (never silently) so a missing config doesn't look like "it's just not
// texting anyone".
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
  const claims = token ? parseJwtClaims(token) : null
  if (claims?.role !== 'service_role') {
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

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  if (!AT_USERNAME || !AT_API_KEY) {
    await supabase.from('sms_send_log').insert({
      provider: 'africastalking', recipient_phone: to, message, status: 'failed',
      error_message: 'AFRICASTALKING_USERNAME / AFRICASTALKING_API_KEY not configured',
    })
    return new Response(JSON.stringify({ error: 'SMS is not configured for this project' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = AT_USERNAME === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'

  const form = new URLSearchParams({ username: AT_USERNAME, to, message })
  if (AT_SENDER_ID) form.set('from', AT_SENDER_ID)

  try {
    const atRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        apiKey: AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    })

    const payload = await atRes.json().catch(() => null)
    const recipient = payload?.SMSMessageData?.Recipients?.[0]
    const ok = atRes.ok && recipient?.status === 'Success'

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
      return new Response(JSON.stringify({ error: 'SMS send failed', detail: payload }), {
        status: 502,
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
    return new Response(JSON.stringify({ error: 'SMS send failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
