import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_PHONE = '+255764190999'

async function sendSms(to: string, message: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, message }),
    })
    const text = await res.text()
    if (!res.ok) console.error('send-sms failed', to, text)
    return { ok: res.ok, detail: `HTTP ${res.status}: ${text}` }
  } catch (e) {
    console.error('send-sms threw', e)
    return { ok: false, detail: `threw: ${(e as Error)?.message ?? e}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    const { name, contact, company, industry } = body

    if (!name || !contact || !company) {
      return new Response(JSON.stringify({ error: 'name, contact, company are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const smsMessage = `New MachineCare Request!\nName: ${name}\nCompany: ${company}\nContact: ${contact}\nIndustry: ${industry || 'N/A'}`

    console.log(`Sending onboarding request SMS to ${ADMIN_PHONE}...`)
    const result = await sendSms(ADMIN_PHONE, smsMessage)

    return new Response(JSON.stringify({ success: result.ok, detail: result.detail }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error handling onboarding request SMS:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
