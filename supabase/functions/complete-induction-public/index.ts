// Finalizes a self-service QR induction: uploads the digital signature to
// Storage and marks the record completed. Called anonymously (no login),
// so verify_jwt = false — but every action here is still gated by looking
// up the record and its programme's qr_self_service_enabled flag with a
// service-role client before doing anything, the same trust model as the
// start_induction_public/submit_induction_quiz_public RPCs.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  let recordId: string
  let signaturePngBase64: string
  try {
    const body = await req.json()
    recordId = body.recordId || body.record_id
    signaturePngBase64 = body.signaturePngBase64 || body.signature_png_base64
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!recordId || !signaturePngBase64) {
    return new Response(JSON.stringify({ error: 'recordId and signaturePngBase64 are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: record, error: recordError } = await supabase
    .from('induction_records')
    .select('id, organisation_id, status, programme_id, induction_programmes(is_active, qr_self_service_enabled)')
    .eq('id', recordId)
    .maybeSingle()

  if (recordError) {
    return new Response(JSON.stringify({ error: recordError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const programme = record?.induction_programmes as unknown as
    | { is_active: boolean; qr_self_service_enabled: boolean }
    | null

  if (!record || !programme?.is_active || !programme?.qr_self_service_enabled) {
    return new Response(JSON.stringify({ error: 'Record not available for self-service completion' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (record.status === 'completed') {
    return new Response(JSON.stringify({ error: 'This induction has already been completed' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: rateLimitError } = await supabase.rpc('enforce_rate_limit', {
    _bucket: `induction_complete:${recordId}`,
    _max_count: 5,
    _window_minutes: 15,
  })
  if (rateLimitError) {
    return new Response(JSON.stringify({ error: 'Too many attempts — please wait a few minutes and try again' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const path = `${record.organisation_id}/signatures/${recordId}.png`
  const { error: uploadError } = await supabase.storage
    .from('induction-assets')
    .upload(path, base64ToBytes(signaturePngBase64), { contentType: 'image/png', upsert: true })

  if (uploadError) {
    console.error('signature upload failed', uploadError)
    return new Response(JSON.stringify({ error: 'Failed to upload signature' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: signed } = await supabase.storage
    .from('induction-assets')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  const { data: results } = await supabase
    .from('induction_module_results')
    .select('score_percent')
    .eq('induction_record_id', recordId)

  const scores = (results ?? []).map((r) => Number(r.score_percent ?? 0))
  const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100

  const { error: updateError } = await supabase
    .from('induction_records')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_score_percent: overall,
      digital_signature_url: signed?.signedUrl ?? path,
    })
    .eq('id', recordId)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, overall_score_percent: overall }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
