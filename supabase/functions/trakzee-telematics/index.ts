// Supabase Edge Function: Trakzee Telematics & Live GPS Fleet Sync
// Bridges MachineCare with Trakzee Webservice API for Logistixwave Tanzania Limited

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrakzeeVehicleData {
  Vehicle_Name?: string;
  Vehicle_No?: string;
  Company?: string;
  Latitude?: string;
  Longitude?: string;
  GPS?: string;
  Speed?: string;
  Imeino?: string;
  Odometer?: string;
  IGN?: string;
  Status?: string;
  battery_percentage?: number;
  ExternalVolt?: string;
  DeviceModel?: string;
  GPSActualTime?: string;
  Datetime?: string;
  Angle?: string;
  [key: string]: any;
}

// Helper to clean plate numbers (e.g. "T 123 ABC" -> "T123ABC")
function normalizePlate(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/[\s\-_]/g, "").toUpperCase();
}

// Convert raw odometer to km (Trakzee can report in meters or km depending on device profile)
function parseOdometerKm(rawOdo: string | number | undefined): number | null {
  if (rawOdo === undefined || rawOdo === null || rawOdo === "--" || rawOdo === "") return null;
  const num = Number(rawOdo);
  if (isNaN(num) || num <= 0) return null;
  // If reading is greater than 5,000,000 it is usually in meters (e.g. 9050007 m = 9,050.007 km)
  if (num > 5000000) {
    return Math.round(num / 1000);
  }
  return Math.round(num);
}

// Safely parse JSON from a response that might return HTML on 502/504 errors
async function safeParseJson(res: Response): Promise<{ ok: boolean; data?: any; rawText?: string }> {
  try {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch {
      return { ok: false, rawText: text.substring(0, 300) };
    }
  } catch (err: any) {
    return { ok: false, rawText: err?.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON request body" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = body.action || "sync_fleet";

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: Test Connection
    // ─────────────────────────────────────────────────────────────
    if (action === "test_connection") {
      const serverUrl = (body.server_url || "http://165.22.222.196/webservice").replace(/\/+$/, "");
      const username = body.username?.trim();
      const password = body.password?.trim();

      if (!username || !password) {
        return new Response(
          JSON.stringify({ success: false, error: "Username and password are required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginUrl = `${serverUrl}?token=generateAccessToken`;
      let loginRes: Response;
      try {
        loginRes = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });
      } catch (netErr: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Could not reach Trakzee server at ${serverUrl} (${netErr?.message || "Connection timed out"}). Please verify the IP / server URL is accessible.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const parsed = await safeParseJson(loginRes);
      if (!parsed.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Server at ${serverUrl} returned non-JSON response (HTTP ${loginRes.status}). Verify URL endpoint.`,
            preview: parsed.rawText,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginData = parsed.data;
      const token = loginData?.data?.token;

      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: loginData?.message || loginData?.error || "Invalid credentials or failed to generate token from Trakzee",
            raw: loginData,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Successfully connected to Trakzee! Access token generated.",
          token_preview: token.substring(0, 16) + "...",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: Sync Fleet Telematics
    // ─────────────────────────────────────────────────────────────
    if (action === "sync_fleet") {
      const orgId = body.organisation_id;
      if (!orgId) {
        return new Response(
          JSON.stringify({ success: false, error: "organisation_id is required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Fetch organization settings
      const { data: org, error: orgErr } = await supabase
        .from("organisations")
        .select("id, name, trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id")
        .eq("id", orgId)
        .maybeSingle();

      if (orgErr || !org) {
        return new Response(
          JSON.stringify({ success: false, error: "Organisation not found or database query failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serverUrl = (body.server_url || org.trakzee_server_url || "http://165.22.222.196/webservice").replace(/\/+$/, "");
      const username = body.username?.trim() || org.trakzee_username?.trim();
      const password = body.password?.trim() || org.trakzee_password?.trim();
      const companyName = body.company_name?.trim() || org.trakzee_company_name?.trim() || org.name || "Logistixwave Tanzania";
      const projectId = body.project_id?.trim() || org.trakzee_project_id?.trim() || "37";

      if (!username || !password) {
        return new Response(
          JSON.stringify({ success: false, error: "Trakzee credentials not configured for this organisation. Go to Settings > Trakzee Telematics." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Fetch active vehicles for this organisation in MachineCare
      const { data: machines, error: mErr } = await supabase
        .from("machines")
        .select("id, name, plate_number, telematics_imei, current_odometer_km, current_hours, status, notes")
        .eq("organisation_id", orgId);

      if (mErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Error loading vehicles: ${mErr.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Collect plate numbers and IMEIs
      const plateList = (machines || [])
        .map((m) => m.plate_number?.trim())
        .filter(Boolean) as string[];

      const imeiList = (machines || [])
        .map((m) => m.telematics_imei?.trim())
        .filter(Boolean) as string[];

      // 3. Step-1: Authenticate with Trakzee
      const loginUrl = `${serverUrl}?token=generateAccessToken`;
      let loginRes: Response;
      try {
        loginRes = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (netErr: any) {
        return new Response(
          JSON.stringify({ success: false, error: `Trakzee login timeout or unreachable: ${netErr?.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginParsed = await safeParseJson(loginRes);
      if (!loginParsed.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid server response during authentication (HTTP ${loginRes.status})` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = loginParsed.data?.data?.token;
      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: loginParsed.data?.message || loginParsed.data?.error || "Could not generate Trakzee token (invalid credentials)",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Step-2: Fetch Live Telemetry Data
      const liveDataUrl = `${serverUrl}?token=getTokenBaseLiveData&ProjectId=${encodeURIComponent(projectId)}`;
      const requestPayload: any = {
        company_names: companyName,
        format: "json",
      };

      if (plateList.length > 0) requestPayload.vehicle_nos = plateList.join(", ");
      if (imeiList.length > 0) requestPayload.imei_nos = imeiList.join(", ");

      let liveRes: Response;
      try {
        liveRes = await fetch(liveDataUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-code": token,
          },
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(20000),
        });
      } catch (netErr: any) {
        return new Response(
          JSON.stringify({ success: false, error: `Telemetry request timeout: ${netErr?.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const liveParsed = await safeParseJson(liveRes);
      if (!liveParsed.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid telematics response (HTTP ${liveRes.status})` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const liveData = liveParsed.data;
      const vehicleList: TrakzeeVehicleData[] =
        liveData?.root?.VehicleData ||
        liveData?.VehicleData ||
        (Array.isArray(liveData) ? liveData : []);

      // 5. Match and update vehicles in Supabase
      let updatedCount = 0;
      const syncLogs: any[] = [];

      for (const tVehicle of vehicleList) {
        const rawPlate = tVehicle.Vehicle_No || tVehicle.Vehicle_Name;
        const normPlate = normalizePlate(rawPlate);
        const imei = tVehicle.Imeino?.trim();

        // Match against existing machine in this org
        const match = (machines || []).find((m) => {
          if (imei && m.telematics_imei && m.telematics_imei.trim() === imei) return true;
          if (normPlate && m.plate_number && normalizePlate(m.plate_number) === normPlate) return true;
          return false;
        });

        if (!match) continue;

        const odoKm = parseOdometerKm(tVehicle.Odometer);
        const speed = tVehicle.Speed !== undefined && tVehicle.Speed !== "--" ? Number(tVehicle.Speed) : 0;
        const lat = tVehicle.Latitude && tVehicle.Latitude !== "--" ? Number(tVehicle.Latitude) : null;
        const lng = tVehicle.Longitude && tVehicle.Longitude !== "--" ? Number(tVehicle.Longitude) : null;
        const ign = tVehicle.IGN === "ON";
        const volt = tVehicle.ExternalVolt && tVehicle.ExternalVolt !== "--" ? Number(tVehicle.ExternalVolt) : null;

        const updatePayload: any = {
          telematics_speed: speed,
          telematics_ignition: ign,
          telematics_battery_volt: volt,
          telematics_latitude: lat,
          telematics_longitude: lng,
          telematics_last_at: new Date().toISOString(),
          telematics_raw: tVehicle,
        };

        if (imei && !match.telematics_imei) {
          updatePayload.telematics_imei = imei;
        }

        // Only update odometer if valid and >= current
        if (odoKm !== null && odoKm > 0) {
          if (!match.current_odometer_km || odoKm >= match.current_odometer_km) {
            updatePayload.current_odometer_km = odoKm;
          }
        }

        // Attempt full update
        const { error: updErr } = await supabase
          .from("machines")
          .update(updatePayload)
          .eq("id", match.id);

        if (!updErr) {
          updatedCount++;
          syncLogs.push({
            machine_id: match.id,
            plate: match.plate_number,
            odometer_km: odoKm ?? match.current_odometer_km,
            speed,
            status: tVehicle.Status,
          });
        } else {
          // Fallback: If schema cache does not have new telematics columns yet,
          // update core fields (odometer) and append telematics into notes
          console.warn("Full telematics update failed, falling back to safe columns:", updErr.message);
          const safePayload: any = {};
          if (odoKm !== null && odoKm > 0) {
            safePayload.current_odometer_km = odoKm;
          }
          try {
            const existingNotes = match.notes || "";
            const telematicsSnippet = `[GPS: ${lat?.toFixed(4)}, ${lng?.toFixed(4)} | Speed: ${speed}km/h | Status: ${tVehicle.Status} | Updated: ${new Date().toISOString()}]`;
            safePayload.notes = existingNotes.includes("[GPS:")
              ? existingNotes.replace(/\[GPS:.*?\]/g, telematicsSnippet)
              : `${existingNotes}\n${telematicsSnippet}`.trim();
          } catch (_) {}

          const { error: fallbackErr } = await supabase
            .from("machines")
            .update(safePayload)
            .eq("id", match.id);

          if (!fallbackErr) {
            updatedCount++;
            syncLogs.push({
              machine_id: match.id,
              plate: match.plate_number,
              odometer_km: odoKm ?? match.current_odometer_km,
              speed,
              status: tVehicle.Status,
              fallback: true,
            });
          }
        }
      }

      // Update last synced timestamp on organisation
      try {
        await supabase
          .from("organisations")
          .update({ trakzee_last_synced_at: new Date().toISOString() })
          .eq("id", orgId);
      } catch (_) {}

      return new Response(
        JSON.stringify({
          success: true,
          vehicles_returned: vehicleList.length,
          vehicles_updated: updatedCount,
          last_synced_at: new Date().toISOString(),
          details: syncLogs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
