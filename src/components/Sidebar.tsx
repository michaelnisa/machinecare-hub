import { useState, useEffect, useMemo } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/hooks/useIndustry";
import { useUserRole } from "@/hooks/useUserRole";
import { isPlatformAdmin } from "@/lib/admin";
import { isEnterpriseFleet } from "@/lib/fleetTiers";
import { isLogistixwareAccount } from "@/services/customerService";
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
  ShieldCheck,
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
  Layers,
  HardHat,
  Trophy,
  FlaskConical,
  Cpu,
  Sliders,
  BookOpen,
  Wallet,
  BarChart3,
  Smartphone,
  PiggyBank,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar.groups.v1";

type NavItem = { to: string; label: string; icon: any };
type NavGroup = { id: string; label: string; items: NavItem[] };

export function Sidebar() {
  const { user, profile, organisation, signOut } = useAuth();
  const { isFleet, isGarage, isMixed } = useIndustry();
  const { isManager } = useUserRole();
  const navigate = useNavigate();
  const { t } = useI18n();

  const isAdmin = isPlatformAdmin(user?.email || profile?.email);
  const isLite = (organisation?.plan ?? "standard") === "lite";
  const isLogistix = isLogistixwareAccount(organisation);
  const companyDisplayName =
    (organisation?.name && organisation.name !== "MachineCare" && organisation.name !== "My Company")
      ? organisation.name
      : user?.user_metadata?.company_name ||
        user?.user_metadata?.organisation_name ||
        organisation?.name ||
        "Company";

  const inventoryNavGroup: NavGroup = useMemo(
    () => ({
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
        { to: "/accounting", label: "Accounting & Receipts", icon: Receipt },
        { to: "/inventory/quarantine", label: "Quarantine", icon: PackageX },
        { to: "/inventory/production-materials", label: "Production materials", icon: Factory },
        { to: "/inventory/reorder", label: "Reorder & insights", icon: TrendingUp },
        { to: "/inventory/stock-counts", label: "Stock counts", icon: ClipboardCheck },
        { to: "/inventory/history", label: "Inventory history", icon: History },
        { to: "/inventory/reports", label: "Inventory reports", icon: FileBarChart },
      ],
    }),
    [t],
  );

  const fleetFinanceNavGroup: NavGroup = useMemo(
    () => ({
      id: "fleet-finance",
      label: "Finance & Accounting",
      items: [
        { to: "/finance", label: "Financial Overview", icon: LayoutDashboard },
        { to: "/finance/expenses", label: "Expenses", icon: Receipt },
        { to: "/finance/fuel", label: "Fuel Finance", icon: Fuel },
        { to: "/finance/trips", label: "Trip Revenue & Costs", icon: Route },
        { to: "/finance/invoices", label: "Customers & Invoicing", icon: FileText },
        { to: "/finance/budgeting", label: "Budgeting", icon: PiggyBank },
        { to: "/finance/suppliers", label: "Supplier Payments", icon: Building2 },
        { to: "/finance/ap-ar", label: "AP & AR Aging", icon: Calendar },
        { to: "/finance/cash-flow", label: "Cash Flow", icon: Wallet },
        { to: "/finance/vehicle-profitability", label: "Vehicle Profitability", icon: TrendingUp },
        { to: "/finance/reports", label: "Financial Reports", icon: BarChart3 },
      ],
    }),
    [],
  );

  const manufacturingFinanceNavGroup: NavGroup = useMemo(
    () => ({
      id: "manufacturing-finance",
      label: "Plant Finance",
      items: [
        { to: "/finance", label: "Plant Financial Overview", icon: LayoutDashboard },
        { to: "/finance/production-costing", label: "Batch & SKU Costing", icon: Boxes },
        { to: "/finance/maintenance-costs", label: "Machine Maintenance Cost", icon: Wrench },
        { to: "/finance/inventory-valuation", label: "Inventory Valuation", icon: Package },
        { to: "/finance/invoices", label: "Customers & Invoicing", icon: FileText },
        { to: "/finance/budgeting", label: "Plant Budgeting", icon: PiggyBank },
        { to: "/finance/suppliers", label: "Supplier Payments", icon: Building2 },
        { to: "/finance/ap-ar", label: "AP & AR Aging", icon: Calendar },
        { to: "/finance/cash-flow", label: "Cash Flow", icon: Wallet },
        { to: "/finance/reports", label: "Financial Reports", icon: BarChart3 },
      ],
    }),
    [],
  );

  const manufacturingGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          ...(!isLite ? [{ to: "/live", label: "Live TV", icon: Tv }] : []),
          ...(!isLite ? [{ to: "/production/3d-plant", label: "3D Plant & Line Layout", icon: Factory }] : []),
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
                { to: "/maintenance/inspections", label: "Inspections", icon: CheckCircle2 },
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
                { to: "/production/3d-plant", label: "3D Plant & Line Layout", icon: Factory },
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
                { to: "/safety/leaderboard", label: "Safety Leaderboard", icon: Trophy },
                { to: "/safety/chemicals", label: "Chemicals & Drum QR", icon: FlaskConical },
                { to: "/safety/supervisor-radar", label: "Supervisor Radar", icon: MapPin },
                { to: "/contractor/portal", label: "Contractor Portal", icon: HardHat },
                { to: "/safety/team", label: "Safety Team", icon: Users },
                { to: "/safety/live-tv", label: "Safety Live TV", icon: Tv },
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
      inventoryNavGroup,
      manufacturingFinanceNavGroup,
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
          ...(isAdmin ? [{ to: "/blog/manage", label: "Daily Blog", icon: BookOpen }] : []),
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/integrations", label: "Integrations", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isLite, profile?.department, isManager, isAdmin, inventoryNavGroup, manufacturingFinanceNavGroup],
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
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "fleet",
        label: "Fleet Operations",
        items: [
          { to: "/fleet/vehicles", label: "Vehicles", icon: Truck },
          { to: "/fleet/live-map", label: "Live GPS Fleet", icon: MapPin },
          { to: "/live", label: "Live TV", icon: Tv },
          { to: "/fleet/drivers", label: "Drivers", icon: Contact },
          { to: "/fleet/trips", label: "Trips", icon: Route },
          { to: "/fleet/approvals", label: "Approvals", icon: ShieldCheck },
          { to: "/fleet/documents", label: "Documents", icon: FileText },
          { to: "/fleet/tyres", label: "Tyres", icon: CircleDot },
          { to: "/fuel", label: t.nav.fuel, icon: Fuel },
          { to: "/fleet/inspections", label: "Inspections", icon: CheckCircle2 },
          ...(!isLogistix ? [{ to: "/field-app", label: "Field Mobile App", icon: Smartphone }] : []),
        ],
      },
      {
        id: "maintenance",
        label: "Maintenance",
        items: [
          {
            to: "/work-orders",
            label: "Job Cards",
            icon: ClipboardList,
          },
          { to: "/fleet/technicians", label: "Technicians", icon: UserCog },
          { to: "/fault-reports", label: "Fault reports", icon: AlertTriangle },
          { to: "/maintenance/calendar", label: "Maintenance Calendar", icon: Calendar },
          { to: "/maintenance/schedules", label: "PM Schedules", icon: ClipboardCheck },
          {
            to: "/checklist-templates",
            label: "Checklist templates",
            icon: ClipboardList,
          },
          { to: "/vendors", label: "Vendors", icon: Building2 },
        ],
      },
      inventoryNavGroup,
      {
        id: "fleet-procurement",
        label: "Procurement Department",
        items: [
          { to: "/fleet/procurement", label: "Procurement Dashboard", icon: ShoppingCart },
          { to: "/inventory/purchase-requests", label: "Purchase Requisitions", icon: FileText },
          { to: "/inventory/purchase-orders", label: "Purchase Orders (POs)", icon: ClipboardList },
          { to: "/fleet/approvals", label: "Approvals", icon: ShieldCheck },
          { to: "/inventory/suppliers", label: "Supplier Directory", icon: Building2 },
          { to: "/vendors", label: "Vendor SLA & Ratings", icon: Target },
        ],
      },
      fleetFinanceNavGroup,
      {
        id: "fleet-insights",
        label: "Insights",
        items: [
          {
            to: "/fleet/insights",
            label: "Fleet KPIs & Analytics",
            icon: Gauge,
          },
          { to: "/fleet/reports", label: "Executive Reports", icon: FileBarChart },
          { to: "/reports", label: t.nav.reports, icon: FileBarChart },
        ],
      },
      {
        id: "fleet-people",
        label: "People",
        items: [
          { to: "/team", label: t.nav.team, icon: Users },
        ],
      },
      {
        id: "system",
        label: "System",
        items: [
          ...(isAdmin ? [{ to: "/blog/manage", label: "Daily Blog", icon: BookOpen }] : []),
          { to: "/integrations", label: "Integrations", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isAdmin, inventoryNavGroup, fleetFinanceNavGroup, isLogistix],
  );

  // Enterprise Fleet 6-Department Architecture (Mega Beverages & Logistixware Blueprint)
  const enterpriseFleetGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "dept-fleet-ops",
        label: "Fleet Operations",
        items: [
          { to: "/dashboard", label: "Fleet Dashboard", icon: LayoutDashboard },
          { to: "/fleet/vehicles", label: "Vehicles & Assets", icon: Truck },
          { to: "/fleet/live-map", label: "Live Telematics & GPS", icon: MapPin },
          { to: "/live", label: "Live TV", icon: Tv },
          { to: "/fleet/drivers", label: "Driver Management", icon: Contact },
          { to: "/fleet/trips", label: "Trips & Dispatch", icon: Route },
          { to: "/fuel", label: "Fuel & Bowser Logs", icon: Fuel },
          { to: "/fleet/inspections", label: "Pre-Trip Inspections", icon: CheckCircle2 },
          { to: "/fleet/documents", label: "Fleet Compliance & Docs", icon: FileText },
          ...(!isLogistix ? [{ to: "/field-app", label: "Field Mobile App", icon: Smartphone }] : []),
        ],
      },
      {
        id: "dept-workshop",
        label: "Workshop Department",
        items: [
          { to: "/fleet/workshop", label: "Workshop Dashboard", icon: Wrench },
          { to: "/work-orders", label: "Job Cards & Repairs", icon: ClipboardList },
          { to: "/maintenance/schedules", label: "Preventive Schedules", icon: ClipboardCheck },
          { to: "/maintenance/calendar", label: "Maintenance Calendar", icon: Calendar },
          { to: "/fault-reports", label: "Defects & Fault Reports", icon: AlertTriangle },
          { to: "/fleet/tyres", label: "Tyre & Axle Matrix", icon: CircleDot },
          { to: "/fleet/vehicles?tab=plant", label: "Plant & Auxiliary Assets", icon: Factory },
          { to: "/fleet/technicians", label: "Technicians & Rosters", icon: UserCog },
          { to: "/checklist-templates", label: "Inspection Checklists", icon: ClipboardCheck },
        ],
      },
      {
        id: "dept-stores",
        label: "Stores & Spares",
        items: [
          { to: "/inventory", label: "Stores Overview", icon: Warehouse },
          { to: "/inventory/items", label: "Spare Parts Catalog", icon: Boxes },
          { to: "/inventory/stock", label: "Stock Levels & Bins", icon: Package },
          { to: "/inventory/requests", label: "Material Issue Slips", icon: ClipboardList },
          { to: "/inventory/locations", label: "Depot Warehouses", icon: MapPin },
          { to: "/inventory/reorder", label: "Min/Max Replenishment", icon: TrendingUp },
          { to: "/inventory/stock-counts", label: "Physical Stock Audits", icon: ClipboardCheck },
          { to: "/inventory/history", label: "Stock Movement Ledger", icon: History },
          { to: "/inventory/reports", label: "Stock Valuation & Audit", icon: FileBarChart },
        ],
      },
      {
        id: "dept-procurement",
        label: "Procurement Department",
        items: [
          { to: "/fleet/procurement", label: "Procurement Dashboard", icon: ShoppingCart },
          { to: "/inventory/purchase-requests", label: "Purchase Requisitions", icon: FileText },
          { to: "/inventory/purchase-orders", label: "Purchase Orders (POs)", icon: ClipboardList },
          { to: "/fleet/approvals", label: "Multi-Stage Approvals", icon: ShieldCheck },
          { to: "/inventory/suppliers", label: "Supplier Directory", icon: Building2 },
          { to: "/vendors", label: "Vendor SLA & Ratings", icon: Target },
        ],
      },
      {
        id: "dept-finance",
        label: "Finance & Accounts",
        items: [
          { to: "/finance", label: "Financial Dashboard", icon: LayoutDashboard },
          { to: "/finance/expenses", label: "Expense Vouchers", icon: Receipt },
          { to: "/finance/fuel", label: "Fuel Reconciliation", icon: Fuel },
          { to: "/finance/vehicle-profitability", label: "Chassis Profit & Loss", icon: TrendingUp },
          { to: "/finance/budgeting", label: "Fleet & Depots Budget", icon: PiggyBank },
          { to: "/finance/suppliers", label: "Supplier AP & Bills", icon: Building2 },
          { to: "/finance/invoices", label: "Customer Billing & AR", icon: FileText },
          { to: "/finance/reports", label: "Cost & Audit Statements", icon: BarChart3 },
        ],
      },
      {
        id: "dept-management",
        label: "Management & Approvals",
        items: [
          { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
          { to: "/fleet/approvals", label: "Executive Approvals", icon: ShieldCheck },
          { to: "/fleet/reports", label: "Executive Reporting Center", icon: FileBarChart },
          { to: "/reports", label: "Monthly Maintenance Reports", icon: FileText },
          { to: "/fleet/insights", label: "KPIs & Telematics Trends", icon: Gauge },
        ],
      },
      {
        id: "system",
        label: "System & Governance",
        items: [
          ...(isAdmin ? [{ to: "/blog/manage", label: "Daily Blog", icon: BookOpen }] : []),
          { to: "/team", label: "Staff & User Roles", icon: Users },
          { to: "/integrations", label: "Integrations & APIs", icon: Layers },
          { to: "/settings", label: "System Settings", icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [isAdmin, isLogistix],
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
          { to: "/live", label: "Live Workshop TV", icon: Tv },
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
          { to: "/accounting", label: "Receipts & Vouchers", icon: Receipt },
          // { to: "/garage/payments", label: "Payments", icon: CreditCard },
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
        items: [
          ...(isAdmin ? [{ to: "/blog/manage", label: "Daily Blog", icon: BookOpen }] : []),
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/integrations", label: "Integrations", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isAdmin],
  );

  const isSafetyDept = profile?.department === "safety";

  const safetyDeptGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "safety-overview",
        label: "Safety Overview",
        items: [
          { to: "/safety", label: "Safety Dashboard", icon: ShieldAlert },
          { to: "/safety/supervisor-radar", label: "Supervisor Radar", icon: MapPin },
          { to: "/safety/live-tv", label: "Safety Live TV", icon: Tv },
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "contractor-ops",
        label: "Contractors & Operations",
        items: [
          { to: "/contractor/portal", label: "Contractor Portal", icon: HardHat },
          { to: "/safety/contractors", label: "Contractor Registry", icon: Building2 },
          { to: "/safety/team", label: "Safety Department Team", icon: Users },
          { to: "/team", label: "Organization Team", icon: Users },
        ],
      },
      {
        id: "safety-governance",
        label: "Safety Governance",
        items: [
          { to: "/safety/risk-assessments", label: "Risk assessments (RAMS)", icon: ClipboardList },
          { to: "/safety/inspections", label: "Safety inspections", icon: CheckCircle2 },
          { to: "/safety/corrective-actions", label: "Corrective actions", icon: AlertTriangle },
          { to: "/safety/ppe", label: "PPE Management", icon: Package },
          { to: "/safety/competency", label: "Training & competency", icon: GraduationCap },
          { to: "/safety/equipment", label: "Safety equipment", icon: ShieldAlert },
          { to: "/safety/certificates", label: "Certificates", icon: ClipboardCheck },
          { to: "/safety/controlled-tools", label: "Controlled tools", icon: Wrench },
          { to: "/safety/documents", label: "Safety documents", icon: FileText },
          { to: "/safety/rules", label: "Safety rules", icon: Settings },
          { to: "/induction/dashboard", label: t.nav.induction, icon: GraduationCap },
        ],
      },
      {
        id: "account",
        label: "Account & System",
        items: [
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isAdmin],
  );

  const iotGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "iot-overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: "IoT Dashboard", icon: LayoutDashboard },
          { to: "/live", label: "Live Telemetry TV", icon: Tv },
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "connected-data",
        label: "Connected Data & IoT",
        items: [
          { to: "/integrations/connected", label: "Connected Devices & IoT", icon: Cpu },
          { to: "/maintenance/meter-readings", label: "Telemetry & Meters", icon: Activity },
          { to: "/integrations/mapping", label: "Data Mapping", icon: Sliders },
          { to: "/integrations/jobs", label: "Sync & Stream Jobs", icon: Layers },
        ],
      },
      {
        id: "monitored-assets",
        label: "Monitored Assets",
        items: [
          { to: "/machines", label: "Monitored Equipment", icon: Wrench },
          { to: "/maintenance/downtime", label: "Telemetry Alarms & Downtime", icon: AlertOctagon },
          { to: "/analytics", label: "Sensor Analytics", icon: BarChart2 },
        ],
      },
      {
        id: "system",
        label: "System",
        items: [
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/integrations", label: "Integrations Catalog", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isAdmin],
  );

  const gpsTrackingGroups: NavGroup[] = useMemo(
    () => [
      {
        id: "gps-overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: "Tracking Dashboard", icon: LayoutDashboard },
          { to: "/live", label: "Live Telematics TV", icon: Tv },
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      },
      {
        id: "gps-telematics",
        label: "MachineCare GPS Tracking",
        items: [
          { to: "/gps/live-map", label: "Live Tracking Map", icon: MapPin },
          { to: "/gps/replay", label: "Route History & Replay", icon: History },
          { to: "/gps/geofences", label: "Geofence Zones", icon: Target },
          { to: "/gps/alerts", label: "Telematics Alerts", icon: AlertTriangle },
          { to: "/gps/devices", label: "GPS Hardware Trackers", icon: Cpu },
          { to: "/gps/vehicles", label: "Tracked Vehicles", icon: Truck },
        ],
      },
      {
        id: "gps-insights",
        label: "Insights",
        items: [
          { to: "/gps/insights", label: "GPS Telematics KPIs", icon: Gauge },
          { to: "/reports", label: t.nav.reports, icon: FileBarChart },
        ],
      },
      {
        id: "system",
        label: "System",
        items: [
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/integrations", label: "Integrations Catalog", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      },
    ],
    [t, isAdmin],
  );

  // When a user belongs to the Safety Department, isolate their view to Safety & People only.
  // Otherwise, respect organisation.enabled_modules or fallback to legacy industry profiles.
  const groups = useMemo(() => {
    if (isSafetyDept) return safetyDeptGroups;

    // Direct Industry Profile or GPS Tracking Suite matching
    if (
      organisation?.industry_profile === "gps_tracking" ||
      (organisation?.industry?.toLowerCase() === "gps_tracking" &&
        organisation?.industry_profile !== "manufacturing" &&
        organisation?.industry_profile !== "fleet_logistics" &&
        organisation?.industry_profile !== "garage" &&
        organisation?.industry_profile !== "mixed") ||
      (organisation?.enabled_modules?.includes("gps_tracking") &&
        !organisation?.enabled_modules?.includes("fleet") &&
        !organisation?.enabled_modules?.includes("production") &&
        !organisation?.enabled_modules?.includes("maintenance"))
    ) {
      return gpsTrackingGroups;
    }

    const isEnterprise = isEnterpriseFleet(organisation);
    const activeFleetGroups = isEnterprise ? enterpriseFleetGroups : fleetGroups;

    if (organisation?.industry_profile === "fleet_logistics" || isFleet) {
      return activeFleetGroups;
    }
    if (organisation?.industry_profile === "garage" || isGarage) {
      return garageGroups;
    }

    const enabledMods = organisation?.enabled_modules;
    if (enabledMods && Array.isArray(enabledMods) && enabledMods.length > 0) {
      // 1. Standalone Safety & HSE
      if (enabledMods.length === 1 && enabledMods[0] === "safety") {
        return safetyDeptGroups;
      }

      // 2. Standalone IoT & Connected Data
      if (
        enabledMods.includes("connected_data") &&
        !enabledMods.includes("fleet") &&
        !enabledMods.includes("workshop") &&
        !enabledMods.includes("production") &&
        !enabledMods.includes("maintenance")
      ) {
        return iotGroups;
      }

      // 3. Standalone Fleet & Logistics
      if (
        enabledMods.includes("fleet") &&
        !enabledMods.includes("workshop") &&
        !enabledMods.includes("production") &&
        !enabledMods.includes("maintenance")
      ) {
        return activeFleetGroups;
      }

      // 3.5 Standalone GPS Tracking & Telematics Suite
      if (
        enabledMods.includes("gps_tracking") &&
        !enabledMods.includes("fleet") &&
        !enabledMods.includes("workshop") &&
        !enabledMods.includes("production") &&
        !enabledMods.includes("maintenance")
      ) {
        return gpsTrackingGroups;
      }

      // 4. Standalone Workshop & Garage
      if (
        enabledMods.includes("workshop") &&
        !enabledMods.includes("fleet") &&
        !enabledMods.includes("production") &&
        !enabledMods.includes("maintenance")
      ) {
        return garageGroups;
      }

      // 5. Modular Composition (Maintenance Suite, Production Suite, Enterprise, or Custom combinations)
      const dynamicGroups: NavGroup[] = [];

      // Overview
      const isProductionOnly = enabledMods.includes("production") && !enabledMods.includes("maintenance");
      dynamicGroups.push({
        id: "overview",
        label: "Overview",
        items: [
          { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          ...(!isLite ? [{
            to: isProductionOnly ? "/live/production" : "/live",
            label: isProductionOnly ? "Live Production TV" : "Live TV",
            icon: Tv,
          }] : []),
          ...(!isLite && !isFleetOnly && !isGarageOnly ? [{
            to: "/production/3d-plant",
            label: "3D Plant & Line Layout",
            icon: Factory,
          }] : []),
          { to: "/notifications", label: t.nav.notifications, icon: Bell },
        ],
      });

      // Maintenance / Assets
      if (enabledMods.includes("maintenance") || enabledMods.includes("assets")) {
        const mGroup = manufacturingGroups.find((g) => g.id === "assets");
        if (mGroup) dynamicGroups.push(mGroup);
      }

      // Production
      if (enabledMods.includes("production")) {
        const pGroup = manufacturingGroups.find((g) => g.id === "production");
        if (pGroup) {
          dynamicGroups.push(pGroup);
        } else if (!isLite) {
          dynamicGroups.push({
            id: "production",
            label: "Production",
            items: [
              { to: "/production/3d-plant", label: "3D Plant & Line Layout", icon: Factory },
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
          });
        }
      }

      // Inventory
      if (enabledMods.includes("inventory")) {
        const iGroup = manufacturingGroups.find((g) => g.id === "inventory");
        if (iGroup) dynamicGroups.push(iGroup);
      }

      // Safety
      if (enabledMods.includes("safety")) {
        const sGroup = manufacturingGroups.find((g) => g.id === "safety");
        if (sGroup) {
          dynamicGroups.push(sGroup);
        } else if (!isLite) {
          const sGovGroup = safetyDeptGroups.find((g) => g.id === "safety-governance");
          if (sGovGroup) dynamicGroups.push(sGovGroup);
        }
      }

      // Connected Data & IoT
      if (enabledMods.includes("connected_data")) {
        dynamicGroups.push({
          id: "connected-data",
          label: "Connected Data & IoT",
          items: [
            { to: "/integrations/connected", label: "Connected Devices & IoT", icon: Cpu },
            { to: "/maintenance/meter-readings", label: "Telemetry & Meters", icon: Activity },
            { to: "/integrations/mapping", label: "Data Mapping", icon: Sliders },
            { to: "/integrations/jobs", label: "Sync & Stream Jobs", icon: Layers },
          ],
        });
      }

      // Fleet
      if (enabledMods.includes("fleet")) {
        const fGroup = fleetGroups.find((g) => g.id === "fleet");
        if (fGroup) dynamicGroups.push(fGroup);
        const fiGroup = fleetGroups.find((g) => g.id === "fleet-insights");
        if (fiGroup) dynamicGroups.push(fiGroup);
      } else if (enabledMods.includes("gps_tracking")) {
        const gGroup = gpsTrackingGroups.find((g) => g.id === "gps-telematics");
        if (gGroup) dynamicGroups.push(gGroup);
      }

      // Workshop & Garage
      if (enabledMods.includes("workshop")) {
        const wGroup = garageGroups.find((g) => g.id === "garage-workshop");
        if (wGroup) dynamicGroups.push(wGroup);
        const cGroup = garageGroups.find((g) => g.id === "garage-commercial");
        if (cGroup) dynamicGroups.push(cGroup);
      }

      // Insights & Vendors
      if (!isLite && (enabledMods.includes("maintenance") || enabledMods.includes("inventory"))) {
        const vGroup = manufacturingGroups.find((g) => g.id === "vendors");
        if (vGroup) dynamicGroups.push(vGroup);
        const insGroup = manufacturingGroups.find((g) => g.id === "insights");
        if (insGroup) dynamicGroups.push(insGroup);
      }

      // Finance
      if (enabledMods.includes("fleet")) {
        dynamicGroups.push(fleetFinanceNavGroup);
      } else if (
        enabledMods.includes("production") ||
        enabledMods.includes("maintenance") ||
        enabledMods.includes("inventory")
      ) {
        dynamicGroups.push(manufacturingFinanceNavGroup);
      }

      // System
      dynamicGroups.push({
        id: "system",
        label: isLite ? "Account" : "System",
        items: [
          ...(isAdmin ? [{ to: "/blog/manage", label: "Daily Blog", icon: BookOpen }] : []),
          { to: "/team", label: t.nav.team, icon: Users },
          { to: "/integrations", label: "Integrations", icon: Layers },
          { to: "/settings", label: t.nav.settings, icon: Settings },
          ...(isAdmin ? [{ to: "/admin", label: "Admin Portal", icon: ShieldAlert }] : []),
        ],
      });

      return dynamicGroups;
    }

    // Legacy fallback for existing database accounts:
    return isMixed
      ? [
          ...manufacturingGroups.filter((g) => g.id !== "system"),
          ...activeFleetGroups.filter((g) => g.id !== "system"),
          ...garageGroups,
        ]
      : isFleet
      ? activeFleetGroups
      : isGarage
      ? garageGroups
      : manufacturingGroups;
  }, [
    isSafetyDept,
    organisation,
    isMixed,
    isFleet,
    isGarage,
    manufacturingGroups,
    fleetGroups,
    enterpriseFleetGroups,
    garageGroups,
    safetyDeptGroups,
    iotGroups,
    isLite,
    isAdmin,
    t,
  ]);

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
        <Link to="/settings" className="flex items-center gap-2.5 min-w-0 group" title="Account & Organization Settings">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={companyDisplayName}
              className="h-10 w-10 rounded-xl object-contain bg-background border border-sidebar-border p-1 shrink-0 shadow-sm transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 font-black text-base shadow-sm uppercase transition-transform group-hover:scale-105">
              {companyDisplayName && companyDisplayName !== "Company" ? (
                companyDisplayName.trim().charAt(0)
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-base font-bold leading-tight tracking-tight text-sidebar-foreground truncate group-hover:text-primary transition-colors" title={companyDisplayName}>
              <span className="truncate">
                {companyDisplayName.includes("Enterprise") ? (
                  companyDisplayName.split(/(Enterprise)/gi).map((part, i) =>
                    part.toLowerCase() === "enterprise" ? (
                      <span key={i} className="text-emerald-600 dark:text-emerald-400 font-extrabold">{part}</span>
                    ) : (
                      part
                    )
                  )
                ) : (
                  companyDisplayName
                )}
              </span>
              {isEnterpriseFleet(organisation) && (
                <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  Enterprise
                </span>
              )}
            </div>
            {(() => {
              if (
                organisation?.industry_profile === "gps_tracking" ||
                (organisation?.industry?.toLowerCase() === "gps_tracking" &&
                  organisation?.industry_profile !== "manufacturing" &&
                  organisation?.industry_profile !== "fleet_logistics" &&
                  organisation?.industry_profile !== "garage" &&
                  organisation?.industry_profile !== "mixed") ||
                (organisation?.enabled_modules?.includes("gps_tracking") &&
                  !organisation?.enabled_modules?.includes("fleet") &&
                  !organisation?.enabled_modules?.includes("production"))
              ) {
                return <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-500 truncate">GPS Tracking</div>;
              }
              if (isFleet || organisation?.industry_profile === "fleet_logistics") {
                return <div className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">Fleet & Logistics</div>;
              }
              if (isGarage || organisation?.industry_profile === "garage") {
                return <div className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">Workshop & Garage</div>;
              }
              const enabledMods = organisation?.enabled_modules;
              if (enabledMods && Array.isArray(enabledMods) && enabledMods.length > 0) {
                if (enabledMods.length === 1 && enabledMods[0] === "safety") {
                  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Safety HSE</div>;
                }
                if (
                  enabledMods.includes("connected_data") &&
                  !enabledMods.includes("fleet") &&
                  !enabledMods.includes("workshop") &&
                  !enabledMods.includes("production") &&
                  !enabledMods.includes("maintenance")
                ) {
                  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">IoT & Telemetry</div>;
                }
                if (organisation.plan === "enterprise" || enabledMods.length >= 7) {
                  return <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">Enterprise</div>;
                }
                if (enabledMods.includes("production") && !enabledMods.includes("maintenance")) {
                  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Production</div>;
                }
                if (enabledMods.includes("maintenance") && !enabledMods.includes("production")) {
                  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Maintenance</div>;
                }
              }
              return (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {organisation?.industry_profile?.replace("_", " ") || "Hub"}
                </div>
              );
            })()}
          </div>
        </Link>
        <LanguageSwitcher compact />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {groups.map((g, idx) => {
          const open = openGroups[g.id] ?? true;
          const isOverview =
            g.id === "overview" ||
            g.id === "fleet-overview" ||
            g.id === "garage-overview" ||
            g.id === "safety-overview" ||
            g.id === "iot-overview";

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
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={organisation.name || "Company"}
              className="h-9 w-9 shrink-0 rounded-lg object-contain bg-background border border-sidebar-border p-0.5 shadow-sm"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {initials(profile?.full_name)}
            </div>
          )}
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
