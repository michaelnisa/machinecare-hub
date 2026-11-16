/**
 * MachineCare Hub - Registered Customer & Consignor Directory Service
 * 
 * Manages official client accounts with organization isolation.
 * Registered customers:
 * - BONITE BOTTLES
 * - ROUND THE WORLD SHIPPING AND LOGISTIC LLC FZ/EMROLE FREIGHT ERVICES LTD
 * - HONEST
 * - COCACOLA KWANZA
 * - PROTEAS
 * - ASAS FUEL
 * - OLYMPIC FUEL
 */

export interface RegisteredCustomer {
  id: string;
  name: string;
  shortName: string;
  industryCategory: string;
  defaultCargo: string;
  defaultPaymentTerms: string;
  isFuelCarrier?: boolean;
  phone?: string;
  email?: string;
  notes?: string;
  isCustom?: boolean;
}

export const LOGISTIXWARE_CUSTOMERS: RegisteredCustomer[] = [
  {
    id: "cust_bonite",
    name: "BONITE BOTTLES",
    shortName: "Bonite Bottles",
    industryCategory: "Beverage & Bottling (Coca-Cola / Kilimanjaro)",
    defaultCargo: "Bottled Mineral Water / Beverage Consignment (Bonite Bottles)",
    defaultPaymentTerms: "Within 30 Days (Direct Bank Transfer / EFT)",
  },
  {
    id: "cust_rtw_emrole",
    name: "ROUND THE WORLD SHIPPING AND LOGISTIC LLC FZ/EMROLE FREIGHT ERVICES LTD",
    shortName: "Round The World / Emrole Freight",
    industryCategory: "International Shipping, Clearing & Forwarding",
    defaultCargo: "Transit Containerized Cargo / Freight Forwarding",
    defaultPaymentTerms: "Upon Delivery & Offloading",
  },
  {
    id: "cust_honest",
    name: "HONEST",
    shortName: "Honest Logistics",
    industryCategory: "Commercial Distribution & Haulage",
    defaultCargo: "Commercial Goods & General Merchandise Haulage",
    defaultPaymentTerms: "Upon Delivery & Offloading",
  },
  {
    id: "cust_coca_cola_kwanza",
    name: "COCACOLA KWANZA",
    shortName: "CocaCola Kwanza",
    industryCategory: "Fast-Moving Consumer Goods & Beverages",
    defaultCargo: "FMCG / Carbonated Soft Drinks & Crates Haulage",
    defaultPaymentTerms: "Within 15 Days (Direct Bank Transfer)",
  },
  {
    id: "cust_proteas",
    name: "PROTEAS",
    shortName: "Proteas Logistics",
    industryCategory: "Commercial Cargo & Logistics",
    defaultCargo: "Commercial Cargo / Bulk Consignment",
    defaultPaymentTerms: "Upon Delivery & Offloading",
  },
  {
    id: "cust_asas_fuel",
    name: "ASAS FUEL",
    shortName: "ASAS Fuel",
    industryCategory: "Bulk Petroleum & Fuel Haulage",
    defaultCargo: "40,000 Litres Bulk Petroleum Diesel (AGO)",
    defaultPaymentTerms: "Upon Delivery & Offloading / Lipa Namba",
    isFuelCarrier: true,
  },
  {
    id: "cust_olympic_fuel",
    name: "OLYMPIC FUEL",
    shortName: "Olympic Fuel",
    industryCategory: "Bulk Petroleum Products & Oil Distribution",
    defaultCargo: "Bulk Petroleum Products (Diesel AGO / Petrol PMS)",
    defaultPaymentTerms: "Upon Delivery & Offloading / Lipa Namba",
    isFuelCarrier: true,
  },
];

const CUSTOM_CUSTOMERS_KEY = "mc_custom_registered_customers";

/**
 * Retrieves custom customers saved by the user from localStorage.
 */
export function getCustomCustomers(): RegisteredCustomer[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Saves or updates a custom customer.
 */
export function saveCustomCustomer(
  input: Omit<RegisteredCustomer, "id"> & { id?: string }
): RegisteredCustomer {
  const customList = getCustomCustomers();
  const id = input.id || `cust_custom_${Date.now()}`;
  const newCustomer: RegisteredCustomer = {
    ...input,
    id,
    isCustom: true,
    shortName: input.shortName?.trim() || input.name.trim(),
  };

  const existingIdx = customList.findIndex((c) => c.id === id);
  if (existingIdx >= 0) {
    customList[existingIdx] = newCustomer;
  } else {
    customList.push(newCustomer);
  }

  try {
    localStorage.setItem(CUSTOM_CUSTOMERS_KEY, JSON.stringify(customList));
    window.dispatchEvent(new CustomEvent("mc_customers_updated", { detail: newCustomer }));
  } catch (_e) {}

  return newCustomer;
}

/**
 * Deletes a custom customer by id.
 */
export function deleteCustomCustomer(id: string): void {
  const customList = getCustomCustomers().filter((c) => c.id !== id);
  try {
    localStorage.setItem(CUSTOM_CUSTOMERS_KEY, JSON.stringify(customList));
    window.dispatchEvent(new CustomEvent("mc_customers_updated"));
  } catch (_e) {}
}

/**
 * Checks if an organization is Logistixware.
 */
export function isLogistixwareAccount(org?: { id?: string | null; name?: string | null } | null): boolean {
  if (!org) return true; // Default to true so features are accessible
  if (org.id === "df6b0c4b-e56b-4694-838a-0381eb480043") return true;
  const name = (org.name || "").toLowerCase();
  return name.includes("logistix") || name.includes("logistics ware") || name.includes("fleet") || name.includes("hub");
}

/**
 * Retrieves all registered customers (standard + custom) for dropdowns and filter pills.
 */
export function getRegisteredCustomers(
  _org?: { id?: string | null; name?: string | null } | null
): RegisteredCustomer[] {
  const custom = getCustomCustomers();
  return [...LOGISTIXWARE_CUSTOMERS, ...custom];
}
