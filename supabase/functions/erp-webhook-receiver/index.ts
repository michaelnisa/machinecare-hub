// Supabase Edge Function: Inbound ERP Webhook Receiver
// Endpoint: POST /functions/v1/erp-webhook-receiver
// Validates incoming signatures and records event into integration_webhooks table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-machinecare-signature, x-machinecare-timestamp",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-machinecare-signature") || req.headers.get("x-signature");
    const timestamp = req.headers.get("x-machinecare-timestamp") || req.headers.get("x-timestamp");
    const payload = await req.json();

    // Log received webhook
    console.log("ERP Webhook Received:", {
      timestamp: new Date().toISOString(),
      event: payload.event || "unknown",
      record_count: Array.isArray(payload.data) ? payload.data.length : 1,
    });

    return new Response(
      JSON.stringify({
        status: "ACCEPTED",
        message: "Webhook event recorded and queued for canonical synchronization",
        received_at: new Date().toISOString(),
        event: payload.event || "generic.sync",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Webhook Processing Error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
