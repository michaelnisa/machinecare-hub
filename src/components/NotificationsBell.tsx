import { Link } from "react-router-dom";
import { Bell, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useServiceNotifications } from "@/hooks/useServiceNotifications";
import { formatDate } from "@/lib/format";
import { useState } from "react";

export function NotificationsBell() {
  const { items, unreadCount, markAllSeen } = useServiceNotifications();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && unreadCount > 0) {
      // mark seen shortly after open so the badge clears
      setTimeout(() => markAllSeen(), 400);
    }
  };

  const overdue = items.filter((i) => i.status === "overdue");
  const dueSoon = items.filter((i) => i.status === "due_soon");

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
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">
              {items.length === 0
                ? "All machines are on schedule"
                : `${overdue.length} overdue · ${dueSoon.length} due soon`}
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
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
            to="/notifications?tab=alerts"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
