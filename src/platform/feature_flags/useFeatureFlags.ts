/**
 * MachineCare Platform - Feature Flags & Tenant Capability Hook
 * Provides dynamic feature checks and maintains backward compatibility with industry profiles.
 */

import { useAuth, type IndustryProfile } from "@/contexts/AuthContext";

export type { IndustryProfile };

export function useFeatureFlags() {
  const { organisation } = useAuth();
  const profile: IndustryProfile = organisation?.industry_profile ?? "manufacturing";

  const isFeatureEnabled = (featureKey: string): boolean => {
    // If organisation explicitly defines enabled_modules, respect it:
    if (organisation?.enabled_modules && Array.isArray(organisation.enabled_modules) && organisation.enabled_modules.length > 0) {
      if (featureKey === "garage" || featureKey === "workshop") {
        return organisation.enabled_modules.includes("workshop");
      }
      if (featureKey === "iot" || featureKey === "connected_data") {
        return organisation.enabled_modules.includes("connected_data");
      }
      return organisation.enabled_modules.includes(featureKey);
    }

    // Dynamic feature flag resolution fallback:
    if (featureKey === "fleet") return profile === "fleet_logistics" || profile === "mixed";
    if (featureKey === "garage" || featureKey === "workshop") return profile === "garage" || profile === "mixed";
    if (featureKey === "production") return profile === "manufacturing" || profile === "mixed";
    if (featureKey === "iot" || featureKey === "connected_data") return profile === "manufacturing" || profile === "mixed";
    // Core capabilities enabled by default
    return true;
  };

  return {
    profile,
    isFleet: profile === "fleet_logistics",
    isManufacturing: profile === "manufacturing",
    isGarage: profile === "garage",
    isMixed: profile === "mixed",
    isIoT: isFeatureEnabled("connected_data"),
    isFeatureEnabled,
  };
}
