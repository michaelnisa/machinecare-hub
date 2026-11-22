import { supabase } from "../config/supabase";
import { DriverSession, DriverVehicleBinding } from "./storageService";

export interface ParsedDriver {
  id: string;
  fullName: string;
  phone: string | null;
  driverCode: string | null;
  email: string | null;
  licenseNumber: string | null;
  assignedVehicle: string | null;
  loginPin: string | null;
  organisationId: string | null;
  photoUrl: string | null;
  rawNotes: any;
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  }
  return digits;
}

export function parseDriverRow(row: any): ParsedDriver {
  let driverCode: string | null = null;
  let email: string | null = null;
  let licenseNumber: string | null = null;
  let assignedVehicle: string | null = null;
  let loginPin: string | null = null;
  let rawNotes: any = {};

  if (row.notes && typeof row.notes === "string" && row.notes.startsWith("{") && row.notes.endsWith("}")) {
    try {
      rawNotes = JSON.parse(row.notes);
      driverCode = rawNotes.driver_code || null;
      email = rawNotes.email || null;
      licenseNumber = rawNotes.license_number || rawNotes.licence_number || null;
      assignedVehicle = rawNotes.assigned_vehicle || null;
      loginPin = rawNotes.login_pin ? String(rawNotes.login_pin).trim() : null;
    } catch {
      rawNotes = { text: row.notes };
    }
  } else if (row.notes) {
    rawNotes = { text: row.notes };
  }

  return {
    id: row.id,
    fullName: row.full_name || "Commercial Driver",
    phone: row.phone || null,
    driverCode: driverCode || `DRV-${row.id.slice(0, 4).toUpperCase()}`,
    email: email || (row.email ?? null),
    licenseNumber: licenseNumber || null,
    assignedVehicle: assignedVehicle || null,
    loginPin: loginPin || null,
    organisationId: row.organisation_id || null,
    photoUrl: row.photo_url || null,
    rawNotes,
  };
}

export const driverAuthService = {
  /**
   * Authenticate a driver using Driver Code (e.g. DRV-001) or Phone Number + PIN.
   * Matches the MachineCare WebApp Driver Portal logic.
   */
  async loginDriverWithPin(
    identifier: string,
    pin: string
  ): Promise<{
    success: boolean;
    driver?: DriverSession;
    vehicleBinding?: DriverVehicleBinding | null;
    needsPinSetup?: boolean;
    rawDriver?: ParsedDriver;
    error?: string;
  }> {
    const cleanId = identifier.trim();
    const cleanPin = pin.trim();

    if (!cleanId) {
      return { success: false, error: "Tafadhali ingiza Namba ya Simu au Namba ya Dereva (Driver Code)." };
    }

    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, phone, status, notes, photo_url, organisation_id")
        .eq("status", "active")
        .limit(100);

      if (error) {
        return { success: false, error: `Hitilafu ya mtandao: ${error.message}` };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error: "Hakuna madereva waliosajiliwa kwenye mfumo. / No active drivers found.",
        };
      }

      const parsedList = data.map(parseDriverRow);
      const normInputPhone = normalizePhone(cleanId);
      const upperInputCode = cleanId.toUpperCase();
      const lowerInputEmail = cleanId.toLowerCase();

      // Find matching driver
      const matched = parsedList.find((d) => {
        const dPhoneNorm = normalizePhone(d.phone);
        const dCodeNorm = (d.driverCode || "").toUpperCase();
        const dEmailNorm = (d.email || "").toLowerCase();

        return (
          (normInputPhone && dPhoneNorm && normInputPhone === dPhoneNorm) ||
          (dCodeNorm && upperInputCode === dCodeNorm) ||
          (dEmailNorm && lowerInputEmail === dEmailNorm) ||
          (d.fullName.toLowerCase() === cleanId.toLowerCase())
        );
      });

      if (!matched) {
        return {
          success: false,
          error: `Dereva mwenye utambulisho "${cleanId}" hakupatikana. Tafadhali wasiliana na msimamizi wa meli (Fleet Manager) au tumia namba sahihi.`,
        };
      }

      // Check if driver has no PIN set yet
      if (!matched.loginPin) {
        return {
          success: false,
          needsPinSetup: true,
          rawDriver: matched,
          error: "Hujatengeneza nenosiri la PIN bado. Tafadhali weka PIN yako ya tarakimu 4 ili kuanza.",
        };
      }

      // Validate PIN
      if (cleanPin !== matched.loginPin) {
        return {
          success: false,
          error: "Nenosiri la PIN sio sahihi. Tafadhali jaribu tena. / Invalid Driver PIN.",
        };
      }

      // Resolve Assigned Vehicle if specified
      let vehicleBinding: DriverVehicleBinding | null = null;
      if (matched.assignedVehicle) {
        const { data: vehicleData } = await supabase
          .from("machines")
          .select("id, name, plate_number, registration_number, make, model, trailer_plate, current_odometer_km, organisation_id")
          .or(`plate_number.eq.${matched.assignedVehicle},name.eq.${matched.assignedVehicle},registration_number.eq.${matched.assignedVehicle}`)
          .limit(1)
          .maybeSingle();

        if (vehicleData) {
          vehicleBinding = {
            vehicleId: vehicleData.id,
            plateNumber: vehicleData.plate_number || vehicleData.name,
            vehicleCode: vehicleData.registration_number || "TRK",
            registrationNumber: vehicleData.registration_number,
            name: vehicleData.name,
            makeModel: [vehicleData.make, vehicleData.model].filter(Boolean).join(" "),
            linkedTrailerPlate: vehicleData.trailer_plate,
            odometerKm: vehicleData.current_odometer_km,
            organisationId: vehicleData.organisation_id,
            pairedAt: new Date().toISOString(),
          };
        }
      }

      const driverSession: DriverSession = {
        id: matched.id,
        fullName: matched.fullName,
        phone: matched.phone,
        driverCode: matched.driverCode,
        email: matched.email,
        assignedVehicle: matched.assignedVehicle,
        organisationId: matched.organisationId,
        signedInAt: new Date().toISOString(),
      };

      return {
        success: true,
        driver: driverSession,
        vehicleBinding,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Hitilafu imetokea wakati wa kuingia kama dereva." };
    }
  },

  /**
   * Set or reset a driver's 4-digit PIN in Supabase notes metadata.
   */
  async setDriverPin(driverId: string, newPin: string): Promise<{ success: boolean; error?: string }> {
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      return { success: false, error: "Nenosiri la PIN lazima liwe na angalau tarakimu 4 (e.g. 1234)." };
    }

    try {
      const { data: rawDriver } = await supabase
        .from("drivers")
        .select("notes")
        .eq("id", driverId)
        .maybeSingle();

      let meta: Record<string, any> = {};
      if (rawDriver?.notes && typeof rawDriver.notes === "string" && rawDriver.notes.startsWith("{")) {
        try {
          meta = JSON.parse(rawDriver.notes);
        } catch {
          meta = { text: rawDriver.notes };
        }
      } else if (rawDriver?.notes) {
        meta = { text: rawDriver.notes };
      }

      meta.login_pin = cleanPin;

      const { error } = await supabase
        .from("drivers")
        .update({ notes: JSON.stringify(meta) })
        .eq("id", driverId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Imeshindwa kuhifadhi PIN ya dereva." };
    }
  },

  /**
   * Ensures a driver row exists in Supabase `drivers` table when a driver registers.
   * Enables immediate visibility on the WebApp Drivers roster (/fleet/drivers).
   */
  async ensureDriverRecord(params: {
    organisationId?: string;
    fullName: string;
    email?: string;
    phone?: string;
    driverPin?: string;
  }): Promise<{ success: boolean; driverId?: string }> {
    try {
      if (!params.fullName.trim()) return { success: false };

      // 1. Check if driver already exists with matching name or email in this org
      let q = supabase
        .from("drivers")
        .select("id, full_name, notes")
        .eq("status", "active");

      if (params.organisationId) {
        q = q.eq("organisation_id", params.organisationId);
      }

      const { data: existing } = await q;

      if (existing && existing.length > 0) {
        const match = existing.find((d) => {
          if (d.full_name?.toLowerCase() === params.fullName.trim().toLowerCase()) return true;
          if (params.email && typeof d.notes === "string" && d.notes.includes(params.email.trim())) return true;
          return false;
        });

        if (match) {
          return { success: true, driverId: match.id };
        }
      }

      // 2. Generate unique driver code (e.g. DRV-882)
      const randNum = Math.floor(100 + Math.random() * 899);
      const code = `DRV-${randNum}`;

      const meta = {
        driver_code: code,
        email: params.email?.trim() || null,
        login_pin: params.driverPin?.trim() || "1234",
        source: "machinecare_app_registration",
      };

      const { data: inserted, error } = await supabase
        .from("drivers")
        .insert({
          full_name: params.fullName.trim(),
          phone: params.phone?.trim() || null,
          organisation_id: params.organisationId || null,
          status: "active",
          notes: JSON.stringify(meta),
        })
        .select("id")
        .maybeSingle();

      if (!error && inserted) {
        return { success: true, driverId: inserted.id };
      }

      return { success: true };
    } catch {
      return { success: false };
    }
  },
};
