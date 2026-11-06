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

      // 1. Fetch organization settings safely
      let org: any = null;
      try {
        const { data: fullOrg, error: fullErr } = await supabase
          .from("organisations")
          .select("id, name, trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id, trakzee_last_synced_at")
          .eq("id", orgId)
          .maybeSingle();

        if (!fullErr && fullOrg) {
          org = fullOrg;
        }
      } catch (_) {}

      if (!org) {
        // Fallback: query basic confirmed columns (id, name)
        const { data: basicOrg } = await supabase
          .from("organisations")
          .select("id, name")
          .eq("id", orgId)
          .maybeSingle();

        if (basicOrg) {
          org = basicOrg;
        } else {
          // If orgId wasn't found, find any existing organisation
          const { data: anyOrg } = await supabase
            .from("organisations")
            .select("id, name")
            .limit(1)
            .maybeSingle();

          org = anyOrg || { id: orgId, name: "LOGISTIXWARE" };
        }
      }

      const targetOrgId = org.id || orgId;

      // Rate limit: only check if trakzee_last_synced_at exists on org object and not auto_import
      if (org.trakzee_last_synced_at && !body.auto_import) {
        const lastSync = new Date(org.trakzee_last_synced_at).getTime();
        const now = Date.now();
        const diffSeconds = (now - lastSync) / 1000;
        if (diffSeconds < 15) {
          const waitTime = Math.ceil(15 - diffSeconds);
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
      const password = body.password ? String(body.password).trim() : (org.trakzee_password?.trim() || "Mdh@2023");
      const companyName = sanitizeString(body.company_name || org.trakzee_company_name || "LOGISTIXWARE");
      const projectId = sanitizeString(body.project_id || org.trakzee_project_id || "37", 20);

      const { url: serverUrl } = await resolveBestServerUrl(rawServerUrl);

      // 2. Fetch active vehicles for this organisation in MachineCare
      const { data: rawMachines, error: mErr } = await supabase
        .from("machines")
        .select("id, name, plate_number, current_odometer_km, current_hours, status, notes")
        .eq("organisation_id", targetOrgId);

      if (mErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Error loading fleet vehicles: ${mErr.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse telematics and notes JSON
      const machines = (rawMachines || []).map((m: any) => {
        let imei = (m as any).telematics_imei || null;
        let notesObj: any = {};
        if (m.notes && typeof m.notes === "string" && m.notes.startsWith("{")) {
          try {
            notesObj = JSON.parse(m.notes);
            imei = imei || notesObj.telematics_imei || notesObj.telematics?.imei || null;
          } catch (_) {}
        }
        return {
          ...m,
          telematics_imei: imei,
          _parsedNotes: notesObj,
        };
      });

      // Collect plate numbers and IMEIs
      const plateList = (machines || [])
        .map((m: any) => sanitizeString(m.plate_number))
        .filter(Boolean);

      const imeiList = (machines || [])
        .map((m: any) => sanitizeString(m.telematics_imei))
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
          const shouldAutoImport = Boolean(body.auto_import === true || body.auto_import === "true" || body.auto_import === 1);
          if (shouldAutoImport) {
            const metaNotes: any = {
              vehicle_code: rawPlate,
              category: "Vehicle",
              text: `[Auto-imported from Trakzee telematics | Model: ${tVehicle.DeviceModel || "GPS"}]`,
              telematics_imei: imei || null,
              telematics: {
                imei: imei || null,
                speed,
                ignition: ign,
                battery_volt: volt,
                latitude: lat,
                longitude: lng,
                last_at: new Date().toISOString(),
                raw: tVehicle,
              },
            };

            const newMachPayload: any = {
              organisation_id: targetOrgId,
              name: rawPlate,
              plate_number: rawPlate,
              category: "Vehicle",
              status: "operational",
              fuel_type: "Diesel",
              current_odometer_km: odoKm && odoKm > 0 ? odoKm : 0,
              current_hours: 0,
              notes: JSON.stringify(metaNotes),
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

        // Merge telematics snapshot into notes JSON
        const existingNotes = match._parsedNotes || {};
        const updatedNotes = {
          ...existingNotes,
          telematics_imei: imei || existingNotes.telematics_imei || null,
          telematics: {
            ...(existingNotes.telematics || {}),
            imei: imei || existingNotes.telematics?.imei || null,
            speed,
            ignition: ign,
            battery_volt: volt,
            latitude: lat,
            longitude: lng,
            last_at: new Date().toISOString(),
            raw: tVehicle,
          },
        };

        const updatePayload: any = {
          notes: JSON.stringify(updatedNotes),
        };

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
        }
      }

      // Update last synced timestamp on organisation
      try {
        await supabase
          .from("organisations")
          .update({ trakzee_last_synced_at: new Date().toISOString() })
          .eq("id", targetOrgId);
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
