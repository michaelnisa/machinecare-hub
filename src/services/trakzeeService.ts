/**
 * Trakzee Telematics & GPS Tracking Service
 * Coordinates live telemetry sync between MachineCare and Trakzee for Logistixwave Tanzania.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TrakzeeConfig {
  trakzee_enabled: boolean;
  trakzee_server_url: string;
  trakzee_username: string;
  trakzee_password: string;
  trakzee_company_name: string;
  trakzee_project_id: string;
  trakzee_last_synced_at?: string | null;
}

export interface TrakzeeTestResult {
  success: boolean;
  message?: string;
  error?: string;
  token_preview?: string;
}

export interface TrakzeeSyncResult {
  success: boolean;
  vehicles_returned?: number;
  vehicles_updated?: number;
  last_synced_at?: string;
  error?: string;
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
  trakzee_server_url: "http://165.22.222.196/webservice",
  trakzee_username: "",
  trakzee_password: "",
  trakzee_company_name: "Logistixwave Tanzania",
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
 * Gracefully defaults if columns do not exist in schema cache yet.
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

    return {
      trakzee_enabled: data.trakzee_enabled ?? false,
      trakzee_server_url: data.trakzee_server_url || DEFAULT_TRAKZEE_CONFIG.trakzee_server_url,
      trakzee_username: data.trakzee_username || "",
      trakzee_password: data.trakzee_password || "",
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
 * Handles schema cache resilience gracefully.
 */
export async function saveTrakzeeSettings(
  organisationId: string,
  cfg: TrakzeeConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from("organisations")
      .update({
        trakzee_enabled: cfg.trakzee_enabled,
        trakzee_server_url: cfg.trakzee_server_url.trim(),
        trakzee_username: cfg.trakzee_username.trim() || null,
        trakzee_password: cfg.trakzee_password.trim() || null,
        trakzee_company_name: cfg.trakzee_company_name.trim() || null,
        trakzee_project_id: cfg.trakzee_project_id.trim() || null,
      })
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

/**
 * Tests connection and credentials against Trakzee API via the secure Edge Function.
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
      const formatted = await extractEdgeFunctionError(error);
      return { success: false, error: formatted };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Authentication failed" };
    }

    return {
      success: true,
      message: data.message || "Connected to Trakzee successfully!",
      token_preview: data.token_preview,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to reach telematics server" };
  }
}

/**
 * Triggers a live telematics sync for the fleet.
 */
export async function syncTrakzeeFleet(organisationId: string): Promise<TrakzeeSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke("trakzee-telematics", {
      body: {
        action: "sync_fleet",
        organisation_id: organisationId,
      },
    });

    if (error) {
      const formatted = await extractEdgeFunctionError(error);
      return { success: false, error: formatted };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Failed to sync fleet" };
    }

    return {
      success: true,
      vehicles_returned: data.vehicles_returned ?? 0,
      vehicles_updated: data.vehicles_updated ?? 0,
      last_synced_at: data.last_synced_at,
      details: data.details,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error syncing fleet" };
  }
}
