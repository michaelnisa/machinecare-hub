import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  ACTIVE_ROLE: "mc_mobile_active_role",
  DRIVER_VEHICLE: "mc_mobile_driver_vehicle",
  SAVED_PROFILE: "mc_mobile_saved_profile",
  ONBOARDING_COMPLETED: "mc_mobile_onboarding_completed",
  FIELD_MODE: "mc_mobile_field_mode",
  OFFLINE_RECEIPTS: "mc_mobile_offline_receipts_queue",
  OFFLINE_INSPECTIONS: "mc_mobile_offline_inspections_queue",
  CACHED_JOB_CARDS: "mc_mobile_cached_job_cards",
  CACHED_FLEET_GPS: "mc_mobile_cached_fleet_gps",
};

export type MobileRole = "driver" | "mechanic" | "dispatcher" | "telematics";

export interface DriverVehicleBinding {
  vehicleId: string;
  plateNumber: string;
  vehicleCode: string;
  registrationNumber?: string | null;
  name: string;
  makeModel?: string;
  linkedTrailerPlate?: string | null;
  odometerKm?: number | null;
  organisationId?: string | null;
  pairedAt: string;
}

export interface OfflineReceiptItem {
  id: string;
  tripId: string;
  vehicleId: string;
  organisationId?: string;
  driverId?: string;
  title: string;
  category: "fuel" | "toll" | "parking" | "fine" | "repair" | "other";
  amount: number;
  currency: "TZS" | "USD";
  receiptNo?: string;
  photoUri?: string;
  notes?: string;
  recordedAt: string;
}

export interface OfflineInspectionItem {
  id: string;
  vehicleId: string;
  organisationId?: string;
  driverId?: string;
  inspectorName: string;
  inspectorPhone?: string;
  tyresOk: boolean;
  oilCoolantOk: boolean;
  brakesOk: boolean;
  lightsOk: boolean;
  trailerLockOk: boolean;
  defectNotes?: string;
  odometerKm: number;
  recordedAt: string;
}

export const storageService = {
  async getActiveRole(): Promise<MobileRole> {
    try {
      const val = await AsyncStorage.getItem(KEYS.ACTIVE_ROLE);
      return (val as MobileRole) || "driver";
    } catch {
      return "driver";
    }
  },

  async setActiveRole(role: MobileRole): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACTIVE_ROLE, role);
  },

  async getDriverVehicle(): Promise<DriverVehicleBinding | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DRIVER_VEHICLE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setDriverVehicle(binding: DriverVehicleBinding | null): Promise<void> {
    if (!binding) {
      await AsyncStorage.removeItem(KEYS.DRIVER_VEHICLE);
    } else {
      await AsyncStorage.setItem(KEYS.DRIVER_VEHICLE, JSON.stringify(binding));
    }
  },

  // Offline Receipts Queue
  async getOfflineReceipts(): Promise<OfflineReceiptItem[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_RECEIPTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async queueOfflineReceipt(item: OfflineReceiptItem): Promise<void> {
    const list = await this.getOfflineReceipts();
    list.push(item);
    await AsyncStorage.setItem(KEYS.OFFLINE_RECEIPTS, JSON.stringify(list));
  },

  async clearOfflineReceipts(syncedIds: string[]): Promise<void> {
    const list = await this.getOfflineReceipts();
    const remaining = list.filter((x) => !syncedIds.includes(x.id));
    await AsyncStorage.setItem(KEYS.OFFLINE_RECEIPTS, JSON.stringify(remaining));
  },

  // Offline Inspections Queue
  async getOfflineInspections(): Promise<OfflineInspectionItem[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_INSPECTIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async queueOfflineInspection(item: OfflineInspectionItem): Promise<void> {
    const list = await this.getOfflineInspections();
    list.push(item);
    await AsyncStorage.setItem(KEYS.OFFLINE_INSPECTIONS, JSON.stringify(list));
  },

  async clearOfflineInspections(syncedIds: string[]): Promise<void> {
    const list = await this.getOfflineInspections();
    const remaining = list.filter((x) => !syncedIds.includes(x.id));
    await AsyncStorage.setItem(KEYS.OFFLINE_INSPECTIONS, JSON.stringify(remaining));
  },

  // Saved Profile & Org metadata
  async getSavedProfile(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SAVED_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setSavedProfile(profile: any | null): Promise<void> {
    if (profile) {
      await AsyncStorage.setItem(KEYS.SAVED_PROFILE, JSON.stringify(profile));
    } else {
      await AsyncStorage.removeItem(KEYS.SAVED_PROFILE);
    }
  },

  // Onboarding lifecycle
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETED);
      return val === "true";
    } catch {
      return false;
    }
  },

  async setCompletedOnboarding(completed: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETED, completed ? "true" : "false");
  },

  // Field Mode (Bypass login for offline QR scans)
  async isFieldModeEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(KEYS.FIELD_MODE);
      return val === "true";
    } catch {
      return false;
    }
  },

  async setFieldMode(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.FIELD_MODE, enabled ? "true" : "false");
  },

  async clearAllAuth(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.SAVED_PROFILE,
      KEYS.FIELD_MODE,
      KEYS.DRIVER_VEHICLE,
    ]);
  },
};
