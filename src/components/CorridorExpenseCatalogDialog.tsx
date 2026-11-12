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
  DEFAULT_USD_TO_TZS_RATE,
  DEFAULT_USD_TO_ZMW_RATE,
  DEFAULT_USD_TO_BWP_RATE,
  DEFAULT_USD_TO_ZAR_RATE,
  REGIONAL_CURRENCIES,
  convertUsdToLocal,
  formatCorridorAmount,
  formatTurnaroundDuration,
  type CrossBorderCorridor,
} from "@/services/crossBorderCorridors";
import {
  Globe2,
  Search,
  DollarSign,
  Car,
  Receipt,
  Clock,
  MapPin,
  CheckCircle2,
  Building2,
  ArrowRight,
  TrendingUp,
  Landmark,
  Smartphone,
  SlidersHorizontal,
  Check,
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
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>(
    CROSS_BORDER_CORRIDORS[0].id
  );
  const [search, setSearch] = useState("");
  const [currencyMode, setCurrencyMode] = useState<"USD" | "TZS" | "ZMW" | "BWP" | "ZAR">("USD");
  const [activeTab, setActiveTab] = useState<"catalog" | "banking" | "rates">("catalog");

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

  const currentCorridor = useMemo(() => {
    return (
      CROSS_BORDER_CORRIDORS.find((c) => c.id === selectedCorridorId) ||
      CROSS_BORDER_CORRIDORS[0]
    );
  }, [selectedCorridorId]);

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return currentCorridor.expenses;
    const q = search.toLowerCase();
    return currentCorridor.expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q) ||
        (e.localCurrency && e.localCurrency.toLowerCase().includes(q))
    );
  }, [currentCorridor, search]);

  const totals = useMemo(() => {
    const totalUsd = currentCorridor.expenses.reduce(
      (sum, e) => sum + e.defaultAmountUsd,
      0
    );
    const requiredUsd = currentCorridor.expenses
      .filter((e) => e.isRequired)
      .reduce((sum, e) => sum + e.defaultAmountUsd, 0);

    const activeRate = rates[currencyMode] || 1;
    const convertedTotal = currencyMode === "USD" ? totalUsd : Math.round(totalUsd * activeRate);
    const convertedRequired = currencyMode === "USD" ? requiredUsd : Math.round(requiredUsd * activeRate);

    return {
      totalUsd,
      convertedTotal,
      convertedRequired,
      itemsCount: currentCorridor.expenses.length,
      requiredCount: currentCorridor.expenses.filter((e) => e.isRequired).length,
    };
  }, [currentCorridor, currencyMode, rates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Globe2 className="h-6 w-6 text-primary" />
                Cross-Border Transit Corridors & Statutory Expense Catalog
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Multi-country statutory fees, road tolls, carbon levies, bridge crossings, and settlement bank accounts.
              </DialogDescription>
            </div>

            {/* Top Navigation Tabs & Currency Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  className={cn(
                    "px-3 py-1 rounded-md font-semibold transition-all text-xs",
                    activeTab === "catalog"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Corridor Fees
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("banking")}
                  className={cn(
                    "px-3 py-1 rounded-md font-semibold transition-all text-xs flex items-center gap-1",
                    activeTab === "banking"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Landmark className="h-3 w-3" /> Bank Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("rates")}
                  className={cn(
                    "px-3 py-1 rounded-md font-semibold transition-all text-xs flex items-center gap-1",
                    activeTab === "rates"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TrendingUp className="h-3 w-3" /> Multi-Currency
                </button>
              </div>

              {/* Multi-Currency Mode Selector */}
              <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-xs text-xs">
                {(["USD", "TZS", "ZMW", "BWP", "ZAR"] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrencyMode(curr)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-bold transition-all",
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

          {/* Corridor Tabs Scrollable */}
          {activeTab === "catalog" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-0.5 no-scrollbar">
              {CROSS_BORDER_CORRIDORS.map((c) => {
                const active = c.id === selectedCorridorId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCorridorId(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                        : "bg-card text-muted-foreground hover:bg-muted/60 border-border"
                    )}
                  >
                    <Globe2 className="h-3 w-3 shrink-0" />
                    <span>{c.name.split("–")[0].trim()}</span>
                    <Badge variant="outline" className={cn("text-[9px] px-1 py-0", active ? "bg-white/20 text-white border-white/30" : "bg-muted")}>
                      {c.expenses.length}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* TAB 1: CORRIDOR CATALOG TABLE */}
        {activeTab === "catalog" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Corridor Info & Stats Banner */}
            <div className="px-6 py-3 border-b border-border bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="text-base font-bold text-foreground">
                      {currentCorridor.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      Key Border Posts: <strong className="text-foreground">{currentCorridor.borderPost}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Est. RT Turnaround: <strong className="text-foreground">{formatTurnaroundDuration(currentCorridor.estimatedRoundtripHours)}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{currentCorridor.description}</p>
                </div>

                {/* Corridor Cost Summary */}
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Corridor Statutory Total ({currentCorridor.expenses.length} Fees)
                    </div>
                    <div className="text-lg font-black text-primary mt-0.5">
                      {formatCorridorAmount(totals.convertedTotal, currencyMode)}
                      {currencyMode !== "USD" && (
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          (≈ ${totals.totalUsd.toLocaleString()} USD)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Mandatory: {formatCorridorAmount(totals.convertedRequired, currencyMode)}
                    </div>
                  </div>

                  {onSelectCorridor && (
                    <Button
                      onClick={() => {
                        onSelectCorridor(currentCorridor);
                        onOpenChange(false);
                      }}
                      className="gap-1.5 shadow-sm"
                    >
                      Use for Trip <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter and Table List */}
            <div className="flex-1 overflow-hidden flex flex-col p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search statutory charge, toll, permit, authority..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  Showing {filteredExpenses.length} of {currentCorridor.expenses.length} fee items
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 sticky top-0 border-b border-border text-muted-foreground text-left font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Statutory Fee / Toll Item</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Native Country Fee</th>
                      <th className="py-2.5 px-3 text-right">Fee (USD)</th>
                      <th className="py-2.5 px-3 text-right">Fee (TZS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExpenses.map((e, idx) => {
                      const localCurr = e.localCurrency || "USD";
                      const localAmt = e.defaultAmountLocal != null ? e.defaultAmountLocal : e.defaultAmountUsd;
                      const calcTzs = e.defaultAmountUsd * (rates.TZS || DEFAULT_USD_TO_TZS_RATE);

                      return (
                        <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{e.title}</div>
                            {e.notes && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">{e.notes}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className="capitalize text-[10px] px-1.5 py-0 font-medium"
                            >
                              {e.category}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            {e.isRequired ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0">
                                Required
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">
                                Conditional
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {formatCorridorAmount(localAmt, localCurr)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                            ${e.defaultAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                            {Math.round(calcTzs).toLocaleString()} TZS
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BANK SETTLEMENT DETAILS */}
        {activeTab === "banking" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" /> Official Settlement & Commercial Wire Accounts
              </h4>
              <p className="text-xs text-muted-foreground">
                These bank and mobile money accounts are automatically included on all commercial invoices, freight waybills, and corridor dispatch receipts.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 bg-card p-4 rounded-xl border border-border">
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
                  placeholder="e.g. Please quote the Order Reference number when making bank deposits."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveTab("catalog")}>
                Back to Catalog
              </Button>
              <Button type="button" onClick={saveBankSettings} className="gap-1.5">
                <Check className="h-4 w-4" /> Save Bank Details
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: MULTI-CURRENCY CONVERTER & RATES */}
        {activeTab === "rates" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Regional Currency Exchange Rates (Base: 1 USD)
              </h4>
              <p className="text-xs text-muted-foreground">
                Adjust regional exchange rates for automated fee conversions across Tanzania, Zambia, Botswana, and South Africa.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { curr: "TZS", name: "Tanzanian Shilling" },
                { curr: "ZMW", name: "Zambian Kwacha" },
                { curr: "BWP", name: "Botswana Pula" },
                { curr: "ZAR", name: "South African Rand" },
              ].map(({ curr, name }) => (
                <div key={curr} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {curr}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {REGIONAL_CURRENCIES[curr]?.symbol}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{name}</div>
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

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
              <h5 className="font-bold text-foreground">Regional Currency Reference:</h5>
              <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
                <div>• <strong>ZMW (Kwacha)</strong>: RDA Road Tolls, RTSA Carbon Tax, NRFA Tolls</div>
                <div>• <strong>BWP (Pula)</strong>: Kazungula Bridge Toll, CBRTA Permits, MVA Fund</div>
                <div>• <strong>ZAR (Rand)</strong>: SANRAL Highway Tolls, SARS Clearance, SA CBRTA</div>
                <div>• <strong>USD ($)</strong>: ZIMRA Road Access, Chirundu Bridge, Beitbridge Toll, DRC</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setActiveTab("catalog")}>
                Done & Return to Catalog
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
