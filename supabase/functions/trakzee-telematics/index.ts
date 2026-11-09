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

// Normalize telematics status to Running | Idle | Inactive | Stopped
function normalizeTelematicsStatus(
  rawStatus?: string | null,
  speed?: number | null,
  ignition?: boolean | null,
  lastAt?: string | null,
  hasGps?: boolean | null
): "Running" | "Idle" | "Inactive" | "Stopped" {
  if (rawStatus) {
    const s = String(rawStatus).trim().toLowerCase();
    if (s === "running" || s === "moving") return "Running";
    if (s === "idle" || s === "idling") return "Idle";
    if (s === "inactive" || s === "offline" || s === "nodata" || s === "no_data") return "Inactive";
    if (s === "stopped" || s === "parked") return "Stopped";
  }

  if (hasGps === false && (!lastAt || isNaN(Date.parse(lastAt)))) {
    return "Inactive";
  }
  if (lastAt) {
    const timeDiff = Date.now() - new Date(lastAt).getTime();
    if (timeDiff > 24 * 60 * 60 * 1000) {
      return "Inactive";
    }
  }
  const spd = Number(speed || 0);
  if (spd > 0) return "Running";
  if (ignition) return "Idle";
  return "Stopped";
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

    if (action === "purge_manual_vehicles") {
      const orgId = sanitizeString(body.organisation_id || "df6b0c4b-e56b-4694-838a-0381eb480043");
      const targetOrgId = orgId;

      // 1. Fetch live vehicles from Trakzee to build whitelist
      const rawServerUrl = sanitizeString(body.server_url || "https://trakzee.uffizio.com/webservice", 200);
      const username = sanitizeString(body.username || "mdhfrancis@gmail.com");
      const password = body.password ? String(body.password).trim() : "Mdh@2023";
      const companyName = sanitizeString(body.company_name || "LOGISTIXWARE");
      const projectId = sanitizeString(body.project_id || "37", 20);

      const { url: serverUrl } = await resolveBestServerUrl(rawServerUrl);
      const loginRes = await fetch(`${serverUrl}?token=generateAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(15000),
      });
      const loginParsed = await safeParseJson(loginRes);
      const token = loginParsed.data?.data?.token;

      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not authenticate with Trakzee to verify live fleet" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const liveRes = await fetch(`${serverUrl}?token=getTokenBaseLiveData&ProjectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-code": token },
        body: JSON.stringify({ company_names: companyName, format: "json" }),
        signal: AbortSignal.timeout(20000),
      });
      const liveParsed = await safeParseJson(liveRes);
      const trakzeeVehicles = liveParsed.data?.root?.VehicleData || liveParsed.data?.VehicleData || (Array.isArray(liveParsed.data) ? liveParsed.data : []);

      if (trakzeeVehicles.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Trakzee returned 0 vehicles; aborting purge to protect fleet." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trakzeePlates = new Set(trakzeeVehicles.map((v) => normalizePlate(v.Vehicle_No || v.Vehicle_Name)));
      const trakzeeImeis = new Set(trakzeeVehicles.map((v) => normalizePlate(v.Imeino)));

      // 2. Fetch all machines for this organisation
      const { data: allMachines } = await supabase
        .from("machines")
        .select("id, name, plate_number, notes")
        .eq("organisation_id", targetOrgId);

      const toDeleteIds: string[] = [];
      const deletedDetails: any[] = [];

      for (const m of (allMachines || [])) {
        const normPlate = normalizePlate(m.plate_number || m.name);
        let imei = "";
        try {
          if (m.notes && m.notes.startsWith("{")) {
            const parsed = JSON.parse(m.notes);
            imei = normalizePlate(parsed.telematics_imei || parsed.telematics?.imei);
          }
        } catch (_) {}

        const isTrakzee = (normPlate && trakzeePlates.has(normPlate)) || (imei && trakzeeImeis.has(imei));
        if (!isTrakzee) {
          toDeleteIds.push(m.id);
          deletedDetails.push({ id: m.id, name: m.name, plate: m.plate_number });
        }
      }

      if (toDeleteIds.length > 0) {
        // Cascade cleanup child references if any
        for (const mid of toDeleteIds) {
          await supabase.from("trips").delete().eq("machine_id", mid);
          await supabase.from("service_schedules").delete().eq("machine_id", mid);
          await supabase.from("service_logs").delete().eq("machine_id", mid);
          await supabase.from("meter_readings").delete().eq("machine_id", mid);
          await supabase.from("vehicle_documents").delete().eq("machine_id", mid);
          await supabase.from("machine_downtime_events").delete().eq("machine_id", mid);
          await supabase.from("tyres").delete().eq("machine_id", mid);
          await supabase.from("fault_reports").delete().eq("machine_id", mid);
          await supabase.from("work_orders").delete().eq("machine_id", mid);
        }

        const { error: delErr } = await supabase
          .from("machines")
          .delete()
          .in("id", toDeleteIds);

        if (delErr) {
          return new Response(
            JSON.stringify({ success: false, error: `Failed to remove manual vehicles: ${delErr.message}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { count: remainingCount } = await supabase
        .from("machines")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", targetOrgId);

      return new Response(
        JSON.stringify({
          success: true,
          deletedCount: toDeleteIds.length,
          deletedVehicles: deletedDetails,
          remainingFleetCount: remainingCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          // If orgId wasn't found, prioritize LOGISTIXWARE organisation
          const { data: logistixOrg } = await supabase
            .from("organisations")
            .select("id, name")
            .ilike("name", "%LOGISTIX%")
            .maybeSingle();

          const { data: anyOrg } = !logistixOrg
            ? await supabase.from("organisations").select("id, name").limit(1).maybeSingle()
            : { data: logistixOrg };

          org = logistixOrg || anyOrg || { id: orgId, name: "LOGISTIXWARE" };
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

      if (vehicleList.length === 0) {
        return new Response(
          JSON.stringify({ success: true, vehicles_returned: 0, vehicles_updated: 0, raw_response: liveData }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 5. Match and update vehicles in Supabase
      let updatedCount = 0;
      const syncLogs: any[] = [];
      const driversToSync = new Map<string, { fullName: string; vehiclePlate: string }>();

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

        const odoKm = parseOdometerKm(tVehicle.can_odometer) ?? parseOdometerKm(tVehicle.Odometer);
        const speed = tVehicle.Speed !== undefined && tVehicle.Speed !== "--" ? Number(tVehicle.Speed) : 0;
        const lat = tVehicle.Latitude && tVehicle.Latitude !== "--" ? Number(tVehicle.Latitude) : null;
        const lng = tVehicle.Longitude && tVehicle.Longitude !== "--" ? Number(tVehicle.Longitude) : null;
        const ign = tVehicle.IGN === "ON";
        const volt = tVehicle.ExternalVolt && tVehicle.ExternalVolt !== "--" ? Number(tVehicle.ExternalVolt) : null;
        const batteryPct = tVehicle.battery_percentage !== undefined && tVehicle.battery_percentage !== "--" ? Number(tVehicle.battery_percentage) : null;
        const location = tVehicle.Location && tVehicle.Location !== "--" ? String(tVehicle.Location).trim() : null;
        const driverParts = [tVehicle.Driver_First_Name, tVehicle.Driver_Middle_Name, tVehicle.Driver_Last_Name].filter(
          (n) => n && n !== "--" && n !== "null" && n !== "NA" && n !== "-"
        );
        const driverName = driverParts.join(" ").trim() || (tVehicle.Driver_Name && tVehicle.Driver_Name !== "--" ? String(tVehicle.Driver_Name).trim() : null) || null;

        if (driverName && driverName.length > 1) {
          const normKey = driverName.toLowerCase();
          if (!driversToSync.has(normKey)) {
            driversToSync.set(normKey, { fullName: driverName, vehiclePlate: rawPlate || "" });
          }
        }

        const heading = tVehicle.Angle !== undefined && tVehicle.Angle !== "--" ? Number(tVehicle.Angle) : null;
        const deviceModel = tVehicle.DeviceModel || "GPS";
        const gpsTime = tVehicle.GPSActualTime || tVehicle.Datetime || new Date().toISOString();

        const tStatus = normalizeTelematicsStatus(
          tVehicle.Status,
          speed,
          ign,
          gpsTime,
          lat != null && lng != null
        );

        if (!match) {
          // Default to auto-importing any unmatched vehicles from Trakzee unless explicitly disabled
          const shouldAutoImport = body.auto_import !== false && body.auto_import !== "false";
          if (shouldAutoImport) {
            const metaNotes: any = {
              vehicle_code: rawPlate,
              category: "Vehicle",
              text: `[Auto-imported from Trakzee telematics | Model: ${deviceModel}]`,
              telematics_imei: imei || null,
              telematics: {
                imei: imei || null,
                speed,
                ignition: ign,
                battery_volt: volt,
                battery_percentage: batteryPct,
                latitude: lat,
                longitude: lng,
                location,
                driver_name: driverName,
                heading,
                device_model: deviceModel,
                gps_time: gpsTime,
                status: tStatus,
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
              home_depot: location || "LOGISTIXWARE Depot",
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
                status: tStatus,
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
            battery_percentage: batteryPct ?? existingNotes.telematics?.battery_percentage ?? null,
            latitude: lat,
            longitude: lng,
            location: location || existingNotes.telematics?.location || null,
            driver_name: driverName || existingNotes.telematics?.driver_name || null,
            heading: heading ?? existingNotes.telematics?.heading ?? null,
            device_model: deviceModel,
            gps_time: gpsTime,
            status: tStatus,
            last_at: new Date().toISOString(),
            raw: tVehicle,
          },
        };

        const updatePayload: any = {
          notes: JSON.stringify(updatedNotes),
        };

        // Cache and persist odometer reading: only update if valid and >= current
        if (odoKm !== null && odoKm > 0) {
          if (!match.current_odometer_km || odoKm >= match.current_odometer_km) {
            updatePayload.current_odometer_km = odoKm;
          }
        }

        if (location && (!match.home_depot || match.home_depot === "LOGISTIXWARE Depot")) {
          updatePayload.home_depot = location;
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
            status: tStatus,
          });
        }
      }

      // Ingest detected live drivers into the drivers table
      if (driversToSync.size > 0) {
        try {
          const { data: existingDrivers } = await supabase
            .from("drivers")
            .select("id, full_name")
            .eq("organisation_id", targetOrgId);

          const existingNames = new Set(
            (existingDrivers || []).map((d: any) => String(d.full_name || "").trim().toLowerCase())
          );

          for (const [normKey, dInfo] of driversToSync.entries()) {
            if (!existingNames.has(normKey)) {
              const newDriver = {
                organisation_id: targetOrgId,
                full_name: dInfo.fullName,
                phone: null,
                status: "active",
                notes: JSON.stringify({
                  driver_code: `DRV-${String(Math.floor(100 + Math.random() * 900))}`,
                  source: "trakzee_telematics",
                  assigned_vehicle: dInfo.vehiclePlate,
                }),
              };
              const { error: dErr } = await supabase.from("drivers").insert(newDriver);
              if (!dErr) {
                existingNames.add(normKey);
              }
            }
          }
        } catch (_) {}
      }

      // Automated Odometer PM Trigger: Evaluate active vehicle schedules against updated odometers
      let pmTriggerCount = 0;
      const pmTriggerDetails: string[] = [];
      try {
        const { data: activeSchedules } = await supabase
          .from("service_schedules")
          .select("id, machine_id, name, service_type, interval_hours, last_service_hours, next_due_hours, instructions, status")
          .in("status", ["ok", "due_soon", "overdue"]);

        if (activeSchedules && activeSchedules.length > 0) {
          const scheduleMachineIds = Array.from(new Set(activeSchedules.map((s: any) => s.machine_id)));
          const { data: openWos } = await supabase
            .from("work_orders")
            .select("id, machine_id, schedule_id")
            .in("machine_id", scheduleMachineIds)
            .in("status", ["open", "assigned", "in_progress", "waiting_parts"]);

          const existingOpenWos = new Set(
            (openWos || []).map((w: any) => `${w.machine_id}_${w.schedule_id}`)
          );

          const { data: freshMachines } = await supabase
            .from("machines")
            .select("id, name, plate_number, current_odometer_km")
            .in("id", scheduleMachineIds);

          const freshMachineMap = new Map((freshMachines || []).map((m: any) => [m.id, m]));

          for (const s of activeSchedules) {
            const m: any = freshMachineMap.get(s.machine_id);
            if (!m) continue;

            const currentOdo = Number(m.current_odometer_km || 0);
            const nextDue = Number(s.next_due_hours || 0);
            const interval = Number(s.interval_hours || 10000);

            if (currentOdo <= 0 || nextDue <= 0) continue;

            const remaining = nextDue - currentOdo;
            if (remaining <= 500) {
              const dedupeKey = `${s.machine_id}_${s.id}`;
              const isOverdue = remaining <= 0;

              await supabase
                .from("service_schedules")
                .update({ status: isOverdue ? "overdue" : "due_soon" })
                .eq("id", s.id);

              if (!existingOpenWos.has(dedupeKey)) {
                const plate = m.plate_number || m.name;
                const title = `PM: ${s.name} · ${plate}`;
                const description = `Automated Odometer-Triggered PM Work Order.\n` +
                  `Vehicle: ${plate} (${m.name})\n` +
                  `Live Telematics Odometer: ${currentOdo.toLocaleString()} km\n` +
                  `Target Threshold: ${nextDue.toLocaleString()} km (Interval: ${interval.toLocaleString()} km)\n` +
                  `Status: ${isOverdue ? `Overdue by ${Math.abs(remaining).toLocaleString()} km` : `Due in ${remaining.toLocaleString()} km`}\n\n` +
                  `Required Tasks:\n${s.instructions || "Inspect and replace scheduled maintenance items."}`;

                const { error: woErr } = await supabase.from("work_orders").insert({
                  organisation_id: targetOrgId,
                  machine_id: s.machine_id,
                  schedule_id: s.id,
                  title,
                  description,
                  priority: isOverdue ? "high" : "normal",
                  status: "open",
                  due_date: new Date().toISOString().slice(0, 10),
                });

                if (!woErr) {
                  existingOpenWos.add(dedupeKey);
                  pmTriggerCount++;
                  pmTriggerDetails.push(`${plate}: ${s.name} (${currentOdo.toLocaleString()} km)`);
                }
              }
            }
          }
        }
      } catch (pmErr) {
        console.error("Error in automated PM evaluation:", pmErr);
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
          pm_work_orders_created: pmTriggerCount,
          pm_details: pmTriggerDetails,
          details: syncLogs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "evaluate_pm") {
      const targetOrgId = body.organisation_id || "df6b0c4b-e56b-4694-838a-0381eb480043";
      const { data: activeSchedules } = await supabase
        .from("service_schedules")
        .select("id, machine_id, name, service_type, interval_hours, last_service_hours, next_due_hours, instructions, status")
        .in("status", ["ok", "due_soon", "overdue"]);

      let pmCreated = 0;
      const details: string[] = [];

      if (activeSchedules && activeSchedules.length > 0) {
        const scheduleMachineIds = Array.from(new Set(activeSchedules.map((s: any) => s.machine_id)));
        const { data: openWos } = await supabase
          .from("work_orders")
          .select("id, machine_id, schedule_id")
          .in("machine_id", scheduleMachineIds)
          .in("status", ["open", "assigned", "in_progress", "waiting_parts"]);

        const existingOpenWos = new Set(
          (openWos || []).map((w: any) => `${w.machine_id}_${w.schedule_id}`)
        );

        const { data: freshMachines } = await supabase
          .from("machines")
          .select("id, name, plate_number, current_odometer_km")
          .in("id", scheduleMachineIds);

        const freshMachineMap = new Map((freshMachines || []).map((m: any) => [m.id, m]));

        for (const s of activeSchedules) {
          const m: any = freshMachineMap.get(s.machine_id);
          if (!m) continue;

          const currentOdo = Number(m.current_odometer_km || 0);
          const nextDue = Number(s.next_due_hours || 0);
          const interval = Number(s.interval_hours || 10000);

          if (currentOdo <= 0 || nextDue <= 0) continue;

          const remaining = nextDue - currentOdo;
          if (remaining <= 500) {
            const dedupeKey = `${s.machine_id}_${s.id}`;
            const isOverdue = remaining <= 0;

            await supabase
              .from("service_schedules")
              .update({ status: isOverdue ? "overdue" : "due_soon" })
              .eq("id", s.id);

            if (!existingOpenWos.has(dedupeKey)) {
              const plate = m.plate_number || m.name;
              const title = `PM: ${s.name} · ${plate}`;
              const description = `Automated Odometer-Triggered PM Work Order.\n` +
                `Vehicle: ${plate} (${m.name})\n` +
                `Live Telematics Odometer: ${currentOdo.toLocaleString()} km\n` +
                `Target Threshold: ${nextDue.toLocaleString()} km (Interval: ${interval.toLocaleString()} km)\n` +
                `Status: ${isOverdue ? `Overdue by ${Math.abs(remaining).toLocaleString()} km` : `Due in ${remaining.toLocaleString()} km`}\n\n` +
                `Required Tasks:\n${s.instructions || "Inspect and replace scheduled maintenance items."}`;

              const { error: woErr } = await supabase.from("work_orders").insert({
                organisation_id: targetOrgId,
                machine_id: s.machine_id,
                schedule_id: s.id,
                title,
                description,
                priority: isOverdue ? "high" : "normal",
                status: "open",
                due_date: new Date().toISOString().slice(0, 10),
              });

              if (!woErr) {
                existingOpenWos.add(dedupeKey);
                pmCreated++;
                details.push(`${plate}: ${s.name}`);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, pm_work_orders_created: pmCreated, details }),
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
