import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  AlertOctagon,
  Plus,
  Loader2,
  ExternalLink,
  Car,
  DollarSign,
  FileText,
  Trash2,
  Calendar,
} from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { TripExpenseDialog, EXPENSE_CATEGORIES } from "./TripExpenseDialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string | null;
  machineId: string;
  machineName?: string;
  driverName?: string;
  fuelCost?: number | null;
  orgId?: string | null;
  canManage?: boolean;
  onExpenseChanged?: () => void;
}

export function TripExpensesListDialog({
  open,
  onOpenChange,
  tripId,
  machineId,
  machineName,
  driverName,
  fuelCost = 0,
  orgId,
  canManage = true,
  onExpenseChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadExpenses = async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      // 1. Try public RPC
      const { data: rpcData } = await (supabase as any)
        .rpc("get_trip_expenses_public", { _trip_id: tripId });

      if (rpcData && Array.isArray(rpcData)) {
        setExpenses(rpcData);
      } else {
        // Fallback to direct select
        const { data } = await (supabase as any)
          .from("trip_expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false });
        setExpenses(data ?? []);
      }
    } catch (err: any) {
      console.warn("Failed to load trip expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && tripId) {
      loadExpenses();
    }
  }, [open, tripId]);

  // Calculations for total driver costs in this trip
  const costBreakdown = useMemo(() => {
    const finesTotal = expenses
      .filter((e) => e.expense_type === "fine")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const receiptsTotal = expenses
      .filter((e) => e.expense_type !== "fine")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const fuel = Number(fuelCost) || 0;
    const grandTotal = finesTotal + receiptsTotal + fuel;

    return {
      finesTotal,
      receiptsTotal,
      fuelCost: fuel,
      grandTotal,
      expensesCount: expenses.length,
    };
  }, [expenses, fuelCost]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const { error } = await (supabase as any)
        .from("trip_expenses")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Expense removed");
      loadExpenses();
      onExpenseChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove expense");
    }
  };

  const getCategoryMeta = (type: string) => {
    return EXPENSE_CATEGORIES.find((c) => c.id === type) || {
      id: type,
      label: type,
      icon: Receipt,
      color: "text-slate-600 bg-slate-50 border-slate-200",
    };
  };

  if (!tripId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Receipt className="h-5 w-5 text-primary" />
                  Trip Fines, Receipts & Costs
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {machineName ? `${machineName}` : "Vehicle"}
                  {driverName ? ` · Driver: ${driverName}` : ""}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setAddExpenseOpen(true)}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Fine / Receipt
              </Button>
            </div>
          </DialogHeader>

          {/* TOTAL COST CALCULATION CARD */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Total Driver Cost in Trip
                </span>
                <div className="text-2xl font-black text-foreground mt-0.5">
                  {formatMoney(costBreakdown.grandTotal)}
                </div>
              </div>
              <Badge className="bg-primary/15 text-primary border-primary/20 text-xs px-2.5 py-1">
                {costBreakdown.expensesCount} item{costBreakdown.expensesCount === 1 ? "" : "s"} logged
              </Badge>
            </div>

            {/* Breakdown row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
              <div className="rounded-lg bg-card/60 p-2 border border-border">
                <span className="text-[11px] text-muted-foreground block">🚨 Fines / Tickets</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatMoney(costBreakdown.finesTotal)}
                </span>
              </div>
              <div className="rounded-lg bg-card/60 p-2 border border-border">
                <span className="text-[11px] text-muted-foreground block">🧾 Receipts & Tolls</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {formatMoney(costBreakdown.receiptsTotal)}
                </span>
              </div>
              <div className="rounded-lg bg-card/60 p-2 border border-border">
                <span className="text-[11px] text-muted-foreground block">⛽ Fuel Cost</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(costBreakdown.fuelCost)}
                </span>
              </div>
            </div>
          </div>

          {/* ITEM LIST */}
          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Itemized Expenses ({expenses.length})
            </h4>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading trip expenses…
              </div>
            ) : expenses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No fines or receipts logged for this trip yet.
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddExpenseOpen(true)}
                    className="h-8 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" /> Record first fine or receipt
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                {expenses.map((item) => {
                  const meta = getCategoryMeta(item.expense_type);
                  const Icon = meta.icon;
                  const isFine = item.expense_type === "fine";

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.receipt_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(item.receipt_url)}
                            className="relative group shrink-0 h-14 w-14 rounded-lg overflow-hidden border border-border bg-black/5"
                            title="Click to zoom receipt"
                          >
                            <img
                              src={item.receipt_url}
                              alt="Receipt thumbnail"
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </div>
                          </button>
                        ) : (
                          <div
                            className={`h-11 w-11 rounded-lg border flex items-center justify-center shrink-0 ${meta.color}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                        )}

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {item.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 capitalize ${
                                isFine
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              }`}
                            >
                              {meta.label}
                            </Badge>
                          </div>

                          {item.reference_number && (
                            <div className="text-[11px] font-mono text-muted-foreground">
                              Ref: {item.reference_number}
                            </div>
                          )}

                          {item.notes && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {item.notes}
                            </p>
                          )}

                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                            <Calendar className="h-3 w-3" />
                            {formatDate(item.occurred_at || item.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isFine ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                          }`}
                        >
                          {formatMoney(item.amount)}
                        </span>

                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExpense(item.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Delete this record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense / Fine Modal */}
      <TripExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        tripId={tripId}
        machineId={machineId}
        orgId={orgId}
        onSaved={() => {
          loadExpenses();
          onExpenseChanged?.();
        }}
      />

      {/* Image Preview / Zoom Modal */}
      {previewImageUrl && (
        <Dialog open={!!previewImageUrl} onOpenChange={(v) => !v && setPreviewImageUrl(null)}>
          <DialogContent className="max-w-2xl p-3 bg-black/90 border-0">
            <div className="relative flex flex-col items-center">
              <img
                src={previewImageUrl}
                alt="Receipt Full Preview"
                className="max-h-[82vh] w-auto object-contain rounded-md"
              />
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-xs text-white/80 hover:text-white flex items-center gap-1 underline"
              >
                <ExternalLink className="h-3 w-3" /> Open original in new tab
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
