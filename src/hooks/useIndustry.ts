import { useAuth, type IndustryProfile } from "@/contexts/AuthContext";

export type { IndustryProfile };

/**
 * Lightweight hook that exposes the current organisation's industry profile
 * and boolean shorthand flags. Every component that needs conditional rendering
 * based on industry should use this hook — never read organisation directly.
 *
 * Reads from AuthContext so it is always synchronous and reactive:
 * switching the profile in Settings updates the sidebar / dashboard
 * immediately without a page reload.
 */
export function useIndustry() {
  const { organisation } = useAuth();
  const profile: IndustryProfile = organisation?.industry_profile ?? "manufacturing";

  return {
    profile,
    isFleet: profile === "fleet_logistics",
    isManufacturing: profile === "manufacturing",
    isGarage: profile === "garage",
    isMixed: profile === "mixed",
  };
}
