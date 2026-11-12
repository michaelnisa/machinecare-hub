/**
 * MachineCare Platform - Feature Flags & Tenant Capability Hook
 * Provides dynamic feature checks and maintains backward compatibility with industry profiles.
 */

import { useAuth, type IndustryProfile } from "@/contexts/AuthContext";

export type { IndustryProfile };

export function useFeatureFlags() {
  const { organisation } = useAuth();
  const isExplicitMixed =
    organisation?.industry_profile === "mixed" ||
    organisation?.industry?.toLowerCase().includes("mixed");

  const isLogisticsOrg =
    !isExplicitMixed &&
    Boolean(
      organisation?.name?.toLowerCase().includes("logistix") ||
      organisation?.name?.toLowerCase().includes("transport") ||
      organisation?.name?.toLowerCase().includes("fleet") ||
      organisation?.industry?.toLowerCase().includes("logistics") ||
      organisation?.industry?.toLowerCase().includes("transport")
    );

  const profile: IndustryProfile =
    organisation?.industry_profile ?? (isExplicitMixed ? "mixed" : isLogisticsOrg ? "fleet_logistics" : "manufacturing");

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
    if (featureKey === "fleet") return profile === "fleet_logistics" || profile === "mixed" || isLogisticsOrg;
    if (featureKey === "garage" || featureKey === "workshop") return profile === "garage" || profile === "mixed";
    if (featureKey === "production") return profile === "manufacturing" || profile === "mixed";
    if (featureKey === "iot" || featureKey === "connected_data") return profile === "manufacturing" || profile === "mixed";
    // Core capabilities enabled by default
    return true;
  };

  return {
    profile,
    isFleet: (profile === "fleet_logistics" || isLogisticsOrg) && profile !== "mixed" && profile !== "gps_tracking",
    isManufacturing: profile === "manufacturing" && !isLogisticsOrg,
    isGarage: profile === "garage",
    isMixed: profile === "mixed",
    isIoT: isFeatureEnabled("connected_data"),
    isGpsTracking: profile === "gps_tracking" || Boolean(organisation?.enabled_modules?.includes("gps_tracking") && !organisation?.enabled_modules?.includes("fleet")),
    isFeatureEnabled,
  };
}

