import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/platform/feature_flags/useFeatureFlags";
import Dashboard from "@/pages/Dashboard";
import FleetDashboard from "@/pages/fleet/FleetDashboard";
import GarageDashboard from "@/pages/garage/GarageDashboard";
import Safety from "@/pages/Safety";
import ProductionOverview from "@/pages/production/Overview";
import GpsLiveMap from "@/pages/gps/GpsLiveMap";

export default function DashboardRouter() {
  const { organisation, profile } = useAuth();
  const { isFleet, isGarage, isManufacturing, isGpsTracking } = useFeatureFlags();

  const enabledMods = organisation?.enabled_modules;
  const isSafetyDept = profile?.department === "safety";
  const industry = organisation?.industry_profile;

  // 1. Safety department user or safety-only module subscription
  if (isSafetyDept || (enabledMods?.length === 1 && enabledMods[0] === "safety")) {
    return <Safety />;
  }

  // 2. MachineCare GPS Tracking independent profile resolution
  if (
    isGpsTracking ||
    industry === "gps_tracking" ||
    (organisation?.industry?.toLowerCase() === "gps_tracking" &&
      industry !== "manufacturing" &&
      industry !== "fleet_logistics" &&
      industry !== "garage" &&
      industry !== "mixed") ||
    (enabledMods?.length === 1 && enabledMods.includes("gps_tracking"))
  ) {
    return <GpsLiveMap />;
  }

  // 3. Mixed Operations profile routes directly to Master Dashboard
  if (industry === "mixed") {
    return <Dashboard />;
  }

  // 4. Manufacturing profile resolution
  if (industry === "manufacturing" || isManufacturing) {
    return <Dashboard />;
  }

  // 5. Direct Industry Profile resolution (Fleet & Logistics defaults immediately to FleetDashboard)
  if (industry === "fleet_logistics" || isFleet) {
    return <FleetDashboard />;
  }

  // 6. Garage & Workshop profile resolution
  if (industry === "garage" || isGarage) {
    return <GarageDashboard />;
  }

  // 4. Specific module-based routing for modular configurations
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

  return <Dashboard />;
}
