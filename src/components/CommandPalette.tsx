/**
 * MachineCare Platform - Universal Command Palette (Cmd + K)
 * Fast spotlight search and action execution across all 8 business domains.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/platform/feature_flags/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import {
  Wrench,
  Truck,
  Building2,
  ShieldAlert,
  Factory,
  Cpu,
  Package,
  Plus,
  Tv,
  Users,
  Settings,
  Layers,
  Calendar,
  Gauge,
  FileText,
  Activity,
  Search,
  LayoutDashboard,
  Receipt,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: extOpen, onOpenChange: setExtOpen }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = extOpen !== undefined;
  const isOpen = isControlled ? extOpen : internalOpen;
  const setIsOpen = isControlled ? setExtOpen! : setInternalOpen;

  const navigate = useNavigate();
  const { organisation } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    machines: { id: string; name: string; category?: string }[];
    workOrders: { id: string; title: string; wo_number?: number; wo_year?: number }[];
  }>({ machines: [], workOrders: [] });

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setIsOpen]);

  // Query live records when query is at least 2 characters
  useEffect(() => {
    if (!organisation?.id || query.trim().length < 2) {
      setSearchResults({ machines: [], workOrders: [] });
      return;
    }

    let active = true;
    const searchRecords = async () => {
      const q = query.trim();
      const [{ data: mData }, { data: woData }] = await Promise.all([
        supabase
          .from("machines")
          .select("id, name, category")
          .eq("organisation_id", organisation.id)
          .ilike("name", `%${q}%`)
          .limit(5),
        supabase
          .from("work_orders")
          .select("id, title, wo_number, wo_year")
          .eq("organisation_id", organisation.id)
          .ilike("title", `%${q}%`)
          .limit(5),
      ]);

      if (active) {
        setSearchResults({
          machines: mData ?? [],
          workOrders: woData ?? [],
        });
      }
    };

    const timer = setTimeout(searchRecords, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, organisation?.id]);

  const runCommand = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput
        placeholder="Type a command, search assets, work orders, or pages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Live Search Results */}
        {searchResults.machines.length > 0 && (
          <CommandGroup heading="Machines & Assets">
            {searchResults.machines.map((m) => (
              <CommandItem
                key={m.id}
                onSelect={() => runCommand(() => navigate(`/machines/${m.id}`))}
              >
                <Wrench className="mr-2 h-4 w-4 text-primary" />
                <span>{m.name}</span>
                {m.category && <span className="ml-2 text-xs text-muted-foreground">({m.category})</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults.workOrders.length > 0 && (
          <CommandGroup heading="Work Orders">
            {searchResults.workOrders.map((wo) => (
              <CommandItem
                key={wo.id}
                onSelect={() => runCommand(() => navigate(`/work-orders/${wo.id}`))}
              >
                <FileText className="mr-2 h-4 w-4 text-amber-500" />
                <span>{wo.title}</span>
                {wo.wo_number && (
                  <span className="ml-2 text-xs font-mono text-muted-foreground">
                    WO-{wo.wo_year ?? "2026"}-{String(wo.wo_number).padStart(4, "0")}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {isFeatureEnabled("maintenance") && (
            <CommandItem onSelect={() => runCommand(() => navigate("/work-orders/new"))}>
              <Plus className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Create Work Order</span>
              <CommandShortcut>WO</CommandShortcut>
            </CommandItem>
          )}
          {isFeatureEnabled("safety") && (
            <CommandItem onSelect={() => runCommand(() => navigate("/safety"))}>
              <ShieldAlert className="mr-2 h-4 w-4 text-rose-500" />
              <span>Report Safety Incident</span>
              <CommandShortcut>HSE</CommandShortcut>
            </CommandItem>
          )}
          {isFeatureEnabled("workshop") && (
            <CommandItem onSelect={() => runCommand(() => navigate("/garage/jobs"))}>
              <Building2 className="mr-2 h-4 w-4 text-blue-500" />
              <span>Intake Workshop Vehicle</span>
              <CommandShortcut>JOB</CommandShortcut>
            </CommandItem>
          )}
          {isFeatureEnabled("fleet") && (
            <CommandItem onSelect={() => runCommand(() => navigate("/fleet/trips"))}>
              <Truck className="mr-2 h-4 w-4 text-sky-500" />
              <span>Dispatch Fleet Trip</span>
            </CommandItem>
          )}
          {isFeatureEnabled("inventory") && (
            <CommandItem onSelect={() => runCommand(() => navigate("/inventory/requests"))}>
              <Package className="mr-2 h-4 w-4 text-amber-500" />
              <span>Request Spare Parts</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => navigate("/live"))}>
            <Tv className="mr-2 h-4 w-4 text-purple-500" />
            <span>Launch Live Operations TV</span>
            <CommandShortcut>TV</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation by Module */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          {isFeatureEnabled("maintenance") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/machines"))}>
                <Wrench className="mr-2 h-4 w-4" />
                <span>Asset Register & Machines</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/work-orders"))}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Work Orders</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/maintenance/calendar"))}>
                <Calendar className="mr-2 h-4 w-4" />
                <span>Maintenance Calendar</span>
              </CommandItem>
            </>
          )}
          {isFeatureEnabled("production") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/production/overview"))}>
                <Factory className="mr-2 h-4 w-4" />
                <span>Production Overview</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/oee"))}>
                <Gauge className="mr-2 h-4 w-4" />
                <span>OEE Performance</span>
              </CommandItem>
            </>
          )}
          {isFeatureEnabled("safety") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/safety"))}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                <span>Safety & HSE Command Center</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/contractor/portal"))}>
                <Users className="mr-2 h-4 w-4" />
                <span>Contractor Portal</span>
              </CommandItem>
            </>
          )}
          {isFeatureEnabled("fleet") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/fleet/vehicles"))}>
                <Truck className="mr-2 h-4 w-4" />
                <span>Fleet Vehicles</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/fleet/trips"))}>
                <Activity className="mr-2 h-4 w-4" />
                <span>Active Trips & Dispatches</span>
              </CommandItem>
            </>
          )}
          {isFeatureEnabled("workshop") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/garage"))}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Workshop Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/garage/jobs"))}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Workshop Jobs &amp; Fast Intake</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/garage/invoices"))}>
                <Receipt className="mr-2 h-4 w-4" />
                <span>Invoices &amp; Quick Counter Sales</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/garage/estimates"))}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Estimates &amp; Quotes</span>
              </CommandItem>
            </>
          )}
          {isFeatureEnabled("connected_data") && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/integrations/connected"))}>
                <Cpu className="mr-2 h-4 w-4" />
                <span>Connected Devices & IoT</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/maintenance/meter-readings"))}>
                <Activity className="mr-2 h-4 w-4" />
                <span>Telemetry & Meter Readings</span>
              </CommandItem>
            </>
          )}
          <CommandItem onSelect={() => runCommand(() => navigate("/team"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Team & User Roles</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/integrations"))}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Integrations & ERP Connectors</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
