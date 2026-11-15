import { Link } from "react-router-dom";
import { Bell, AlertTriangle, Clock, CheckCircle2, ZapOff, Gauge, Target, ShieldAlert, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useServiceNotifications } from "@/hooks/useServiceNotifications";
import { useIndustry } from "@/hooks/useIndustry";
import { useAuth } from "@/contexts/AuthContext";
import { getGpsAlerts, GpsAlert } from "@/services/gpsService";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { useEffect, useState, useCallback } from "react";

export function NotificationsBell() {
  const { isGpsTracking } = useIndustry();
  const { organisation } = useAuth();
  const { items, unreadCount, markAllSeen } = useServiceNotifications();
  const [open, setOpen] = useState(false);

  // GPS Alerts State
  const [gpsAlerts, setGpsAlerts] = useState<GpsAlert[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadGpsAlerts = useCallback(async () => {
    if (!organisation?.id || !isGpsTracking) return;
    try {
      const data = await getGpsAlerts(organisation.id, 20, true);
      setGpsAlerts(data);
    } catch {
      // ignore
    }
  }, [organisation?.id, isGpsTracking]);

  useEffect(() => {
    const orgId = organisation?.id;
    if (!isGpsTracking || !orgId) return;

    loadGpsAlerts();

    // 30s polling fallback
    const interval = setInterval(loadGpsAlerts, 30000);

    // Unique channel topic name per mount to prevent reusing subscribed channel instance
    const channelName = `gps-alerts-bell:${orgId}:${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gps_alerts",
          filter: `organisation_id=eq.${orgId}`,
        },
        () => loadGpsAlerts()
      );

    channel.subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isGpsTracking, organisation?.id, loadGpsAlerts]);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && unreadCount > 0 && !isGpsTracking) {
      // mark seen shortly after open so the badge clears
      setTimeout(() => markAllSeen(), 400);
    }
  };

  const overdue = items.filter((i) => i.status === "overdue");
  const dueSoon = items.filter((i) => i.status === "due_soon");

  const effectiveCount = isGpsTracking ? gpsAlerts.length : unreadCount;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {effectiveCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {effectiveCount > 9 ? "9+" : effectiveCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">
              {isGpsTracking ? "GPS Telematics Alerts" : "Notifications"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isGpsTracking
                ? gpsAlerts.length === 0
                  ? "All tracked vehicles normal"
                  : `${gpsAlerts.length} unacknowledged telematics alert${gpsAlerts.length === 1 ? "" : "s"}`
                : items.length === 0
                ? "All machines are on schedule"
                : `${overdue.length} overdue · ${dueSoon.length} due soon`}
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isGpsTracking ? (
            gpsAlerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p className="text-sm text-muted-foreground">
                  No GPS alerts need attention right now.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {gpsAlerts.map((a) => {
                  const Icon =
                    a.alert_type === "overspeed"
                      ? Gauge
                      : a.alert_type === "geofence"
                      ? Target
                      : a.alert_type === "power_cut" || a.alert_type === "engine_immobilized"
                      ? ZapOff
                      : AlertTriangle;
                  const tone =
                    a.severity === "critical"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
                  return (
                    <li key={a.id}>
                      <Link
                        to={`/gps/live-map?selected=${a.vehicle_id}`}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 transition hover:bg-muted/60"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {a.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                              {new Date(a.event_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="truncate text-xs text-muted-foreground mt-0.5">
                            {a.message}
                          </div>
                          <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                            {a.vehicle?.plate_number || a.vehicle?.name || "Vehicle"}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))]" />
              <p className="text-sm text-muted-foreground">
                No services need attention right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {[...overdue, ...dueSoon].map((n) => {
                const Icon = n.status === "overdue" ? AlertTriangle : Clock;
                const tone =
                  n.status === "overdue"
                    ? "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]"
                    : "bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_38%)]";
                return (
                  <li key={n.id}>
                    <Link
                      to={`/machines/${n.machine_id}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 transition hover:bg-muted/60"
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {n.machine_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {n.schedule_name}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {n.status === "overdue" ? (
                            <span className="text-[hsl(var(--destructive))]">
                              Overdue · was due {formatDate(n.next_due_date)}
                            </span>
                          ) : (
                            <span className="text-[hsl(38_92%_38%)]">
                              Due {formatDate(n.next_due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2">
          <Link
            to={isGpsTracking ? "/gps/alerts" : "/notifications?tab=alerts"}
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            {isGpsTracking ? "View all GPS alerts" : "View all notifications"}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
