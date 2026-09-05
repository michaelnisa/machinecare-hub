import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  BookOpen,
  Settings,
  Database,
  Sliders,
  History,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { ConnectionWizardModal } from "./ConnectionWizardModal";
import { integrationsService } from "@/services/integrationsService";

export function IntegrationsLayout() {
  const location = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);

  const navItems = [
    { to: "/integrations", label: "Marketplace", icon: Layers, exact: true },
    { to: "/integrations/connected", label: "Connected Systems", icon: CheckCircle2 },
    { to: "/integrations/mapping", label: "Data Mapping", icon: Sliders },
    { to: "/integrations/jobs", label: "Sync Jobs", icon: RotateCw },
    { to: "/integrations/history", label: "Sync History", icon: History },
    { to: "/integrations/errors", label: "Errors & DLQ", icon: AlertTriangle, badge: "2" },
    { to: "/integrations/webhooks", label: "Webhooks", icon: Radio },
    { to: "/integrations/credentials", label: "API Credentials", icon: ShieldCheck },
    { to: "/integrations/settings", label: "Settings", icon: Settings },
  ];

  const connectedCount = integrationsService.getConnectedSystems().length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              ERP & Business Systems Integration
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              Enterprise Hub
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect MachineCare operational intelligence with Odoo, SAP Business One, Microsoft Dynamics 365, and enterprise financial systems of record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => window.open("https://github.com", "_blank")}
          >
            <BookOpen className="h-3.5 w-3.5" /> Docs
          </Button>
          <Button
            size="sm"
            className="gap-2 text-xs bg-primary text-primary-foreground shadow-sm"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="h-4 w-4" /> Connect ERP System
          </Button>
        </div>
      </div>

      {/* Enterprise KPI Strip (Section 17) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-border">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Systems
            </div>
            <div className="text-2xl font-black text-foreground mt-1 flex items-center justify-between">
              {connectedCount}
              <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono font-bold">
                100% ONLINE
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Active Sync Jobs
            </div>
            <div className="text-2xl font-black text-foreground mt-1 flex items-center justify-between">
              8
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono font-bold">
                SCHEDULED
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Records Synced Today
            </div>
            <div className="text-2xl font-black text-foreground mt-1 flex items-center justify-between">
              24,892
              <span className="text-[10px] text-emerald-600 font-mono">
                +14.2%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Failed Records
            </div>
            <div className="text-2xl font-black text-destructive mt-1 flex items-center justify-between">
              2
              <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-mono font-bold">
                REQUIRES ATTN
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border col-span-2 sm:col-span-1">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Last Sync
            </div>
            <div className="text-base font-bold text-foreground mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              2 mins ago
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-1 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-1 rounded-full bg-destructive/15 text-destructive px-1.5 py-0.2 text-[10px] font-bold font-mono">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Subpage View Content */}
      <Outlet />

      {/* Guided Connection Wizard */}
      <ConnectionWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
export default IntegrationsLayout;
