import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { estimateTotal } from "@/lib/garage-money";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  changes_requested: "bg-purple-100 text-purple-700",
};

const TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "changes_requested", label: "Changes requested" },
];

export default function GarageEstimates() {
  const { profile, user, organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("garage_estimates")
      .select("*, garage_estimate_items(*), garage_jobs(id, job_number, job_year, garage_customers(name), garage_vehicles(make, model, registration_number))")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setEstimates(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  const filtered = useMemo(() => {
    let out = tab === "all" ? estimates : estimates.filter((e) => e.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((e) =>
        e.garage_jobs?.garage_customers?.name?.toLowerCase().includes(q) ||
        e.garage_jobs?.garage_vehicles?.registration_number?.toLowerCase().includes(q)
      );
    }
    return out;
  }, [estimates, tab, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estimates</h1>
          <p className="text-sm text-muted-foreground">Every quotation sent — and whether the customer approved it.</p>
        </div>
        <Button onClick={() => setNewQuoteOpen(true)} className="bg-primary text-primary-foreground gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Create Quotation
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              tab === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Input
          placeholder="Search customer or plate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No estimates"
          description="Click 'Create Quotation' or prepare an estimate from a job's diagnosis section."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Job</th>
                <th className="px-5 py-3 font-medium">Customer / vehicle</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    {e.garage_jobs ? (
                      <Link
                        to={`/garage/jobs/${e.garage_jobs.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        JOB-{e.garage_jobs.job_year}-{String(e.garage_jobs.job_number).padStart(4, "0")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {e.garage_jobs?.garage_customers?.name}
                    {e.garage_jobs?.garage_vehicles?.registration_number &&
                      ` · ${e.garage_jobs.garage_vehicles.registration_number}`}
                  </td>
                  <td className="px-5 py-3">{formatMoney(estimateTotal(e))}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[e.status]}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/garage/estimates/${e.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewQuotationDialog
        open={newQuoteOpen}
        onOpenChange={setNewQuoteOpen}
        orgId={organisation?.id || profile?.organisation_id}
        userId={user?.id}
        onSaved={load}
      />
    </div>
  );
}

function NewQuotationDialog({ open, onOpenChange, orgId, userId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [stockParts, setStockParts] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newPlate, setNewPlate] = useState("");

  const [complaint, setComplaint] = useState("");
  const [labourCost, setLabourCost] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");

  const [items, setItems] = useState<any[]>([]);
  const [selectedPartId, setSelectedPartId] = useState("");

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setIsNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setVehicleId("");
      setIsNewVehicle(false);
      setNewMake("");
      setNewModel("");
      setNewPlate("");
      setComplaint("Quotation Enquiry / Estimate");
      setLabourCost("0");
      setDiscount("0");
      setTaxRate("0");
      setItems([]);
      setSelectedPartId("");

      Promise.all([
        (supabase as any).from("garage_customers").select("id, name, phone").order("name"),
        supabase.from("inventory_items").select("id, name, unit_cost, selling_price").eq("status", "active").order("name"),
      ]).then(([{ data: c }, { data: p }]) => {
        setCustomers(c ?? []);
        setStockParts(p ?? []);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!customerId || isNewCustomer) {
      setVehicles([]);
      return;
    }
    (supabase as any)
      .from("garage_vehicles")
      .select("id, make, model, registration_number")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const list = data ?? [];
        setVehicles(list);
        if (list.length > 0) {
          setVehicleId(list[0].id);
          setIsNewVehicle(false);
        } else {
          setIsNewVehicle(true);
        }
      });
  }, [customerId, isNewCustomer]);

  const addStockPart = (partId: string) => {
    if (!partId) return;
    const part = stockParts.find((p) => p.id === partId);
    if (!part) return;
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        item_id: part.id,
        description: part.name,
        quantity: 1,
        unit_price: Number(part.selling_price || part.unit_cost || 0),
        unit_cost: Number(part.unit_cost || 0),
      },
    ]);
    setSelectedPartId("");
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "Service Labour / Part",
        quantity: 1,
        unit_price: 0,
        unit_cost: 0,
      },
    ]);
  };

  const updateItem = (id: string, field: string, val: any) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const submitQuotation = async () => {
    if (!isNewCustomer && !customerId) return toast.error("Select or create a customer");
    if (isNewCustomer && !newCustName.trim()) return toast.error("Enter customer name");

    setSaving(true);
    try {
      // 1. Customer
      let finalCustId = customerId;
      if (isNewCustomer) {
        const { data: c, error: cErr } = await (supabase as any)
          .from("garage_customers")
          .insert({
            organisation_id: orgId,
            name: newCustName.trim(),
            phone: newCustPhone.trim() || null,
            created_by: userId,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        finalCustId = c.id;
      }

      // 2. Vehicle
      let finalVehId = vehicleId;
      if (isNewVehicle || !finalVehId) {
        const { data: v, error: vErr } = await (supabase as any)
          .from("garage_vehicles")
          .insert({
            organisation_id: orgId,
            customer_id: finalCustId,
            make: newMake.trim() || "Vehicle",
            model: newModel.trim() || "Quotation",
            registration_number: newPlate.trim().toUpperCase() || "ENQUIRY",
            created_by: userId,
          })
          .select()
          .single();
        if (vErr) throw vErr;
        finalVehId = v.id;
      }

      // 3. Create job in 'estimate' state
      const { data: job, error: jErr } = await (supabase as any)
        .from("garage_jobs")
        .insert({
          organisation_id: orgId,
          customer_id: finalCustId,
          vehicle_id: finalVehId,
          reported_problem: complaint.trim() || "Quotation Enquiry",
          status: "estimate",
          created_by: userId,
        })
        .select()
        .single();
      if (jErr) throw jErr;

      // 4. Create estimate
      const { data: est, error: estErr } = await (supabase as any)
        .from("garage_estimates")
        .insert({
          organisation_id: orgId,
          job_id: job.id,
          status: "draft",
          labour_cost: Number(labourCost) || 0,
          discount: Number(discount) || 0,
          tax_rate_percent: Number(taxRate) || 0,
          notes: "Standalone formal quotation",
          created_by: userId,
        })
        .select()
        .single();
      if (estErr) throw estErr;

      // 5. Create estimate items
      for (const it of items) {
        await (supabase as any).from("garage_estimate_items").insert({
          estimate_id: est.id,
          item_id: it.item_id || null,
          description: it.description.trim() || "Item",
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          unit_cost: Number(it.unit_cost) || 0,
        });
      }

      toast.success("Quotation created successfully");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to create quotation");
    } finally {
      setSaving(false);
    }
  };

  const subtotal =
    items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0) +
    (Number(labourCost) || 0) -
    (Number(discount) || 0);
  const taxAmt = Math.max(0, subtotal) * ((Number(taxRate) || 0) / 100);
  const total = Math.max(0, subtotal) + taxAmt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Create Standalone Quotation / Estimate</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate an estimate for a customer inquiry without checking in a vehicle.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Customer */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold uppercase text-muted-foreground">
              <span>Customer Details</span>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                className="text-primary hover:underline lowercase"
              >
                {isNewCustomer ? "← select existing" : "+ new customer"}
              </button>
            </div>

            {!isNewCustomer ? (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Customer Name *"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Phone Number"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold uppercase text-muted-foreground">
              <span>Vehicle Information</span>
              <button
                type="button"
                onClick={() => setIsNewVehicle(!isNewVehicle)}
                className="text-primary hover:underline lowercase"
              >
                {isNewVehicle ? "← saved vehicles" : "+ specify vehicle"}
              </button>
            </div>

            {!isNewVehicle && vehicles.length > 0 ? (
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.make, v.model].filter(Boolean).join(" ")} ({v.registration_number})
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Make (e.g. Toyota)"
                  value={newMake}
                  onChange={(e) => setNewMake(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Model (e.g. Prado)"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Plate (e.g. KDC 123)"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                  className="h-8 text-xs uppercase"
                />
              </div>
            )}
          </div>

          {/* Scope of Work */}
          <div>
            <Label className="text-xs">Quotation Scope / Requested Work</Label>
            <Input
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. Front brake pad replacement and disc skimming"
              className="mt-1 h-8 text-xs"
            />
          </div>

          {/* Parts & Services */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </Label>
              <Button variant="ghost" size="sm" onClick={addCustomItem} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Custom Line
              </Button>
            </div>

            <select
              value={selectedPartId}
              onChange={(e) => addStockPart(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Pick part from inventory…</option>
              {stockParts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(Number(p.selling_price || p.unit_cost || 0))}
                </option>
              ))}
            </select>

            {items.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                {items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 items-center rounded border border-border p-2 text-xs">
                    <div className="col-span-6">
                      <Input
                        value={it.description}
                        onChange={(e) => updateItem(it.id, "description", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, "quantity", Number(e.target.value) || 1)}
                        className="h-7 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={0}
                        value={it.unit_price}
                        onChange={(e) => updateItem(it.id, "unit_price", Number(e.target.value) || 0)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Adjustments */}
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div>
              <Label className="text-xs">Labour Charge</Label>
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

          <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3 text-sm font-semibold">
            <span>Estimated Total Quote:</span>
            <span className="text-base text-primary font-bold">{formatMoney(total)}</span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submitQuotation}
            disabled={saving}
            className="bg-primary text-primary-foreground gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" /> Save Quotation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
