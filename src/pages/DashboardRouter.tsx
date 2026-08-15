import { useIndustry } from "@/hooks/useIndustry";
import Dashboard from "@/pages/Dashboard";
import FleetDashboard from "@/pages/fleet/FleetDashboard";
import GarageDashboard from "@/pages/garage/GarageDashboard";

export default function DashboardRouter() {
  const { isFleet, isGarage } = useIndustry();
  if (isFleet) return <FleetDashboard />;
  if (isGarage) return <GarageDashboard />;
  return <Dashboard />;
}
