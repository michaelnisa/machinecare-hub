import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Fuel,
  Route,
  FileText,
  Building2,
  Calendar,
  Wallet,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FinanceNavHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const FINANCE_NAV_ITEMS = [
  { to: "/finance", label: "Overview", icon: LayoutDashboard },
  { to: "/finance/expenses", label: "Expenses", icon: Receipt },
  { to: "/finance/fuel", label: "Fuel Finance", icon: Fuel },
  { to: "/finance/trips", label: "Trip Revenue & Costs", icon: Route },
  { to: "/finance/invoices", label: "Customers & Invoicing", icon: FileText },
  { to: "/finance/suppliers", label: "Supplier Payments", icon: Building2 },
  { to: "/finance/ap-ar", label: "AP & AR Aging", icon: Calendar },
  { to: "/finance/cash-flow", label: "Cash Flow", icon: Wallet },
  { to: "/finance/vehicle-profitability", label: "Vehicle Profitability", icon: TrendingUp },
  { to: "/finance/reports", label: "Reports & P&L", icon: BarChart3 },
];

export function FinanceNavHeader({ title, subtitle, actions }: FinanceNavHeaderProps) {
  const location = useLocation();

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Commercials
            </span>
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Navigation Tabs Strip */}
      <div className="border-b border-border">
        <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none" aria-label="Finance Navigation">
          {FINANCE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/finance"
                ? location.pathname === "/finance"
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
