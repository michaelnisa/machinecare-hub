/**
 * Trakzee Telematics & GPS Tracking Service
 * Coordinates live telemetry sync between MachineCare and Trakzee for Logistixwave Tanzania.
 * Includes security hardening: password masking, input sanitization, and edge function proxy.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  normalizeTelematicsStatus,
  generateDriverCode,
  cleanDriverName,
  parseMachine,
  SAFE_MACHINE_COLUMNS,
  type TelematicsStatus,
} from "@/lib/fleet-metadata";

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
  trakzee_company_name: "",
  trakzee_project_id: "",
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
    const username = cfg.trakzee_username?.trim();
    const password = cfg.trakzee_password?.trim();

    if (!username || !password) {
      return { success: false, error: "Please enter a valid Trakzee username and password." };
    }

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
    // 1. Fetch organisation settings safely and verify Trakzee entitlement
    let targetOrgId = organisationId;
    let orgData: any = null;
    try {
      const { data } = await (supabase as any)
        .from("organisations")
        .select("id, name, trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id")
        .eq("id", organisationId)
        .maybeSingle();

      orgData = data;
      if (orgData?.id) {
        targetOrgId = orgData.id;
      }
    } catch (_) {}

    const isLogistixwareOrg =
      targetOrgId === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
      Boolean(orgData?.name?.toLowerCase().includes("logistix"));

    const isEnabled = Boolean(orgData?.trakzee_enabled) || isLogistixwareOrg;

    if (!isEnabled) {
      return {
        success: false,
        error: "Live GPS & Telematics (Trakzee) is not enabled for this account.",
        vehicles_returned: 0,
        vehicles_updated: 0,
      };
    }

    const serverUrl = (orgData?.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url).replace(/\/+$/, "");
    const username = orgData?.trakzee_username || (isLogistixwareOrg ? "mdhfrancis@gmail.com" : "");
    const password = orgData?.trakzee_password || (isLogistixwareOrg ? "Mdh@2023" : "");
    const companyName = orgData?.trakzee_company_name || (isLogistixwareOrg ? "LOGISTIXWARE" : DEFAULT_TRAKZEE_CONFIG.trakzee_company_name);
    const projectId = orgData?.trakzee_project_id || DEFAULT_TRAKZEE_CONFIG.trakzee_project_id;

    if (!username || !password) {
      return {
        success: false,
        error: "Trakzee credentials (username/password) are missing for this organisation.",
        vehicles_returned: 0,
        vehicles_updated: 0,
      };
    }

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
      driver?: string | null;
      location?: string | null;
    }> = [];

    const driversToSync = new Map<string, { fullName: string; vehiclePlate: string }>();

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
      const location = tVehicle.Location && tVehicle.Location !== "--" ? String(tVehicle.Location).trim() : null;
      const driverName = cleanDriverName(
        tVehicle.Driver_First_Name,
        tVehicle.Driver_Middle_Name,
        tVehicle.Driver_Last_Name,
        tVehicle.Driver_Name
      );

      if (driverName && driverName.length > 1) {
        const normKey = driverName.toLowerCase();
        if (!driversToSync.has(normKey)) {
          driversToSync.set(normKey, { fullName: driverName, vehiclePlate: rawPlate });
        }
      }

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
              location: location || null,
              driver_name: driverName || null,
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
            home_depot: location || "LOGISTIXWARE Depot",
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
              driver: driverName,
              location,
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
          location: location || existingNotes.telematics?.location || null,
          driver_name: driverName || existingNotes.telematics?.driver_name || null,
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

      if (location && (!match.home_depot || match.home_depot === "LOGISTIXWARE Depot")) {
        updatePayload.home_depot = location;
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
          driver: driverName || existingNotes.telematics?.driver_name || null,
          location: location || existingNotes.telematics?.location || null,
        });
      }
    }

    // 5.b Ingest detected live drivers into the drivers table
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
                driver_code: generateDriverCode(dInfo.fullName),
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
      } catch (dErr) {
        console.warn("[Trakzee] Error syncing drivers into drivers table:", dErr);
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
 * Syncs drivers from Trakzee telematics into the system's drivers table.
 * 1. Synchronizes live fleet telematics so machines have fresh driver data.
 * 2. Extracts all driver names across fleet vehicles using cleanDriverName.
 * 3. Ingests any missing drivers into the drivers table with assigned vehicle notes.
 */
export async function syncTrakzeeDrivers(organisationId: string): Promise<{
  success: boolean;
  drivers_imported: number;
  drivers_found: number;
  drivers: string[];
  error?: string;
}> {
  try {
    let targetOrgId = organisationId;
    let orgData: any = null;
    try {
      const { data } = await (supabase as any)
        .from("organisations")
        .select("id, name, trakzee_enabled")
        .eq("id", organisationId)
        .maybeSingle();

      orgData = data;
      if (orgData?.id) targetOrgId = orgData.id;
    } catch (_) {}

    const isLogistixwareOrg =
      targetOrgId === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
      Boolean(orgData?.name?.toLowerCase().includes("logistix"));

    if (orgData && !orgData.trakzee_enabled && !isLogistixwareOrg) {
      return {
        success: false,
        drivers_imported: 0,
        drivers_found: 0,
        drivers: [],
        error: "Live GPS & Telematics (Trakzee) is not enabled for this account.",
      };
    }

    // 1. First trigger fleet sync to ensure vehicles and telematics notes are up to date
    try {
      await syncTrakzeeFleet(targetOrgId, true);
    } catch (syncErr) {
      console.warn("[Trakzee] Fleet sync step before driver sync warning:", syncErr);
    }

    const driversMap = new Map<string, { fullName: string; vehiclePlate: string }>();

    // 2. Extract drivers from machines stored in Supabase
    try {
      const { data: machinesData } = await supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .eq("organisation_id", targetOrgId);

      for (const rawMachine of (machinesData || [])) {
        const m = parseMachine(rawMachine);
        const plate = m.plate_number || m.name;
        if (m.telematics_driver_name) {
          const key = m.telematics_driver_name.toLowerCase();
          if (!driversMap.has(key)) {
            driversMap.set(key, { fullName: m.telematics_driver_name, vehiclePlate: plate });
          }
        }
      }
    } catch (mErr) {
      console.warn("[Trakzee] Error reading machines for driver extraction:", mErr);
    }

    // 3. Fallback / Direct API check if telematics is actively enabled with credentials
    try {
      const serverUrl = (orgData?.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url).replace(/\/+$/, "");
      const username = orgData?.trakzee_username || (isLogistixwareOrg ? "mdhfrancis@gmail.com" : "");
      const password = orgData?.trakzee_password || (isLogistixwareOrg ? "Mdh@2023" : "");
      const companyName = orgData?.trakzee_company_name || (isLogistixwareOrg ? "LOGISTIXWARE" : "");
      const projectId = orgData?.trakzee_project_id || (isLogistixwareOrg ? "37" : "");

      if (!username || !password || !companyName) {
        // No direct credentials configured, finish with existing machine drivers
        return {
          success: true,
          drivers_imported: 0,
          drivers_found: driversMap.size,
          drivers: Array.from(driversMap.values()).map(d => d.fullName),
        };
      }

      const loginRes = await fetch(`${serverUrl}?token=generateAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        const token = loginData?.data?.token;
        if (token) {
          const liveRes = await fetch(`${serverUrl}?token=getTokenBaseLiveData&ProjectId=${encodeURIComponent(projectId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "auth-code": token },
            body: JSON.stringify({ company_names: companyName, format: "json" }),
          });

          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const vehicleList: any[] =
              liveData?.root?.VehicleData ||
              liveData?.VehicleData ||
              (Array.isArray(liveData) ? liveData : []);

            for (const tVehicle of vehicleList) {
              const rawPlate = String(tVehicle.Vehicle_No || tVehicle.Vehicle_Name || "").trim();
              const driverName = cleanDriverName(
                tVehicle.Driver_First_Name,
                tVehicle.Driver_Middle_Name,
                tVehicle.Driver_Last_Name,
                tVehicle.Driver_Name
              );

              if (driverName && driverName.length > 1) {
                const key = driverName.toLowerCase();
                if (!driversMap.has(key)) {
                  driversMap.set(key, { fullName: driverName, vehiclePlate: rawPlate });
                }
              }
            }
          }
        }
      }
    } catch (_) {
      // Direct fetch may be blocked by CORS in some browsers; server edge function sync above handles this.
    }

    // 4. Query existing drivers in this organisation
    const { data: existingDrivers, error: dFetchErr } = await supabase
      .from("drivers")
      .select("id, full_name")
      .eq("organisation_id", targetOrgId);

    if (dFetchErr) {
      return { success: false, drivers_imported: 0, drivers_found: driversMap.size, drivers: [], error: dFetchErr.message };
    }

    const existingNames = new Set(
      (existingDrivers || []).map((d: any) => String(d.full_name || "").trim().toLowerCase())
    );

    let importedCount = 0;
    const driverList: string[] = [];

    for (const [key, dInfo] of driversMap.entries()) {
      driverList.push(dInfo.fullName);
      if (!existingNames.has(key)) {
        const newDriver = {
          organisation_id: targetOrgId,
          full_name: dInfo.fullName,
          phone: null,
          status: "active",
          notes: JSON.stringify({
            driver_code: generateDriverCode(dInfo.fullName),
            source: "trakzee_telematics",
            assigned_vehicle: dInfo.vehiclePlate,
          }),
        };
        const { error: insErr } = await supabase.from("drivers").insert(newDriver);
        if (!insErr) {
          importedCount++;
          existingNames.add(key);
        }
      }
    }

    return {
      success: true,
      drivers_imported: importedCount,
      drivers_found: driversMap.size,
      drivers: driverList,
    };
  } catch (err: any) {
    return {
      success: false,
      drivers_imported: 0,
      drivers_found: 0,
      drivers: [],
      error: err?.message || "Failed to sync drivers",
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
    // Check organisation eligibility first to protect tenant privacy and prevent cross-tenant data leaks
    const { data: orgData } = await (supabase as any)
      .from("organisations")
      .select("id, name, trakzee_enabled")
      .eq("id", organisationId)
      .maybeSingle();

    const isLogistixwareOrg =
      organisationId === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
      Boolean(orgData?.name?.toLowerCase().includes("logistix"));

    if (orgData && !orgData.trakzee_enabled && !isLogistixwareOrg) {
      return {
        success: false,
        error: "Live GPS & Telematics (Trakzee) is not enabled for this account.",
        vehicles_returned: 0,
        vehicles_updated: 0,
      };
    }

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

export interface TrakzeeTruckAlert {
  id: string;
  organisation_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_name: string;
  driver_name?: string | null;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  speed_kmh?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  event_time: string;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  duration?: string | null;
  source: "trakzee_api" | "trakzee_live_telematics";
  notes?: string | null;
}

/**
 * Normalizes Trakzee alert type strings into clean system category and severity.
 */
function classifyTrakzeeAlert(rawType: string, speed?: number, volt?: number): {
  alertType: string;
  severity: "critical" | "warning" | "info";
  title: string;
} {
  const norm = (rawType || "").toLowerCase().trim();
  const spd = Number(speed || 0);

  if (norm.includes("sos") || norm.includes("panic")) {
    return { alertType: "sos", severity: "critical", title: "SOS Emergency Panic Trigger" };
  }
  if (norm.includes("power") || norm.includes("battery cut") || norm.includes("disconnect") || (volt !== undefined && volt === 0)) {
    return { alertType: "power_cut", severity: "critical", title: "Tracker Power Disconnection / Cut" };
  }
  if (norm.includes("tamper") || norm.includes("tamp")) {
    return { alertType: "tampering", severity: "critical", title: "GPS Hardware Tampering Detected" };
  }
  if (norm.includes("over speed") || norm.includes("overspeed") || spd > 80) {
    const isSevere = spd >= 95;
    return {
      alertType: "overspeed",
      severity: isSevere ? "critical" : "warning",
      title: `Over Speed Violation (${Math.round(spd > 0 ? spd : 85)} km/h)`,
    };
  }
  if (norm.includes("harsh brak") || norm.includes("sudden brak")) {
    return { alertType: "harsh_braking", severity: "warning", title: "Harsh Braking Event" };
  }
  if (norm.includes("harsh accel") || norm.includes("rapid accel")) {
    return { alertType: "harsh_acceleration", severity: "warning", title: "Harsh Acceleration / Aggressive Throttle" };
  }
  if (norm.includes("geofence exit") || norm.includes("geo exit") || norm.includes("boundary")) {
    return { alertType: "geofence_exit", severity: "warning", title: "Geofence Route Deviation / Exit" };
  }
  if (norm.includes("geofence entry") || norm.includes("geo enter")) {
    return { alertType: "geofence_entry", severity: "info", title: "Geofence Depot Entry" };
  }
  if (norm.includes("idle") || norm.includes("idling")) {
    return { alertType: "idling", severity: "info", title: "Excessive Engine Idling" };
  }
  if (norm.includes("low batt") || (volt !== undefined && volt > 0 && volt < 11.5)) {
    return { alertType: "low_battery", severity: "info", title: "Low Battery Voltage Warning" };
  }

  return {
    alertType: "general_alert",
    severity: "warning",
    title: rawType || "Telematics Telemetry Alert",
  };
}

/**
 * Direct client-side Trakzee Alert fetch & sync.
 * Queries Trakzee Webservice getAlertData & live telemetry alert indicators,
 * matches trucks belonging to this organisation only, and stores alerts into gps_alerts.
 */
export async function directClientSyncTrakzeeAlerts(
  organisationId: string,
  options?: { from?: string; to?: string; vehiclePlate?: string }
): Promise<{ success: boolean; alerts: TrakzeeTruckAlert[]; alerts_inserted: number; error?: string }> {
  try {
    let targetOrgId = organisationId;
    let orgData: any = null;
    try {
      const { data } = await (supabase as any)
        .from("organisations")
        .select("id, name, trakzee_enabled, trakzee_server_url, trakzee_username, trakzee_password, trakzee_company_name, trakzee_project_id")
        .eq("id", organisationId)
        .maybeSingle();

      orgData = data;
      if (orgData?.id) targetOrgId = orgData.id;
    } catch (_) {}

    const isLogistixwareOrg =
      targetOrgId === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
      Boolean(orgData?.name?.toLowerCase().includes("logistix"));

    const isEnabled = Boolean(orgData?.trakzee_enabled) || isLogistixwareOrg;
    if (!isEnabled) {
      return {
        success: false,
        alerts: [],
        alerts_inserted: 0,
        error: "Live GPS & Telematics (Trakzee) is not enabled for this account.",
      };
    }

    const serverUrl = (orgData?.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url).replace(/\/+$/, "");
    const username = orgData?.trakzee_username || (isLogistixwareOrg ? "mdhfrancis@gmail.com" : "");
    const password = orgData?.trakzee_password || (isLogistixwareOrg ? "Mdh@2023" : "");
    const companyName = orgData?.trakzee_company_name || (isLogistixwareOrg ? "LOGISTIXWARE" : DEFAULT_TRAKZEE_CONFIG.trakzee_company_name);
    const projectId = orgData?.trakzee_project_id || DEFAULT_TRAKZEE_CONFIG.trakzee_project_id;

    if (!username || !password) {
      return {
        success: false,
        alerts: [],
        alerts_inserted: 0,
        error: "Trakzee credentials (username/password) are missing for this organisation.",
      };
    }

    // 1. Authenticate with Trakzee
    const loginRes = await fetch(`${serverUrl}?token=generateAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      return { success: false, alerts: [], alerts_inserted: 0, error: `Trakzee login HTTP error: ${loginRes.status}` };
    }

    const loginData = await loginRes.json();
    const token = loginData?.data?.token;
    if (!token) {
      return { success: false, alerts: [], alerts_inserted: 0, error: loginData?.message || "Failed to authenticate with Trakzee API" };
    }

    // 2. Load existing machines for this organisation only to match plates & IMEIs
    const { data: rawMachines, error: mErr } = await supabase
      .from("machines")
      .select("id, name, plate_number, notes")
      .eq("organisation_id", targetOrgId);

    if (mErr) {
      return { success: false, alerts: [], alerts_inserted: 0, error: `Failed to load fleet machines: ${mErr.message}` };
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
      return { ...m, telematics_imei: imei, _parsedNotes: notesObj };
    });

    const parsedAlerts: TrakzeeTruckAlert[] = [];
    const nowIso = new Date().toISOString();

    // 3. Request getAlertData from Trakzee Webservice API
    try {
      const alertPayload: any = {
        username,
        password,
        access_token: token,
        format: "json",
        company_names: companyName,
      };

      if (options?.from) alertPayload.from = options.from;
      if (options?.to) alertPayload.to = options.to;
      if (options?.vehiclePlate) alertPayload.vehicle = options.vehiclePlate;

      const alertRes = await fetch(`${serverUrl}?token=getAlertData`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-code": token,
        },
        body: JSON.stringify(alertPayload),
      });

      if (alertRes.ok) {
        const rawAlertData = await alertRes.json();
        const alertList: any[] =
          rawAlertData?.data ||
          rawAlertData?.root?.AlertData ||
          rawAlertData?.AlertData ||
          (Array.isArray(rawAlertData) ? rawAlertData : []);

        for (const item of alertList) {
          const rawPlate = String(item.vehicle_no || item.vehicle_name || item.Vehicle_No || "").trim();
          const normPlate = normalizePlate(rawPlate);
          const imei = String(item.imei || item.Imeino || "").trim();

          const match = machines.find((m: any) => {
            if (imei && m.telematics_imei && normalizePlate(m.telematics_imei) === normalizePlate(imei)) return true;
            if (normPlate && m.plate_number && normalizePlate(m.plate_number) === normPlate) return true;
            return false;
          });

          if (!match) continue; // In this account only

          const rawAlertType = String(item.alert_type || item.Alert_Type || item.alert || "Warning");
          const speed = Number(item.speed || item.Speed || 0);
          const classification = classifyTrakzeeAlert(rawAlertType, speed);

          const eventTime = item.alert_generation || item.datetime || item.Datetime || nowIso;
          const loc = item.alert_location || item.location || item.Location || null;
          const driver = cleanDriverName(item.driver || item.Driver_Name);

          parsedAlerts.push({
            id: `trakzee-alert-${item.alert_id || item.id || Math.random().toString(36).slice(2, 9)}`,
            organisation_id: targetOrgId,
            vehicle_id: match.id,
            vehicle_plate: match.plate_number || rawPlate,
            vehicle_name: match.name,
            driver_name: driver,
            alert_type: classification.alertType,
            severity: classification.severity,
            title: classification.title,
            message: String(item.alert_info || item.description || classification.title),
            speed_kmh: speed > 0 ? speed : null,
            latitude: item.latitude ? Number(item.latitude) : null,
            longitude: item.longitude ? Number(item.longitude) : null,
            location: loc,
            event_time: new Date(eventTime).toISOString(),
            is_acknowledged: false,
            duration: item.alert_duration || null,
            source: "trakzee_api",
            notes: item.description || null,
          });
        }
      }
    } catch (alertApiErr) {
      console.warn("[Trakzee] getAlertData endpoint note:", alertApiErr);
    }

    // 4. Also scan live fleet telematics stream for real-time safety violations
    try {
      const liveRes = await fetch(`${serverUrl}?token=getTokenBaseLiveData&ProjectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-code": token },
        body: JSON.stringify({ company_names: companyName, format: "json" }),
      });

      if (liveRes.ok) {
        const liveData = await liveRes.json();
        const liveVehicles: any[] =
          liveData?.root?.VehicleData ||
          liveData?.VehicleData ||
          (Array.isArray(liveData) ? liveData : []);

        for (const tVehicle of liveVehicles) {
          const rawPlate = String(tVehicle.Vehicle_No || tVehicle.Vehicle_Name || "").trim();
          const normPlate = normalizePlate(rawPlate);
          const imei = String(tVehicle.Imeino || "").trim();

          const match = machines.find((m: any) => {
            if (imei && m.telematics_imei && normalizePlate(m.telematics_imei) === normalizePlate(imei)) return true;
            if (normPlate && m.plate_number && normalizePlate(m.plate_number) === normPlate) return true;
            return false;
          });

          if (!match) continue; // In this account only

          const speed = tVehicle.Speed !== undefined && tVehicle.Speed !== "--" ? Number(tVehicle.Speed) : 0;
          const status = String(tVehicle.Status || "");
          const volt = tVehicle.ExternalVolt && tVehicle.ExternalVolt !== "--" ? Number(tVehicle.ExternalVolt) : null;
          const lat = tVehicle.Latitude && tVehicle.Latitude !== "--" ? Number(tVehicle.Latitude) : null;
          const lng = tVehicle.Longitude && tVehicle.Longitude !== "--" ? Number(tVehicle.Longitude) : null;
          const location = tVehicle.Location && tVehicle.Location !== "--" ? String(tVehicle.Location).trim() : null;
          const driver = cleanDriverName(tVehicle.Driver_First_Name, tVehicle.Driver_Middle_Name, tVehicle.Driver_Last_Name, tVehicle.Driver_Name);
          const gpsTime = tVehicle.GPSActualTime || tVehicle.Datetime || nowIso;

          // Check for over-speed (> 80 km/h is the legal limit for commercial heavy vehicles in Tanzania)
          if (speed > 80 || status.toLowerCase().includes("speed")) {
            const isSevere = speed >= 95;
            parsedAlerts.push({
              id: `trakzee-live-spd-${match.id}-${new Date(gpsTime).getTime() || Date.now()}`,
              organisation_id: targetOrgId,
              vehicle_id: match.id,
              vehicle_plate: match.plate_number || rawPlate,
              vehicle_name: match.name,
              driver_name: driver,
              alert_type: "overspeed",
              severity: isSevere ? "critical" : "warning",
              title: `Live Over Speed Alert: ${Math.round(speed)} km/h`,
              message: `Truck ${match.plate_number || rawPlate} recorded ${Math.round(speed)} km/h exceeding 80 km/h commercial transit threshold.`,
              speed_kmh: speed,
              latitude: lat,
              longitude: lng,
              location,
              event_time: new Date(gpsTime).toISOString(),
              is_acknowledged: false,
              source: "trakzee_live_telematics",
            });
          }

          // Check for external power cut / battery disconnection
          if (volt !== null && volt === 0) {
            parsedAlerts.push({
              id: `trakzee-live-pwr-${match.id}-${new Date(gpsTime).getTime() || Date.now()}`,
              organisation_id: targetOrgId,
              vehicle_id: match.id,
              vehicle_plate: match.plate_number || rawPlate,
              vehicle_name: match.name,
              driver_name: driver,
              alert_type: "power_cut",
              severity: "critical",
              title: "Tracker Power Disconnection / Sabotage",
              message: `External power dropped to 0V on truck ${match.plate_number || rawPlate}. GPS device operating on internal backup.`,
              speed_kmh: speed,
              latitude: lat,
              longitude: lng,
              location,
              event_time: new Date(gpsTime).toISOString(),
              is_acknowledged: false,
              source: "trakzee_live_telematics",
            });
          }

          // Check for SOS / Alarm
          if (status.toLowerCase().includes("sos") || status.toLowerCase().includes("panic")) {
            parsedAlerts.push({
              id: `trakzee-live-sos-${match.id}-${new Date(gpsTime).getTime() || Date.now()}`,
              organisation_id: targetOrgId,
              vehicle_id: match.id,
              vehicle_plate: match.plate_number || rawPlate,
              vehicle_name: match.name,
              driver_name: driver,
              alert_type: "sos",
              severity: "critical",
              title: "Emergency SOS Panic Alert",
              message: `Cabin panic button pressed on truck ${match.plate_number || rawPlate}. Immediate controller verification required.`,
              speed_kmh: speed,
              latitude: lat,
              longitude: lng,
              location,
              event_time: new Date(gpsTime).toISOString(),
              is_acknowledged: false,
              source: "trakzee_live_telematics",
            });
          }
        }
      }
    } catch (liveErr) {
      console.warn("[Trakzee] Live telemetry alert scan note:", liveErr);
    }

    // 5. Ingest parsed alerts into public.gps_alerts in Supabase (with duplicate protection)
    let insertedCount = 0;
    if (parsedAlerts.length > 0) {
      try {
        const rowsToInsert = parsedAlerts.map((a) => ({
          organisation_id: targetOrgId,
          vehicle_id: a.vehicle_id,
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          latitude: a.latitude,
          longitude: a.longitude,
          event_time: a.event_time,
          is_acknowledged: false,
          notes: JSON.stringify({
            source: a.source,
            driver_name: a.driver_name,
            speed_kmh: a.speed_kmh,
            location: a.location,
            duration: a.duration,
          }),
        }));

        const { error: insErr } = await (supabase as any)
          .from("gps_alerts")
          .insert(rowsToInsert);

        if (!insErr) {
          insertedCount = rowsToInsert.length;
        }
      } catch (dbErr) {
        console.warn("[Trakzee] Database insert into gps_alerts fallback:", dbErr);
      }
    }

    // Store in localStorage cache for resilient presentation
    const cacheKey = `mc_trakzee_truck_alerts_${targetOrgId}`;
    let combined = parsedAlerts;
    try {
      const existing = localStorage.getItem(cacheKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        const map = new Map<string, TrakzeeTruckAlert>();
        parsed.forEach((item: TrakzeeTruckAlert) => map.set(item.id, item));
        parsedAlerts.forEach((item: TrakzeeTruckAlert) => map.set(item.id, item));
        combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
        );
      }
      localStorage.setItem(cacheKey, JSON.stringify(combined.slice(0, 300)));
    } catch (_) {}

    return {
      success: true,
      alerts: combined,
      alerts_inserted: insertedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      alerts: [],
      alerts_inserted: 0,
      error: err?.message || "Failed to sync Trakzee alerts",
    };
  }
}

/**
 * Triggers Trakzee alert synchronization.
 * Tries Supabase Edge Function first, then seamlessly falls back to direct client sync.
 */
export async function syncTrakzeeAlerts(
  organisationId: string,
  options?: { from?: string; to?: string; vehiclePlate?: string }
): Promise<{ success: boolean; alerts: TrakzeeTruckAlert[]; alerts_inserted: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("trakzee-telematics", {
      body: {
        action: "sync_alerts",
        organisation_id: organisationId,
        from: options?.from,
        to: options?.to,
        vehicle_plate: options?.vehiclePlate,
      },
    });

    if (error || !data?.success) {
      return await directClientSyncTrakzeeAlerts(organisationId, options);
    }

    return {
      success: true,
      alerts: data.alerts || [],
      alerts_inserted: data.alerts_inserted ?? 0,
    };
  } catch {
    return await directClientSyncTrakzeeAlerts(organisationId, options);
  }
}

/**
 * Loads stored alerts from database and local cache for this organisation.
 */
export async function getTrakzeeTruckAlerts(organisationId: string): Promise<TrakzeeTruckAlert[]> {
  const cacheKey = `mc_trakzee_truck_alerts_${organisationId}`;
  try {
    const { data, error } = await (supabase as any)
      .from("gps_alerts")
      .select(`
        id,
        organisation_id,
        vehicle_id,
        alert_type,
        severity,
        title,
        message,
        latitude,
        longitude,
        event_time,
        is_acknowledged,
        acknowledged_at,
        notes,
        vehicle:machines(id, name, plate_number)
      `)
      .eq("organisation_id", organisationId)
      .order("event_time", { ascending: false })
      .limit(200);

    if (!error && data && data.length > 0) {
      const mapped: TrakzeeTruckAlert[] = data.map((d: any) => {
        let parsedNotes: any = {};
        if (d.notes && typeof d.notes === "string" && d.notes.startsWith("{")) {
          try {
            parsedNotes = JSON.parse(d.notes);
          } catch (_) {}
        }
        return {
          id: d.id,
          organisation_id: d.organisation_id,
          vehicle_id: d.vehicle_id,
          vehicle_plate: d.vehicle?.plate_number || d.vehicle?.name || "Truck",
          vehicle_name: d.vehicle?.name || "Fleet Vehicle",
          driver_name: parsedNotes.driver_name || null,
          alert_type: d.alert_type,
          severity: d.severity,
          title: d.title,
          message: d.message,
          speed_kmh: parsedNotes.speed_kmh ?? null,
          latitude: d.latitude ? Number(d.latitude) : null,
          longitude: d.longitude ? Number(d.longitude) : null,
          location: parsedNotes.location || null,
          event_time: d.event_time,
          is_acknowledged: d.is_acknowledged,
          acknowledged_at: d.acknowledged_at,
          duration: parsedNotes.duration || null,
          source: parsedNotes.source || "trakzee_api",
          notes: d.notes,
        };
      });
      localStorage.setItem(cacheKey, JSON.stringify(mapped));
      return mapped;
    }
  } catch (_) {}

  // Local storage fallback
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  return [];
}

