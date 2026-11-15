import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_ADMIN_EMAILS = [
  "michaelnisa3@gmail.com",
];

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Switch the active organisation for the current platform administrator.
 */
export async function switchAdminOrganisation(targetOrgId: string): Promise<{ success: boolean; orgName?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isPlatformAdmin(user.email)) {
      return { success: false, error: "Unauthorized. Platform Admin required." };
    }

    // 1. Try security definer RPC
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc("admin_switch_organisation", {
      target_org_id: targetOrgId,
    });

    if (!rpcErr && rpcData?.success) {
      return { success: true, orgName: rpcData.org_name };
    }

    // 2. Client fallback: direct update on profiles
    const { error: directErr } = await supabase
      .from("profiles")
      .update({ organisation_id: targetOrgId })
      .eq("id", user.id);

    if (directErr) {
      console.warn("Direct profiles update fallback failed:", directErr);
      return { success: false, error: directErr.message || rpcErr?.message };
    }

    const { data: orgData } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", targetOrgId)
      .maybeSingle();

    return { success: true, orgName: orgData?.name || "Target Organisation" };
  } catch (err: any) {
    console.error("switchAdminOrganisation error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Idempotently provision the MachineCare GPS Tracking suite and demo telemetry.
 */
export async function provisionMachineCareGpsAccount(): Promise<{ success: boolean; orgId?: string; isNew?: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isPlatformAdmin(user.email)) {
      return { success: false, error: "Unauthorized. Platform Admin required." };
    }

    // 1. Try security definer RPC
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc("admin_provision_machinecare_gps");
    if (!rpcErr && rpcData?.success) {
      return {
        success: true,
        orgId: rpcData.org_id,
        isNew: rpcData.is_new,
      };
    }

    // 2. Client-side fallback: check existing or insert
    const { data: existingOrg } = await supabase
      .from("organisations")
      .select("id, name, industry_profile, industry")
      .ilike("name", "%MachineCare GPS%")
      .limit(1)
      .maybeSingle();

    if (existingOrg) {
      return { success: true, orgId: existingOrg.id, isNew: false };
    }

    // Insert new MachineCare GPS organisation
    // Uses 'fleet_logistics' for industry_profile to stay 100% compatible with PostgreSQL enum,
    // and industry: 'gps_tracking' as text. Does not rely on enabled_modules column existing in schema cache.
    const { data: newOrg, error: orgErr } = await supabase
      .from("organisations")
      .insert({
        name: "MachineCare GPS Tracking",
        industry_profile: "fleet_logistics",
        industry: "gps_tracking",
        plan: "enterprise",
      } as any)
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      return { success: false, error: orgErr?.message || "Failed to create MachineCare GPS organization" };
    }

    const orgId = newOrg.id;

    // Seed sample vehicles
    const { data: v1 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Scania R500 Prime Mover",
      plate_number: "T 842 DKL",
      category: "Vehicle",
      type: "Truck",
      status: "operational",
      current_odometer_km: 412500,
      notes: "GPS tracked cross-border hauler",
    }).select("id").single();

    const { data: v2 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Mercedes Actros 3340",
      plate_number: "T 619 DSE",
      category: "Vehicle",
      type: "Truck",
      status: "operational",
      current_odometer_km: 389200,
      notes: "GPS tracked transit tanker",
    }).select("id").single();

    const { data: v3 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Toyota Hilux GD-6 Support",
      plate_number: "T 194 EAP",
      category: "Vehicle",
      type: "Pickup",
      status: "operational",
      current_odometer_km: 84300,
      notes: "GPS tracked escort unit",
    }).select("id").single();

    // Seed devices & positions if tables exist
    try {
      const { data: d1 } = await (supabase as any).from("gps_devices").insert({
        organisation_id: orgId,
        imei: "863452041234561",
        name: "Teltonika FMC920 #1",
        manufacturer: "Teltonika",
        model: "FMC920",
        protocol: "teltonika",
        sim_carrier: "Vodacom TZ",
        status: "active",
      }).select("id").single();

      const { data: d2 } = await (supabase as any).from("gps_devices").insert({
        organisation_id: orgId,
        imei: "863452041234562",
        name: "Teltonika FMC130 #2",
        manufacturer: "Teltonika",
        model: "FMC130",
        protocol: "teltonika",
        sim_carrier: "Airtel TZ",
        status: "active",
      }).select("id").single();

      const { data: d3 } = await (supabase as any).from("gps_devices").insert({
        organisation_id: orgId,
        imei: "863452041234563",
        name: "Concox WeTrack2 #3",
        manufacturer: "Concox",
        model: "WeTrack2",
        protocol: "gt06",
        sim_carrier: "Tigo TZ",
        status: "active",
      }).select("id").single();

      if (v1 && d1) {
        await (supabase as any).from("vehicle_gps_assignments").insert({
          organisation_id: orgId,
          device_id: d1.id,
          vehicle_id: v1.id,
          status: "active",
          installation_location: "Under Dashboard OBD",
        });
        await (supabase as any).from("latest_vehicle_positions").upsert({
          vehicle_id: v1.id,
          device_id: d1.id,
          organisation_id: orgId,
          latitude: -6.816200,
          longitude: 39.280400,
          speed_kmh: 38.5,
          heading: 270.0,
          ignition: true,
          motion_status: "moving",
          satellite_count: 14,
          address: "Kurasini Port Terminal, Dar es Salaam",
          recorded_at: new Date().toISOString(),
        });
      }

      if (v2 && d2) {
        await (supabase as any).from("vehicle_gps_assignments").insert({
          organisation_id: orgId,
          device_id: d2.id,
          vehicle_id: v2.id,
          status: "active",
          installation_location: "Fuse Box / Main Harness",
        });
        await (supabase as any).from("latest_vehicle_positions").upsert({
          vehicle_id: v2.id,
          device_id: d2.id,
          organisation_id: orgId,
          latitude: -6.822200,
          longitude: 37.661200,
          speed_kmh: 64.0,
          heading: 285.0,
          ignition: true,
          motion_status: "moving",
          satellite_count: 16,
          address: "Morogoro Highway, Morogoro",
          recorded_at: new Date().toISOString(),
        });
      }

      if (v3 && d3) {
        await (supabase as any).from("vehicle_gps_assignments").insert({
          organisation_id: orgId,
          device_id: d3.id,
          vehicle_id: v3.id,
          status: "active",
          installation_location: "Behind Instrument Cluster",
        });
        await (supabase as any).from("latest_vehicle_positions").upsert({
          vehicle_id: v3.id,
          device_id: d3.id,
          organisation_id: orgId,
          latitude: -6.173000,
          longitude: 35.741900,
          speed_kmh: 0.0,
          heading: 0.0,
          ignition: false,
          motion_status: "stopped",
          satellite_count: 12,
          address: "Dodoma Capital Operations Yard, Dodoma",
          recorded_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("GPS telematics tables seed notice:", e);
    }

    return { success: true, orgId, isNew: true };
  } catch (err: any) {
    console.error("provisionMachineCareGpsAccount error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
