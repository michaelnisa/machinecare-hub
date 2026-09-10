/**
 * MachineCare - Solution Suite & Independent Module Selector
 * Allows customers and administrators to select specific business suites during onboarding,
 * ensuring clean separation of modules without clutter.
 */

import React from "react";
import {
  Wrench,
  Factory,
  ShieldAlert,
  Truck,
  Building2,
  Cpu,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SolutionSuite {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  modules: string[];
  recommendedIndustry: string;
  badge?: string;
}

export const SOLUTION_SUITES: SolutionSuite[] = [
  {
    id: "maintenance",
    name: "Asset Care & Maintenance",
    description: "Machines, preventive work orders, spare parts stock, and safety permits.",
    icon: Wrench,
    modules: ["assets", "maintenance", "inventory", "safety"],
    recommendedIndustry: "manufacturing",
  },
  {
    id: "production",
    name: "Manufacturing Operations",
    description: "Production lines, live OEE tracking, scrap, raw materials, and factory safety.",
    icon: Factory,
    modules: ["production", "inventory", "safety"],
    recommendedIndustry: "manufacturing",
  },
  {
    id: "safety_only",
    name: "Standalone Safety & HSE",
    description: "Incident logs, risk assessments (RAMS), permits to work, contractor compliance.",
    icon: ShieldAlert,
    modules: ["safety"],
    recommendedIndustry: "mixed",
    badge: "Independent",
  },
  {
    id: "fleet",
    name: "Fleet & Logistics",
    description: "Vehicles, drivers, trips, fuel efficiency, tyres, and pre-start checklists.",
    icon: Truck,
    modules: ["fleet"],
    recommendedIndustry: "fleet_logistics",
  },
  {
    id: "garage",
    name: "Workshop & Garage",
    description: "Customer intake, mechanics dispatch, diagnostic estimates, and invoices.",
    icon: Building2,
    modules: ["workshop", "inventory"],
    recommendedIndustry: "garage",
  },
  {
    id: "iot_connected",
    name: "Connected Data & IoT Suite",
    description: "High-frequency telemetry, live sensor feeds, vibration/temperature alarms.",
    icon: Cpu,
    modules: ["connected_data", "assets"],
    recommendedIndustry: "mixed",
    badge: "IoT Telemetry",
  },
  {
    id: "enterprise",
    name: "Full Enterprise Platform",
    description: "All 8 domains unlocked with custom fields, database gateway, and extension slots.",
    icon: Layers,
    modules: [
      "assets",
      "maintenance",
      "production",
      "inventory",
      "fleet",
      "safety",
      "workshop",
      "connected_data",
    ],
    recommendedIndustry: "mixed",
    badge: "Enterprise",
  },
];

interface SolutionSuitePickerProps {
  selectedSuiteId: string;
  onSelectSuite: (suite: SolutionSuite) => void;
  accountTier: "standard" | "enterprise";
  onChangeAccountTier?: (tier: "standard" | "enterprise") => void;
}

export const SolutionSuitePicker: React.FC<SolutionSuitePickerProps> = ({
  selectedSuiteId,
  onSelectSuite,
  accountTier,
  onChangeAccountTier,
}) => {
  return (
    <div className="space-y-4">
      {/* Optional Tier Switcher */}
      {onChangeAccountTier && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 text-sm">
          <div>
            <div className="font-semibold text-foreground">Account Tier</div>
            <div className="text-xs text-muted-foreground">
              {accountTier === "enterprise"
                ? "Custom extensions, custom fields, and dedicated database integrations unlocked."
                : "Standard out-of-the-box solution."}
            </div>
          </div>
          <div className="flex rounded-md bg-background border p-0.5">
            <button
              type="button"
              onClick={() => onChangeAccountTier("standard")}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                accountTier === "standard"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => onChangeAccountTier("enterprise")}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                accountTier === "enterprise"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Enterprise
            </button>
          </div>
        </div>
      )}

      {/* Suites Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Select Solution Suite
        </label>
        <div className="grid grid-cols-1 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
          {SOLUTION_SUITES.map((suite) => {
            const isSelected = selectedSuiteId === suite.id;
            const Icon = suite.icon;

            return (
              <div
                key={suite.id}
                onClick={() => onSelectSuite(suite)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                    : "border-border hover:border-muted-foreground/40 bg-card"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg shrink-0 mt-0.5",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{suite.name}</span>
                    {suite.badge && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded">
                        {suite.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {suite.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {suite.modules.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] bg-secondary/80 text-secondary-foreground px-1.5 py-0.2 rounded font-mono"
                      >
                        {m === "connected_data" ? "IoT" : m}
                      </span>
                    ))}
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 self-center" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
