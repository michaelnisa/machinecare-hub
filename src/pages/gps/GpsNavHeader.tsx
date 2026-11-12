import { Link, useLocation } from "react-router-dom";
import { Navigation, History, ShieldCheck, ShieldAlert, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export function GpsNavHeader() {
  const location = useLocation();

  const links = [
    { to: "/gps/live-map", label: "Live Tracking Map", icon: Navigation },
    { to: "/gps/replay", label: "Route History & Replay", icon: History },
    { to: "/gps/geofences", label: "Geofence Zones", icon: ShieldCheck },
    { to: "/gps/alerts", label: "Telematics Alerts", icon: ShieldAlert },
    { to: "/gps/devices", label: "GPS Hardware Trackers", icon: Cpu },
  ];

  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-2.5 mb-2 shrink-0 overflow-x-auto text-xs">
      {links.map((link) => {
        const isActive = location.pathname === link.to;
        const Icon = link.icon;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
