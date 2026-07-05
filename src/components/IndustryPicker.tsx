import { Factory, Truck, Wrench, Layers } from "lucide-react";
import type { IndustryProfile } from "@/hooks/useIndustry";
import { cn } from "@/lib/utils";

export const INDUSTRY_PROFILES: {
  value: IndustryProfile;
  label: string;
  icon: React.ElementType;
  desc: string;
  accent: string;
}[] = [
  {
    value: "manufacturing",
    label: "Manufacturing",
    icon: Factory,
    desc: "Production, OEE, Quality, Safety & Maintenance",
    accent: "border-blue-500 bg-blue-50 text-blue-700",
  },
  {
    value: "fleet_logistics",
    label: "Fleet & Logistics",
    icon: Truck,
    desc: "Vehicles, Drivers, Trips, Fuel & Documents",
    accent: "border-emerald-500 bg-emerald-50 text-emerald-700",
  },
  {
    value: "garage",
    label: "Workshop / Garage",
    icon: Wrench,
    desc: "Vehicle repairs, Job cards & Service management",
    accent: "border-orange-500 bg-orange-50 text-orange-700",
  },
  {
    value: "mixed",
    label: "Mixed Operations",
    icon: Layers,
    desc: "Combine fleet, manufacturing & workshop features",
    accent: "border-purple-500 bg-purple-50 text-purple-700",
  },
];

export function IndustryPicker({
  value,
  onChange,
}: {
  value: IndustryProfile;
  onChange: (value: IndustryProfile) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {INDUSTRY_PROFILES.map((p) => {
        const Icon = p.icon;
        const selected = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
              selected
                ? p.accent
                : "border-border bg-background hover:border-primary/40",
            )}
          >
            <Icon
              className={cn("h-5 w-5", selected ? "" : "text-muted-foreground")}
            />
            <div
              className={cn(
                "text-xs font-semibold leading-tight",
                !selected && "text-foreground",
              )}
            >
              {p.label}
            </div>
            <div
              className={cn(
                "text-[10px] leading-tight",
                selected ? "opacity-80" : "text-muted-foreground",
              )}
            >
              {p.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}
