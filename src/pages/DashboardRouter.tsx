import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/platform/feature_flags/useFeatureFlags";
import Dashboard from "@/pages/Dashboard";
import FleetDashboard from "@/pages/fleet/FleetDashboard";
import GarageDashboard from "@/pages/garage/GarageDashboard";
import Safety from "@/pages/Safety";
import ProductionOverview from "@/pages/production/Overview";

export default function DashboardRouter() {
  const { organisation, profile } = useAuth();
  const { isFleet, isGarage } = useFeatureFlags();

  const enabledMods = organisation?.enabled_modules;
  const isSafetyDept = profile?.department === "safety";

  if (isSafetyDept || (enabledMods?.length === 1 && enabledMods[0] === "safety")) {
    return <Safety />;
  }

  if (enabledMods && Array.isArray(enabledMods) && enabledMods.length > 0) {
    if (enabledMods.includes("production") && !enabledMods.includes("maintenance")) {
      return <ProductionOverview />;
    }
    if (enabledMods.includes("fleet") && !enabledMods.includes("production") && !enabledMods.includes("maintenance")) {
      return <FleetDashboard />;
    }
    if (enabledMods.includes("workshop") && !enabledMods.includes("production") && !enabledMods.includes("maintenance")) {
      return <GarageDashboard />;
    }
  }

  if (isFleet) return <FleetDashboard />;
  if (isGarage) return <GarageDashboard />;
  return <Dashboard />;
}
