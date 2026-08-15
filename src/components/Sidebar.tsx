import { useState, useEffect, useMemo } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/hooks/useIndustry";
import { useUserRole } from "@/hooks/useUserRole";
import {
  LayoutDashboard,
  Wrench,
  BarChart2,
  Settings,
  LogOut,
  ClipboardList,
  ClipboardCheck,
  Package,
  Boxes,
  Warehouse,
  MapPin,
  ArrowLeftRight,
  ShoppingCart,
  PackageX,
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
  Truck,
  Contact,
  Route,
  CircleDot,
  Factory,
  History,
  TrendingUp,
  BellRing,
  Calendar,
  Receipt,
  CreditCard,
  UserCog,
  Activity,
  AlertOctagon,
  CalendarRange,
  Recycle,
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
  const { isFleet, isGarage } = useIndustry();
  const { isManager } = useUserRole();
  const navigate = useNavigate();
  const { t } = useI18n();

  const isLite = (organisation?.plan ?? "standard") === "lite";

  const manufacturingGroups: NavGroup[] = useMemo(
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
        label: "Maintenance",
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
          ...(!isLite
            ? [
                { to: "/maintenance/calendar", label: "Maintenance Calendar", icon: Calendar },
                { to: "/maintenance/schedules", label: "PM Schedules", icon: ClipboardCheck },
                { to: "/maintenance/history", label: "Service History", icon: History },
                { to: "/maintenance/downtime", label: "Downtime", icon: AlertOctagon },
                { to: "/maintenance/meter-readings", label: "Meter readings", icon: Activity },
                { to: "/analytics", label: t.nav.analytics, icon: BarChart2 },
              ]
            : []),
          { to: "/fuel", label: t.nav.fuel, icon: Fuel },
          { to: "/documents", label: t.nav.documents, icon: FileText },
        ],
      },
      ...(!isLite &&
      isManager &&
      (!profile?.department || profile.department === "production")
        ? [
            {
              id: "production",
              label: "Production",
              items: [
                { to: "/live/production", label: "Live TV", icon: Tv },
                { to: "/production/overview", label: "Production Overview", icon: LayoutDashboard },
                { to: "/production/planning", label: "Production Planning", icon: CalendarRange },
                { to: "/production/orders", label: "Production Orders", icon: ClipboardList },
                { to: "/production", label: "Production KPI", icon: Target },
                { to: "/oee", label: t.nav.oee, icon: Gauge },
                { to: "/production/downtime", label: "Downtime", icon: AlertOctagon },
                { to: "/quality", label: t.nav.quality, icon: CheckCircle2 },
                { to: "/production/material-waste", label: "Material & Waste", icon: Recycle },
                { to: "/utilities", label: t.nav.utilities, icon: Zap },
                { to: "/production/analytics", label: "Analytics", icon: BarChart2 },
                { to: "/production/history", label: "Production History", icon: History },
                { to: "/reports", label: t.nav.reports, icon: FileBarChart },
              ],
            },
          ]
        : []),
      ...(!isLite && (!profile?.department || profile.department === "safety")
        ? [
            {
              id: "safety",
              label: "Safety & People",
              items: [
                { to: "/safety", label: t.nav.safety, icon: ShieldAlert },
                { to: "/safety/risk-assessments", label: "Risk assessments", icon: ClipboardList },
                { to: "/safety/inspections", label: "Safety inspections", icon: CheckCircle2 },
                { to: "/safety/corrective-actions", label: "Corrective actions", icon: AlertTriangle },
                { to: "/safety/ppe", label: "PPE", icon: Package },
                { to: "/safety/contractors", label: "Contractors", icon: Building2 },
                { to: "/safety/competency", label: "Training & competency", icon: GraduationCap },
                { to: "/safety/equipment", label: "Safety equipment", icon: ShieldAlert },
                { to: "/safety/certificates", label: "Certificates", icon: ClipboardCheck },
                { to: "/safety/controlled-tools", label: "Controlled tools", icon: Wrench },
                { to: "/safety/documents", label: "Safety documents", icon: FileText },
                { to: "/safety/rules", label: "Safety rules", icon: Settings },
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
      {
        id: "inventory",
        label: "Inventory",
        items: [
          { to: "/inventory", label: t.nav.inventory, icon: Package },
          { to: "/inventory/items", label: "Items & spare parts", icon: Boxes },
          { to: "/inventory/stock", label: "Stock", icon: Warehouse },
          { to: "/inventory/locations", label: "Locations", icon: MapPin },
          { to: "/inventory/requests", label: "Material requests", icon: ClipboardList },
          { to: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
          { to: "/inventory/critical-spares", label: "Critical spares", icon: ShieldAlert },
          { to: "/inventory/purchase-requests", label: "Purchase requests", icon: ShoppingCart },
          { to: "/inventory/purchase-orders", label: "Purchase orders", icon: ClipboardList },
          { to: "/inventory/suppliers", label: "Suppliers", icon: Building2 },
          { to: "/inventory/quarantine", label: "Quarantine", icon: PackageX },
          { to: "/inventory/production-materials", label: "Production materials", icon: Factory },
          { to: "/inventory/reorder", label: "Reorder & insights", icon: TrendingUp },
          { to: "/inventory/stock-counts", label: "Stock counts", icon: ClipboardCheck },
          { to: "/inventory/history", label: "Inventory history", icon: History },
          { to: "/inventory/reports", label: "Inventory reports", icon: FileBarChart },
        ],
      },
      ...(!isLite
        ? [
            {
              id: "vendors",
              label: "Vendor Insight",
              items: [{ to: "/vendors", label: "Vendors", icon: Building2 }],
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
    [t, isLite, profile?.department, isManager],
  );

  // Fleet & Logistics nav — pages not yet built (Phases 2-6) route to a
  // shared "coming soon" placeholder so nothing 404s while it's rolled out.
  const fleetGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "fleet-overview",
        label: "Overview",
        items: [
          {
            to: "/dashboard",
            label: "Fleet Dashboard",
            icon: LayoutDashboard,
          },
          { to: "/live", label: "Live TV", icon: Tv },
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "fleet",
        label: "Fleet",
        items: [
          { to: "/fleet/vehicles", label: "Vehicles", icon: Truck },
          { to: "/fleet/drivers", label: "Drivers", icon: Contact },
          { to: "/fleet/trips", label: "Trips", icon: Route },
          { to: "/fleet/documents", label: "Documents", icon: FileText },
          { to: "/fleet/tyres", label: "Tyres", icon: CircleDot },
          { to: "/fuel", label: t.nav.fuel, icon: Fuel },
          { to: "/fleet/inspections", label: "Inspections", icon: CheckCircle2 },
        ],
      },
      {
        id: "maintenance",
        label: "Maintenance",
        items: [
          { to: "/work-orders", label: t.nav.workOrders, icon: ClipboardList },
          { to: "/fault-reports", label: "Fault reports", icon: AlertTriangle },
          {
            to: "/checklist-templates",
            label: "Checklist templates",
            icon: ClipboardList,
          },
          { to: "/inventory", label: t.nav.inventory, icon: Package },
          { to: "/vendors", label: "Vendors", icon: Building2 },
        ],
      },
      {
        id: "fleet-insights",
        label: "Insights",
        items: [
          {
            to: "/fleet/insights",
            label: "Fleet KPIs & Analytics",
            icon: Gauge,
          },
          { to: "/reports", label: t.nav.reports, icon: FileBarChart },
        ],
      },
      {
        id: "fleet-people",
        label: "People",
        items: [
          { to: "/team", label: t.nav.team, icon: Users },
          {
            to: "/induction/dashboard",
            label: t.nav.induction,
            icon: GraduationCap,
          },
        ],
      },
      {
        id: "system",
        label: "System",
        items: [{ to: "/settings", label: t.nav.settings, icon: Settings }],
      },
    ],
    [t],
  );

  // Workshop/Garage nav — a fully separate product experience from
  // Industrial and Fleet (garage_workshop.md section 5), not a relabelled
  // subset. Pages not yet built (later phases) route to a shared
  // "coming soon" placeholder so nothing 404s while it's rolled out.
  const garageGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "garage-overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: "Workshop Dashboard", icon: LayoutDashboard },
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "garage-workshop",
        label: "Workshop",
        items: [
          { to: "/garage/customers", label: "Customers", icon: Users },
          { to: "/garage/vehicles", label: "Vehicles", icon: Truck },
          { to: "/garage/jobs", label: "Jobs", icon: ClipboardList },
          { to: "/garage/calendar", label: "Calendar", icon: Calendar },
          { to: "/garage/reminders", label: "Reminders", icon: BellRing },
        ],
      },
      {
        id: "garage-commercial",
        label: "Commercial",
        items: [
          { to: "/garage/estimates", label: "Estimates", icon: FileText },
          { to: "/garage/invoices", label: "Invoices", icon: Receipt },
          { to: "/garage/payments", label: "Payments", icon: CreditCard },
        ],
      },
      {
        id: "garage-inventory",
        label: "Inventory",
        items: [
          { to: "/garage/inventory", label: "Parts & stock", icon: Package },
          { to: "/garage/suppliers", label: "Suppliers", icon: Building2 },
        ],
      },
      {
        id: "garage-people",
        label: "People",
        items: [
          { to: "/garage/mechanics", label: "Mechanics", icon: UserCog },
          { to: "/team", label: t.nav.team, icon: Users },
        ],
      },
      {
        id: "garage-insights",
        label: "Insights",
        items: [{ to: "/garage/reports", label: "Reports", icon: FileBarChart }],
      },
      {
        id: "system",
        label: "System",
        items: [{ to: "/settings", label: t.nav.settings, icon: Settings }],
      },
    ],
    [t],
  );

  const groups = isFleet ? fleetGroups : isGarage ? garageGroups : manufacturingGroups;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore malformed/unavailable storage
    }
    return Object.fromEntries(groups.map((g) => [g.id, true]));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore unavailable storage
    }
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
          <div>
            <div className="text-lg font-semibold leading-tight tracking-tight text-sidebar-foreground">
              {t.common.appName}
            </div>
            {(isGarage || isFleet) && (
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {isGarage ? "Workshop" : "Fleet"}
              </div>
            )}
          </div>
        </div>
        <LanguageSwitcher compact />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {groups.map((g, idx) => {
          const open = openGroups[g.id] ?? true;
          const isOverview = g.id === "overview" || g.id === "fleet-overview" || g.id === "garage-overview";

          if (isOverview) {
            return (
              <div key={g.id} className="space-y-1 pb-2">
                {g.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                    activeClassName="!bg-primary !text-primary-foreground hover:!bg-primary"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </NavLink>
                ))}
              </div>
            );
          }

          return (
            <div
              key={g.id}
              className={cn(idx > 0 && "border-t border-sidebar-border pt-2")}
            >
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1.5 pt-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-sidebar-foreground"
              >
                <span>{g.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    !open && "-rotate-90",
                  )}
                />
              </button>
              {open && (
                <div className="space-y-0.5 pb-1">
                  {g.items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      activeClassName="!bg-primary !text-primary-foreground hover:!bg-primary"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
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
