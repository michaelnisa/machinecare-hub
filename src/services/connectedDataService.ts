import { supabase } from "@/integrations/supabase/client";
import {
  ConnectedCustomer,
  ConnectedSite,
  ConnectedAsset,
  ConnectedDevice,
  ConnectedDataSource,
  MachineDataParameter,
  TelemetryPoint,
  DataQualityRecord,
  ConnectedEvent,
  EventRule,
  ConnectedApiKey,
  ConnectedWebhook,
} from "@/types/connected-data";
import {
  MOCK_CONNECTED_CUSTOMERS,
  MOCK_CONNECTED_SITES,
  MOCK_CONNECTED_ASSETS,
  MOCK_CONNECTED_DEVICES,
  MOCK_CONNECTED_DATA_SOURCES,
  MOCK_DICTIONARY_PARAMETERS,
  MOCK_CONNECTED_EVENTS,
  MOCK_EVENT_RULES,
  MOCK_API_KEYS,
  MOCK_WEBHOOKS,
  MOCK_DATA_QUALITY_RECORDS,
} from "@/lib/connected-data-mock";

/**
 * Phase 1 Database Service Layer
 * Interacts with Supabase tables with seed data fallback for continuous uptime
 */
export const connectedDataService = {
  // ── 1. CUSTOMERS ──────────────────────────────────────────
  async getCustomers(): Promise<ConnectedCustomer[]> {
    try {
      const { data, error } = await supabase.from("connected_customers").select("*");
      if (error || !data || data.length === 0) return MOCK_CONNECTED_CUSTOMERS;
      return data as ConnectedCustomer[];
    } catch {
      return MOCK_CONNECTED_CUSTOMERS;
    }
  },

  async createCustomer(customer: Partial<ConnectedCustomer>): Promise<ConnectedCustomer> {
    const newCust: ConnectedCustomer = {
      id: "cust-" + Date.now(),
      name: customer.name || "New Industrial Client",
      code: customer.code || "CUST-NEW",
      industry: customer.industry || "Manufacturing",
      contact_person: customer.contact_person || "Operations Manager",
      email: customer.email || "contact@client.com",
      phone: customer.phone || "+1 555-0000",
      status: "ACTIVE",
      site_count: 1,
      asset_count: 0,
      device_count: 0,
      created_at: new Date().toISOString(),
    };
    try {
      await supabase.from("connected_customers").insert([newCust]);
    } catch {
      // fallback
    }
    return newCust;
  },

  // ── 2. SITES ──────────────────────────────────────────────
  async getSites(customerId?: string): Promise<ConnectedSite[]> {
    try {
      let query = supabase.from("connected_sites").select("*");
      if (customerId && customerId !== "ALL") {
        query = query.eq("customer_id", customerId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return customerId && customerId !== "ALL"
          ? MOCK_CONNECTED_SITES.filter((s) => s.customer_id === customerId)
          : MOCK_CONNECTED_SITES;
      }
      return data as ConnectedSite[];
    } catch {
      return customerId && customerId !== "ALL"
        ? MOCK_CONNECTED_SITES.filter((s) => s.customer_id === customerId)
        : MOCK_CONNECTED_SITES;
    }
  },

  // ── 3. ASSETS ─────────────────────────────────────────────
  async getAssets(customerId?: string): Promise<ConnectedAsset[]> {
    try {
      let query = supabase.from("connected_assets").select("*");
      if (customerId && customerId !== "ALL") {
        query = query.eq("customer_id", customerId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return customerId && customerId !== "ALL"
          ? MOCK_CONNECTED_ASSETS.filter((a) => a.customer_id === customerId)
          : MOCK_CONNECTED_ASSETS;
      }
      return data as ConnectedAsset[];
    } catch {
      return customerId && customerId !== "ALL"
        ? MOCK_CONNECTED_ASSETS.filter((a) => a.customer_id === customerId)
        : MOCK_CONNECTED_ASSETS;
    }
  },

  // ── 4. DEVICES ────────────────────────────────────────────
  async getDevices(): Promise<ConnectedDevice[]> {
    try {
      const { data, error } = await supabase.from("connected_devices").select("*");
      if (error || !data || data.length === 0) return MOCK_CONNECTED_DEVICES;
      return data as ConnectedDevice[];
    } catch {
      return MOCK_CONNECTED_DEVICES;
    }
  },

  // ── 5. DATA SOURCES ───────────────────────────────────────
  async getDataSources(): Promise<ConnectedDataSource[]> {
    try {
      const { data, error } = await supabase.from("connected_data_sources").select("*");
      if (error || !data || data.length === 0) return MOCK_CONNECTED_DATA_SOURCES;
      return data as ConnectedDataSource[];
    } catch {
      return MOCK_CONNECTED_DATA_SOURCES;
    }
  },

  // ── 6. DATA DICTIONARY ────────────────────────────────────
  async getDataDictionary(): Promise<MachineDataParameter[]> {
    try {
      const { data, error } = await supabase.from("machine_data_dictionary").select("*");
      if (error || !data || data.length === 0) return MOCK_DICTIONARY_PARAMETERS;
      return data as MachineDataParameter[];
    } catch {
      return MOCK_DICTIONARY_PARAMETERS;
    }
  },

  // ── 7. EVENTS & ALERTS ────────────────────────────────────
  async getEvents(): Promise<ConnectedEvent[]> {
    try {
      const { data, error } = await supabase.from("connected_events").select("*").order("timestamp", { ascending: false });
      if (error || !data || data.length === 0) return MOCK_CONNECTED_EVENTS;
      return data as ConnectedEvent[];
    } catch {
      return MOCK_CONNECTED_EVENTS;
    }
  },

  async acknowledgeEvent(eventId: string, user = "Operator"): Promise<boolean> {
    try {
      await supabase
        .from("connected_events")
        .update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString(), acknowledged_by: user })
        .eq("id", eventId);
    } catch {
      // ignore fallback
    }
    return true;
  },

  // ── 8. API KEYS ───────────────────────────────────────────
  async getApiKeys(): Promise<ConnectedApiKey[]> {
    try {
      const { data, error } = await supabase.from("connected_api_keys").select("*");
      if (error || !data || data.length === 0) return MOCK_API_KEYS;
      return data as ConnectedApiKey[];
    } catch {
      return MOCK_API_KEYS;
    }
  },

  // ── 9. WEBHOOKS ───────────────────────────────────────────
  async getWebhooks(): Promise<ConnectedWebhook[]> {
    try {
      const { data, error } = await supabase.from("connected_webhooks").select("*");
      if (error || !data || data.length === 0) return MOCK_WEBHOOKS;
      return data as ConnectedWebhook[];
    } catch {
      return MOCK_WEBHOOKS;
    }
  },

  // ── 10. DATA QUALITY ──────────────────────────────────────
  async getDataQualityRecords(): Promise<DataQualityRecord[]> {
    try {
      const { data, error } = await supabase.from("data_quality_records").select("*");
      if (error || !data || data.length === 0) return MOCK_DATA_QUALITY_RECORDS;
      return data as DataQualityRecord[];
    } catch {
      return MOCK_DATA_QUALITY_RECORDS;
    }
  },
};
