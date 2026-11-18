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
} from "lucide-react";
import { toast } from "sonner";
import {
  DriverSignInModal,
  getActiveDriverSession,
  clearActiveDriverSession,
  type ActiveDriverSession,
} from "@/components/fleet/DriverSignInModal";
import { QuickFuelDialog } from "@/components/QuickFuelDialog";
import { TripExpenseDialog } from "@/components/TripExpenseDialog";
import { SAFE_MACHINE_COLUMNS, parseMachine, type FleetVehicle } from "@/lib/fleet-metadata";

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
          setActiveTrip(trip);
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

        {/* Driver Session Card */}
        {activeDriver ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {activeDriver.photo_url ? (
                  <img
                    src={activeDriver.photo_url}
                    alt={activeDriver.full_name}
                    className="h-12 w-12 rounded-full object-cover border-2 border-primary/30 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/20 text-primary font-bold text-base flex items-center justify-center shrink-0 border border-primary/30">
                    {activeDriver.full_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
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

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => setDriverModalOpen(true)}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{t.switchDriver}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
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
        ) : (
          /* Sign In Card for unauthenticated drivers */
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t.welcome}</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {t.signInPrompt}
              </p>
            </div>
            <Button
              type="button"
              className="w-full h-12 gap-2 text-sm font-semibold shadow-xs"
              onClick={() => setDriverModalOpen(true)}
            >
              <UserCheck className="h-4 w-4" />
              <span>{t.checkInBtn}</span>
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
                  to={`/m/${assignedVehicle.id}`}
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
                  {activeTrip.cargo_description && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t.cargo}:</span>
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {activeTrip.cargo_description}
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
                      onClick={() => navigate(`/m/${assignedVehicle.id}/inspect`)}
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
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/30 text-center space-y-2">
                <p className="text-xs text-muted-foreground">{t.noTrip}</p>
                {assignedVehicle && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => navigate(`/m/${assignedVehicle.id}`)}
                  >
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    <span>{t.scanQr}</span>
                  </Button>
                )}
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
    </div>
  );
}
