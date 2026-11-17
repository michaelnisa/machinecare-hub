import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Truck,
  CheckCircle2,
  Calendar,
  DollarSign,
  Building2,
  Route,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import { createConsolidatedFinanceInvoice } from "@/services/financeService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ConsolidatedInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTrips: any[];
  onInvoiceCreated: () => void;
  preselectedTripIds?: string[];
  preselectedClient?: string;
}

export function ConsolidatedInvoiceModal({
  open,
  onOpenChange,
  availableTrips,
  onInvoiceCreated,
  preselectedTripIds = [],
  preselectedClient = "",
}: ConsolidatedInvoiceModalProps) {
  const { organisation } = useAuth();

  const [clientName, setClientName] = useState(preselectedClient);
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [currency, setCurrency] = useState<"USD" | "TZS">("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(2600);
  const [taxRate, setTaxRate] = useState<string>("0");
  const [discount, setDiscount] = useState<string>("0");
  const [dueDate, setDueDate] = useState<string>(() => {
    return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected trip IDs for consolidation
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>(preselectedTripIds);

  // Editable price overrides per trip { [tripId]: number }
  const [tripPriceOverrides, setTripPriceOverrides] = useState<Record<string, number>>({});

  // Additional ad-hoc line items (e.g. Demurrage, Escort)
  const [extraItems, setExtraItems] = useState<{ description: string; amount: number }[]>([]);

  // Unique clients who have completed unbilled trips
  const clientsWithTrips = useMemo(() => {
    const map = new Map<string, number>();
    availableTrips.forEach((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const isAlreadyInvoiced = !!meta?.invoice_id || !!meta?.invoice_number;
      if (!isAlreadyInvoiced) {
        const c = (meta?.client || t.client_name || "").trim();
        if (c) {
          map.set(c, (map.get(c) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [availableTrips]);

  // When preselected trips or client change, initialize
  useEffect(() => {
    if (preselectedClient) setClientName(preselectedClient);
    if (preselectedTripIds.length > 0) setSelectedTripIds(preselectedTripIds);
  }, [preselectedClient, preselectedTripIds]);

  // Filter eligible trips for the chosen customer
  const customerEligibleTrips = useMemo(() => {
    if (!clientName.trim()) return [];
    const q = clientName.trim().toLowerCase();
    return availableTrips.filter((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const isAlreadyInvoiced = !!meta?.invoice_id || !!meta?.invoice_number;
      if (isAlreadyInvoiced) return false;

      const c = (meta?.client || t.client_name || "").toLowerCase();
      return c.includes(q);
    });
  }, [availableTrips, clientName]);

  // If customer is selected and no trips were explicitly preselected, default select all their unbilled trips
  useEffect(() => {
    if (customerEligibleTrips.length > 0 && selectedTripIds.length === 0) {
      setSelectedTripIds(customerEligibleTrips.map((t) => t.id));
    }
  }, [customerEligibleTrips]);

  // Calculate price for a single trip
  const getTripPrice = (trip: any): number => {
    if (tripPriceOverrides[trip.id] != null) {
      return tripPriceOverrides[trip.id];
    }
    const meta = parseCargoMeta(trip.cargo_description);
    const rawAmt = Number(meta?.client_billing_amount) || Number(trip.cost) * 1.35 || 1500;
    const isTripUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";

    if (currency === "USD") {
      return isTripUsd ? rawAmt : Math.round(rawAmt / exchangeRate);
    } else {
      return isTripUsd ? Math.round(rawAmt * exchangeRate) : Math.round(rawAmt);
    }
  };

  const handlePriceChange = (tripId: string, valStr: string) => {
    const val = Number(valStr) || 0;
    setTripPriceOverrides((prev) => ({ ...prev, [tripId]: val }));
  };

  const toggleTrip = (tripId: string) => {
    setSelectedTripIds((prev) =>
      prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTripIds.length === customerEligibleTrips.length) {
      setSelectedTripIds([]);
    } else {
      setSelectedTripIds(customerEligibleTrips.map((t) => t.id));
    }
  };

  // Financial Totals
  const tripsSubtotal = useMemo(() => {
    return selectedTripIds.reduce((sum, tId) => {
      const trip = customerEligibleTrips.find((t) => t.id === tId);
      if (!trip) return sum;
      return sum + getTripPrice(trip);
    }, 0);
  }, [selectedTripIds, customerEligibleTrips, tripPriceOverrides, currency, exchangeRate]);

  const extrasSubtotal = useMemo(() => {
    return extraItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [extraItems]);

  const grossSubtotal = tripsSubtotal + extrasSubtotal;
  const taxRateNum = Number(taxRate) || 0;
  const taxAmount = Math.round((grossSubtotal * taxRateNum) / 100);
  const discountNum = Number(discount) || 0;
  const totalAmount = Math.max(grossSubtotal + taxAmount - discountNum, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!clientName.trim()) {
      toast.error("Please enter or select a customer name");
      return;
    }
    if (selectedTripIds.length === 0) {
      toast.error("Please select at least 1 trip to include in the consolidated invoice");
      return;
    }

    setSubmitting(true);
    try {
      // Build clean itemized invoice lines
      const items = selectedTripIds.map((tId) => {
        const trip = customerEligibleTrips.find((t) => t.id === tId);
        const meta = parseCargoMeta(trip?.cargo_description);
        const cargo = extractCleanCargo(trip?.cargo_description, trip?.purpose || meta?.purpose);
        const vehiclePlate = trip?.machines?.plate_number || trip?.machines?.name || "Fleet Truck";
        const waybillRef = meta?.order_no
          ? `WB-${meta.order_no}`
          : `WB-${trip?.id?.slice(0, 8).toUpperCase()}`;
        const route = `${trip?.origin || "Origin Depot"} ➔ ${trip?.destination || "Destination Facility"}`;
        const unitPrice = getTripPrice(trip);

        return {
          description: `Road Freight Consignment [${waybillRef}] · Route: ${route} · Truck: ${vehiclePlate} · Cargo: ${cargo || "Commercial Freight"}`,
          quantity: 1,
          unit_price: unitPrice,
        };
      });

      // Add extra fee items if present
      extraItems.forEach((extra) => {
        if (extra.description.trim() && extra.amount > 0) {
          items.push({
            description: extra.description.trim(),
            quantity: 1,
            unit_price: Number(extra.amount),
          });
        }
      });

      const res = await createConsolidatedFinanceInvoice(organisation.id, {
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        trip_ids: selectedTripIds,
        currency,
        due_date: dueDate,
        tax_rate_percent: taxRateNum,
        discount_amount: discountNum,
        notes: notes.trim() || undefined,
        items,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to create consolidated invoice");
      }

      toast.success(
        `Consolidated Invoice ${res.invoice?.invoice_number || ""} generated successfully with ${selectedTripIds.length} trips!`
      );
      onInvoiceCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create consolidated invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Create Consolidated Freight Invoice
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Combine multiple completed freight trips into one master commercial invoice for your client.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* STEP 1: CUSTOMER SELECTION */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" /> 01. Select Corporate Customer
              </Label>
              {clientsWithTrips.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {clientsWithTrips.length} clients with unbilled trips
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="custName" className="text-xs">
                  Customer / Corporate Client Name *
                </Label>
                <div className="relative">
                  <Input
                    id="custName"
                    placeholder="Enter or pick customer (e.g. Bakhresa Group)"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                  {clientsWithTrips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="text-[10px] text-muted-foreground self-center">Quick pick:</span>
                      {clientsWithTrips.slice(0, 4).map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setClientName(c.name)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                            clientName.toLowerCase() === c.name.toLowerCase()
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted hover:bg-muted/80 text-foreground border-border"
                          }`}
                        >
                          {c.name} ({c.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="custPhone" className="text-xs">
                  Client Contact / Tel
                </Label>
                <Input
                  id="custPhone"
                  placeholder="+255 754 000 000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* STEP 2: MULTI-TRIP SELECTION CHECKLIST */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-emerald-500" /> 02. Select Trips to Include in Invoice
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {customerEligibleTrips.length} completed trips eligible for {clientName || "selected client"}
                </p>
              </div>

              {customerEligibleTrips.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={toggleSelectAll}
                  >
                    {selectedTripIds.length === customerEligibleTrips.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedTripIds.length} of {customerEligibleTrips.length} Selected
                  </Badge>
                </div>
              )}
            </div>

            {customerEligibleTrips.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-border bg-muted/20 space-y-1">
                <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                <p className="text-xs font-medium text-foreground">
                  {clientName
                    ? `No unbilled trips found matching "${clientName}"`
                    : "Enter a customer name above to view their unbilled trips"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Only completed trips not yet linked to an existing invoice will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {customerEligibleTrips.map((trip) => {
                  const isChecked = selectedTripIds.includes(trip.id);
                  const meta = parseCargoMeta(trip.cargo_description);
                  const cargo = extractCleanCargo(trip.cargo_description, trip.purpose || meta?.purpose);
                  const plate = trip.machines?.plate_number || trip.machines?.name || "Fleet Truck";
                  const waybillRef = meta?.order_no
                    ? `WB-${meta.order_no}`
                    : `WB-${trip.id.slice(0, 8).toUpperCase()}`;
                  const currentPrice = getTripPrice(trip);

                  return (
                    <div
                      key={trip.id}
                      onClick={() => toggleTrip(trip.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                        isChecked
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "border-border hover:border-border/80 bg-background/50 opacity-80"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded text-primary focus:ring-primary shrink-0 pointer-events-none"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-foreground">
                              {waybillRef}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(trip.start_at || new Date().toISOString())}
                            </span>
                            <Badge variant="outline" className="text-[9.5px] font-mono px-1.5 py-0">
                              {plate}
                            </Badge>
                          </div>
                          <div className="text-xs text-foreground font-medium flex items-center gap-1.5 truncate">
                            <span>{trip.origin || "Origin Depot"}</span>
                            <span className="text-muted-foreground">➔</span>
                            <span>{trip.destination || "Destination Facility"}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            Cargo: <strong className="text-foreground">{cargo || "Commercial Freight"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Price override per trip */}
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-medium text-muted-foreground">Freight:</span>
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1.5 text-xs font-mono text-muted-foreground">
                            {currency === "USD" ? "$" : "TSh"}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step={currency === "USD" ? "10" : "1000"}
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(trip.id, e.target.value)}
                            className="h-8 text-xs font-mono font-bold text-right pl-8"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 3: INVOICE SETTINGS & PAYMENT TERMS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> 03. Invoice Terms & Currency
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Billing Currency</Label>
                  <Select value={currency} onValueChange={(v: "USD" | "TZS") => setCurrency(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($) · Cross-Border</SelectItem>
                      <SelectItem value="TZS">TZS (TSh) · Domestic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Payment Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">VAT / Tax Rate (%)</Label>
                  <Select value={taxRate} onValueChange={setTaxRate}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Tax Rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Cross-Border Transit)</SelectItem>
                      <SelectItem value="18">18% (Standard Local VAT)</SelectItem>
                      <SelectItem value="5">5% (Withholding / Special)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Discount Amount ({currency})</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Invoice Notes & Instructions</Label>
                <Textarea
                  placeholder="e.g. Consolidated monthly freight billing for November 2026. Deliver original signed waybills to finance desk."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-16 text-xs resize-none"
                />
              </div>
            </div>

            {/* LIVE FINANCIAL SUMMARY PANEL */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                  <span className="font-bold text-foreground">Consolidated Billing Summary</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selectedTripIds.length} Trips
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Trips Freight Subtotal:</span>
                    <span className="font-mono font-medium text-foreground">
                      {currency === "USD"
                        ? `$${tripsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `${tripsSubtotal.toLocaleString()} TZS`}
                    </span>
                  </div>

                  {taxRateNum > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT ({taxRateNum}%):</span>
                      <span className="font-mono font-medium text-foreground">
                        {currency === "USD"
                          ? `$${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${taxAmount.toLocaleString()} TZS`}
                      </span>
                    </div>
                  )}

                  {discountNum > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount:</span>
                      <span className="font-mono font-medium">
                        -{currency === "USD" ? `$${discountNum}` : `${discountNum} TZS`}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex justify-between items-baseline">
                    <span className="font-bold text-sm text-foreground">Total Invoiced:</span>
                    <span className="font-mono font-black text-lg text-primary">
                      {currency === "USD"
                        ? `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `${totalAmount.toLocaleString()} TZS`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Double-Billing Protection Active
                </div>
                <p>
                  All {selectedTripIds.length} selected trips will be locked with this master invoice number upon creation.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || selectedTripIds.length === 0}
              className="gap-2 shadow-xs"
            >
              <Layers className="h-4 w-4" />
              {submitting
                ? "Generating Consolidated Invoice..."
                : `Generate Consolidated Invoice (${selectedTripIds.length} Trips)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
