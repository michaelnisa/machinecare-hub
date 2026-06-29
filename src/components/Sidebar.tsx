import { useState, useEffect, useMemo } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Wrench,
  BarChart2,
  Settings,
  LogOut,
  ClipboardList,
  Package,
  Fuel,
  FileText,
  Users,
  GraduationCap,
  UserCheck,
  Bell,
  Gauge,
  FileBarChart,
  ShieldAlert,
  CheckCircle2,
  Target,
  Zap,
  Tv,
  Building2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar.groups.v1";

type NavItem = { to: string; label: string; icon: any };
type NavGroup = { id: string; label: string; items: NavItem[] };

export function Sidebar() {
  const { profile, organisation, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const isLite = (organisation?.plan ?? "standard") === "lite";

  const groups: NavGroup[] = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          ...(!isLite ? [{ to: "/live", label: "Live TV", icon: Tv }] : []),
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "assets",
        label: "Assets",
        items: [
          { to: "/machines", label: t.nav.machines, icon: Wrench },
          { to: "/work-orders", label: t.nav.workOrders, icon: ClipboardList },
          ...(!isLite
            ? [
                {
                  to: "/fault-reports",
                  label: "Fault reports",
                  icon: AlertTriangle,
                },
              ]
            : []),
          ...(!isLite
            ? [
                {
                  to: "/checklist-templates",
                  label: "Checklist templates",
                  icon: ClipboardList,
                },
              ]
            : []),
          { to: "/inventory", label: t.nav.inventory, icon: Package },
          { to: "/fuel", label: t.nav.fuel, icon: Fuel },
          { to: "/documents", label: t.nav.documents, icon: FileText },
        ],
      },
      ...(!isLite
        ? [
            {
              id: "vendors",
              label: "Vendors",
              items: [{ to: "/vendors", label: "Vendors", icon: Building2 }],
            },
          ]
        : []),
      ...(!isLite
        ? [
            {
              id: "manufacturing",
              label: "Manufacturing",
              items: [
                { to: "/production", label: t.nav.production, icon: Target },
                { to: "/oee", label: t.nav.oee, icon: Gauge },
                { to: "/quality", label: t.nav.quality, icon: CheckCircle2 },
                { to: "/utilities", label: t.nav.utilities, icon: Zap },
              ],
            },
          ]
        : []),
      ...(!isLite
        ? [
            {
              id: "safety",
              label: "Safety & People",
              items: [
                { to: "/safety", label: t.nav.safety, icon: ShieldAlert },
                {
                  to: "/induction/dashboard",
                  label: t.nav.induction,
                  icon: GraduationCap,
                },
                {
                  to: "/induction/programmes",
                  label: t.nav.inductionProgrammes,
                  icon: ClipboardList,
                },
                {
                  to: "/induction/inductees",
                  label: t.nav.inductionInductees,
                  icon: UserCheck,
                },
                { to: "/team", label: t.nav.team, icon: Users },
              ],
            },
          ]
        : []),
      ...(!isLite
        ? [
            {
              id: "insights",
              label: "Insights",
              items: [
                {
                  to: "/maintenance-kpis",
                  label: t.nav.maintenanceKpis,
                  icon: Gauge,
                },
                { to: "/reports", label: t.nav.reports, icon: FileBarChart },
                { to: "/analytics", label: t.nav.analytics, icon: BarChart2 },
              ],
            },
          ]
        : []),
      {
        id: "system",
        label: isLite ? "Account" : "System",
        items: [
          ...(isLite ? [{ to: "/team", label: t.nav.team, icon: Users }] : []),
          { to: "/settings", label: t.nav.settings, icon: Settings },
        ],
      },
    ],
    [t, isLite],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(groups.map((g) => [g.id, true]));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {}
  }, [openGroups]);

  const toggle = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            {t.common.appName}
          </div>
        </div>
        <LanguageSwitcher compact />
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {groups.map((g) => {
          const open = openGroups[g.id] ?? true;
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-sidebar-foreground"
              >
                <span>{g.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !open && "-rotate-90",
                  )}
                />
              </button>
              {open && (
                <div className="space-y-1">
                  {g.items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      activeClassName="!bg-primary !text-primary-foreground hover:!bg-primary"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            {initials(profile?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.full_name ?? "User"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {organisation?.name ?? "—"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t.common.logout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
