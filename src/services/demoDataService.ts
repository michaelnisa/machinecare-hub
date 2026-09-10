/**
 * MachineCare Platform - Demo Data Generator & Cleanup Service
 * Instantly populates realistic industrial sample data for prospective customers
 * and allows 1-click cleanup to leave the database pristine.
 */

import { supabase } from "@/integrations/supabase/client";

export const demoDataService = {
  async loadDemoDataset(orgId: string): Promise<{ success: boolean; message: string }> {
    if (!orgId) throw new Error("Organisation ID is required");

    try {
      // 1. Create Sample Machines (notes column used instead of description)
      const machinesToInsert = [
        {
          organisation_id: orgId,
          name: "[DEMO] CNC Milling Center (5-Axis)",
          category: "Production",
          make: "Haas",
          model: "VF-4SS",
          year: 2023,
          status: "active",
          current_hours: 1450,
          notes: "[DEMO] High-precision 5-axis vertical machining center",
        },
        {
          organisation_id: orgId,
          name: "[DEMO] Hydraulic Stamping Press 250T",
          category: "Pressing",
          make: "Schuler",
          model: "HP-250",
          year: 2021,
          status: "active",
          current_hours: 3200,
          notes: "[DEMO] Primary automated stamping press",
        },
        {
          organisation_id: orgId,
          name: "[DEMO] Rotary Screw Air Compressor 75kW",
          category: "Utilities",
          make: "Atlas Copco",
          model: "GA-75",
          year: 2022,
          status: "active",
          current_hours: 4120,
          notes: "[DEMO] Central shop pneumatic supply compressor",
        },
      ];

      const { data: insertedMachines, error: mErr } = await supabase
        .from("machines")
        .insert(machinesToInsert)
        .select("id, name");

      if (mErr) throw mErr;

      const primaryMachineId = insertedMachines?.[0]?.id;
      const secondaryMachineId = insertedMachines?.[1]?.id;

      // 2. Create Sample Work Orders
      if (primaryMachineId) {
        try {
          await supabase.from("work_orders").insert([
            {
              organisation_id: orgId,
              machine_id: primaryMachineId,
              title: "[DEMO] 1500h Preventive Spindle Lubrication & Alignment",
              description: "Replace primary synthetic grease cartridges and check runout on spindle taper.",
              priority: "medium",
              status: "in_progress",
              work_type: "preventive",
              due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
            },
            {
              organisation_id: orgId,
              machine_id: secondaryMachineId || primaryMachineId,
              title: "[DEMO] High-Pressure Hydraulic Seal Inspection",
              description: "Check manifold cylinder seals for pressure drops after scheduled batch run.",
              priority: "high",
              status: "open",
              work_type: "corrective",
              due_date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
            },
          ]);
        } catch (e) {
          console.warn("Work orders demo insert warning:", e);
        }
      }

      // 3. Create Sample Spare Parts in inventory_items
      try {
        await supabase.from("inventory_items").insert([
          {
            organisation_id: orgId,
            name: "[DEMO] High-Pressure Hydraulic Filter Element",
            part_number: "HF-250-X",
            category: "filter",
            quantity: 8,
            reorder_level: 3,
            unit_cost: 145.0,
            unit: "pcs",
            status: "active",
            order_status: "received",
          },
          {
            organisation_id: orgId,
            name: "[DEMO] Synthetic Spindle Lubricant ISO VG 68 (20L)",
            part_number: "LUB-VG68-20L",
            category: "oil",
            quantity: 4,
            reorder_level: 2,
            unit_cost: 210.0,
            unit: "litres",
            status: "active",
            order_status: "received",
          },
        ]);
      } catch (e) {
        console.warn("Inventory demo insert warning:", e);
      }

      // 4. Safety Incidents & Hazards (/safety)
      try {
        await supabase.from("safety_incidents").insert([
          {
            organisation_id: orgId,
            description: "[DEMO] Minor hydraulic fluid seepage spotted during pre-start check. Spill kit applied; work order dispatched.",
            incident_type: "hazard",
            severity: "low",
            status: "investigating",
            occurred_at: new Date(Date.now() - 2 * 3600000).toISOString(),
            machine_id: primaryMachineId || null,
          },
          {
            organisation_id: orgId,
            description: "[DEMO] Near-miss: Stored material shifted on high-density pallet racking during forklift transit.",
            incident_type: "near_miss",
            severity: "medium",
            status: "open",
            occurred_at: new Date(Date.now() - 24 * 3600000).toISOString(),
          },
          {
            organisation_id: orgId,
            description: "[DEMO] Thermal overload sensor trip on auxiliary cooling circulation pump. Controlled cooldown executed.",
            incident_type: "asset_damage",
            severity: "low",
            status: "closed",
            occurred_at: new Date(Date.now() - 72 * 3600000).toISOString(),
            machine_id: secondaryMachineId || null,
          },
        ]);
      } catch (e) {
        console.warn("Safety incidents demo insert warning:", e);
      }

      // 5. Safety Risk Assessments / RAMS (/safety/risk-assessments)
      try {
        await supabase.from("risk_assessments").insert([
          {
            organisation_id: orgId,
            title: "[DEMO] High-Voltage Switchgear Replacement & Busbar Torque Testing (RAMS)",
            activity: "Transformer de-energization, busbar re-torque, and thermal scan",
            overall_risk: "high",
            status: "pending_approval",
            machine_id: primaryMachineId || null,
          },
          {
            organisation_id: orgId,
            title: "[DEMO] Confined Space Slurry Tank Internal Inspection (RAMS)",
            activity: "Gas clearance testing, vessel entry, ultrasonic wall thickness measurement",
            overall_risk: "medium",
            status: "approved",
          },
          {
            organisation_id: orgId,
            title: "[DEMO] Working at Heights - Overhead Gantry Crane Beam Alignment (RAMS)",
            activity: "Scissor lift elevated access, rail laser measurement, gear mesh calibration",
            overall_risk: "high",
            status: "approved",
          },
        ]);
      } catch (e) {
        console.warn("Risk assessments demo insert warning:", e);
      }

      // 6. Safety Corrective Actions / CAPA (/safety/corrective-actions)
      try {
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        await supabase.from("corrective_actions").insert([
          {
            organisation_id: orgId,
            description: "[DEMO] Install secondary spill containment bunding beneath hydraulic power pack",
            priority: "high",
            status: "open",
            source_type: "hazard",
            due_date: nextWeek,
            department: "Machining",
          },
          {
            organisation_id: orgId,
            description: "[DEMO] Recalibrate emergency trip-wire tension along stamping conveyor line",
            priority: "medium",
            status: "in_progress",
            source_type: "audit",
            due_date: inTwoWeeks,
            department: "Production",
          },
        ]);
      } catch (e) {
        console.warn("Corrective actions demo insert warning:", e);
      }

      // 7. Safety Equipment & Inspection Assets (/safety/equipment)
      try {
        const nextMonth = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
        const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

        await supabase.from("safety_equipment").insert([
          {
            organisation_id: orgId,
            name: "[DEMO] CO2 Fire Extinguisher 5kg (Bay 3)",
            equipment_type: "fire_extinguisher",
            asset_tag: "FE-003",
            location: "Main Workshop Bay 3",
            condition: "good",
            inspection_frequency_days: 30,
            next_inspection_date: nextMonth,
            notes: "[DEMO] Hydrostatic pressure certified until 2028",
          },
          {
            organisation_id: orgId,
            name: "[DEMO] Emergency Eye Wash Station (Battery Room)",
            equipment_type: "eyewash_station",
            asset_tag: "EW-001",
            location: "Battery Charging Area",
            condition: "good",
            inspection_frequency_days: 7,
            next_inspection_date: nextWeek,
            notes: "[DEMO] Weekly water flush check logged",
          },
          {
            organisation_id: orgId,
            name: "[DEMO] Industrial First Aid Station Kit (Hall A)",
            equipment_type: "first_aid_kit",
            asset_tag: "FA-002",
            location: "Assembly Area 1",
            condition: "good",
            inspection_frequency_days: 30,
            next_inspection_date: nextMonth,
            notes: "[DEMO] Stock replenishment verified",
          },
        ]);
      } catch (e) {
        console.warn("Safety equipment demo insert warning:", e);
      }

      // 8. Controlled & Calibrated Tools (/safety/controlled-tools)
      try {
        const calibDue = new Date(Date.now() + 150 * 86400000).toISOString().slice(0, 10);
        const lastCalib = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

        await supabase.from("controlled_tools").insert([
          {
            organisation_id: orgId,
            name: "[DEMO] Digital Torque Wrench 40-200 Nm",
            tool_type: "torque",
            asset_tag: "CT-001",
            serial_number: "TW-2023-994",
            condition: "good",
            status: "available",
            location: "Calibration Tool Crib",
            last_calibration_date: lastCalib,
            calibration_due_date: calibDue,
            requires_safety_approval: false,
            notes: "[DEMO] Calibrated to ISO 6789 precision standards",
          },
          {
            organisation_id: orgId,
            name: "[DEMO] Multi-Gas Detector 4-Gas (O2/LEL/CO/H2S)",
            tool_type: "gas_detector",
            asset_tag: "GD-002",
            serial_number: "SN-GAS-4410",
            condition: "good",
            status: "available",
            location: "Safety Office",
            last_calibration_date: lastCalib,
            calibration_due_date: calibDue,
            requires_safety_approval: true,
            notes: "[DEMO] Bump tested and certified with quad-gas mix",
          },
        ]);
      } catch (e) {
        console.warn("Controlled tools demo insert warning:", e);
      }

      // 9. Hazardous Chemical Registry (/safety/chemicals)
      try {
        await (supabase as any).from("safety_chemicals").insert([
          {
            organisation_id: orgId,
            name: "[DEMO] Heavy Duty Industrial Degreaser Solvent",
            trade_name: "Kleenex 400 Solvent",
            cas_number: "64742-47-8",
            un_number: "UN1268",
            storage_location: "Chemical Locker Bay 2",
            container_type: "drum",
            signal_word: "Warning",
            ghs_pictograms: ["flame", "health_hazard"],
            hazard_statements: "Flammable liquid and vapour. Causes serious eye irritation.",
            precautionary_statements: "Keep away from heat, hot surfaces, sparks, open flames. Wear protective gloves and eye protection.",
            first_aid_inhalation: "Move to fresh air. If breathing is difficult, administer oxygen.",
            first_aid_skin: "Wash immediately with soap and plenty of water.",
            first_aid_eyes: "Rinse cautiously with water for several minutes.",
            current_quantity: 45,
            max_storage_quantity: 200,
            unit: "Liters",
          },
          {
            organisation_id: orgId,
            name: "[DEMO] Synthetic High-Temp Spindle Coolant",
            trade_name: "CoolCut Ultra 500",
            cas_number: "102-71-6",
            storage_location: "Utility Bay Chemical Rack",
            container_type: "drum",
            signal_word: "Warning",
            ghs_pictograms: ["exclamation"],
            hazard_statements: "Causes skin irritation and mild eye irritation.",
            precautionary_statements: "Avoid breathing mist. Wash thoroughly after handling.",
            current_quantity: 80,
            max_storage_quantity: 200,
            unit: "Liters",
          },
        ]);
      } catch (e) {
        console.warn("Safety chemicals demo insert warning:", e);
      }

      // 10. Golden Safety Rules (/safety/rules)
      try {
        await (supabase as any).from("safety_rules").insert([
          {
            organisation_id: orgId,
            name: "[DEMO] Mandatory Lockout/Tagout (LOTO) for Machine Overhauls",
            match_field: "work_type",
            match_value: "preventive",
            requires_loto: true,
            requires_ptw: true,
            requires_risk_assessment: true,
            required_ppe: ["Safety Glasses", "Ear Plugs", "Steel Toe Boots"],
            is_active: true,
          },
          {
            organisation_id: orgId,
            name: "[DEMO] 100% Tie-Off Fall Protection Above 1.8 Meters",
            match_field: "category",
            match_value: "Production",
            requires_loto: false,
            requires_ptw: true,
            requires_risk_assessment: true,
            required_ppe: ["Full Body Harness", "Shock-Absorbing Lanyard", "Hard Hat"],
            is_active: true,
          },
        ]);
      } catch (e) {
        console.warn("Safety rules demo insert warning:", e);
      }

      // 11. PPE Requirements (/safety/ppe)
      try {
        await (supabase as any).from("ppe_requirements").insert([
          {
            organisation_id: orgId,
            activity: "[DEMO] CNC Machining & High-Speed Milling",
            required_ppe: ["Safety Glasses with Side Shields", "Ear Defenders (SNR 30dB)", "Cut-Resistant Level 5 Gloves", "Steel Toe Safety Boots"],
            notes: "[DEMO] Mandatory compliance zone across Machine Shop bay",
          },
          {
            organisation_id: orgId,
            activity: "[DEMO] Chemical Decanting & Fluid Transfer",
            required_ppe: ["Chemical Splash Goggles", "Nitrile Chemical Gloves", "PVC Acid Apron", "Vapour Respirator"],
            notes: "[DEMO] Required for all coolant refilling and oil transfer",
          },
        ]);
      } catch (e) {
        console.warn("PPE requirements demo insert warning:", e);
      }

      // 12. Approved Safety Contractors (/safety/contractors)
      try {
        await (supabase as any).from("contractors").insert([
          {
            organisation_id: orgId,
            company_name: "[DEMO] Apex Industrial Electrical Specialists Ltd",
            contact_name: "David M. Vance",
            contact_email: "david@apex-electric.demo",
            contact_phone: "+255 784 123 456",
            status: "approved",
            insurance_expiry: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
            notes: "[DEMO] Certified high-voltage switchgear and transformer contractor",
          },
        ]);
      } catch (e) {
        console.warn("Contractors demo insert warning:", e);
      }

      return {
        success: true,
        message: "Demo dataset successfully generated! Machines, work orders, spares, and all Safety HSE modules are now live.",
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || "Failed to generate demo data",
      };
    }
  },

  async clearDemoDataset(orgId: string): Promise<{ success: boolean; message: string }> {
    if (!orgId) throw new Error("Organisation ID is required");

    try {
      // Clear demo records tagged with [DEMO] across all modules
      await Promise.all([
        supabase.from("work_orders").delete().eq("organisation_id", orgId).ilike("title", "%[DEMO]%"),
        supabase.from("safety_incidents").delete().eq("organisation_id", orgId).ilike("description", "%[DEMO]%"),
        supabase.from("risk_assessments").delete().eq("organisation_id", orgId).ilike("title", "%[DEMO]%"),
        supabase.from("corrective_actions").delete().eq("organisation_id", orgId).ilike("description", "%[DEMO]%"),
        supabase.from("safety_equipment").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        supabase.from("controlled_tools").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        (supabase as any).from("safety_chemicals").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        (supabase as any).from("safety_rules").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        (supabase as any).from("ppe_requirements").delete().eq("organisation_id", orgId).ilike("activity", "%[DEMO]%"),
        (supabase as any).from("contractors").delete().eq("organisation_id", orgId).ilike("company_name", "%[DEMO]%"),
        supabase.from("inventory_items").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        supabase.from("machines").delete().eq("organisation_id", orgId).ilike("name", "%[DEMO]%"),
        supabase.from("machines").delete().eq("organisation_id", orgId).ilike("notes", "%[DEMO]%"),
      ]);

      return {
        success: true,
        message: "Sample demo records cleared across all modules. Your workspace is now clean.",
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || "Failed to clear demo data",
      };
    }
  },
};
