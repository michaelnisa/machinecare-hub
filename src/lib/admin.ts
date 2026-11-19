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
      // Ensure vehicles have active GPS coordinates so map & TV display them immediately
      try {
        const { data: existingMachines } = await supabase
          .from("machines")
          .select("id, name, telematics_latitude")
          .eq("organisation_id", existingOrg.id);

        if (existingMachines && existingMachines.some((m: any) => !m.telematics_latitude)) {
          const nowIso = new Date().toISOString();
          await supabase.from("machines").update({
            telematics_latitude: -6.7924,
            telematics_longitude: 39.2083,
            telematics_speed: 68,
            telematics_ignition: true,
            telematics_battery_volt: 24.6,
            telematics_last_at: nowIso,
          } as any).eq("organisation_id", existingOrg.id).ilike("name", "%Scania%");

          await supabase.from("machines").update({
            telematics_latitude: -3.3869,
            telematics_longitude: 36.6830,
            telematics_speed: 0,
            telematics_ignition: true,
            telematics_battery_volt: 24.2,
            telematics_last_at: nowIso,
          } as any).eq("organisation_id", existingOrg.id).ilike("name", "%Mercedes%");

          await supabase.from("machines").update({
            telematics_latitude: -6.1630,
            telematics_longitude: 35.7516,
            telematics_speed: 0,
            telematics_ignition: false,
            telematics_battery_volt: 12.6,
            telematics_last_at: new Date(Date.now() - 3600000).toISOString(),
          } as any).eq("organisation_id", existingOrg.id).ilike("name", "%Toyota%");
        }
      } catch {
        // ignore
      }

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
    const nowIso = new Date().toISOString();

    // Seed sample vehicles with live coordinates
    const { data: v1 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Scania R500 Prime Mover",
      plate_number: "T 842 DKL",
      category: "Vehicle",
      type: "Truck",
      status: "operational",
      current_odometer_km: 412500,
      telematics_latitude: -6.7924,
      telematics_longitude: 39.2083,
      telematics_speed: 68,
      telematics_ignition: true,
      telematics_battery_volt: 24.6,
      telematics_last_at: nowIso,
      notes: "GPS tracked cross-border hauler",
    } as any).select("id").single();

    const { data: v2 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Mercedes Actros 3340",
      plate_number: "T 619 DSE",
      category: "Vehicle",
      type: "Truck",
      status: "operational",
      current_odometer_km: 389200,
      telematics_latitude: -3.3869,
      telematics_longitude: 36.6830,
      telematics_speed: 0,
      telematics_ignition: true,
      telematics_battery_volt: 24.2,
      telematics_last_at: nowIso,
      notes: "GPS tracked transit tanker",
    } as any).select("id").single();

    const { data: v3 } = await supabase.from("machines").insert({
      organisation_id: orgId,
      name: "Toyota Hilux GD-6 Support",
      plate_number: "T 194 EAP",
      category: "Vehicle",
      type: "Pickup",
      status: "operational",
      current_odometer_km: 84300,
      telematics_latitude: -6.1630,
      telematics_longitude: 35.7516,
      telematics_speed: 0,
      telematics_ignition: false,
      telematics_battery_volt: 12.6,
      telematics_last_at: new Date(Date.now() - 3600000).toISOString(),
      notes: "GPS tracked escort unit",
    } as any).select("id").single();

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

/**
 * Idempotently provision the Machinecare Transport Company (Enterprise Fleet Edition).
 * Seeds enterprise commercial vehicles and workshop fixed assets (Slide 19).
 */
export async function provisionMachinecareTransportCompany(): Promise<{
  success: boolean;
  orgId?: string;
  isNew?: boolean;
  error?: string;
}> {
  try {
    // 1. Check if already existing
    const { data: existingOrg } = await supabase
      .from("organisations")
      .select("id, name, industry_profile, industry, plan")
      .ilike("name", "%Machinecare Transport%")
      .limit(1)
      .maybeSingle();

    if (existingOrg) {
      if (existingOrg.plan !== "enterprise") {
        await supabase
          .from("organisations")
          .update({ plan: "enterprise" } as any)
          .eq("id", existingOrg.id);
      }
      return { success: true, orgId: existingOrg.id, isNew: false };
    }

    // 2. Insert new Machinecare Transport Company organisation
    const { data: newOrg, error: orgErr } = await supabase
      .from("organisations")
      .insert({
        name: "Machinecare Transport Company",
        industry_profile: "fleet_logistics",
        industry: "transport",
        plan: "enterprise",
        enabled_modules: ["fleet", "maintenance", "inventory"],
      } as any)
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      return {
        success: false,
        error: orgErr?.message || "Failed to create Machinecare Transport Company",
      };
    }

    const orgId = newOrg.id;
    const nowIso = new Date().toISOString();

    // 3. Seed Enterprise Commercial Haulage Fleet
    const { data: insertedVehicles } = await supabase.from("machines").insert([
      {
        organisation_id: orgId,
        name: "Scania R500 6x4 Prime Mover",
        plate_number: "T 842 DKL",
        make: "Scania",
        model: "R500",
        year: 2023,
        axle_configuration: "6x4",
        head_tank_capacity_l: 600,
        has_trailer: true,
        trailer_plate: "TZ 9012",
        category: "Vehicle",
        type: "Truck",
        status: "operational",
        current_odometer_km: 412500,
        telematics_latitude: -6.7924,
        telematics_longitude: 39.2083,
        telematics_speed: 68,
        telematics_ignition: true,
        telematics_battery_volt: 24.6,
        telematics_last_at: nowIso,
        notes: "Heavy haulage prime mover assigned to Lusaka transit corridor",
      },
      {
        organisation_id: orgId,
        name: "Sinotruk Howo 371 Tipper",
        plate_number: "T 412 DFB",
        make: "Sinotruk",
        model: "Howo 371",
        year: 2022,
        axle_configuration: "6x4",
        head_tank_capacity_l: 400,
        category: "Vehicle",
        type: "Truck",
        status: "operational",
        current_odometer_km: 268400,
        telematics_latitude: -6.8222,
        telematics_longitude: 37.6612,
        telematics_speed: 0,
        telematics_ignition: false,
        telematics_battery_volt: 24.1,
        telematics_last_at: nowIso,
        notes: "Regional distribution bulk tipper",
      },
      {
        organisation_id: orgId,
        name: "Mercedes-Benz Actros 3340 Tanker",
        plate_number: "T 619 DSE",
        make: "Mercedes-Benz",
        model: "Actros 3340",
        year: 2021,
        axle_configuration: "6x4",
        head_tank_capacity_l: 500,
        category: "Vehicle",
        type: "Truck",
        status: "operational",
        current_odometer_km: 389200,
        telematics_latitude: -3.3869,
        telematics_longitude: 36.6830,
        telematics_speed: 0,
        telematics_ignition: true,
        telematics_battery_volt: 24.2,
        telematics_last_at: nowIso,
        notes: "Transit fuel and liquid cargo tanker",
      },
      {
        organisation_id: orgId,
        name: "Tri-Axle Skeletal Container Trailer",
        plate_number: "TZ 9012",
        make: "Afrit",
        model: "Tri-Axle Skeletal",
        year: 2024,
        axle_configuration: "trailer_tri",
        category: "Vehicle",
        type: "Trailer",
        status: "operational",
        current_odometer_km: 195000,
        notes: "40ft intermodal container chassis",
      },
      // 4. Seed Workshop Fixed Assets (Mega Beverages Slide 19)
      {
        organisation_id: orgId,
        name: "Atlas Copco GA37 VSD+ Industrial Air Compressor",
        serial_number: "AC-GA37-2024-09",
        category: "Workshop Equipment",
        type: "Compressor",
        status: "operational",
        notes: "[workshop_asset] Workshop pneumatic line master compressor (Bay 01-04)",
      },
      {
        organisation_id: orgId,
        name: "Caterpillar 250kVA Standby Diesel Generator",
        serial_number: "CAT-C9-250-881",
        category: "Workshop Equipment",
        type: "Generator",
        status: "operational",
        notes: "[workshop_asset] Workshop and yard backup electrical power unit",
      },
      {
        organisation_id: orgId,
        name: "Ravaglioli 24-Ton Heavy Vehicle 4-Post Lift",
        serial_number: "RAV-HV24-002",
        category: "Workshop Equipment",
        type: "Pneumatics/Lift",
        status: "operational",
        notes: "[workshop_asset] Heavy truck inspection and overhaul rack (Heavy Bay 02)",
      },
      {
        organisation_id: orgId,
        name: "Kärcher HDS 1000 De High-Pressure Fleet Washer",
        serial_number: "KRC-HDS-9912",
        category: "Workshop Equipment",
        type: "Wash System",
        status: "operational",
        notes: "[workshop_asset] Steam cleaning washbay unit for chassis degreasing",
      },
    ] as any).select("id, plate_number");

    // 5. Seed Scania R500 Commercial Tyres (Slide 18 Axle Layout)
    if (insertedVehicles && insertedVehicles.length > 0) {
      const scania = insertedVehicles.find((m: any) => m.plate_number === "T 842 DKL");
      if (scania) {
        await supabase.from("tyres").insert([
          { machine_id: scania.id, position: "A1L", brand: "Michelin", pattern: "X Multi Z", size: "315/80R22.5", serial: "MICH-8812", current_tread_mm: 9.5, fitted_odo: 360000 },
          { machine_id: scania.id, position: "A1R", brand: "Michelin", pattern: "X Multi Z", size: "315/80R22.5", serial: "MICH-8813", current_tread_mm: 9.5, fitted_odo: 360000 },
          { machine_id: scania.id, position: "B1-LO", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4101", current_tread_mm: 8.2, fitted_odo: 365000 },
          { machine_id: scania.id, position: "B1-LI", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4102", current_tread_mm: 8.0, fitted_odo: 365000 },
          { machine_id: scania.id, position: "B1-RI", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4103", current_tread_mm: 8.0, fitted_odo: 365000 },
          { machine_id: scania.id, position: "B1-RO", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4104", current_tread_mm: 8.1, fitted_odo: 365000 },
          { machine_id: scania.id, position: "B2-LO", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4201", current_tread_mm: 7.8, fitted_odo: 370000 },
          { machine_id: scania.id, position: "B2-LI", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4202", current_tread_mm: 7.6, fitted_odo: 370000 },
          { machine_id: scania.id, position: "B2-RI", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4203", current_tread_mm: 7.5, fitted_odo: 370000 },
          { machine_id: scania.id, position: "B2-RO", brand: "Bridgestone", pattern: "M729", size: "315/80R22.5", serial: "BRDG-4204", current_tread_mm: 7.7, fitted_odo: 370000 },
          { machine_id: scania.id, position: "Spare1", brand: "Pirelli", pattern: "Formula D", size: "315/80R22.5", serial: "PIRE-0012", current_tread_mm: 12.0, fitted_odo: 340000 },
        ] as any);
      }
    }

    // 6. Seed Enterprise Starter Approval Dossiers (Slide 16 Tender Workflow)
    try {
      const storageKey = `machinecare_fleet_approvals_v1_${orgId}`;
      const starterApprovals = [
        {
          id: `app-starter-01`,
          organisation_id: orgId,
          request_number: "REQ-2026-0041",
          request_type: "purchase_requisition",
          priority: "urgent",
          title: "Scania R500 Turbocharger Assembly & Manifold Gasket Overhaul",
          description: "Major exhaust manifold pressure loss on T 842 DKL. Requires genuine BorgWarner or Scania OEM turbocharger.",
          vehicle_plate: "T 842 DKL",
          amount: 3850000,
          currency: "TZS",
          department: "Workshop & Maintenance",
          requested_by: "system_provisioner",
          requester_name: "Workshop Foreman (Hamisi Juma)",
          items: [
            { name: "Scania Turbocharger Assembly DC16", quantity: 1, unit_price: 3600000, total_price: 3600000 },
            { name: "High-Temp Turbo Manifold Gasket Set", quantity: 1, unit_price: 250000, total_price: 250000 },
          ],
          tender_quotes: [
            { vendor_name: "Scania Tanzania Ltd (Dar Es Salaam)", unit_price: 3850000, total_price: 3850000, delivery_days: 2, warranty_months: 12, is_selected: true },
            { vendor_name: "Commercial Heavy Spares & Diesel Ltd", unit_price: 4100000, total_price: 4100000, delivery_days: 4, warranty_months: 6, is_selected: false },
            { vendor_name: "Trans-Africa Auto Parts Co.", unit_price: 4250000, total_price: 4250000, delivery_days: 5, warranty_months: 6, is_selected: false },
          ],
          selected_tender_vendor: "Scania Tanzania Ltd (Dar Es Salaam)",
          status: "pending_procurement",
          current_stage: "procurement",
          approval_chain: [
            { stage: "supervisor", stage_label: "Workshop Supervisor", role_required: "supervisor", status: "approved", reviewer_name: "Hamisi Juma (Supervisor)", reviewed_at: new Date(Date.now() - 7200000).toISOString(), note: "Visual turbo seal leakage verified in inspection bay." },
            { stage: "fleet_manager", stage_label: "Fleet Operations Manager", role_required: "fleet_manager", status: "approved", reviewer_name: "Rashid Salim (Fleet Manager)", reviewed_at: new Date(Date.now() - 3600000).toISOString(), note: "Approved. Essential for maintaining Lusaka corridor turnaround." },
            { stage: "procurement", stage_label: "Procurement & Stores Officer", role_required: "procurement", status: "pending" },
            { stage: "finance", stage_label: "Finance Director / Controller", role_required: "finance", status: "pending" },
          ],
          evidence_urls: [],
          created_at: new Date(Date.now() - 10800000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: `app-starter-02`,
          organisation_id: orgId,
          request_number: "REQ-2026-0042",
          request_type: "emergency_breakdown",
          priority: "emergency",
          title: "Mikumi Highway Roadside Clutch Cylinder Rescue",
          description: "Sinotruk Howo T 412 DFB hydraulic clutch cylinder burst at Mikumi corridor KM 182. Roadside rescue dispatched.",
          vehicle_plate: "T 412 DFB",
          amount: 650000,
          currency: "TZS",
          department: "Fleet Operations & Dispatch",
          requested_by: "system_provisioner",
          requester_name: "Driver (John Mwangi)",
          items: [
            { name: "Howo Clutch Slave Cylinder Replacement", quantity: 1, unit_price: 450000, total_price: 450000 },
            { name: "Mobile Mechanic Field Callout & Bleed", quantity: 1, unit_price: 200000, total_price: 200000 },
          ],
          gps_location: "Morogoro-Iringa Highway KM 182 (Mikumi)",
          vendor_name: "Mikumi 24hr Commercial Rescue",
          vendor_phone: "+255 754 889 120",
          status: "approved",
          current_stage: "completed",
          approval_chain: [
            { stage: "supervisor", stage_label: "Workshop Supervisor", role_required: "supervisor", status: "approved", reviewer_name: "Hamisi Juma", reviewed_at: new Date(Date.now() - 3600000).toISOString(), note: "Highway rescue dispatched." },
            { stage: "fleet_manager", stage_label: "Fleet Operations Manager", role_required: "fleet_manager", status: "approved", reviewer_name: "Rashid Salim", reviewed_at: new Date(Date.now() - 1800000).toISOString(), note: "Authorized. Emergency highway protocol." },
            { stage: "finance", stage_label: "Finance Director / Controller", role_required: "finance", status: "approved", reviewer_name: "Grace Mushi (Finance)", reviewed_at: new Date(Date.now() - 600000).toISOString(), note: "Approved for immediate mobile disbursement." },
          ],
          evidence_urls: [],
          created_at: new Date(Date.now() - 5400000).toISOString(),
          updated_at: new Date(Date.now() - 600000).toISOString(),
        },
      ];
      localStorage.setItem(storageKey, JSON.stringify(starterApprovals));
    } catch (_e) {}

    return { success: true, orgId, isNew: true };
  } catch (err: any) {
    console.error("provisionMachinecareTransportCompany error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Creates a generic Fleet Organization account with explicit tier selection:
 * - "standard": Lean Logistixware blueprint (1-stage manager approval, direct disbursements, standard parts)
 * - "enterprise": Full corporate blueprint (5-stage approvals, smart vehicle-parts compatibility, tyre axle matrix, workshop plant, 3-quote tender matrix)
 */
export async function createFleetOrganization({
  name,
  tier,
  seedDemoData = true,
}: {
  name: string;
  tier: "standard" | "enterprise";
  seedDemoData?: boolean;
}): Promise<{
  success: boolean;
  orgId?: string;
  error?: string;
}> {
  try {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Organisation name is required");

    // 1. Insert organisation
    const { data: newOrg, error: orgErr } = await supabase
      .from("organisations")
      .insert({
        name: trimmedName,
        industry_profile: "fleet_logistics",
        industry: "transport",
        plan: tier,
        enabled_modules: ["fleet", "maintenance", "inventory"],
      } as any)
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      throw orgErr || new Error("Failed to create organisation");
    }

    const orgId = newOrg.id;
    const nowIso = new Date().toISOString();

    // 2. Associate current authenticated user with new org
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const userId = authData.user.id;
      try {
        await (supabase as any).from("organisation_members").insert({
          organisation_id: orgId,
          user_id: userId,
          role: "owner",
        });
      } catch (_e) {}
    }

    // 3. Seed demo data if requested
    if (seedDemoData) {
      if (tier === "enterprise") {
        // Seed Commercial Enterprise fleet (Heavy Scania 6x4, Sinotruk, Mercedes Actros, Skeletal Trailer)
        const { data: insertedVehicles } = await supabase.from("machines").insert([
          {
            organisation_id: orgId,
            name: "Scania R500 6x4 Heavy Hauler",
            plate_number: "T 892 DKA",
            category: "Vehicle",
            make: "Scania",
            model: "R500 V8",
            year: 2023,
            axle_configuration: "6x4",
            head_tank_capacity_l: 600,
            status: "active",
            current_odometer_km: 142580,
            telematics_status: "Running",
            telematics_speed: 68,
            telematics_ignition: true,
            telematics_last_at: nowIso,
            telematics_latitude: -6.8235,
            telematics_longitude: 39.2695,
          },
          {
            organisation_id: orgId,
            name: "Sinotruk Howo A7 371 Tipper",
            plate_number: "T 412 DFB",
            category: "Vehicle",
            make: "Sinotruk",
            model: "Howo 371",
            year: 2022,
            axle_configuration: "6x4",
            head_tank_capacity_l: 400,
            status: "active",
            current_odometer_km: 98450,
            telematics_status: "Idle",
            telematics_speed: 0,
            telematics_ignition: true,
            telematics_last_at: nowIso,
            telematics_latitude: -6.7924,
            telematics_longitude: 39.2083,
          },
          {
            organisation_id: orgId,
            name: "Mercedes-Benz Actros 3340",
            plate_number: "T 619 DPL",
            category: "Vehicle",
            make: "Mercedes-Benz",
            model: "Actros 3340",
            year: 2021,
            axle_configuration: "6x4",
            head_tank_capacity_l: 500,
            status: "active",
            current_odometer_km: 215300,
            telematics_status: "Stopped",
            telematics_speed: 0,
            telematics_ignition: false,
            telematics_last_at: nowIso,
            telematics_latitude: -6.8001,
            telematics_longitude: 39.2801,
          },
          {
            organisation_id: orgId,
            name: "Tri-Axle Skeletal Container Trailer",
            plate_number: "T 108 DXX",
            category: "Trailer",
            make: "Afrit",
            model: "Skeletal 40ft",
            year: 2022,
            axle_configuration: "trailer_tri",
            status: "active",
            current_odometer_km: 84200,
          },
        ] as any).select("id, name, plate_number, axle_configuration");

        // Seed Workshop Plant Equipment (Slide 19)
        await supabase.from("machines").insert([
          {
            organisation_id: orgId,
            name: "Atlas Copco GA30+ Rotary Screw Air Compressor",
            plate_number: "PLANT-COMP-01",
            category: "Equipment",
            make: "Atlas Copco",
            model: "GA30+",
            year: 2022,
            status: "active",
            current_odometer_km: 3450,
          },
          {
            organisation_id: orgId,
            name: "Cummins 250kVA Workshop Backup Diesel Generator",
            plate_number: "PLANT-GEN-01",
            category: "Equipment",
            make: "Cummins",
            model: "C250 D5e",
            year: 2021,
            status: "active",
            current_odometer_km: 1820,
          },
          {
            organisation_id: orgId,
            name: "Heavy Commercial 4-Post Hydraulic Workshop Lift (25T)",
            plate_number: "PLANT-LIFT-01",
            category: "Equipment",
            make: "Stertil-Koni",
            model: "SK-2025",
            year: 2023,
            status: "active",
            current_odometer_km: 890,
          },
        ] as any);

        // Seed fitted tyres for Scania
        const scania = (insertedVehicles || []).find((v: any) => v.name?.includes("Scania"));
        if (scania?.id) {
          const tyreRows = [
            { machine_id: scania.id, position: "1L", brand: "Michelin", size: "315/80R22.5", pattern: "steer", serial_number: "MICH-26-8801", current_tread_depth_mm: 13.5, pressure_psi: 120, status: "good" },
            { machine_id: scania.id, position: "1R", brand: "Michelin", size: "315/80R22.5", pattern: "steer", serial_number: "MICH-26-8802", current_tread_depth_mm: 13.2, pressure_psi: 119, status: "good" },
            { machine_id: scania.id, position: "2LO", brand: "Bridgestone", size: "315/80R22.5", pattern: "drive", serial_number: "BS-26-4410", current_tread_depth_mm: 11.0, pressure_psi: 115, status: "good" },
            { machine_id: scania.id, position: "2LI", brand: "Bridgestone", size: "315/80R22.5", pattern: "drive", serial_number: "BS-26-4411", current_tread_depth_mm: 10.8, pressure_psi: 116, status: "good" },
            { machine_id: scania.id, position: "2RI", brand: "Bridgestone", size: "315/80R22.5", pattern: "drive", serial_number: "BS-26-4412", current_tread_depth_mm: 11.2, pressure_psi: 115, status: "good" },
            { machine_id: scania.id, position: "2RO", brand: "Bridgestone", size: "315/80R22.5", pattern: "drive", serial_number: "BS-26-4413", current_tread_depth_mm: 10.9, pressure_psi: 114, status: "good" },
            { machine_id: scania.id, position: "3LO", brand: "Goodyear", size: "315/80R22.5", pattern: "drive", serial_number: "GY-26-9011", current_tread_depth_mm: 9.5, pressure_psi: 114, status: "good" },
            { machine_id: scania.id, position: "3LI", brand: "Goodyear", size: "315/80R22.5", pattern: "drive", serial_number: "GY-26-9012", current_tread_depth_mm: 9.2, pressure_psi: 115, status: "good" },
            { machine_id: scania.id, position: "3RI", brand: "Goodyear", size: "315/80R22.5", pattern: "drive", serial_number: "GY-26-9013", current_tread_depth_mm: 9.4, pressure_psi: 114, status: "good" },
            { machine_id: scania.id, position: "3RO", brand: "Goodyear", size: "315/80R22.5", pattern: "drive", serial_number: "GY-26-9014", current_tread_depth_mm: 9.1, pressure_psi: 112, status: "good" },
            { machine_id: scania.id, position: "SPARE", brand: "Sailun", size: "315/80R22.5", pattern: "all_position", serial_number: "SL-26-0044", current_tread_depth_mm: 14.0, pressure_psi: 125, status: "good" },
          ];
          try {
            await supabase.from("tyres").insert(tyreRows as any);
          } catch (_e) {}
        }
      } else {
        // Seed Standard Fleet (Medium duty distribution trucks: Isuzu Forward, Mitsubishi Fuso Canter, Toyota Hilux)
        await supabase.from("machines").insert([
          {
            organisation_id: orgId,
            name: "Isuzu Forward FRR 11-Ton Box Body",
            plate_number: "T 304 DGM",
            category: "Vehicle",
            make: "Isuzu",
            model: "Forward FRR",
            year: 2022,
            status: "active",
            current_odometer_km: 74200,
            telematics_status: "Running",
            telematics_speed: 45,
            telematics_ignition: true,
            telematics_last_at: nowIso,
          },
          {
            organisation_id: orgId,
            name: "Mitsubishi Fuso Canter 4.5-Ton",
            plate_number: "T 518 DTR",
            category: "Vehicle",
            make: "Mitsubishi",
            model: "Fuso Canter",
            year: 2021,
            status: "active",
            current_odometer_km: 112400,
            telematics_status: "Stopped",
            telematics_speed: 0,
            telematics_ignition: false,
            telematics_last_at: nowIso,
          },
          {
            organisation_id: orgId,
            name: "Toyota Hilux 2.8 D-4D Field Support",
            plate_number: "T 192 DKZ",
            category: "Vehicle",
            make: "Toyota",
            model: "Hilux Single Cab",
            year: 2023,
            status: "active",
            current_odometer_km: 38900,
            telematics_status: "Idle",
            telematics_speed: 0,
            telematics_ignition: true,
            telematics_last_at: nowIso,
          },
        ] as any);
      }
    }

    return { success: true, orgId };
  } catch (err: any) {
    console.error("createFleetOrganization error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

