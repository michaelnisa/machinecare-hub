import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, Shield, Phone, CreditCard, X, Check, LogOut, ArrowRight, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { SAFE_DRIVER_COLUMNS, parseDriver, type FleetDriver } from "@/lib/fleet-metadata";
import { CoverImage } from "@/components/CoverImage";

export interface ActiveDriverSession {
  id: string;
  full_name: string;
  phone?: string | null;
  licence_number?: string | null;
  licence_class?: string | null;
  driver_code?: string | null;
  photo_url?: string | null;
  assigned_vehicle?: string | null;
  signed_in_at: string;
}

const STORAGE_KEY = "fleet_active_driver_session";

export function getActiveDriverSession(): ActiveDriverSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveActiveDriverSession(driver: FleetDriver): ActiveDriverSession {
  const session: ActiveDriverSession = {
    id: driver.id,
    full_name: driver.full_name,
    phone: driver.phone || null,
    licence_number: driver.licence_number || null,
    licence_class: driver.licence_class || null,
    driver_code: driver.driver_code || null,
    photo_url: driver.photo_url || null,
    assigned_vehicle: driver.assigned_vehicle || null,
    signed_in_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export function clearActiveDriverSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId?: string | null;
  currentVehiclePlate?: string | null;
  onDriverSelected: (session: ActiveDriverSession) => void;
  lang?: "en" | "sw";
}

export function DriverSignInModal({
  open,
  onOpenChange,
  organisationId,
  currentVehiclePlate,
  onDriverSelected,
  lang = "en",
}: Props) {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const isSwahili = lang === "sw";

  const t = {
    title: isSwahili ? "Kuingia kwa Dereva" : "Driver Fast Check-In",
    subtitle: isSwahili
      ? "Chagua jina lako kwenye orodha ya madereva wa kampuni ili kuanza zamu."
      : "Select your name from the fleet roster to sign in and record trip actions.",
    searchPlaceholder: isSwahili ? "Tafuta jina au namba ya simu..." : "Search driver name or phone...",
    assignedToThis: isSwahili ? "Gari hili" : "Assigned to this vehicle",
    switchDriver: isSwahili ? "Badili Dereva" : "Switch Driver",
    signIn: isSwahili ? "Ingia kama Dereva" : "Check-in as Driver",
    noDrivers: isSwahili ? "Hakuna dereva aliyepatikana" : "No active drivers found",
    cancel: isSwahili ? "Funga" : "Close",
    successMsg: isSwahili ? "Karibu kazini" : "Driver checked in successfully",
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let q = supabase.from("drivers").select(SAFE_DRIVER_COLUMNS).eq("status", "active").order("full_name");
    if (organisationId) {
      q = q.eq("organisation_id", organisationId);
    }
    q.then(({ data, error }) => {
      setLoading(false);
      if (error) {
        console.error("Failed to load drivers for sign in:", error);
        return;
      }
      const parsed = (data || []).map((raw, idx) => parseDriver(raw, idx));
      setDrivers(parsed);
    });
  }, [open, organisationId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      d.full_name.toLowerCase().includes(q) ||
      (d.phone || "").toLowerCase().includes(q) ||
      (d.driver_code || "").toLowerCase().includes(q) ||
      (d.assigned_vehicle || "").toLowerCase().includes(q)
    );
  }, [drivers, search]);

  const handleSelect = (driver: FleetDriver) => {
    const session = saveActiveDriverSession(driver);
    toast.success(`${t.successMsg}, ${driver.full_name}!`);
    onDriverSelected(session);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">{t.title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t.subtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 border-b border-border/60 bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-sm bg-muted/40"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-border/40">
          {loading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {isSwahili ? "Inapakia madereva..." : "Loading drivers..."}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs text-muted-foreground">{t.noDrivers}</p>
            </div>
          ) : (
            filtered.map((d) => {
              const isAssigned =
                currentVehiclePlate &&
                d.assigned_vehicle &&
                d.assigned_vehicle.toLowerCase().trim() === currentVehiclePlate.toLowerCase().trim();

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 pt-3.5 group hover:bg-muted/60 ${
                    isAssigned ? "bg-primary/5 border border-primary/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-11 w-11 rounded-full overflow-hidden border border-border/80 bg-muted shadow-2xs shrink-0 ring-1 ring-border/40">
                      <CoverImage
                        value={d.photo_url}
                        alt={d.full_name}
                        className="h-full w-full object-cover object-center"
                        fallback={
                          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 text-primary font-bold text-xs flex items-center justify-center">
                            {d.full_name.slice(0, 2).toUpperCase()}
                          </div>
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {d.full_name}
                        </span>
                        {isAssigned && (
                          <Badge variant="outline" className="text-[9.5px] bg-primary/10 text-primary border-primary/30 shrink-0">
                            {t.assignedToThis}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-0.5">
                        {d.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {d.phone}
                          </span>
                        )}
                        {d.driver_code && (
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {d.driver_code}
                          </span>
                        )}
                        {d.licence_class && (
                          <span className="font-mono bg-muted px-1.5 py-0.2 rounded text-[10px]">
                            {d.licence_class}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 p-2 rounded-full group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DriverSignInModal;
