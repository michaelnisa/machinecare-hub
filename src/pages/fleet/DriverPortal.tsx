import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/PageLoader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { formatMoney, formatDate } from "@/lib/format";
import {
  Truck,
  Car,
  Route,
  Fuel,
  Receipt,
  ClipboardCheck,
  AlertTriangle,
  LogOut,
  UserCheck,
  MapPin,
  Calendar,
  DollarSign,
  ShieldCheck,
  Building2,
  ChevronRight,
  ArrowRight,
  Phone,
  QrCode,
  AlertOctagon,
  KeyRound,
  Eye,
  EyeOff,
  Users,
  Lock,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DriverSignInModal,
  getActiveDriverSession,
  clearActiveDriverSession,
  validateDriverLogin,
  findDriverByIdentifier,
  saveActiveDriverSession,
  type ActiveDriverSession,
} from "@/components/fleet/DriverSignInModal";
import { QuickFuelDialog } from "@/components/QuickFuelDialog";
import { DriverComplaintModal } from "@/components/fleet/DriverComplaintModal";
import {
  SAFE_MACHINE_COLUMNS,
  SAFE_DRIVER_COLUMNS,
  parseMachine,
  parseDriver,
  parseCargoMeta,
  extractCleanCargo,
  saveDriverPin,
  verifyDriverIdentitySecret,
  type FleetVehicle,
  type FleetDriver,
} from "@/lib/fleet-metadata";
import { CoverImage } from "@/components/CoverImage";

export default function DriverPortal() {
  const { user, organisation } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const isSwahili = lang === "sw";

  const [activeDriver, setActiveDriver] = useState<ActiveDriverSession | null>(() => getActiveDriverSession());
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Assigned vehicle and active trip data
  const [assignedVehicle, setAssignedVehicle] = useState<FleetVehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

  // Dialog states for Quick Actions
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseDialogType, setExpenseDialogType] = useState<"receipt" | "fine">("receipt");
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);

  // Inline login form state for unauthenticated drivers
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlinePin, setInlinePin] = useState("");
  const [showInlinePin, setShowInlinePin] = useState(false);
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Self-Service PIN Creation / Setup state
  const [setupDriver, setSetupDriver] = useState<FleetDriver | null>(null);
  const [setupStep, setSetupStep] = useState<"verify" | "pin">("pin");
  const [setupSecret, setSetupSecret] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  // Forgot PIN self-service reset state
  const [forgotDriver, setForgotDriver] = useState<FleetDriver | null>(null);
  const [verifySecret, setVerifySecret] = useState("");

  // Change PIN modal state for logged-in driver
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [changeNewPin, setChangeNewPin] = useState("");
  const [changeConfirmPin, setChangeConfirmPin] = useState("");
  const [showChangePin, setShowChangePin] = useState(false);
  const [savingChangePin, setSavingChangePin] = useState(false);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLogin(true);
    try {
      let q = supabase.from("drivers").select(SAFE_DRIVER_COLUMNS).eq("status", "active");
      if (organisation?.id) {
        q = q.eq("organisation_id", organisation.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      const parsedDrivers = (data || []).map((raw, idx) => parseDriver(raw, idx));
      const res = validateDriverLogin(parsedDrivers, inlinePhone, inlinePin, isSwahili ? "sw" : "en");

      if (res.needsSetup && res.driver) {
        setSetupDriver(res.driver);
        setSetupStep("verify");
        setSetupSecret("");
        setNewPin("");
        setConfirmPin("");
        return;
      }

      if (!res.success || !res.driver) {
        toast.error(res.error || "Authentication failed");
        return;
      }
      const session = saveActiveDriverSession(res.driver);
      setActiveDriver(session);
      toast.success(`${isSwahili ? "Karibu kazini" : "Driver signed in successfully"}, ${res.driver.full_name}!`);
      setInlinePhone("");
      setInlinePin("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleInlineSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupDriver) return;
    const p = newPin.trim();
    if (p.length < 4) {
      toast.error(isSwahili ? "PIN lazima iwe angalau tarakimu 4." : "PIN must be at least 4 digits.");
      return;
    }
    if (p !== confirmPin.trim()) {
      toast.error(isSwahili ? "PIN hazilingani. Tafadhali rudia kwa usahihi." : "PINs do not match. Please re-enter.");
      return;
    }
    setSavingPin(true);
    const res = await saveDriverPin(setupDriver.id, p);
    setSavingPin(false);
    if (!res.success) {
      toast.error(res.error || "Failed to save PIN");
      return;
    }
    setupDriver.login_pin = p;
    const session = saveActiveDriverSession(setupDriver);
    setActiveDriver(session);
    setSetupDriver(null);
    setInlinePhone("");
    setInlinePin("");
    toast.success(isSwahili ? "PIN imehifadhiwa! Karibu kazini." : "PIN created! Welcome on duty.");
  };

  const handleInlineVerifySetupSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupDriver) return;
    const ok = verifyDriverIdentitySecret(setupDriver, setupSecret);
    if (!ok) {
      toast.error(
        isSwahili
          ? "Taarifa haikulingana na kumbukumbu. Weka Driver ID yako (mf. DRV-001) au Namba ya Leseni."
          : "Verification failed. Check your Driver ID (e.g. DRV-001) or Driving Licence number."
      );
      return;
    }
    setSetupStep("pin");
    toast.success(
      isSwahili
        ? "Utambulisho umethibitishwa! Weka PIN yako mpya ya tarakimu 4 sasa."
        : "Identity confirmed! Create your new 4-digit PIN now."
    );
  };

  const handleInlineVerifySecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotDriver) return;
    const ok = verifyDriverIdentitySecret(forgotDriver, verifySecret);

    if (!ok) {
      toast.error(isSwahili ? "Taarifa haikulingana na kumbukumbu za dereva huyu." : "Verification failed. Check Driver ID or Licence.");
      return;
    }
    const target = forgotDriver;
    setForgotDriver(null);
    setSetupDriver(target);
    setSetupStep("pin");
    setNewPin("");
    setConfirmPin("");
    toast.success(isSwahili ? "Utambulisho umethibitishwa! Weka PIN mpya sasa." : "Identity confirmed! Create your new PIN now.");
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDriver) return;

    // Security check: if driver has an existing PIN in localStorage, verify current PIN
    const savedPin = typeof window !== "undefined" ? localStorage.getItem(`fleet_driver_pin_${activeDriver.id}`) : null;
    if (savedPin && currentPin.trim() !== savedPin.trim()) {
      toast.error(isSwahili ? "PIN ya sasa uliyoweka siyo sahihi." : "Current PIN is incorrect.");
      return;
    }

    const p = changeNewPin.trim();
    if (p.length < 4) {
      toast.error(isSwahili ? "PIN mpya lazima iwe angalau tarakimu 4." : "New PIN must be at least 4 digits.");
      return;
    }
    if (p !== changeConfirmPin.trim()) {
      toast.error(isSwahili ? "PIN mpya hazilingani." : "New PINs do not match.");
      return;
    }
    setSavingChangePin(true);
    const res = await saveDriverPin(activeDriver.id, p);
    setSavingChangePin(false);
    if (!res.success) {
      toast.error(res.error || "Failed to change PIN");
      return;
    }
    setChangePinOpen(false);
    toast.success(isSwahili ? "PIN yako imebadilishwa kikamilifu!" : "Your PIN has been changed successfully!");
  };

  const t = {
    portalTitle: isSwahili ? "Tovuti ya Dereva" : "Driver Portal",
    welcome: isSwahili ? "Karibu Kazini" : "Driver Operations Dashboard",
    signInPrompt: isSwahili ? "Tafadhali ingia ili kutazama gari na safari zako" : "Please sign in to view your assigned vehicle and trips",
    checkInBtn: isSwahili ? "Ingia Kama Dereva" : "Driver Fast Check-In",
    signOut: isSwahili ? "Toka" : "Sign Out",
    switchDriver: isSwahili ? "Badili Dereva" : "Switch Driver",
    myVehicle: isSwahili ? "Gari na Trela Lililopangwa" : "My Assigned Truck & Trailer",
    noVehicle: isSwahili ? "Hakuna gari lililopangwa kwa sasa" : "No specific vehicle assigned currently",
    activeTrip: isSwahili ? "Safari Inayoendelea" : "Active Commercial Trip",
    noTrip: isSwahili ? "Hakuna safari inayoendelea kwa sasa" : "No active commercial trip in progress",
    preTripCheck: isSwahili ? "Ukaguzi wa Gari" : "Pre-Trip Inspection",
    preTripPassed: isSwahili ? "Umekamilika Leo" : "Completed Today",
    preTripDue: isSwahili ? "Unatakiwa Kufanyika" : "Inspection Due",
    doPreTrip: isSwahili ? "Fanya Ukaguzi Sasa" : "Start Walkaround Check",
    logFuel: isSwahili ? "Weka Mafuta" : "Log Fuel & Litres",
    addExpense: isSwahili ? "Ripoti Risiti / Gharama" : "Upload Receipt",
    addFine: isSwahili ? "Ripoti Faini ya Barabarani" : "Upload Traffic Fine",
    reportIssue: isSwahili ? "Ripoti Hitilafu ya Gari" : "Report Breakdown / Defect",
    recentActions: isSwahili ? "Matumizi na Risiti za Hivi Karibuni" : "Recent En-Route Expenses",
    scanQr: isSwahili ? "Fungua Ukurasa wa Gari (QR)" : "Open Vehicle QR Sheet",
    route: isSwahili ? "Njia" : "Route",
    cargo: isSwahili ? "Mzigo" : "Cargo",
    fuelExpenses: isSwahili ? "Gharama ya Mafuta" : "Fuel Cost",
    otherExpenses: isSwahili ? "Gharama Nyingine" : "Other Expenses",
    totalCosts: isSwahili ? "Jumla ya Matumizi" : "Total Driver Expenses",
  };

  // Load assigned vehicle and trip when activeDriver changes
  useEffect(() => {
    if (!activeDriver) {
      setAssignedVehicle(null);
      setActiveTrip(null);
      setRecentExpenses([]);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        // 1. Find assigned vehicle by plate or driver_id
        let vehicleData: any = null;
        if (activeDriver.assigned_vehicle) {
          const { data: vList } = await supabase
            .from("machines")
            .select(SAFE_MACHINE_COLUMNS)
            .ilike("plate_number", `%${activeDriver.assigned_vehicle.trim()}%`)
            .limit(1);
          if (vList && vList.length > 0) vehicleData = vList[0];
        }

        // Fallback: search by active trips for this driver
        const { data: trips } = await supabase
          .from("trips")
          .select("id, machine_id, driver_id, status, start_at, end_at, start_odo, origin, destination, cargo_description, machines(id, name, plate_number, make, model, current_odometer_km, current_hours, status)")
          .eq("driver_id", activeDriver.id)
          .in("status", ["active", "in_progress", "pending"])
          .order("start_at", { ascending: false })
          .limit(1);

        if (trips && trips.length > 0) {
          const trip = trips[0];
          let parsedCargo: any = null;
          if (trip.cargo_description) {
            parsedCargo = parseCargoMeta(trip.cargo_description);
          }
          const rawClient = parsedCargo?.client || (trip.purpose?.startsWith("Client:") ? trip.purpose.replace(/^Client:\s*/i, "") : null);
          const cleanClient = rawClient ? rawClient.replace(/^[,\s]+|[,\s]+$/g, "").trim() : null;
          const cleanCargo = extractCleanCargo(trip.cargo_description, trip.purpose);

          setActiveTrip({
            ...trip,
            client_name: cleanClient,
            clean_cargo: cleanCargo,
            origin: trip.origin ? trip.origin.replace(/^[,\s]+|[,\s]+$/g, "").trim() : null,
            destination: trip.destination ? trip.destination.replace(/^[,\s]+|[,\s]+$/g, "").trim() : null,
          });
          if (!vehicleData && trip.machines) {
            vehicleData = trip.machines;
          }

          // Fetch expenses for active trip
          const { data: exps } = await (supabase as any)
            .from("trip_expenses")
            .select("*")
            .eq("trip_id", trip.id)
            .order("expense_date", { ascending: false })
            .limit(6);
          setRecentExpenses(exps || []);
        } else {
          setActiveTrip(null);
          setRecentExpenses([]);
        }

        if (vehicleData) {
          setAssignedVehicle(parseMachine(vehicleData));
        } else {
          setAssignedVehicle(null);
        }
      } catch (err) {
        console.error("Failed to load driver portal data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeDriver]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 pb-20">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Top Header with Logo and Language Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {organisation?.logo_url ? (
              <img
                src={organisation.logo_url}
                alt={organisation.name}
                className="h-9 w-auto max-w-[130px] object-contain rounded-md bg-white p-1 border shadow-xs"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xs">
                {organisation?.name ? organisation.name.charAt(0).toUpperCase() : <Building2 className="h-5 w-5" />}
              </div>
            )}
            <div>
              <span className="font-bold text-sm tracking-tight text-foreground block leading-tight">
                {organisation?.name || "LOGISTIXWARE FLEET"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                {t.portalTitle}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground underline">
              Home
            </Link>
          </div>
        </div>

        {/* Admin context bar (visible when account admin visits driver portal) */}
        {user && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 px-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span className="text-muted-foreground truncate">
                Admin Mode: <strong className="text-foreground">{user.email}</strong>
              </span>
            </div>
            <Link to="/fleet/vehicles" className="font-semibold text-primary hover:underline shrink-0 text-[11px]">
              Fleet Admin →
            </Link>
          </div>
        )}

        {/* Driver Session Card */}
        {activeDriver ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-13 w-13 rounded-full overflow-hidden border-2 border-primary/40 bg-muted shadow-sm shrink-0 ring-2 ring-primary/10">
                  <CoverImage
                    value={activeDriver.photo_url}
                    alt={activeDriver.full_name}
                    className="h-full w-full object-cover object-center"
                    fallback={
                      <div className="h-full w-full bg-gradient-to-br from-primary/25 via-primary/15 to-primary/5 text-primary font-bold text-base flex items-center justify-center">
                        {activeDriver.full_name.slice(0, 2).toUpperCase()}
                      </div>
                    }
                  />
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background ring-1 ring-emerald-500/40" title="Active on duty" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground truncate">
                      {activeDriver.full_name}
                    </span>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {activeDriver.driver_code && (
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {activeDriver.driver_code}
                      </span>
                    )}
                    {activeDriver.licence_class && (
                      <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                        Class {activeDriver.licence_class}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 cursor-pointer"
                  onClick={() => {
                    setChangePinOpen(true);
                    setCurrentPin("");
                    setChangeNewPin("");
                    setChangeConfirmPin("");
                  }}
                  title={isSwahili ? "Badili PIN yako ya siri" : "Change your secret PIN"}
                >
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">{isSwahili ? "Badili PIN" : "Change PIN"}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 cursor-pointer"
                  onClick={() => setDriverModalOpen(true)}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{t.switchDriver}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 cursor-pointer"
                  onClick={() => {
                    clearActiveDriverSession();
                    setActiveDriver(null);
                    toast.info(isSwahili ? "Umetoka kwenye akaunti ya dereva" : "Signed out of driver session");
                  }}
                  title={t.signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : setupDriver ? (
          setupStep === "verify" ? (
            /* Step 1: Verify Driver Identity before setting PIN */
            <div className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="text-center space-y-1.5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {isSwahili ? "Hatua ya 1: Thibitisha Utambulisho Wako" : "Step 1: Verify Driver Identity"}
                </h2>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isSwahili
                    ? `Dereva: ${setupDriver.full_name}. Ili kuweka PIN yako kwa usalama, weka Driver ID yako (mf. DRV-001) au Namba ya Leseni.`
                    : `Driver: ${setupDriver.full_name}. Enter your Driver ID (e.g. DRV-001) or Driving Licence number to verify your identity.`}
                </p>
              </div>

              <form onSubmit={handleInlineVerifySetupSecret} className="space-y-3.5 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {isSwahili ? "Driver ID au Namba ya Leseni" : "Driver ID or Licence Number"}
                  </label>
                  <Input
                    type="text"
                    value={setupSecret}
                    onChange={(e) => setSetupSecret(e.target.value)}
                    placeholder={isSwahili ? "Mfano: DRV-001 au namba ya leseni" : "e.g. DRV-001 or licence number"}
                    className="h-11 text-sm font-mono uppercase bg-muted/30"
                    autoFocus
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {isSwahili
                      ? "Hakikisha unatumia Driver ID yako iliyosajiliwa na ofisi ya fleet."
                      : "Enter the unique Driver ID or licence number on file with fleet management."}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 cursor-pointer"
                    onClick={() => setSetupDriver(null)}
                  >
                    {isSwahili ? "Rudi" : "Back"}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2 text-sm font-semibold shadow-xs cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isSwahili ? "Thibitisha & Endelea" : "Verify & Continue"}</span>
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Step 2: Driver PIN Creation */
            <div className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="text-center space-y-1.5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {isSwahili ? "Hatua ya 2: Weka PIN Yako ya Siri" : "Step 2: Create Your Secret PIN"}
                </h2>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isSwahili
                    ? `Karibu, ${setupDriver.full_name}! Weka PIN ya tarakimu 4 utakayotumia kila siku kuingia kazini.`
                    : `Welcome, ${setupDriver.full_name}! Please create your 4-digit secret PIN for everyday login.`}
                </p>
              </div>

              <form onSubmit={handleInlineSaveNewPin} className="space-y-3.5 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    <span>{isSwahili ? "Weka PIN Mpya (Tarakimu 4)" : "Enter New 4-Digit PIN"}</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPin ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="••••"
                      className="h-11 font-mono tracking-widest text-base text-center bg-muted/30 pr-10"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {isSwahili ? "Rudia PIN Kuthibitisha" : "Confirm PIN"}
                  </label>
                  <Input
                    type={showNewPin ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••"
                    className="h-11 font-mono tracking-widest text-base text-center bg-muted/30"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 cursor-pointer"
                    onClick={() => setSetupDriver(null)}
                  >
                    {isSwahili ? "Rudi" : "Back"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingPin}
                    className="flex-1 gap-2 text-sm font-semibold shadow-xs cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingPin ? (isSwahili ? "Inahifadhi..." : "Saving...") : (isSwahili ? "Hifadhi PIN & Ingia" : "Save PIN & Sign In")}</span>
                  </Button>
                </div>
              </form>
            </div>
          )
        ) : forgotDriver ? (
          /* Driver Self-Service Forgot PIN Reset */
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="text-center space-y-1.5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-2">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {isSwahili ? "Weka Upya PIN Uliyosahau" : "Reset Forgotten PIN"}
              </h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isSwahili
                  ? `Dereva: ${forgotDriver.full_name}. Thibitisha utambulisho wako kwa kuweka Driver ID yako (mf. DRV-001) au Namba ya Leseni.`
                  : `Driver: ${forgotDriver.full_name}. Enter your Driver ID (e.g. DRV-001) or licence number to verify your identity.`}
              </p>
            </div>

            <form onSubmit={handleInlineVerifySecret} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {isSwahili ? "Driver ID au Namba ya Leseni" : "Driver ID or Licence Number"}
                </label>
                <Input
                  type="text"
                  value={verifySecret}
                  onChange={(e) => setVerifySecret(e.target.value)}
                  placeholder={isSwahili ? "Mfano: DRV-001 au namba ya leseni" : "e.g. DRV-001 or licence number"}
                  className="h-11 text-sm font-mono uppercase bg-muted/30"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={() => setForgotDriver(null)}
                >
                  {isSwahili ? "Rudi" : "Back"}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gap-2 text-sm font-semibold shadow-xs cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSwahili ? "Thibitisha" : "Verify Identity"}</span>
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Sign In Card for unauthenticated drivers */
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="text-center space-y-1.5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{t.welcome}</h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isSwahili
                  ? "Weka namba yako ya simu na PIN uliyoweka kuingia kwenye gari lako."
                  : "Enter your registered phone number and PIN to access your truck & trips."}
              </p>
            </div>

            <form onSubmit={handleInlineLogin} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>{isSwahili ? "Namba ya Simu au Driver ID" : "Phone Number or Driver ID"}</span>
                </label>
                <Input
                  type="text"
                  value={inlinePhone}
                  onChange={(e) => setInlinePhone(e.target.value)}
                  placeholder={isSwahili ? "Mfano: 0712 345 678 au DRV-001" : "e.g. 0712 345 678 or DRV-001"}
                  className="h-11 text-sm bg-muted/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>{isSwahili ? "PIN ya Dereva (Tarakimu 4)" : "Driver PIN (4 digits)"}</span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!inlinePhone.trim()) {
                        toast.info(isSwahili ? "Weka kwanza namba ya simu au Driver ID hapo juu." : "Please enter your phone number or Driver ID first.");
                        return;
                      }
                      try {
                        const { data } = await supabase.from("drivers").select(SAFE_DRIVER_COLUMNS).eq("status", "active");
                        const parsed = (data || []).map((raw, idx) => parseDriver(raw, idx));
                        const matched = findDriverByIdentifier(parsed, inlinePhone);
                        if (matched) {
                          setForgotDriver(matched);
                          setVerifySecret("");
                        } else {
                          toast.error(isSwahili ? "Dereva hajapatikana." : "Driver not found.");
                        }
                      } catch {
                        toast.error("Could not verify driver");
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    {isSwahili ? "Umesahau PIN?" : "Forgot PIN?"}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showInlinePin ? "text" : "password"}
                    value={inlinePin}
                    onChange={(e) => setInlinePin(e.target.value)}
                    placeholder="••••"
                    className="h-11 font-mono tracking-widest text-sm bg-muted/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInlinePin(!showInlinePin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showInlinePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isSwahili ? "Kama ni mara ya kwanza, utaelekezwa kuweka PIN yako mpya." : "First time? You will be guided to create your new PIN."}
                </p>
              </div>

              <Button
                type="submit"
                disabled={submittingLogin}
                className="w-full h-11 gap-2 text-sm font-semibold shadow-xs cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                <span>{submittingLogin ? (isSwahili ? "Inathibitisha..." : "Signing in...") : (isSwahili ? "Ingia Kazini" : "Sign In & Check In")}</span>
              </Button>
            </form>

            <div className="relative pt-1 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <span className="relative bg-card px-2 text-[11px] text-muted-foreground uppercase font-medium">
                {isSwahili ? "au" : "or"}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 gap-2 text-xs font-medium cursor-pointer"
              onClick={() => setDriverModalOpen(true)}
            >
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>{isSwahili ? "Tafuta Jina Kwenye Orodha ya Madereva" : "Browse Driver Directory"}</span>
            </Button>
          </div>
        )}

        {/* When signed in: Active Vehicle Card */}
        {activeDriver && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  {t.myVehicle}
                </h3>
              </div>
              {assignedVehicle && (
                <Link
                  to={`/m/${assignedVehicle.id}?d=${encodeURIComponent(activeDriver.full_name)}&di=${encodeURIComponent(activeDriver.id)}`}
                  className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{t.scanQr}</span>
                </Link>
              )}
            </div>

            {assignedVehicle ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-400 text-black font-mono font-black text-xs border border-amber-500 shadow-2xs">
                    <span className="text-[9px] bg-black/10 px-1 rounded">TZ</span>
                    {assignedVehicle.plate_number || assignedVehicle.name}
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {[assignedVehicle.make, assignedVehicle.model].filter(Boolean).join(" · ") || assignedVehicle.name}
                  </div>
                  {assignedVehicle.current_odometer_km != null && (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Odometer: {Number(assignedVehicle.current_odometer_km).toLocaleString()} km
                    </div>
                  )}
                </div>

                {assignedVehicle.linked_trailer_plate && (
                  <div className="text-right space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      {isSwahili ? "Trela Lililounganishwa" : "Coupled Trailer"}
                    </span>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                      {assignedVehicle.linked_trailer_plate}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/30 text-center text-xs text-muted-foreground">
                {t.noVehicle}
              </div>
            )}
          </div>
        )}

        {/* Active Trip Card */}
        {activeDriver && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Route className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  {t.activeTrip}
                </h3>
              </div>
              {activeTrip && (
                <Badge variant="outline" className="text-[9.5px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  In Progress
                </Badge>
              )}
            </div>

            {activeTrip ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t.route}:</span>
                    <span className="font-bold text-foreground">
                      {activeTrip.origin || "Origin"} ➔ {activeTrip.destination || "Destination"}
                    </span>
                  </div>
                  {activeTrip.client_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{isSwahili ? "Mteja:" : "Client:"}</span>
                      <span className="font-semibold text-foreground truncate max-w-[200px]">
                        {activeTrip.client_name}
                      </span>
                    </div>
                  )}
                  {activeTrip.clean_cargo && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t.cargo}:</span>
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {activeTrip.clean_cargo}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Quick Action Driver Tiles */}
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex-col gap-1 items-start p-3 border-border bg-card hover:bg-muted/50"
                    onClick={() => setFuelDialogOpen(true)}
                  >
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Fuel className="h-4 w-4" />
                      <span className="font-bold text-xs">{t.logFuel}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Pump receipt & litres</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex-col gap-1 items-start p-3 border-border bg-card hover:bg-muted/50"
                    onClick={() => {
                      setExpenseDialogType("receipt");
                      setExpenseDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <Receipt className="h-4 w-4" />
                      <span className="font-bold text-xs">{t.addExpense}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Tolls & food receipt</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex-col gap-1 items-start p-3 border-border bg-card hover:bg-muted/50"
                    onClick={() => {
                      setExpenseDialogType("fine");
                      setExpenseDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-rose-600">
                      <AlertOctagon className="h-4 w-4" />
                      <span className="font-bold text-xs">{t.addFine}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Traffic fine notice</span>
                  </Button>

                  {assignedVehicle ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 flex-col gap-1 items-start p-3 border-border bg-card hover:bg-muted/50"
                      onClick={() => navigate(`/m/${assignedVehicle.id}/inspect?driverId=${encodeURIComponent(activeDriver.id)}&driverName=${encodeURIComponent(activeDriver.full_name)}`)}
                    >
                      <div className="flex items-center gap-1.5 text-primary">
                        <ClipboardCheck className="h-4 w-4" />
                        <span className="font-bold text-xs">{t.preTripCheck}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Daily walkaround</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 flex-col gap-1 items-start p-3 border-border bg-card hover:bg-muted/50"
                      onClick={() => toast.info("Please scan your vehicle QR code to start walkaround check")}
                    >
                      <div className="flex items-center gap-1.5 text-primary">
                        <ClipboardCheck className="h-4 w-4" />
                        <span className="font-bold text-xs">{t.preTripCheck}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Walkaround checklist</span>
                    </Button>
                  )}
                  {/* Slide 10: Driver Complaints & Breakdown Action */}
                  <Button
                    type="button"
                    variant="outline"
                    className="col-span-2 h-14 flex items-center justify-between p-3 border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    onClick={() => setComplaintDialogOpen(true)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-rose-500/10">
                        <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-xs block text-foreground">
                          {isSwahili ? "Ripoti Hitilafu au Uharibifu (Breakdown)" : "Report Breakdown / Vehicle Defect"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isSwahili ? "Slide 10: Tuma taarifa ya ufundi na picha mara moja" : "Slide 10: Defects, abnormal conditions & breakdown rescue"}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/30 text-center space-y-3">
                <p className="text-xs text-muted-foreground">{t.noTrip}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {assignedVehicle && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => navigate(`/m/${assignedVehicle.id}?d=${encodeURIComponent(activeDriver.full_name)}&di=${encodeURIComponent(activeDriver.id)}`)}
                    >
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      <span>{t.scanQr}</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10"
                    onClick={() => setComplaintDialogOpen(true)}
                  >
                    <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                    <span>{isSwahili ? "Ripoti Hitilafu" : "Report Breakdown / Defect"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Expenses List */}
        {activeDriver && recentExpenses.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              {t.recentActions}
            </h3>
            <div className="space-y-2 divide-y divide-border/40">
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="pt-2 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground capitalize">
                      {exp.category?.replace("_", " ") || "Expense"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(exp.expense_date)} {exp.vendor ? `· ${exp.vendor}` : ""}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatMoney(exp.amount, exp.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Driver Sign-in Modal */}
      <DriverSignInModal
        open={driverModalOpen}
        onOpenChange={setDriverModalOpen}
        organisationId={organisation?.id}
        currentVehiclePlate={assignedVehicle?.plate_number}
        onDriverSelected={(session) => {
          setActiveDriver(session);
        }}
        lang={lang as any}
      />

      {/* Slide 10: Driver Complaint & Breakdown Modal */}
      <DriverComplaintModal
        open={complaintDialogOpen}
        onOpenChange={setComplaintDialogOpen}
        vehicles={assignedVehicle ? [{ id: assignedVehicle.id, name: assignedVehicle.name, plate_number: assignedVehicle.plate_number }] : []}
        defaultVehicleId={assignedVehicle?.id}
        defaultReporterName={activeDriver?.name || activeDriver?.full_name || ""}
        defaultReporterPhone={activeDriver?.phone_number || ""}
        onCreated={() => {
          toast.success(isSwahili ? "Taarifa ya hitilafu imetumwa kwa karakana" : "Complaint & breakdown report dispatched to workshop");
        }}
      />

      {/* Fuel Log Dialog */}
      {assignedVehicle && (
        <QuickFuelDialog
          open={fuelDialogOpen}
          onOpenChange={setFuelDialogOpen}
          machine={assignedVehicle}
          activeTripId={activeTrip?.id}
          onLogged={() => {
            toast.success(isSwahili ? "Mafuta yamerekodiwa kikamilifu" : "Fuel logged successfully");
          }}
        />
      )}

      {/* Expense / Fine Dialog */}
      {activeTrip && (
        <TripExpenseDialog
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
          tripId={activeTrip.id}
          expenseType={expenseDialogType}
          onExpenseCreated={() => {
            toast.success(isSwahili ? "Gharama imehifadhiwa kikamilifu" : "Expense saved successfully");
          }}
        />
      )}

      {/* Change PIN Dialog for Logged-in Driver */}
      <Dialog open={changePinOpen} onOpenChange={setChangePinOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <KeyRound className="h-5 w-5 text-primary" />
              <span>{isSwahili ? "Badili PIN Yako ya Kuingilia" : "Change Your Driver Portal PIN"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isSwahili
                ? `Dereva: ${activeDriver?.name || ""}. Weka namba mpya ya siri (tarakimu 4 au zaidi) unayoweza kukumbuka kwa urahisi.`
                : `Driver: ${activeDriver?.name || ""}. Enter a new 4-digit PIN that you can easily remember.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {isSwahili ? "Namba ya Sasa ya PIN" : "Current PIN"}
              </label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-center tracking-widest text-lg font-bold h-11"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {isSwahili ? "Namba Mpya ya PIN (tarakimu 4+)" : "New 4-digit PIN"}
              </label>
              <div className="relative">
                <Input
                  type={showChangePin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••"
                  value={changeNewPin}
                  onChange={(e) => setChangeNewPin(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-center tracking-widest text-lg font-bold h-11"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowChangePin(!showChangePin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showChangePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {isSwahili ? "Rudia Kuthibitisha PIN Mpya" : "Confirm New PIN"}
              </label>
              <Input
                type={showChangePin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••"
                value={changeConfirmPin}
                onChange={(e) => setChangeConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-center tracking-widest text-lg font-bold h-11"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChangePinOpen(false)}
              >
                {isSwahili ? "Ghairi" : "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingChangePin || changeNewPin.length < 4}
                className="gap-1.5 font-semibold"
              >
                {savingChangePin ? (
                  isSwahili ? "Inahifadhi..." : "Saving..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{isSwahili ? "Hifadhi PIN Mpya" : "Save New PIN"}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
