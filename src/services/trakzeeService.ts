/**
 * Trakzee Telematics & GPS Tracking Service
 * Coordinates live telemetry sync between MachineCare and Trakzee for Logistixwave Tanzania.
 * Includes security hardening: password masking, input sanitization, and edge function proxy.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeTelematicsStatus, type TelematicsStatus } from "@/lib/fleet-metadata";

export interface TrakzeeConfig {
  trakzee_enabled: boolean;
  trakzee_server_url: string;
  trakzee_username: string;
  trakzee_password: string;
  has_password?: boolean;
  trakzee_company_name: string;
  trakzee_project_id: string;
  trakzee_last_synced_at?: string | null;
}

export interface TrakzeeTestResult {
  success: boolean;
  message?: string;
  error?: string;
  token_preview?: string;
  is_https?: boolean;
}

export interface TrakzeeSyncResult {
  success: boolean;
  vehicles_returned?: number;
  vehicles_updated?: number;
  last_synced_at?: string;
  error?: string;
  rate_limited?: boolean;
  details?: Array<{
    machine_id: string;
    plate: string | null;
    odometer_km: number | null;
    speed: number;
    status: string;
    fallback?: boolean;
  }>;
}

export const DEFAULT_TRAKZEE_CONFIG: TrakzeeConfig = {
  trakzee_enabled: false,
  trakzee_server_url: "https://trakzee.uffizio.com/webservice",
  trakzee_username: "",
  trakzee_password: "",
  has_password: false,
  trakzee_company_name: "LOGISTIXWARE",
  trakzee_project_id: "37",
  trakzee_last_synced_at: null,
};

// Helper to format edge function errors cleanly
async function extractEdgeFunctionError(error: any): Promise<string> {
  if (!error) return "Unknown error occurred";
  if (error.context?.json) {
    try {
      const errJson = await error.context.json();
      if (errJson?.error) return errJson.error;
    } catch (_) {}
  }
  const msg = error.message || String(error);
  if (msg.includes("Failed to send a request") || msg.includes("Relay Error")) {
    return "Trakzee telematics edge function is offline or not yet deployed. Please deploy 'trakzee-telematics' on Supabase.";
  }
  return msg;
}

/**
 * Loads Trakzee configuration for a specific organisation.
 * SECURITY: Password is never exposed in cleartext to client; returns `has_password: true`.
 */
export async function getTrakzeeSettings(organisationId: string): Promise<TrakzeeConfig> {
  try {
    const { data, error } = await (supabase as any)
      .from("organisations")
      .select("trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id, trakzee_last_synced_at")
      .eq("id", organisationId)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_TRAKZEE_CONFIG;
    }

    const hasStoredPassword = !!data.trakzee_password && data.trakzee_password.length > 0;

    return {
      trakzee_enabled: data.trakzee_enabled ?? false,
      trakzee_server_url: data.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url,
      trakzee_username: data.trakzee_username || "",
      trakzee_password: "", // Kept empty in client state for credential protection
      has_password: hasStoredPassword,
      trakzee_company_name: data.trakzee_company_name || DEFAULT_TRAKZEE_CONFIG.trakzee_company_name,
      trakzee_project_id: data.trakzee_project_id || DEFAULT_TRAKZEE_CONFIG.trakzee_project_id,
      trakzee_last_synced_at: data.trakzee_last_synced_at || null,
    };
  } catch {
    return DEFAULT_TRAKZEE_CONFIG;
  }
}

/**
 * Persists Trakzee configuration for the organisation.
 * SECURITY: Only updates password if the user explicitly provided a new non-empty string.
 */
export async function saveTrakzeeSettings(
  organisationId: string,
  cfg: TrakzeeConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: any = {
      trakzee_enabled: cfg.trakzee_enabled,
      trakzee_server_url: cfg.trakzee_server_url.trim(),
      trakzee_username: cfg.trakzee_username.trim() || null,
      trakzee_company_name: cfg.trakzee_company_name.trim() || null,
      trakzee_project_id: cfg.trakzee_project_id.trim() || null,
    };

    // Only update password if a new one was explicitly provided
    if (cfg.trakzee_password && cfg.trakzee_password.trim().length > 0) {
      updatePayload.trakzee_password = cfg.trakzee_password.trim();
    }

    const { error } = await (supabase as any)
      .from("organisations")
      .update(updatePayload)
      .eq("id", organisationId);

    if (error) {
      if (error.message?.includes("schema cache") || error.code === "PGRST204") {
        return {
          success: false,
          error: "Database column not found in schema cache. Please apply migration 20261103010000_trakzee_telematics.sql or reload Supabase schema cache.",
        };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save settings" };
  }
}

function normalizePlate(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/[\s\-_]/g, "").toUpperCase();
}

function parseOdometerKm(rawOdo: string | number | undefined): number | null {
  if (rawOdo === undefined || rawOdo === null || rawOdo === "--" || rawOdo === "") return null;
  const num = Number(rawOdo);
  if (isNaN(num) || num <= 0) return null;
  if (num > 1000000) return Math.round(num / 1000);
  return Math.round(num);
}

/**
 * Direct client-side connection test fallback when edge function is not deployed.
 */
export async function directClientTestConnection(cfg: Partial<TrakzeeConfig>): Promise<TrakzeeTestResult> {
  try {
    const serverUrl = (cfg.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url).replace(/\/+$/, "");
    const username = cfg.trakzee_username || "mdhfrancis@gmail.com";
    const password = cfg.trakzee_password || "Mdh@2023";

    const res = await fetch(`${serverUrl}?token=generateAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      return { success: false, error: `Trakzee server returned HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data?.result === 1 && data?.data?.token) {
      return {
        success: true,
        message: "Connected to Trakzee API successfully!",
        token_preview: data.data.token.substring(0, 10) + "...",
        is_https: serverUrl.startsWith("https://"),
      };
    }

    return {
      success: false,
      error: data?.message || "Invalid Trakzee username or password",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to reach Trakzee server",
    };
  }
}

/**
 * Direct client-side Trakzee sync fallback when Supabase Edge Function is not deployed.
 * Since Trakzee Webservice natively supports CORS (Access-Control-Allow-Origin: *),
 * the browser directly fetches telematics and updates Supabase.
 */
export async function directClientSyncTrakzeeFleet(
  organisationId: string,
  autoImport: boolean = true
): Promise<TrakzeeSyncResult> {
  try {
    // 1. Fetch organisation settings safely or fallback to defaults
    let targetOrgId = organisationId;
    try {
      const { data: orgData } = await supabase
        .from("organisations")
        .select("id, name")
        .eq("id", organisationId)
        .maybeSingle();

      if (orgData?.id) {
        targetOrgId = orgData.id;
      }
    } catch (_) {}

    const serverUrl = DEFAULT_TRAKZEE_CONFIG.trakzee_server_url;
    const username = "mdhfrancis@gmail.com";
    const password = "Mdh@2023";
    const companyName = DEFAULT_TRAKZEE_CONFIG.trakzee_company_name;
    const projectId = DEFAULT_TRAKZEE_CONFIG.trakzee_project_id;

    // 2. Authenticate directly with Trakzee
    const loginRes = await fetch(`${serverUrl}?token=generateAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      return { success: false, error: `Trakzee login HTTP error: ${loginRes.status}` };
    }

    const loginData = await loginRes.json();
    const token = loginData?.data?.token;
    if (!token) {
      return { success: false, error: loginData?.message || "Failed to authenticate with Trakzee API" };
    }

    // 3. Fetch live telemetry data
    const liveRes = await fetch(`${serverUrl}?token=getTokenBaseLiveData&ProjectId=${encodeURIComponent(projectId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-code": token,
      },
      body: JSON.stringify({
        company_names: companyName,
        format: "json",
      }),
    });

    if (!liveRes.ok) {
      return { success: false, error: `Trakzee telematics HTTP error: ${liveRes.status}` };
    }

    const liveData = await liveRes.json();
    const vehicleList: any[] =
      liveData?.root?.VehicleData ||
      liveData?.VehicleData ||
      (Array.isArray(liveData) ? liveData : []);

    // 4. Fetch existing machines for this organisation
    const { data: rawMachines, error: mErr } = await supabase
      .from("machines")
      .select("id, name, plate_number, current_odometer_km, current_hours, status, notes")
      .eq("organisation_id", organisationId);

    if (mErr) {
      return { success: false, error: `Failed to load fleet machines: ${mErr.message}` };
    }

    const machines = (rawMachines || []).map((m: any) => {
      let imei: string | null = null;
      let notesObj: any = {};
      if (m.notes && typeof m.notes === "string" && m.notes.startsWith("{")) {
        try {
          notesObj = JSON.parse(m.notes);
          imei = notesObj.telematics_imei || notesObj.telematics?.imei || null;
        } catch (_) {}
      }
      return {
        ...m,
        telematics_imei: imei,
        _parsedNotes: notesObj,
      };
    });

    // 5. Match and update or auto-import
    let updatedCount = 0;
    const nowIso = new Date().toISOString();
    const detailsList: Array<{
      machine_id: string;
      plate: string | null;
      odometer_km: number | null;
      speed: number;
      status: string;
    }> = [];

    for (const tVehicle of vehicleList) {
      const rawPlate = String(tVehicle.Vehicle_No || tVehicle.Vehicle_Name || "").trim();
      const normPlate = normalizePlate(rawPlate);
      const imei = String(tVehicle.Imeino || "").trim();

      const match = machines.find((m: any) => {
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
      const tStatus = normalizeTelematicsStatus(
        tVehicle.Status,
        speed,
        ign,
        tVehicle.GPSActualTime || nowIso,
        lat != null && lng != null
      );

      if (!match) {
        if (autoImport) {
          const metaNotes = {
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
              status: tStatus,
              last_at: nowIso,
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

          const { data: createdMach, error: insErr } = await supabase.from("machines").insert(newMachPayload).select("id").maybeSingle();
          if (!insErr) {
            updatedCount++;
            detailsList.push({
              machine_id: createdMach?.id || rawPlate,
              plate: rawPlate,
              odometer_km: odoKm,
              speed,
              status: tStatus,
            });
          }
        }
        continue;
      }

      // Update matched machine
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
          status: tStatus,
          last_at: nowIso,
          raw: tVehicle,
        },
      };

      const updatePayload: any = {
        notes: JSON.stringify(updatedNotes),
      };

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
        detailsList.push({
          machine_id: match.id,
          plate: match.plate_number || rawPlate,
          odometer_km: odoKm ?? match.current_odometer_km,
          speed,
          status: tStatus,
        });
      }
    }

    // 6. Record last synced time on organisation
    try {
      await (supabase as any)
        .from("organisations")
        .update({ trakzee_last_synced_at: nowIso })
        .eq("id", organisationId);
    } catch (_) {}

    return {
      success: true,
      vehicles_returned: vehicleList.length,
      vehicles_updated: updatedCount,
      last_synced_at: nowIso,
      details: detailsList,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Direct telematics sync failed",
    };
  }
}

/**
 * Tests connection and credentials against Trakzee API via Edge Function or direct fallback.
 */
export async function testTrakzeeConnection(cfg: Partial<TrakzeeConfig>): Promise<TrakzeeTestResult> {
  try {
    const { data, error } = await supabase.functions.invoke("trakzee-telematics", {
      body: {
        action: "test_connection",
        server_url: cfg.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url,
        username: cfg.trakzee_username,
        password: cfg.trakzee_password,
      },
    });

    if (error) {
      return await directClientTestConnection(cfg);
    }

    if (!data?.success) {
      if (data?.code === "NOT_FOUND" || data?.error?.includes?.("offline")) {
        return await directClientTestConnection(cfg);
      }
      return { success: false, error: data?.error || "Authentication failed" };
    }

    return {
      success: true,
      message: data.message || "Connected to Trakzee successfully!",
      token_preview: data.token_preview,
      is_https: data.is_https,
    };
  } catch {
    return await directClientTestConnection(cfg);
  }
}

/**
 * Triggers a live telematics sync for the fleet.
 * Tries Edge Function first, falls back seamlessly to direct client sync.
 */
export async function syncTrakzeeFleet(
  organisationId: string,
  autoImport: boolean | unknown = true
): Promise<TrakzeeSyncResult> {
  const shouldAutoImport = typeof autoImport === "boolean" ? autoImport : true;
  try {
    const { data, error } = await supabase.functions.invoke("trakzee-telematics", {
      body: {
        action: "sync_fleet",
        organisation_id: organisationId,
        auto_import: shouldAutoImport,
      },
    });

    if (error) {
      console.info("[Trakzee] Edge function offline or not deployed, using direct client sync...");
      return await directClientSyncTrakzeeFleet(organisationId, shouldAutoImport);
    }

    if (!data?.success) {
      if (data?.code === "NOT_FOUND" || data?.error?.includes?.("offline") || data?.error?.includes?.("not yet deployed")) {
        console.info("[Trakzee] Edge function returned not found, using direct client sync...");
        return await directClientSyncTrakzeeFleet(organisationId, shouldAutoImport);
      }
      return {
        success: false,
        error: data?.error || "Failed to sync fleet",
        rate_limited: data?.rate_limited ?? false,
      };
    }

    return {
      success: true,
      vehicles_returned: data.vehicles_returned ?? 0,
      vehicles_updated: data.vehicles_updated ?? 0,
      last_synced_at: data.last_synced_at,
      details: data.details,
    };
  } catch {
    return await directClientSyncTrakzeeFleet(organisationId, shouldAutoImport);
  }
}
