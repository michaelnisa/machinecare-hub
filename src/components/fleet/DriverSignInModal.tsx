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
import {
  Search,
  UserCheck,
  Shield,
  Phone,
  CreditCard,
  X,
  Check,
  LogOut,
  ArrowRight,
  Truck,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  SAFE_DRIVER_COLUMNS,
  parseDriver,
  normalizePhone,
  type FleetDriver,
} from "@/lib/fleet-metadata";
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

/**
 * Validates driver login credentials using phone / driver code + PIN.
 * Fallback PIN is the last 4 digits of driver phone (or "1234").
 */
export function validateDriverLogin(
  drivers: FleetDriver[],
  identifier: string,
  pin: string,
  lang: "en" | "sw" = "en"
): { success: boolean; driver?: FleetDriver; error?: string } {
  const isSwahili = lang === "sw";
  const cleanId = identifier.trim();
  const cleanPin = pin.trim();

  if (!cleanId) {
    return {
      success: false,
      error: isSwahili ? "Tafadhali weka namba ya simu au Driver ID." : "Please enter your phone number or Driver ID.",
    };
  }
  if (!cleanPin) {
    return {
      success: false,
      error: isSwahili ? "Tafadhali weka PIN / Nenosiri lako." : "Please enter your PIN / Password.",
    };
  }

  const normInputPhone = normalizePhone(cleanId);
  const upperInputCode = cleanId.toUpperCase();

  const matched = drivers.find((d) => {
    const dPhone = d.phone ? normalizePhone(d.phone) : "";
    const dCode = (d.driver_code || "").trim().toUpperCase();
    return (dPhone && normInputPhone && dPhone === normInputPhone) || (dCode && dCode === upperInputCode);
  });

  if (!matched) {
    return {
      success: false,
      error: isSwahili
        ? "Dereva hajapatikana kwa namba hii ya simu au ID. Hakikisha umesajiliwa na meneja wa fleet."
        : "Driver not found for this phone or Driver ID. Please contact your fleet admin.",
    };
  }

  const expectedPin =
    matched.login_pin || (matched.phone ? matched.phone.replace(/\D/g, "").slice(-4) : "1234");

  if (cleanPin !== expectedPin) {
    return {
      success: false,
      error: isSwahili
        ? "PIN siyo sahihi. PIN chaguomsingi ni tarakimu 4 za mwisho za simu yako."
        : "Incorrect PIN. Default PIN is the last 4 digits of your phone number.",
    };
  }

  return { success: true, driver: matched };
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
  const [tab, setTab] = useState<"phone_pin" | "directory">("phone_pin");
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Phone & PIN form state
  const [phoneInput, setPhoneInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Directory selected driver for PIN confirmation
  const [pinModalDriver, setPinModalDriver] = useState<FleetDriver | null>(null);
  const [directoryPin, setDirectoryPin] = useState("");
  const [showDirPin, setShowDirPin] = useState(false);

  const isSwahili = lang === "sw";

  const t = {
    title: isSwahili ? "Kuingia kwa Dereva" : "Driver Portal Sign-In",
    subtitle: isSwahili
      ? "Ingia kwa namba yako ya simu na PIN kuanza safari na kuripoti mafuta."
      : "Sign in with your registered phone number and PIN to log trips and expenses.",
    tabPhone: isSwahili ? "Simu na PIN" : "Phone & PIN",
    tabDirectory: isSwahili ? "Orodha ya Madereva" : "Driver Directory",
    phoneLabel: isSwahili ? "Namba ya Simu au Driver ID" : "Phone Number or Driver ID",
    phonePlaceholder: isSwahili ? "Mfano: 0712 345 678 au DRV-001" : "e.g. 0712 345 678 or DRV-001",
    pinLabel: isSwahili ? "PIN ya Kuingia (Tarakimu 4)" : "Login PIN (4 digits)",
    pinPlaceholder: isSwahili ? "Tarakimu 4 (Chaguomsingi: mwisho wa simu)" : "4 digits (Default: last 4 of phone)",
    pinHelper: isSwahili
      ? "Kumbuka: PIN chaguomsingi ni tarakimu 4 za mwisho za simu yako."
      : "Tip: Default PIN is the last 4 digits of your registered phone number.",
    signInBtn: isSwahili ? "Ingia Kazini" : "Sign In & Check In",
    searchPlaceholder: isSwahili ? "Tafuta jina au simu..." : "Search driver name or phone...",
    assignedToThis: isSwahili ? "Gari hili" : "Assigned to this vehicle",
    noDrivers: isSwahili ? "Hakuna dereva aliyepatikana" : "No active drivers found",
    cancel: isSwahili ? "Funga" : "Close",
    back: isSwahili ? "Rudi" : "Back",
    confirmPinTitle: isSwahili ? "Thibitisha PIN yako" : "Confirm Your PIN",
    successMsg: isSwahili ? "Karibu kazini" : "Driver checked in successfully",
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let q = supabase
      .from("drivers")
      .select(SAFE_DRIVER_COLUMNS)
      .eq("status", "active")
      .order("full_name");
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
    setPinModalDriver(null);
    setPhoneInput("");
    setPinInput("");
    setDirectoryPin("");
  };

  const handlePhonePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateDriverLogin(drivers, phoneInput, pinInput, lang);
    if (!result.success || !result.driver) {
      toast.error(result.error || "Authentication failed");
      return;
    }
    handleSelect(result.driver);
  };

  const handleDirectoryPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalDriver) return;
    const expectedPin =
      pinModalDriver.login_pin ||
      (pinModalDriver.phone ? pinModalDriver.phone.replace(/\D/g, "").slice(-4) : "1234");

    if (directoryPin.trim() !== expectedPin) {
      toast.error(
        isSwahili
          ? "PIN siyo sahihi. PIN chaguomsingi ni tarakimu 4 za mwisho za simu yako."
          : "Incorrect PIN. Default PIN is the last 4 digits of your phone."
      );
      return;
    }
    handleSelect(pinModalDriver);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0">
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

          {/* Mode Switcher Tabs */}
          {!pinModalDriver && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl mt-3 border border-border/60">
              <button
                type="button"
                onClick={() => setTab("phone_pin")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tab === "phone_pin"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <span>{t.tabPhone}</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("directory")}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tab === "directory"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{t.tabDirectory}</span>
              </button>
            </div>
          )}
        </DialogHeader>

        {/* PIN Confirmation Screen when selecting from directory */}
        {pinModalDriver ? (
          <form onSubmit={handleDirectoryPinSubmit} className="p-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
              <div className="relative h-12 w-12 rounded-full overflow-hidden border border-border bg-muted shrink-0">
                <CoverImage
                  value={pinModalDriver.photo_url}
                  alt={pinModalDriver.full_name}
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="h-full w-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center">
                      {pinModalDriver.full_name.slice(0, 2).toUpperCase()}
                    </div>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-foreground truncate">{pinModalDriver.full_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  {pinModalDriver.phone && <span>{pinModalDriver.phone}</span>}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {pinModalDriver.driver_code}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{t.pinLabel}</span>
                {pinModalDriver.phone && (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {isSwahili ? "Chaguomsingi: " : "Default: "}
                    {pinModalDriver.phone.replace(/\D/g, "").slice(-4)}
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showDirPin ? "text" : "password"}
                  value={directoryPin}
                  onChange={(e) => setDirectoryPin(e.target.value)}
                  placeholder="••••"
                  className="h-12 text-center text-xl font-mono tracking-widest bg-muted/30 pr-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowDirPin(!showDirPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showDirPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">{t.pinHelper}</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={() => {
                  setPinModalDriver(null);
                  setDirectoryPin("");
                }}
              >
                {t.back}
              </Button>
              <Button type="submit" className="flex-1 gap-2 font-semibold shadow-xs cursor-pointer">
                <Check className="h-4 w-4" />
                <span>{t.signInBtn}</span>
              </Button>
            </div>
          </form>
        ) : tab === "phone_pin" ? (
          /* Phone & PIN Login Form */
          <form onSubmit={handlePhonePinSubmit} className="p-5 space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t.phoneLabel}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="pl-9 h-11 text-sm bg-muted/30"
                  autoFocus
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isSwahili ? "Unaweza kutumia namba ya simu au Driver ID yako (mf. DRV-001)" : "Enter your registered phone or Driver Code (e.g. DRV-001)"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t.pinLabel}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPin ? "text" : "password"}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={t.pinPlaceholder}
                  className="pl-9 pr-10 h-11 text-sm font-mono tracking-wider bg-muted/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.pinHelper}</p>
            </div>

            <Button type="submit" className="w-full h-11 gap-2 text-sm font-semibold shadow-xs mt-2 cursor-pointer">
              <UserCheck className="h-4 w-4" />
              <span>{t.signInBtn}</span>
            </Button>
          </form>
        ) : (
          /* Directory List View */
          <>
            <div className="p-4 border-b border-border/60 bg-background">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 text-sm bg-muted/40"
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
                      onClick={() => {
                        setPinModalDriver(d);
                        setDirectoryPin("");
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 pt-3.5 group hover:bg-muted/60 cursor-pointer ${
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
          </>
        )}

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
