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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs">
              Commercial ERP
            </span>
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Navigation Tabs Strip */}
      <div className="border-b border-border bg-card/40 rounded-xl p-1.5 shadow-2xs">
        <nav className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none" aria-label="Finance Navigation">
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
                  "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
