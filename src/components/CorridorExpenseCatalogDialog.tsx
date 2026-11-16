import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CROSS_BORDER_CORRIDORS,
  getAllCorridors,
  DEFAULT_USD_TO_TZS_RATE,
  DEFAULT_USD_TO_ZMW_RATE,
  DEFAULT_USD_TO_BWP_RATE,
  DEFAULT_USD_TO_ZAR_RATE,
  REGIONAL_CURRENCIES,
  formatCorridorAmount,
  formatTurnaroundDuration,
  type CrossBorderCorridor,
} from "@/services/crossBorderCorridors";
import { CreateCrossBorderRouteModal } from "@/components/fleet/CreateCrossBorderRouteModal";
import {
  Search,
  Clock,
  MapPin,
  ArrowRight,
  TrendingUp,
  Landmark,
  Check,
  Plus,
  Info,
  ShieldCheck,
  Receipt,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCorridor?: (corridor: CrossBorderCorridor) => void;
}

interface BankSettings {
  bankName: string;
  accountName: string;
  accountNumberUsd: string;
  accountNumberTzs: string;
  swiftCode: string;
  branch: string;
  mobileMoneyName: string;
  mobileMoneyNumber: string;
  notes: string;
}

const DEFAULT_BANK_SETTINGS: BankSettings = {
  bankName: "CRDB Bank Plc / Standard Chartered",
  accountName: "MachineCare Freight & Logistics Ltd",
  accountNumberUsd: "0250-9921-88401",
  accountNumberTzs: "0150-3849-22100",
  swiftCode: "CORUTZTZ",
  branch: "Kurasini Port Commercial Branch",
  mobileMoneyName: "M-Pesa Lipa Namba (Heavy Haulage)",
  mobileMoneyNumber: "5829104",
  notes: "Quote Trip Order / DO number as payment reference for automated receipt reconciliation.",
};

export function CorridorExpenseCatalogDialog({
  open,
  onOpenChange,
  onSelectCorridor,
}: Props) {
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [, setCorridorsVersion] = useState(0);

  useEffect(() => {
    const handleCorridorUpdate = () => setCorridorsVersion((v) => v + 1);
    window.addEventListener("mc_corridors_updated", handleCorridorUpdate);
    return () => window.removeEventListener("mc_corridors_updated", handleCorridorUpdate);
  }, []);

  const allCorridors = getAllCorridors();
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>(
    () => allCorridors[0]?.id || CROSS_BORDER_CORRIDORS[0].id
  );
  const [corridorSearch, setCorridorSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [currencyMode, setCurrencyMode] = useState<"USD" | "TZS" | "ZMW" | "BWP" | "ZAR">("USD");
  const [activeTab, setActiveTab] = useState<"catalog" | "banking" | "rates">("catalog");
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Multi-currency exchange rates
  const [rates, setRates] = useState<Record<string, number>>({
    TZS: DEFAULT_USD_TO_TZS_RATE,
    ZMW: DEFAULT_USD_TO_ZMW_RATE,
    BWP: DEFAULT_USD_TO_BWP_RATE,
    ZAR: DEFAULT_USD_TO_ZAR_RATE,
  });

  // Bank Settlement Accounts
  const [bankSettings, setBankSettings] = useState<BankSettings>(() => {
    try {
      const saved = localStorage.getItem("fleet_corridor_bank_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_BANK_SETTINGS;
  });

  const saveBankSettings = () => {
    try {
      localStorage.setItem("fleet_corridor_bank_settings", JSON.stringify(bankSettings));
      toast.success("Bank & Settlement accounts saved for all corridor documents!");
      setActiveTab("catalog");
    } catch (e) {
      toast.error("Failed to save bank settings");
    }
  };

  const filteredCorridors = useMemo(() => {
    if (!corridorSearch.trim()) return allCorridors;
    const q = corridorSearch.toLowerCase();
    return allCorridors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.borderPost.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [allCorridors, corridorSearch]);

  const currentCorridor = useMemo(() => {
    return (
      allCorridors.find((c) => c.id === selectedCorridorId) ||
      allCorridors[0] ||
      CROSS_BORDER_CORRIDORS[0]
    );
  }, [allCorridors, selectedCorridorId]);

  // Extract unique stages for filter pills
  const availableStages = useMemo(() => {
    const set = new Set<string>();
    currentCorridor.expenses.forEach((e) => {
      if (e.countryStage) set.add(e.countryStage);
    });
    return Array.from(set);
  }, [currentCorridor]);

  const filteredExpenses = useMemo(() => {
    return currentCorridor.expenses.filter((e) => {
      if (stageFilter !== "all" && e.countryStage !== stageFilter) {
        return false;
      }
      if (!expenseSearch.trim()) return true;
      const q = expenseSearch.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q) ||
        (e.localCurrency && e.localCurrency.toLowerCase().includes(q)) ||
        (e.countryStage && e.countryStage.toLowerCase().includes(q))
      );
    });
  }, [currentCorridor, expenseSearch, stageFilter]);

  const totals = useMemo(() => {
    const totalUsd = currentCorridor.expenses.reduce(
      (sum, e) => sum + e.defaultAmountUsd,
      0
    );
    const requiredUsd = currentCorridor.expenses
      .filter((e) => e.isRequired)
      .reduce((sum, e) => sum + e.defaultAmountUsd, 0);
    const optionalUsd = totalUsd - requiredUsd;

    const activeRate = rates[currencyMode] || 1;
    const convertedTotal = currencyMode === "USD" ? totalUsd : Math.round(totalUsd * activeRate);
    const convertedRequired = currencyMode === "USD" ? requiredUsd : Math.round(requiredUsd * activeRate);
    const convertedOptional = currencyMode === "USD" ? optionalUsd : Math.round(optionalUsd * activeRate);

    return {
      totalUsd,
      requiredUsd,
      optionalUsd,
      convertedTotal,
      convertedRequired,
      convertedOptional,
      itemsCount: currentCorridor.expenses.length,
      requiredCount: currentCorridor.expenses.filter((e) => e.isRequired).length,
    };
  }, [currentCorridor, currencyMode, rates]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border bg-background shadow-2xl">
          {/* Header - Claude Style: Warm, Minimal, Clear */}
          <div className="px-6 py-4 border-b border-border bg-card/60 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Cross-Border Transit Corridors & Statutory Compliance
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                  Centralized statutory tariff directory for road tolls, carbon levies, bridge crossings, and customs clearance across East & Southern Africa.
                </DialogDescription>
              </div>

              {/* Navigation Tabs & Currency Toggle */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-lg bg-muted/60 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("catalog")}
                    className={cn(
                      "px-3 py-1.5 rounded-md font-semibold transition-all text-xs",
                      activeTab === "catalog"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Corridor Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("banking")}
                    className={cn(
                      "px-3 py-1.5 rounded-md font-semibold transition-all text-xs flex items-center gap-1.5",
                      activeTab === "banking"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    Settlement Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("rates")}
                    className={cn(
                      "px-3 py-1.5 rounded-md font-semibold transition-all text-xs flex items-center gap-1.5",
                      activeTab === "rates"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Exchange Rates
                  </button>
                </div>

                {/* Currency Switcher */}
                <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 shadow-xs text-xs">
                  {(["USD", "TZS", "ZMW", "BWP", "ZAR"] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrencyMode(curr)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[11px] font-bold transition-all",
                        currencyMode === curr
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={REGIONAL_CURRENCIES[curr]?.name}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: CORRIDORS & STATUTORY DIRECTORY (Master-Detail Layout) */}
          {activeTab === "catalog" && (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Corridor Selector Sidebar */}
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-muted/15 flex flex-col shrink-0">
                <div className="p-3 border-b border-border/80 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Corridors ({allCorridors.length})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCreateRouteOpen(true)}
                      className="h-7 text-xs font-semibold text-primary hover:bg-primary/10 px-2 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> New Route
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter corridors or borders..."
                      value={corridorSearch}
                      onChange={(e) => setCorridorSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                {/* Corridor List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                  {filteredCorridors.map((c) => {
                    const active = c.id === currentCorridor.id;
                    const corridorTotalUsd = c.expenses.reduce(
                      (s, e) => s + e.defaultAmountUsd,
                      0
                    );
                    const activeRate = rates[currencyMode] || 1;
                    const displayAmt =
                      currencyMode === "USD"
                        ? `$${corridorTotalUsd.toLocaleString()}`
                        : formatCorridorAmount(
                            Math.round(corridorTotalUsd * activeRate),
                            currencyMode
                          );

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCorridorId(c.id);
                          setStageFilter("all");
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all border text-xs relative",
                          active
                            ? "bg-card border-primary/40 shadow-sm ring-1 ring-primary/20"
                            : "bg-background/60 hover:bg-card border-border/60 hover:border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-foreground line-clamp-1">
                            {c.name.split("–")[0].trim()}
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-transform mt-0.5",
                              active ? "text-primary translate-x-0.5" : "text-muted-foreground"
                            )}
                          />
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                          {c.borderPost}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40 text-[10.5px]">
                          <span className="text-muted-foreground">
                            {formatTurnaroundDuration(c.estimatedRoundtripHours)} RT
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {displayAmt}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredCorridors.length === 0 && (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No matching corridors found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Corridor Details & Interactive Fee Table */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
                {/* Corridor Overview Banner */}
                <div className="p-5 border-b border-border bg-card/40 shrink-0 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-foreground">
                          {currentCorridor.name}
                        </h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          Key Border Checkpoints:{" "}
                          <strong className="text-foreground">{currentCorridor.borderPost}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          Roundtrip Duration:{" "}
                          <strong className="text-foreground">
                            {formatTurnaroundDuration(currentCorridor.estimatedRoundtripHours)}
                          </strong>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {currentCorridor.description}
                      </p>
                    </div>

                    {/* Action & Cost Pill */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="rounded-xl border border-border bg-muted/30 p-3 text-right">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          Statutory Total ({totals.itemsCount} Fees)
                        </div>
                        <div className="text-lg font-black text-foreground font-mono mt-0.5">
                          {formatCorridorAmount(totals.convertedTotal, currencyMode)}
                          {currencyMode !== "USD" && (
                            <span className="text-xs font-normal text-muted-foreground ml-1.5 font-sans">
                              (≈ ${totals.totalUsd.toLocaleString()} USD)
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground mt-0.5">
                          Mandatory: {formatCorridorAmount(totals.convertedRequired, currencyMode)}
                        </div>
                      </div>

                      {onSelectCorridor && (
                        <Button
                          onClick={() => {
                            onSelectCorridor(currentCorridor);
                            onOpenChange(false);
                          }}
                          className="font-bold gap-1.5 shadow-sm px-4 h-11"
                        >
                          Apply to Trip <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Claude-Style "How It Works & Benefits" Guidance Card */}
                  {showHowItWorks && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5 relative text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>How this corridor works and protects your operations</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowHowItWorks(false)}
                          className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                        >
                          Dismiss
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2.5 pt-2.5 border-t border-amber-500/15 text-muted-foreground leading-relaxed">
                        <div>
                          <strong className="text-foreground block mb-0.5">1. Pre-Funded Allowances</strong>
                          Drivers receive exact statutory cash/mobile allowances for every road toll (RDA, SANRAL) and border tax before departure, avoiding stuck trucks.
                        </div>
                        <div>
                          <strong className="text-foreground block mb-0.5">2. Client Transparency</strong>
                          All government tariffs are pre-itemized on client consignment waybills and commercial invoices with zero surprise extra charges.
                        </div>
                        <div>
                          <strong className="text-foreground block mb-0.5">3. 1-Click Dispatch</strong>
                          Clicking "Apply to Trip" populates route border posts, required fees, and turnaround timelines straight into your new trip dispatch.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter Bar & Country Stages */}
                <div className="px-5 py-2.5 border-b border-border bg-muted/10 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                      Filter by Country / Stage:
                    </span>
                    <button
                      type="button"
                      onClick={() => setStageFilter("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                        stageFilter === "all"
                          ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                          : "bg-background text-muted-foreground hover:text-foreground border-border"
                      )}
                    >
                      All ({currentCorridor.expenses.length})
                    </button>
                    {availableStages.map((stage) => {
                      const count = currentCorridor.expenses.filter((e) => e.countryStage === stage).length;
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setStageFilter(stage)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                            stageFilter === stage
                              ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                              : "bg-background text-muted-foreground hover:text-foreground border-border"
                          )}
                        >
                          {stage} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search charge, toll, authority..."
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="pl-8 h-7 text-xs bg-background"
                    />
                  </div>
                </div>

                {/* Table of Statutory Fees */}
                <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-5">
                  <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
                    <table className="w-full min-w-[780px] text-xs">
                      <thead className="bg-muted/60 border-b border-border text-muted-foreground text-left font-semibold sticky top-0 backdrop-blur z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10">#</th>
                          <th className="py-2.5 px-3 min-w-[240px]">Statutory Fee / Toll Item</th>
                          <th className="py-2.5 px-3 min-w-[90px]">Transit Stage</th>
                          <th className="py-2.5 px-3 min-w-[90px]">Category</th>
                          <th className="py-2.5 px-3 min-w-[85px]">Obligation</th>
                          <th className="py-2.5 px-3 text-right min-w-[130px] whitespace-nowrap bg-muted/40 font-bold text-foreground">
                            Native Country Fee
                          </th>
                          <th className="py-2.5 px-3 text-right min-w-[95px] whitespace-nowrap font-bold">
                            Fee (USD)
                          </th>
                          <th className="py-2.5 px-3 text-right min-w-[125px] whitespace-nowrap font-bold text-primary">
                            Fee (TZS)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredExpenses.map((e, idx) => {
                          const localCurr = e.localCurrency || "USD";
                          const localAmt =
                            e.defaultAmountLocal != null ? e.defaultAmountLocal : e.defaultAmountUsd;
                          const calcTzs = e.defaultAmountUsd * (rates.TZS || DEFAULT_USD_TO_TZS_RATE);

                          return (
                            <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-foreground">{e.title}</div>
                                {e.notes && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                    {e.notes}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {e.countryStage ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 font-medium bg-muted/50 border-border text-foreground"
                                  >
                                    {e.countryStage}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-[11px] text-muted-foreground capitalize">
                                  {e.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {e.isRequired ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 text-[10px] px-1.5 py-0 font-semibold">
                                    Mandatory
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-muted-foreground text-[10px] px-1.5 py-0"
                                  >
                                    Conditional
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground bg-muted/20 whitespace-nowrap">
                                {formatCorridorAmount(localAmt, localCurr)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                                ${e.defaultAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary whitespace-nowrap">
                                {Math.round(calcTzs).toLocaleString()} TZS
                              </td>
                            </tr>
                          );
                        })}
                        {filteredExpenses.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                              No fees match your current search or country stage filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BANK SETTLEMENT DETAILS */}
          {activeTab === "banking" && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  Official Bank & Mobile Money Settlement Accounts
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  These settlement banking accounts and Lipa Namba merchant details are automatically printed on official road consignment waybills (P.O.D.), customer delivery receipts, and commercial freight invoices.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 bg-card p-5 rounded-xl border border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Primary Commercial Bank Name</Label>
                  <Input
                    value={bankSettings.bankName}
                    onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                    placeholder="e.g. CRDB Bank Plc / Standard Chartered"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Beneficiary Account Name</Label>
                  <Input
                    value={bankSettings.accountName}
                    onChange={(e) => setBankSettings({ ...bankSettings, accountName: e.target.value })}
                    placeholder="e.g. MachineCare Freight Limited"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">USD Bank Account Number</Label>
                  <Input
                    value={bankSettings.accountNumberUsd}
                    onChange={(e) => setBankSettings({ ...bankSettings, accountNumberUsd: e.target.value })}
                    placeholder="e.g. 0250-9921-88401"
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">TZS Bank Account Number</Label>
                  <Input
                    value={bankSettings.accountNumberTzs}
                    onChange={(e) => setBankSettings({ ...bankSettings, accountNumberTzs: e.target.value })}
                    placeholder="e.g. 0150-3849-22100"
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SWIFT Code / BIC</Label>
                  <Input
                    value={bankSettings.swiftCode}
                    onChange={(e) => setBankSettings({ ...bankSettings, swiftCode: e.target.value })}
                    placeholder="e.g. CORUTZTZ"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bank Branch & Clearing Code</Label>
                  <Input
                    value={bankSettings.branch}
                    onChange={(e) => setBankSettings({ ...bankSettings, branch: e.target.value })}
                    placeholder="e.g. Kurasini Port Commercial Branch"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Mobile Money Merchant Name</Label>
                  <Input
                    value={bankSettings.mobileMoneyName}
                    onChange={(e) => setBankSettings({ ...bankSettings, mobileMoneyName: e.target.value })}
                    placeholder="e.g. M-Pesa Lipa Namba"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Lipa Namba / Till Reference</Label>
                  <Input
                    value={bankSettings.mobileMoneyNumber}
                    onChange={(e) => setBankSettings({ ...bankSettings, mobileMoneyNumber: e.target.value })}
                    placeholder="e.g. 5829104"
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">Settlement Instructions / Notes</Label>
                  <Input
                    value={bankSettings.notes}
                    onChange={(e) => setBankSettings({ ...bankSettings, notes: e.target.value })}
                    placeholder="e.g. Quote Trip Order Reference number when making bank deposits."
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={() => setActiveTab("catalog")}>
                  Back to Directory
                </Button>
                <Button type="button" onClick={saveBankSettings} className="gap-1.5 font-bold">
                  <Check className="h-4 w-4" /> Save Settlement Details
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: REGIONAL CURRENCY EXCHANGE RATES */}
          {activeTab === "rates" && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Regional Currency Exchange Rates (Base: 1 USD)
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Adjust regional currency pegs for automated fee conversions across Tanzania, Zambia, Botswana, and South Africa. All statutory expenses automatically compute according to these rates.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { curr: "TZS", name: "Tanzanian Shilling", jurisdiction: "Tanzania domestic leg & port" },
                  { curr: "ZMW", name: "Zambian Kwacha", jurisdiction: "RDA tolls, RTSA carbon tax" },
                  { curr: "BWP", name: "Botswana Pula", jurisdiction: "Kazungula bridge & CBRTA" },
                  { curr: "ZAR", name: "South African Rand", jurisdiction: "SANRAL tolls & Beitbridge" },
                ].map(({ curr, name, jurisdiction }) => (
                  <div key={curr} className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{curr}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {REGIONAL_CURRENCIES[curr]?.symbol}
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-foreground">{name}</div>
                    <div className="text-[11px] text-muted-foreground">{jurisdiction}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-xs font-mono text-muted-foreground">1 USD =</span>
                      <Input
                        type="number"
                        step="any"
                        value={rates[curr]}
                        onChange={(e) =>
                          setRates({ ...rates, [curr]: Number(e.target.value) || 1 })
                        }
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-2 text-xs">
                <h5 className="font-bold text-foreground">Statutory Authority Currency Guidelines:</h5>
                <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div>• <strong>ZMW (Kwacha)</strong>: RDA Road Tolls, RTSA Carbon Tax, NRFA Weighbridges</div>
                  <div>• <strong>BWP (Pula)</strong>: Kazungula Bridge Toll, CBRTA Permits, MVA Fund</div>
                  <div>• <strong>ZAR (Rand)</strong>: SANRAL Highway Tolls, SARS Clearance, SA CBRTA</div>
                  <div>• <strong>USD ($)</strong>: ZIMRA Road Access, Chirundu Bridge, Beitbridge Toll, DRC Visas</div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <Button type="button" onClick={() => setActiveTab("catalog")} className="font-bold">
                  Return to Corridor Directory
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateCrossBorderRouteModal
        open={createRouteOpen}
        onOpenChange={setCreateRouteOpen}
        onCorridorCreated={(newC) => {
          setSelectedCorridorId(newC.id);
        }}
      />
    </>
  );
}
