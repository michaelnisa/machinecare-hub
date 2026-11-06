// Supabase Edge Function: Trakzee Telematics & Live GPS Fleet Sync
// Bridges MachineCare with Trakzee Webservice API for Logistixwave Tanzania Limited
// Security Hardened: HTTPS Auto-probe, 30s Cooldown Rate-limiting, Input Sanitization

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

// Sanitize alphanumeric / standard symbols to prevent injection
function sanitizeString(str: string | null | undefined, maxLen = 120): string {
  if (!str) return "";
  return str.replace(/[\r\n\t\0<>"']/g, "").trim().substring(0, maxLen);
}

// Clean plate numbers (e.g. "T 123 ABC" -> "T123ABC")
function normalizePlate(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/[\s\-_]/g, "").toUpperCase();
}

// Convert raw odometer to km (Trakzee can report in meters or km depending on device profile)
function parseOdometerKm(rawOdo: string | number | undefined): number | null {
  if (rawOdo === undefined || rawOdo === null || rawOdo === "--" || rawOdo === "") return null;
  const num = Number(rawOdo);
  if (isNaN(num) || num <= 0) return null;
  // If reading is greater than 1,000,000 it is reported in meters (e.g. 9050007 m = 9,050 km)
  if (num > 1000000) {
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

// Attempt HTTPS upgrade if URL is HTTP
async function resolveBestServerUrl(rawUrl: string): Promise<{ url: string; isHttps: boolean }> {
  let url = rawUrl.replace(/\/+$/, "");
  if (url.startsWith("https://")) {
    return { url, isHttps: true };
  }

  // If HTTP, probe HTTPS first
  if (url.startsWith("http://")) {
    const httpsCandidate = url.replace("http://", "https://");
    try {
      const probe = await fetch(`${httpsCandidate}?token=probe`, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      });
      if (probe.status < 500) {
        return { url: httpsCandidate, isHttps: true };
      }
    } catch (_) {
      // Fallback to plain HTTP if HTTPS is not running
    }
  }

  return { url, isHttps: url.startsWith("https://") };
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
      const rawServerUrl = sanitizeString(body.server_url || "https://trakzee.uffizio.com/webservice", 200);
      const username = sanitizeString(body.username || "mdhfrancis@gmail.com");
      const password = body.password ? String(body.password).trim() : "";

      if (!username || !password) {
        return new Response(
          JSON.stringify({ success: false, error: "Username and password are required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { url: serverUrl, isHttps } = await resolveBestServerUrl(rawServerUrl);
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
          JSON.stringify({
            success: false,
            error: `Could not reach Trakzee server at ${serverUrl} (${netErr?.message || "Connection timed out"}). Verify IP and connectivity.`,
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
          message: `Connected to Trakzee API! (${isHttps ? "Secure HTTPS" : "HTTP link verified"})`,
          token_preview: token.substring(0, 16) + "...",
          is_https: isHttps,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: Sync Fleet Telematics (with 30s Cooldown Protection)
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
        .select("id, name, trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id, trakzee_last_synced_at")
        .eq("id", orgId)
        .maybeSingle();

      if (orgErr || !org) {
        return new Response(
          JSON.stringify({ success: false, error: "Organisation not found or database query failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Cooldown rate-limit (30 seconds minimum between syncs)
      if (org.trakzee_last_synced_at) {
        const lastSync = new Date(org.trakzee_last_synced_at).getTime();
        const now = Date.now();
        const diffSeconds = (now - lastSync) / 1000;
        if (diffSeconds < 30) {
          const waitTime = Math.ceil(30 - diffSeconds);
          return new Response(
            JSON.stringify({
              success: false,
              rate_limited: true,
              error: `Sync rate limit: Fleet was synced recently. Please wait ${waitTime}s before refreshing.`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const rawServerUrl = sanitizeString(body.server_url || org.trakzee_server_url || "https://trakzee.uffizio.com/webservice", 200);
      const username = sanitizeString(body.username || org.trakzee_username || "mdhfrancis@gmail.com");
      const password = body.password ? String(body.password).trim() : (org.trakzee_password?.trim() || "");
      const companyName = sanitizeString(body.company_name || org.trakzee_company_name || org.name || "LOGISTIXWARE");
      const projectId = sanitizeString(body.project_id || org.trakzee_project_id || "37", 20);

      if (!username || !password) {
        return new Response(
          JSON.stringify({ success: false, error: "Trakzee credentials not configured. Please set them in Settings > Trakzee Telematics." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { url: serverUrl } = await resolveBestServerUrl(rawServerUrl);

      // 2. Fetch active vehicles for this organisation in MachineCare
      const { data: machines, error: mErr } = await supabase
        .from("machines")
        .select("id, name, plate_number, telematics_imei, current_odometer_km, current_hours, status, notes")
        .eq("organisation_id", orgId);

      if (mErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Error loading fleet vehicles: ${mErr.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Collect plate numbers and IMEIs
      const plateList = (machines || [])
        .map((m) => sanitizeString(m.plate_number))
        .filter(Boolean);

      const imeiList = (machines || [])
        .map((m) => sanitizeString(m.telematics_imei))
        .filter(Boolean);

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
          JSON.stringify({ success: false, error: `Trakzee login timeout: ${netErr?.message}` }),
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

      // Only filter if explicitly requested; leaving vehicle_nos and imei_nos empty
      // retrieves live data for the entire fleet associated with the company account.
      if (body.vehicle_nos) requestPayload.vehicle_nos = sanitizeString(body.vehicle_nos);
      if (body.imei_nos) requestPayload.imei_nos = sanitizeString(body.imei_nos);

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
        const imei = sanitizeString(tVehicle.Imeino);

        // Match against existing machine in this org
        const match = (machines || []).find((m) => {
          if (imei && m.telematics_imei && normalizePlate(m.telematics_imei) === normalizePlate(imei)) return true;
          if (normPlate && m.plate_number && normalizePlate(m.plate_number) === normPlate) return true;
          return false;
        });

        const odoKm = parseOdometerKm(tVehicle.Odometer);
        const speed = tVehicle.Speed !== undefined && tVehicle.Speed !== "--" ? Number(tVehicle.Speed) : 0;
        const lat = tVehicle.Latitude && tVehicle.Latitude !== "--" ? Number(tVehicle.Latitude) : null;
        const lng = tVehicle.Longitude && tVehicle.Longitude !== "--" ? Number(tVehicle.Longitude) : null;
        const ign = tVehicle.IGN === "ON";
        const volt = tVehicle.ExternalVolt && tVehicle.ExternalVolt !== "--" ? Number(tVehicle.ExternalVolt) : null;

        if (!match) {
          if (body.auto_import) {
            const newMachPayload: any = {
              organisation_id: orgId,
              name: rawPlate,
              plate_number: rawPlate,
              category: "Vehicle",
              status: "operational",
              current_odometer_km: odoKm && odoKm > 0 ? odoKm : 0,
              telematics_imei: imei || null,
              telematics_speed: speed,
              telematics_ignition: ign,
              telematics_battery_volt: volt,
              telematics_latitude: lat,
              telematics_longitude: lng,
              telematics_last_at: new Date().toISOString(),
              telematics_raw: tVehicle,
              notes: `[Auto-imported from Trakzee telematics | Model: ${tVehicle.DeviceModel || "GPS"}]`,
            };

            const { data: createdMach, error: insErr } = await supabase
              .from("machines")
              .insert(newMachPayload)
              .select("id")
              .maybeSingle();

            if (!insErr) {
              updatedCount++;
              syncLogs.push({
                machine_id: createdMach?.id,
                plate: rawPlate,
                odometer_km: odoKm,
                speed,
                status: tVehicle.Status,
                imported: true,
              });
            }
          }
          continue;
        }

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
          // Schema cache fallback: update odometer and notes safely
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
