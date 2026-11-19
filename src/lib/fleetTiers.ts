/**
 * MachineCare Platform - Fleet Tier Architecture & Capability Engine
 * 
 * Provides strict separation between:
 * 1. Standard Fleet Edition (Logistixware Blueprint): Lean, 1-step manager approval, Job Cards, direct disbursements.
 * 2. Enterprise Fleet Edition (Mega Beverages Blueprint): Multi-department governance, 11-component breakdown,
 *    workshop fixed assets, smart compatible stores, and interactive tire lifecycle matrix.
 */

import { isLogistixwareAccount } from "@/services/customerService";

export type FleetTier = "standard" | "enterprise";

export interface FleetTierCapabilities {
  tier: FleetTier;
  isEnterprise: boolean;
  isStandard: boolean;
  hasMultiDeptApprovals: boolean;
  hasSmartStoresCompatibility: boolean;
  hasTireAxleMatrix: boolean;
  hasWorkshopFixedAssets: boolean;
  hasCostPerKmAnalytics: boolean;
  hasContractorPerformanceTracking: boolean;
}

/**
 * Checks if an organization is an Enterprise Fleet account.
 * Logistixware is strictly protected and ALWAYS returns false.
 */
export function isEnterpriseFleet(
  org?: {
    id?: string | null;
    name?: string | null;
    plan?: string | null;
    industry_profile?: string | null;
    industry?: string | null;
    enabled_modules?: string[] | null;
  } | null
): boolean {
  if (!org) return false;

  // Rule 1: Logistixware is strictly locked to Standard Edition
  if (isLogistixwareAccount(org)) {
    return false;
  }

  // Rule 2: Explicit enterprise plan
  if (org.plan === "enterprise") {
    return true;
  }

  // Rule 3: Machinecare Transport Company or named enterprise fleets
  const name = (org.name || "").toLowerCase();
  if (
    name.includes("machinecare transport") ||
    name.includes("transport company") ||
    name.includes("mega beverage") ||
    name.includes("enterprise fleet")
  ) {
    return true;
  }

  // Rule 4: Explicit local storage admin override for testing
  if (typeof window !== "undefined") {
    try {
      const override = localStorage.getItem(`mc_enterprise_override_${org.id}`);
      if (override === "true") return true;
    } catch (_e) {}
  }

  return false;
}

/**
 * Checks if an organization is a Standard Fleet account (e.g. Logistixware or SMB fleet).
 */
export function isStandardFleet(
  org?: {
    id?: string | null;
    name?: string | null;
    plan?: string | null;
    industry_profile?: string | null;
    industry?: string | null;
    enabled_modules?: string[] | null;
  } | null
): boolean {
  if (!org) return false;
  return !isEnterpriseFleet(org);
}

/**
 * Resolves full fleet tier capabilities for an organization.
 */
export function getFleetTierCapabilities(
  org?: {
    id?: string | null;
    name?: string | null;
    plan?: string | null;
    industry_profile?: string | null;
    industry?: string | null;
    enabled_modules?: string[] | null;
  } | null
): FleetTierCapabilities {
  const isEnt = isEnterpriseFleet(org);

  return {
    tier: isEnt ? "enterprise" : "standard",
    isEnterprise: isEnt,
    isStandard: !isEnt,
    hasMultiDeptApprovals: isEnt,
    hasSmartStoresCompatibility: isEnt,
    hasTireAxleMatrix: isEnt,
    hasWorkshopFixedAssets: isEnt,
    hasCostPerKmAnalytics: isEnt,
    hasContractorPerformanceTracking: isEnt,
  };
}
