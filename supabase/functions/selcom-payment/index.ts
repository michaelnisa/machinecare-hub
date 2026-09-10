// Supabase Edge Function: Selcom Payment Gateway
// Handles: Mobile Money USSD Push (C2B), Checkout Orders, Status Polling, and Webhook Notifications
// Base API: https://apigw.selcommobile.com/v1

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Formats phone to Tanzania international E.164 (255XXXXXXXXX)
function formatTanzaniaPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("255") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "255" + digits.slice(1);
  if (digits.length === 9) return "255" + digits;
  return digits;
}

// Detect carrier network
export function detectCarrier(phone: string): "mpesa" | "tigopesa" | "airtel" | "halopesa" | "selcom_mobile" {
  const p = formatTanzaniaPhone(phone);
  if (!p.startsWith("255")) return "selcom_mobile";
  const prefix = p.substring(3, 5); // 255 7X...
  if (["74", "75", "76"].includes(prefix)) return "mpesa";
  if (["71", "65", "67", "77"].includes(prefix)) return "tigopesa";
  if (["78", "79", "68", "69"].includes(prefix)) return "airtel";
  if (["62", "61"].includes(prefix)) return "halopesa";
  return "selcom_mobile";
}

// Compute HMAC-SHA256 signature required by Selcom API
async function computeSelcomDigest(dataStr: string, apiSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(dataStr));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { action, order_id } = body;

    // 1. TEST CONNECTION
    if (action === "test_connection") {
      const { vendor_id, api_key, api_secret, is_sandbox } = body;
      if (!vendor_id || !api_key || !api_secret) {
        return new Response(
          JSON.stringify({ success: false, message: "Vendor ID, API Key, and API Secret are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If in sandbox mode without real live credentials, return verified simulated connection
      if (is_sandbox && (api_key.includes("test") || api_key.includes("demo") || vendor_id.includes("test"))) {
        return new Response(
          JSON.stringify({ success: true, message: "Selcom Sandbox Gateway connected successfully (Simulation Mode active)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const timestamp = new Date().toISOString();
        const authHeader = `SELCOM ${btoa(api_key)}`;
        const digest = await computeSelcomDigest(`timestamp=${timestamp}`, api_secret);

        const res = await fetch("https://apigw.selcommobile.com/v1/checkout/order-status?order_id=test-ping", {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Digest-Method": "HS256",
            "Digest": digest,
            "Timestamp": timestamp,
            "Accept": "application/json"
          }
        });

        // Selcom returns 404 for test-ping order but 200/401 tells us if authentication worked
        if (res.status === 401 || res.status === 403) {
          return new Response(
            JSON.stringify({ success: false, message: "Selcom Authentication Failed. Check your Vendor ID, API Key, or Secret." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Selcom Gateway credentials verified successfully!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: "Connection error: " + err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. CREATE PAYMENT ORDER (USSD PUSH OR CHECKOUT LINK)
    if (action === "create_order") {
      const {
        organisation_id,
        invoice_id,
        job_id,
        amount,
        phone_number,
        customer_name,
        customer_email,
        notes,
        initiated_by
      } = body;

      if (!organisation_id || !amount || !phone_number) {
        return new Response(
          JSON.stringify({ success: false, message: "organisation_id, amount, and phone_number are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch organization gateway config
      const { data: org, error: orgErr } = await supabase
        .from("organisations")
        .select("selcom_enabled, selcom_vendor_id, selcom_api_key, selcom_api_secret, selcom_is_sandbox")
        .eq("id", organisation_id)
        .single();

      if (orgErr || !org) {
        return new Response(
          JSON.stringify({ success: false, message: "Organisation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = formatTanzaniaPhone(phone_number);
      const carrier = detectCarrier(formattedPhone);
      const orderId = `MC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Save initial transaction record
      const { data: txn, error: txnErr } = await supabase
        .from("garage_payment_transactions")
        .insert({
          organisation_id,
          invoice_id: invoice_id || null,
          job_id: job_id || null,
          gateway: "selcom",
          order_id: orderId,
          phone_number: formattedPhone,
          channel: "ussd_push",
          payment_method: carrier,
          amount,
          currency: "TZS",
          status: "pending",
          initiated_by: initiated_by || null,
          raw_request: { phone: formattedPhone, amount, customer_name, customer_email, notes }
        })
        .select()
        .single();

      if (txnErr) {
        return new Response(
          JSON.stringify({ success: false, message: "Failed to create transaction record: " + txnErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isDemoMode = org.selcom_is_sandbox || !org.selcom_api_key || org.selcom_api_key.includes("test");

      if (isDemoMode) {
        // Sandbox Simulation Mode
        return new Response(
          JSON.stringify({
            success: true,
            order_id: orderId,
            status: "pending",
            carrier,
            phone_number: formattedPhone,
            is_simulation: true,
            message: `USSD PIN prompt sent to ${formattedPhone} (${carrier.toUpperCase()}). Please enter PIN on phone.`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Live Selcom C2B USSD Push
      try {
        const timestamp = new Date().toISOString();
        const payload = {
          vendor: org.selcom_vendor_id,
          order_id: orderId,
          buyer_email: customer_email || "billing@machinecare.co.tz",
          buyer_name: customer_name || "Valued Customer",
          buyer_phone: formattedPhone,
          amount: Number(amount),
          currency: "TZS",
          no_of_items: 1,
          webhook: `${supabaseUrl}/functions/v1/selcom-payment?action=webhook`
        };

        const payloadStr = JSON.stringify(payload);
        const authHeader = `SELCOM ${btoa(org.selcom_api_key)}`;
        const digest = await computeSelcomDigest(payloadStr, org.selcom_api_secret);

        const selcomRes = await fetch("https://apigw.selcommobile.com/v1/checkout/create-order-minimal", {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Digest-Method": "HS256",
            "Digest": digest,
            "Timestamp": timestamp,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: payloadStr
        });

        const selcomData = await selcomRes.json();

        await supabase
          .from("garage_payment_transactions")
          .update({
            raw_response: selcomData,
            trans_id: selcomData?.reference || selcomData?.transid || null,
            result_code: selcomData?.resultcode || String(selcomRes.status),
            result_message: selcomData?.message || null,
            status: selcomRes.ok && selcomData?.result === "SUCCESS" ? "pending" : "failed"
          })
          .eq("id", txn.id);

        return new Response(
          JSON.stringify({
            success: selcomRes.ok,
            order_id: orderId,
            carrier,
            phone_number: formattedPhone,
            selcom_response: selcomData,
            message: `USSD PIN prompt dispatched to ${formattedPhone}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (selcomErr: any) {
        await supabase
          .from("garage_payment_transactions")
          .update({
            status: "failed",
            result_message: selcomErr.message
          })
          .eq("id", txn.id);

        return new Response(
          JSON.stringify({ success: false, message: "Selcom Gateway request failed: " + selcomErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. CHECK ORDER STATUS
    if (action === "check_status") {
      if (!order_id) {
        return new Response(
          JSON.stringify({ success: false, message: "order_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: txn, error: txnErr } = await supabase
        .from("garage_payment_transactions")
        .select("*")
        .eq("order_id", order_id)
        .single();

      if (txnErr || !txn) {
        return new Response(
          JSON.stringify({ success: false, message: "Transaction not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (txn.status === "completed") {
        return new Response(
          JSON.stringify({ success: true, status: "completed", order_id, transaction: txn }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If transaction is pending in live mode, poll Selcom
      const { data: org } = await supabase
        .from("organisations")
        .select("selcom_vendor_id, selcom_api_key, selcom_api_secret, selcom_is_sandbox")
        .eq("id", txn.organisation_id)
        .single();

      if (org && !org.selcom_is_sandbox && org.selcom_api_key) {
        try {
          const timestamp = new Date().toISOString();
          const authHeader = `SELCOM ${btoa(org.selcom_api_key)}`;
          const digest = await computeSelcomDigest(`order_id=${order_id}`, org.selcom_api_secret);

          const res = await fetch(`https://apigw.selcommobile.com/v1/checkout/order-status?order_id=${order_id}`, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Digest-Method": "HS256",
              "Digest": digest,
              "Timestamp": timestamp,
              "Accept": "application/json"
            }
          });

          const data = await res.json();
          if (data?.data?.[0]?.payment_status === "COMPLETED" || data?.result === "SUCCESS") {
            // Complete transaction via RPC
            const { data: rpcRes } = await supabase.rpc("complete_selcom_payment", {
              p_order_id: order_id,
              p_trans_id: data.data?.[0]?.transid || null,
              p_reference: data.data?.[0]?.reference || null,
              p_notes: `Selcom verification: ${data.data?.[0]?.payment_status || "COMPLETED"}`
            });

            return new Response(
              JSON.stringify({ success: true, status: "completed", rpc: rpcRes }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.error("Selcom order status polling failed:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, status: txn.status, order_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. SIMULATE APPROVAL (SANDBOX DEMO HELPER)
    if (action === "simulate_approval") {
      if (!order_id) {
        return new Response(
          JSON.stringify({ success: false, message: "order_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mockTransId = `SELCOM-TX-${Math.floor(100000 + Math.random() * 900000)}`;
      const mockRef = `MPESA-REF-${Math.floor(100000 + Math.random() * 900000)}`;

      const { data: rpcRes, error: rpcErr } = await supabase.rpc("complete_selcom_payment", {
        p_order_id: order_id,
        p_trans_id: mockTransId,
        p_reference: mockRef,
        p_notes: "Simulated Sandbox Mobile Money PIN Approval"
      });

      if (rpcErr) {
        return new Response(
          JSON.stringify({ success: false, message: rpcErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: "completed", rpc: rpcRes, mockTransId, mockRef }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. WEBHOOK CALLBACK RECEIVER (IPN)
    if (action === "webhook" || req.method === "POST" && body?.resultcode) {
      const webhookOrderId = body.order_id;
      const transId = body.transid || body.reference;
      const resultCode = body.resultcode;

      if (webhookOrderId && (resultCode === "000" || body.result === "SUCCESS")) {
        await supabase.rpc("complete_selcom_payment", {
          p_order_id: webhookOrderId,
          p_trans_id: transId,
          p_reference: body.reference,
          p_notes: `Selcom IPN Webhook confirmation: ${resultCode}`
        });

        return new Response(
          JSON.stringify({ result: "SUCCESS", message: "Webhook processed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ result: "RECEIVED", message: "Webhook acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
