import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Receipt, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  CreditCard,
  Smartphone
} from "lucide-react";
import { SelcomPaymentModal } from "@/components/garage/SelcomPaymentModal";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

interface QuickCounterSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleCompleted?: (invoice: any) => void;
}

interface SaleItem {
  id: string;
  item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  available_stock?: number;
}

export function QuickCounterSaleModal({
  open,
  onOpenChange,
  onSaleCompleted,
}: QuickCounterSaleModalProps) {
  const { profile, user, organisation } = useAuth();
  const [saving, setSaving] = useState(false);

  // Reference data
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [stockBalances, setStockBalances] = useState<Record<string, number>>({});

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [walkinName, setWalkinName] = useState("Walk-in Cash Customer");
  const [walkinPhone, setWalkinPhone] = useState("");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [labourCost, setLabourCost] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState(String(organisation?.tax_rate_percent ?? 0));

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");

  // Selcom
  const [selcomModalOpen, setSelcomModalOpen] = useState(false);
  const [pendingSelcomInvoice, setPendingSelcomInvoice] = useState<any>(null);

  // Result
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);

  useEffect(() => {
    if (open) {
      resetForm();
      loadData();
    }
  }, [open]);

  const resetForm = () => {
    setCustomerId("");
    setWalkinName("Walk-in Cash Customer");
    setWalkinPhone("");
    setItems([]);
    setSelectedPartId("");
    setLabourCost("0");
    setDiscount("0");
    setTaxRate(String(organisation?.tax_rate_percent ?? 0));
    setPaymentMethod("cash");
    setPaymentRef("");
    setCompletedInvoice(null);
  };

  const loadData = async () => {
    const [{ data: custs }, { data: inv }, { data: b }] = await Promise.all([
      (supabase as any).from("garage_customers").select("id, name, phone").order("name"),
      supabase.from("inventory_items").select("id, name, part_number, unit_cost, selling_price").eq("status", "active").order("name"),
      (supabase as any).from("stock_balances").select("item_id, available_stock"),
    ]);

    setCustomers(custs ?? []);
    setInventoryItems(inv ?? []);

    const balMap: Record<string, number> = {};
    (b ?? []).forEach((row: any) => {
      balMap[row.item_id] = (balMap[row.item_id] ?? 0) + Number(row.available_stock || 0);
    });
    setStockBalances(balMap);
  };

  const addInventoryItem = (partId: string) => {
    if (!partId) return;
    const part = inventoryItems.find((p) => p.id === partId);
    if (!part) return;

    const available = stockBalances[part.id] ?? 0;
    const price = Number(part.selling_price || part.unit_cost || 0);
    const cost = Number(part.unit_cost || 0);

    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        item_id: part.id,
        description: part.name + (part.part_number ? ` (${part.part_number})` : ""),
        quantity: 1,
        unit_price: price,
        unit_cost: cost,
        available_stock: available,
      },
    ]);
    setSelectedPartId("");
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "General Service / Part",
        quantity: 1,
        unit_price: 0,
        unit_cost: 0,
      },
    ]);
  };

  const updateItem = (id: string, field: keyof SaleItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const totals = useMemo(() => {
    const partsSubtotal = items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
    const labour = Number(labourCost) || 0;
    const disc = Number(discount) || 0;
    const preTax = Math.max(0, partsSubtotal + labour - disc);
    const rate = Number(taxRate) || 0;
    const tax = preTax * (rate / 100);
    const grandTotal = preTax + tax;

    return {
      partsSubtotal,
      labour,
      preTax,
      tax,
      grandTotal,
    };
  }, [items, labourCost, discount, taxRate]);

  const submitSale = async () => {
    if (items.length === 0 && Number(labourCost) <= 0) {
      return toast.error("Add at least one item or labour charge");
    }

    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return toast.error("Organization context missing");

    setSaving(true);
    try {
      // 1. Resolve customer
      let finalCustomerId = customerId;
      if (!finalCustomerId) {
        // Look for existing walk-in customer or create one
        const { data: existingWalkin } = await (supabase as any)
          .from("garage_customers")
          .select("id")
          .eq("organisation_id", orgId)
          .eq("name", walkinName.trim())
          .maybeSingle();

        if (existingWalkin) {
          finalCustomerId = existingWalkin.id;
        } else {
          const { data: newCust, error: cErr } = await (supabase as any)
            .from("garage_customers")
            .insert({
              organisation_id: orgId,
              name: walkinName.trim() || "Walk-in Cash Customer",
              phone: walkinPhone.trim() || null,
              created_by: user?.id,
            })
            .select()
            .single();
          if (cErr) throw cErr;
          finalCustomerId = newCust.id;
        }
      }

      // 2. Resolve or create default counter vehicle
      let finalVehicleId = null;
      const { data: existingVeh } = await (supabase as any)
        .from("garage_vehicles")
        .select("id")
        .eq("customer_id", finalCustomerId)
        .maybeSingle();

      if (existingVeh) {
        finalVehicleId = existingVeh.id;
      } else {
        const { data: newVeh, error: vErr } = await (supabase as any)
          .from("garage_vehicles")
          .insert({
            organisation_id: orgId,
            customer_id: finalCustomerId,
            make: "Counter",
            model: "Sale",
            registration_number: "COUNTER",
            created_by: user?.id,
          })
          .select()
          .single();
        if (vErr) throw vErr;
        finalVehicleId = newVeh.id;
      }

      // 3. Create closed job for counter sale
      const { data: job, error: jErr } = await (supabase as any)
        .from("garage_jobs")
        .insert({
          organisation_id: orgId,
          customer_id: finalCustomerId,
          vehicle_id: finalVehicleId,
          reported_problem: "Direct Counter Sale / Over-the-Counter Parts",
          status: "closed",
          priority: "normal",
          created_by: user?.id,
        })
        .select()
        .single();
      if (jErr) throw jErr;

      // 4. Resolve next invoice number
      const currentYear = new Date().getFullYear();
      const { data: invCounter } = await (supabase as any)
        .from("org_invoice_counters")
        .select("next_number")
        .eq("organisation_id", orgId)
        .eq("year", currentYear)
        .maybeSingle();

      const nextInvNum = invCounter?.next_number ?? 1;

      await (supabase as any)
        .from("org_invoice_counters")
        .upsert(
          { organisation_id: orgId, year: currentYear, next_number: nextInvNum + 1 },
          { onConflict: "organisation_id,year" }
        );

      // 5. Create invoice
      const { data: inv, error: invErr } = await (supabase as any)
        .from("garage_invoices")
        .insert({
          organisation_id: orgId,
          job_id: job.id,
          invoice_number: nextInvNum,
          invoice_year: currentYear,
          labour_cost: Number(labourCost) || 0,
          discount: Number(discount) || 0,
          other_cost: 0,
          tax_rate_percent: Number(taxRate) || 0,
          notes: "Over-the-counter point of sale",
          issued_at: new Date().toISOString(),
          created_by: user?.id,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      // 6. Insert invoice items & issue stock transactions
      const { data: defaultLoc } = await (supabase as any)
        .from("stock_locations")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("is_default", true)
        .maybeSingle();

      for (const it of items) {
        const lineTotal = Number(it.quantity) * Number(it.unit_price);
        await (supabase as any).from("garage_invoice_items").insert({
          invoice_id: inv.id,
          item_id: it.item_id || null,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          unit_cost: Number(it.unit_cost) || 0,
          line_total: lineTotal,
        });

        // If stocked item, record transactional issue
        if (it.item_id && defaultLoc) {
          try {
            await (supabase as any).rpc("record_stock_transaction", {
              p_item_id: it.item_id,
              p_location_id: defaultLoc.id,
              p_type: "issue",
              p_quantity: -Math.abs(Number(it.quantity) || 1),
              p_reason: "Direct counter sale invoice",
              p_reference: `invoice:${inv.id}`,
              p_affect_balance: true,
              p_balance_field: "physical_stock",
            });
          } catch (e) {
            console.warn("Stock transaction auto issue note:", e);
          }
        }
      }

      // 7. Payment handling
      if (paymentMethod === "selcom_mobile") {
        toast.success(`Counter sale invoice generated: INV-${currentYear}-${String(nextInvNum).padStart(4, "0")}`);
        setCompletedInvoice(inv);
        if (onSaleCompleted) onSaleCompleted(inv);
        setPendingSelcomInvoice(inv);
        setSelcomModalOpen(true);
      } else {
        await (supabase as any).from("garage_payments").insert({
          organisation_id: orgId,
          invoice_id: inv.id,
          type: "payment",
          amount: totals.grandTotal,
          method: paymentMethod,
          reference: paymentRef.trim() || null,
          received_by: user?.id,
          paid_at: new Date().toISOString(),
        });

        toast.success(`Counter sale complete: INV-${currentYear}-${String(nextInvNum).padStart(4, "0")}`);
        setCompletedInvoice(inv);
        if (onSaleCompleted) onSaleCompleted(inv);
      }
    } catch (err: any) {
      toast.error(err.message || "Counter sale failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Quick Over-The-Counter Sale</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Instant parts and walk-in service checkout with immediate invoice and receipt.
              </p>
            </div>
          </div>
        </DialogHeader>

        {completedInvoice ? (
          /* Completion & Print Screen */
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Sale Completed &amp; Paid</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Invoice:{" "}
                <span className="font-semibold text-foreground">
                  INV-{completedInvoice.invoice_year}-{String(completedInvoice.invoice_number).padStart(4, "0")}
                </span>{" "}
                · Total: <span className="font-semibold text-foreground">{formatMoney(totals.grandTotal)}</span>
              </p>
            </div>

            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  window.open(`/garage/invoices/${completedInvoice.id}/print`, "_blank");
                }}
                className="gap-2"
              >
                <Printer className="h-4 w-4" /> Print Sale Receipt / Invoice
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-primary hover:underline"
              >
                + New counter sale
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-sm">
            {/* Customer selector / walk-in */}
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-card p-3">
              <div>
                <Label className="text-xs">Account Customer (optional)</Label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Walk-in Customer (Non-Account)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!customerId ? (
                <div>
                  <Label className="text-xs">Walk-in Customer Name</Label>
                  <Input
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Walk-in Cash Customer"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Customer Contact</Label>
                  <div className="mt-1 text-xs text-muted-foreground pt-1.5">
                    {customers.find((c) => c.id === customerId)?.phone || "No phone on file"}
                  </div>
                </div>
              )}
            </div>

            {/* Item adders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Items / Parts Sold
                </Label>
                <Button variant="ghost" size="sm" onClick={addCustomItem} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Custom Item
                </Button>
              </div>

              {/* Stock item picker */}
              <div className="flex gap-2">
                <select
                  value={selectedPartId}
                  onChange={(e) => addInventoryItem(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Pick from workshop stock…</option>
                  {inventoryItems.map((p) => {
                    const avail = stockBalances[p.id] ?? 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({avail} in stock) — {formatMoney(Number(p.selling_price || p.unit_cost || 0))}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Items table */}
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Select a part from inventory or click "+ Add Custom Item" to start the sale.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border p-2 text-xs"
                    >
                      <div className="col-span-5">
                        <Input
                          value={it.description}
                          onChange={(e) => updateItem(it.id, "description", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="Description"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => updateItem(it.id, "quantity", Number(e.target.value) || 1)}
                          className="h-8 text-xs text-center"
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          value={it.unit_price}
                          onChange={(e) => updateItem(it.id, "unit_price", Number(e.target.value) || 0)}
                          className="h-8 text-xs"
                          placeholder="Price"
                        />
                      </div>
                      <div className="col-span-2 text-right font-medium pr-1">
                        {formatMoney((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cost adjustments */}
            <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
              <div>
                <Label className="text-xs">Labour / Service</Label>
                <Input
                  type="number"
                  min={0}
                  value={labourCost}
                  onChange={(e) => setLabourCost(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Discount</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Tax Rate %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            {/* Payment capture */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Payment Details
                </span>
                <span className="text-foreground text-sm font-bold">
                  Total Due: {formatMoney(totals.grandTotal)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="cash">Cash</option>
                    {/* <option value="selcom_mobile">Selcom Mobile Money (USSD Push)</option> */}
                    <option value="mobile_money">Mobile Money (M-Pesa / MTN)</option>
                    <option value="bank">Card / POS</option>
                    <option value="other">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Reference (Transaction ID / Code)</Label>
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder={paymentMethod === "selcom_mobile" ? "Auto-generated by Selcom" : "e.g. QX91283M"}
                    disabled={paymentMethod === "selcom_mobile"}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {paymentMethod === "selcom_mobile" && (
                <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    When completing the sale, a Selcom USSD prompt will pop up on customer phone (<strong>{walkinPhone || "please enter phone in customer details"}</strong>) for mobile PIN entry.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {!completedInvoice && (
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitSale}
              disabled={saving || (items.length === 0 && Number(labourCost) <= 0)}
              className="bg-primary text-primary-foreground gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Sale…
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  Complete Sale &amp; Issue Receipt ({formatMoney(totals.grandTotal)})
                </>
              )}
            </Button>
          </DialogFooter>
        )}

        {pendingSelcomInvoice && (
          <SelcomPaymentModal
            open={selcomModalOpen}
            onOpenChange={(op) => {
              setSelcomModalOpen(op);
              if (!op) setPendingSelcomInvoice(null);
            }}
            invoiceId={pendingSelcomInvoice.id}
            invoiceNumber={`INV-${pendingSelcomInvoice.invoice_year}-${String(pendingSelcomInvoice.invoice_number).padStart(4, "0")}`}
            amount={totals.grandTotal}
            customerPhone={walkinPhone}
            customerName={walkinName}
            onSuccess={() => {
              if (onSaleCompleted) onSaleCompleted(pendingSelcomInvoice);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
