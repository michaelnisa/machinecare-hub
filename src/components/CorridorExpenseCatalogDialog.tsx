import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CROSS_BORDER_CORRIDORS,
  DEFAULT_USD_TO_TZS_RATE,
  formatDualCurrency,
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
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCorridor?: (corridor: CrossBorderCorridor) => void;
}

export function CorridorExpenseCatalogDialog({
  open,
  onOpenChange,
  onSelectCorridor,
}: Props) {
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>(
    CROSS_BORDER_CORRIDORS[0].id
  );
  const [search, setSearch] = useState("");
  const [rate, setRate] = useState<number>(DEFAULT_USD_TO_TZS_RATE);
  const [currencyMode, setCurrencyMode] = useState<"USD" | "TZS">("USD");

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
        e.category.toLowerCase().includes(q)
    );
  }, [currentCorridor, search]);

  const totals = useMemo(() => {
    const totalUsd = currentCorridor.expenses.reduce(
      (sum, e) => sum + e.defaultAmountUsd,
      0
    );
    const totalTzs = currentCorridor.expenses.reduce(
      (sum, e) => sum + e.defaultAmountTzs,
      0
    );
    const requiredUsd = currentCorridor.expenses
      .filter((e) => e.isRequired)
      .reduce((sum, e) => sum + e.defaultAmountUsd, 0);
    const requiredTzs = currentCorridor.expenses
      .filter((e) => e.isRequired)
      .reduce((sum, e) => sum + e.defaultAmountTzs, 0);

    return {
      totalUsd,
      totalTzs,
      requiredUsd,
      requiredTzs,
      itemsCount: currentCorridor.expenses.length,
      requiredCount: currentCorridor.expenses.filter((e) => e.isRequired).length,
    };
  }, [currentCorridor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Globe2 className="h-6 w-6 text-primary" />
                Cross-Border Transit Corridors & Statutory Expense Catalog
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Standard statutory border tolls, permits, scanners, transit levies, and allowances across East & Southern Africa.
              </DialogDescription>
            </div>

            {/* Currency Mode & Rate */}
            <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border shadow-xs text-xs">
              <div className="flex rounded-md bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setCurrencyMode("USD")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    currencyMode === "USD"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyMode("TZS")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    currencyMode === "TZS"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  TZS (Tsh)
                </button>
              </div>

              <div className="flex items-center gap-1.5 pl-2 border-l border-border text-[11px] text-muted-foreground">
                <span>1 USD =</span>
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || DEFAULT_USD_TO_TZS_RATE)}
                  className="w-16 h-7 px-1.5 text-xs font-mono rounded border border-input bg-background text-foreground"
                />
                <span>TZS</span>
              </div>
            </div>
          </div>

          {/* Corridor Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 pb-1 no-scrollbar">
            {CROSS_BORDER_CORRIDORS.map((c) => {
              const active = c.id === selectedCorridorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCorridorId(c.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground hover:bg-muted/60 border-border"
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span>{c.country}</span>
                  <span className="text-[10px] opacity-80">({c.expenses.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Corridor Info & Stats Banner */}
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentCorridor.flag}</span>
                <h3 className="text-base font-bold text-foreground">
                  {currentCorridor.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  Border: <strong className="text-foreground">{currentCorridor.borderPost}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Est. RT Turnaround: <strong className="text-foreground">{currentCorridor.estimatedRoundtripHours} Hours</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">{currentCorridor.description}</p>
            </div>

            {/* Corridor Cost Summary */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-right">
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Standard Corridor Total ({currentCorridor.expenses.length} items)
                </div>
                <div className="text-lg font-black text-primary mt-0.5">
                  {currencyMode === "USD" ? (
                    <>
                      ${totals.totalUsd.toLocaleString()}
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">
                        (≈ {(totals.totalUsd * rate).toLocaleString()} TZS)
                      </span>
                    </>
                  ) : (
                    <>
                      {(totals.totalUsd * rate).toLocaleString()} TZS
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">
                        (≈ ${totals.totalUsd.toLocaleString()})
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Mandatory Statutory: ${totals.requiredUsd.toLocaleString()} (≈ {(totals.requiredUsd * rate).toLocaleString()} TZS)
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
        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search expense, statutory authority, scanner, toll…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing {filteredExpenses.length} of {currentCorridor.expenses.length} fee items
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0 border-b border-border text-muted-foreground text-left font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Fee / Statutory Charge</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Fee (USD)</th>
                  <th className="py-2.5 px-3 text-right">Fee (TZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map((e, idx) => {
                  const calcTzs = e.defaultAmountUsd * rate;
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
      </DialogContent>
    </Dialog>
  );
}
