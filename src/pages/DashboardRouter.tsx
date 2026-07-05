import { useIndustry } from "@/hooks/useIndustry";
import Dashboard from "@/pages/Dashboard";
import FleetDashboard from "@/pages/fleet/FleetDashboard";

export default function DashboardRouter() {
  const { isFleet } = useIndustry();
  return isFleet ? <FleetDashboard /> : <Dashboard />;
}
