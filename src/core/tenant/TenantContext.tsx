/**
 * MachineCare Core - Tenant Context
 * Manages organization configuration, operational preferences, and active modules.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth, type Organisation } from "@/core/auth/AuthContext";

export interface TenantContextValue {
  organization: Organisation | null;
  organizationId: string | null;
  currency: string;
  taxRatePercent: number;
  isModuleEnabled: (moduleName: string) => boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { organisation } = useAuth();

  const value = useMemo<TenantContextValue>(() => {
    return {
      organization: organisation,
      organizationId: organisation?.id ?? null,
      currency: "TZS",
      taxRatePercent: organisation?.default_tax_rate_percent ?? 18,
      isModuleEnabled: (moduleName: string) => {
        // If organisation explicitly defines enabled_modules, respect it:
        if (organisation?.enabled_modules && Array.isArray(organisation.enabled_modules) && organisation.enabled_modules.length > 0) {
          return organisation.enabled_modules.includes(moduleName);
        }

        // Backward-compatible fallback based on industry profile for existing accounts:
        const profile = organisation?.industry_profile ?? "manufacturing";
        if (profile === "fleet_logistics") {
          return ["fleet", "safety", "inventory"].includes(moduleName);
        }
        if (profile === "garage") {
          return ["workshop", "inventory", "safety"].includes(moduleName);
        }
        if (profile === "manufacturing") {
          return ["assets", "maintenance", "production", "inventory", "safety", "connected_data"].includes(moduleName);
        }
        // "mixed" or "enterprise" enables all modules by default
        return true;
      },
    };
  }, [organisation]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
