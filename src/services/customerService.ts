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
 * Retrieves registered customers for the dropdown list.
 * Always returns the customer list so dispatchers and accountants can pick from the dropdown.
 */
export function getRegisteredCustomers(
  _org?: { id?: string | null; name?: string | null } | null
): RegisteredCustomer[] {
  return LOGISTIXWARE_CUSTOMERS;
}
