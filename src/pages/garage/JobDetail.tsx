import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/PageLoader";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_FLOW, STATUS_LABEL, STATUS_BADGE, formatJobNumber } from "@/lib/garage-constants";
import { TRIGGER_EVENTS, TRIGGER_EVENT_LABEL, buildMessage } from "@/lib/garage-messages";

export default function GarageJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [mechanicId, setMechanicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"approve" | "decline" | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: j, error } = await (supabase as any)
      .from("garage_jobs")
      .select("*, garage_customers(id, name, phone), garage_vehicles(id, make, model, registration_number, mileage)")
      .eq("id", id).maybeSingle();
    if (error) toast.error(error.message);
    setJob(j);
    if (!j) { setLoading(false); return; }
    setMechanicId(j.mechanic_id ?? "");

    const [{ data: m }, { data: f }, { data: est }, { data: inv }, { data: h }] = await Promise.all([
      (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
      (supabase as any).from("garage_job_findings").select("*").eq("job_id", id).order("created_at"),
      (supabase as any).from("garage_estimates").select("*, garage_estimate_items(*)").eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("garage_invoices").select("*, garage_invoice_items(*)").eq("job_id", id).maybeSingle(),
      (supabase as any).from("garage_job_status_history").select("*, profiles:changed_by(full_name)").eq("job_id", id).order("created_at", { ascending: false }),
    ]);
    setMechanics(m ?? []);
    setFindings(f ?? []);
    setEstimate(est ?? null);
    setInvoice(inv ?? null);
    if (inv) {
      const { data: p } = await (supabase as any).from("garage_payments").select("*").eq("invoice_id", inv.id).order("paid_at", { ascending: false });
      setPayments(p ?? []);
    } else {
      setPayments([]);
    }
    setHistory(h ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <PageLoader />;
  if (!job) return <div className="p-6 text-sm text-muted-foreground">Job not found.</div>;

  const currentIndex = STATUS_FLOW.indexOf(job.status);
  const nextStatus = job.status === "cancelled" ? null : STATUS_FLOW[currentIndex + 1];

  const setStatus = async (status: string) => {
    setBusy(true);
    const { error } = await (supabase as any).from("garage_jobs").update({ status }).eq("id", job.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Job moved to ${STATUS_LABEL[status]}`);
    load();
  };

  const assignMechanic = async () => {
    setBusy(true);
    const { error } = await (supabase as any).from("garage_jobs").update({ mechanic_id: mechanicId || null }).eq("id", job.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Mechanic updated");
    load();
  };

  const saveDiagnosis = async (diagnosis_notes: string, recommended_repair: string) => {
    const { error } = await (supabase as any).from("garage_jobs").update({ diagnosis_notes, recommended_repair }).eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success("Diagnosis saved");
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/garage/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to jobs</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{formatJobNumber(job)}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[job.status]}`}>{STATUS_LABEL[job.status]}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{job.priority} priority</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {[job.garage_vehicles?.make, job.garage_vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
            {job.garage_vehicles?.registration_number ? ` · ${job.garage_vehicles.registration_number}` : ""} — {job.garage_customers?.name}
          </p>
        </div>
        {job.status !== "closed" && job.status !== "cancelled" && (
          <div className="flex flex-wrap gap-2">
            {nextStatus && <Button size="sm" onClick={() => setStatus(nextStatus)} disabled={busy}>Move to {STATUS_LABEL[nextStatus]}</Button>}
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus("cancelled")} disabled={busy}>Cancel job</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Reported problem</h2>
            <p className="text-sm text-muted-foreground">{job.reported_problem}</p>
            {job.notes && <p className="mt-2 text-sm text-muted-foreground">{job.notes}</p>}
          </div>

          <DiagnosisCard job={job} findings={findings} onSaveDiagnosis={saveDiagnosis} onFindingsChanged={load} />

          <EstimateCard job={job} estimate={estimate} onChanged={load} decisionMode={decisionMode} setDecisionMode={setDecisionMode} />

          <InvoiceCard job={job} invoice={invoice} payments={payments} onChanged={load} />

          <MessageCard job={job} />

          {history.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-medium">History</h2>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id}>{formatDate(h.created_at)} — {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : "Created as "}{STATUS_LABEL[h.to_status]} {h.profiles?.full_name ? `(${h.profiles.full_name})` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Details</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{job.garage_customers?.name}</dd></div>
              {job.garage_customers?.phone && <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{job.garage_customers.phone}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">Mileage at intake</dt><dd>{job.mileage_at_intake ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected completion</dt><dd>{job.expected_completion ? formatDate(job.expected_completion) : "—"}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <Label>Mechanic</Label>
            <div className="mt-1 flex gap-2">
              <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {mechanics.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={assignMechanic} disabled={busy}>Save</Button>
            </div>
          </div>

          {["ready", "delivered", "closed"].includes(job.status) && <NextServiceCard vehicle={job.garage_vehicles} />}
        </div>
      </div>
    </div>
  );
}

function NextServiceCard({ vehicle }: any) {
  const [date, setDate] = useState(vehicle?.next_service_date ?? "");
  const [mileage, setMileage] = useState(vehicle?.next_service_mileage != null ? String(vehicle.next_service_mileage) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("garage_vehicles").update({
      next_service_date: date || null, next_service_mileage: mileage === "" ? null : Number(mileage),
    }).eq("id", vehicle.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Next service saved");
  };

  if (!vehicle) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium">Next service</h2>
      <div className="grid gap-3">
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9" /></div>
        <div><Label className="text-xs">Mileage (km)</Label><Input type="number" min={0} value={mileage} onChange={(e) => setMileage(e.target.value)} className="mt-1 h-9" /></div>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
      </div>
    </div>
  );
}

function DiagnosisCard({ job, findings, onSaveDiagnosis, onFindingsChanged }: any) {
  const [notes, setNotes] = useState(job.diagnosis_notes ?? "");
  const [repair, setRepair] = useState(job.recommended_repair ?? "");
  const [saving, setSaving] = useState(false);
  const [newFinding, setNewFinding] = useState("");

  useEffect(() => { setNotes(job.diagnosis_notes ?? ""); setRepair(job.recommended_repair ?? ""); }, [job.id]);

  const save = async () => { setSaving(true); await onSaveDiagnosis(notes, repair); setSaving(false); };

  const addFinding = async () => {
    if (!newFinding.trim()) return;
    const { error } = await (supabase as any).from("garage_job_findings").insert({ job_id: job.id, description: newFinding.trim() });
    if (error) return toast.error(error.message);
    setNewFinding("");
    onFindingsChanged();
  };

  const removeFinding = async (fid: string) => {
    const { error } = await (supabase as any).from("garage_job_findings").delete().eq("id", fid);
    if (error) return toast.error(error.message);
    onFindingsChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Diagnosis</h2>
      <div className="space-y-3">
        <div><Label>Diagnosis</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="What's actually wrong" /></div>
        <div><Label>Recommended repair</Label><Textarea rows={2} value={repair} onChange={(e) => setRepair(e.target.value)} className="mt-1" /></div>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save diagnosis"}</Button>

        <div>
          <Label>Findings</Label>
          {findings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {findings.map((f: any) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm">
                  <span>{f.description}</span>
                  <button onClick={() => removeFinding(f.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Input value={newFinding} onChange={(e) => setNewFinding(e.target.value)} placeholder="e.g. Coolant leak" onKeyDown={(e) => e.key === "Enter" && addFinding()} />
            <Button size="sm" variant="outline" onClick={addFinding}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EstimateCard({ job, estimate, onChanged, decisionMode, setDecisionMode }: any) {
  const [creating, setCreating] = useState(false);

  const createEstimate = async () => {
    setCreating(true);
    const { error } = await (supabase as any).from("garage_estimates").insert({ organisation_id: job.organisation_id, job_id: job.id, status: "draft" });
    if (!error && ["received", "diagnosing"].includes(job.status)) {
      await (supabase as any).from("garage_jobs").update({ status: "estimate" }).eq("id", job.id);
    }
    setCreating(false);
    if (error) return toast.error(error.message);
    onChanged();
  };

  if (!estimate) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">Estimate</h2>
        <p className="mb-3 text-sm text-muted-foreground">No estimate yet — create one once diagnosis is done.</p>
        <Button size="sm" onClick={createEstimate} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create estimate"}</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Estimate</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{estimate.status.replace("_", " ")}</span>
      </div>

      {estimate.status === "draft" || estimate.status === "changes_requested" ? (
        <EstimateEditor estimate={estimate} job={job} onChanged={onChanged} />
      ) : (
        <EstimateReadOnly estimate={estimate} />
      )}

      {estimate.status === "sent" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDecisionMode("approve")}>Record approval</Button>
          <Button size="sm" variant="outline" onClick={() => setDecisionMode("decline")}>Record decline</Button>
        </div>
      )}

      {estimate.status === "approved" && estimate.approved_at && (
        <p className="mt-3 text-xs text-muted-foreground">
          Approved by {estimate.approved_by_name} via {estimate.approval_method?.replace("_", " ")} on {formatDate(estimate.approved_at)} — {formatMoney(estimate.approved_amount)}
        </p>
      )}
      {estimate.status === "declined" && (
        <p className="mt-3 text-xs text-muted-foreground">Declined{estimate.decline_reason ? `: ${estimate.decline_reason}` : ""}. Create a new estimate to revise.</p>
      )}

      <JobCosting estimate={estimate} />

      <EstimateDecisionDialog mode={decisionMode} estimate={estimate} job={job} onClose={() => setDecisionMode(null)} onChanged={onChanged} />
    </div>
  );
}

function estimateTotal(estimate: any) {
  const itemsTotal = (estimate.garage_estimate_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
  return itemsTotal + Number(estimate.labour_cost || 0) - Number(estimate.discount || 0);
}

function JobCosting({ estimate }: any) {
  const items = estimate.garage_estimate_items ?? [];
  if (items.length === 0 && Number(estimate.labour_cost) === 0) return null;
  const customerPrice = estimateTotal(estimate);
  const partsCost = items.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_cost ?? 0), 0);
  const labour = Number(estimate.labour_cost || 0);
  const other = Number(estimate.other_cost || 0);
  const profit = customerPrice - partsCost - labour - other;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-3 text-xs sm:grid-cols-5">
      <div><div className="text-muted-foreground">Customer price</div><div className="font-medium">{formatMoney(customerPrice)}</div></div>
      <div><div className="text-muted-foreground">Parts cost</div><div className="font-medium">{formatMoney(partsCost)}</div></div>
      <div><div className="text-muted-foreground">Labour</div><div className="font-medium">{formatMoney(labour)}</div></div>
      <div><div className="text-muted-foreground">Other</div><div className="font-medium">{formatMoney(other)}</div></div>
      <div><div className="text-muted-foreground">Est. gross profit</div><div className={`font-medium ${profit < 0 ? "text-destructive" : ""}`}>{formatMoney(profit)}</div></div>
    </div>
  );
}

function EstimateReadOnly({ estimate }: any) {
  return (
    <div className="space-y-2 text-sm">
      {(estimate.garage_estimate_items ?? []).map((it: any) => (
        <div key={it.id} className="flex justify-between text-muted-foreground">
          <span>{it.description} × {it.quantity}</span>
          <span>{formatMoney(it.line_total ?? it.quantity * it.unit_price)}</span>
        </div>
      ))}
      {Number(estimate.labour_cost) > 0 && <div className="flex justify-between text-muted-foreground"><span>Labour</span><span>{formatMoney(estimate.labour_cost)}</span></div>}
      {Number(estimate.discount) > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatMoney(estimate.discount)}</span></div>}
      <div className="flex justify-between border-t border-border pt-2 font-medium"><span>Total</span><span>{formatMoney(estimateTotal(estimate))}</span></div>
    </div>
  );
}

function EstimateEditor({ estimate, job, onChanged }: any) {
  const [items, setItems] = useState<any[]>(estimate.garage_estimate_items ?? []);
  const [labour, setLabour] = useState(String(estimate.labour_cost ?? 0));
  const [discount, setDiscount] = useState(String(estimate.discount ?? 0));
  const [otherCost, setOtherCost] = useState(String(estimate.other_cost ?? 0));
  const [parts, setParts] = useState<any[]>([]);
  const [newItem, setNewItem] = useState<any>({ item_id: "", description: "", quantity: "1", unit_price: "0", unit_cost: "0" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(estimate.garage_estimate_items ?? []);
    setLabour(String(estimate.labour_cost ?? 0));
    setDiscount(String(estimate.discount ?? 0));
    setOtherCost(String(estimate.other_cost ?? 0));
  }, [estimate.id]);

  useEffect(() => {
    supabase.from("inventory_items").select("id, name, unit_cost, selling_price").eq("status", "active").order("name")
      .then(({ data }) => setParts(data ?? []));
  }, []);

  const pickPart = (partId: string) => {
    const p = parts.find((x) => x.id === partId);
    if (!p) { setNewItem((f: any) => ({ ...f, item_id: "" })); return; }
    setNewItem((f: any) => ({ ...f, item_id: p.id, description: p.name, unit_price: String(p.selling_price ?? p.unit_cost ?? 0), unit_cost: String(p.unit_cost ?? 0) }));
  };

  const addItem = async () => {
    if (!newItem.description.trim()) return toast.error("Enter a description");
    const { error } = await (supabase as any).from("garage_estimate_items").insert({
      estimate_id: estimate.id, item_id: newItem.item_id || null, description: newItem.description.trim(), quantity: Number(newItem.quantity) || 1,
      unit_price: Number(newItem.unit_price) || 0, unit_cost: Number(newItem.unit_cost) || 0,
    });
    if (error) return toast.error(error.message);
    setNewItem({ item_id: "", description: "", quantity: "1", unit_price: "0", unit_cost: "0" });
    onChanged();
  };

  const removeItem = async (id: string) => {
    const { error } = await (supabase as any).from("garage_estimate_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const saveCosts = async () => {
    const { error } = await (supabase as any).from("garage_estimates").update({ labour_cost: Number(labour) || 0, discount: Number(discount) || 0, other_cost: Number(otherCost) || 0 }).eq("id", estimate.id);
    if (error) toast.error(error.message); else onChanged();
  };

  const send = async () => {
    if (items.length === 0) return toast.error("Add at least one item, or labour cost");
    setBusy(true);
    const { error } = await (supabase as any).from("garage_estimates").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", estimate.id);
    if (!error && job.status === "estimate") await (supabase as any).from("garage_jobs").update({ status: "awaiting_approval" }).eq("id", job.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Estimate sent — awaiting customer approval");
    onChanged();
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{it.description} × {it.quantity}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{formatMoney(it.line_total ?? it.quantity * it.unit_price)}</span>
                <button onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {parts.length > 0 && (
        <div>
          <Label className="text-xs">Pick from stock (optional — auto-fills price and deducts stock)</Label>
          <select value={newItem.item_id} onChange={(e) => pickPart(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">— Type a custom line instead —</option>
            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-[1fr,60px,90px,90px,auto] items-end gap-2">
        <div><Label className="text-xs">Item</Label><Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value, item_id: "" })} className="mt-1 h-9" placeholder="Thermostat" /></div>
        <div><Label className="text-xs">Qty</Label><Input type="number" min={0} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} className="mt-1 h-9" /></div>
        <div><Label className="text-xs">Sell price</Label><Input type="number" min={0} value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} className="mt-1 h-9" /></div>
        <div><Label className="text-xs">Cost price</Label><Input type="number" min={0} value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} className="mt-1 h-9" /></div>
        <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Labour cost</Label><Input type="number" min={0} value={labour} onChange={(e) => setLabour(e.target.value)} onBlur={saveCosts} className="mt-1 h-9" /></div>
        <div><Label className="text-xs">Other cost</Label><Input type="number" min={0} value={otherCost} onChange={(e) => setOtherCost(e.target.value)} onBlur={saveCosts} className="mt-1 h-9" /></div>
        <div><Label className="text-xs">Discount</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={saveCosts} className="mt-1 h-9" /></div>
      </div>

      <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
        <span>Total</span>
        <span>{formatMoney((items.reduce((s, it) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0)) + (Number(labour) || 0) - (Number(discount) || 0))}</span>
      </div>

      <Button size="sm" onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to customer"}</Button>
    </div>
  );
}

function EstimateDecisionDialog({ mode, estimate, job, onClose, onChanged }: any) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("in_person");
  const [approvedBy, setApprovedBy] = useState(job.garage_customers?.name ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "approve") { setAmount(String(Math.round(estimateTotal(estimate)))); setApprovedBy(job.garage_customers?.name ?? ""); setMethod("in_person"); }
    setReason("");
  }, [mode]);

  const submit = async () => {
    setSaving(true);
    if (mode === "approve") {
      if (!amount || !approvedBy.trim()) { setSaving(false); return toast.error("Amount and approver name are required"); }
      const { error } = await (supabase as any).from("garage_estimates").update({
        status: "approved", approved_amount: Number(amount), approval_method: method, approved_by_name: approvedBy.trim(),
      }).eq("id", estimate.id);
      if (!error && !["approved", "in_progress", "quality_check", "ready", "delivered", "closed"].includes(job.status)) {
        await (supabase as any).from("garage_jobs").update({ status: "approved" }).eq("id", job.id);
      }
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Approval recorded");
    } else {
      const { error } = await (supabase as any).from("garage_estimates").update({ status: "declined", decline_reason: reason.trim() || null }).eq("id", estimate.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Decline recorded");
    }
    onClose();
    onChanged();
  };

  return (
    <Dialog open={!!mode} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{mode === "approve" ? "Record customer approval" : "Record customer decline"}</DialogTitle></DialogHeader>
        {mode === "approve" ? (
          <div className="grid gap-3">
            <div><Label>Approved amount *</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
            <div><Label>Approved by *</Label><Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="mt-1" /></div>
            <div><Label>Method</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["in_person", "phone", "sms", "email", "other"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div><Label>Reason (optional)</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" /></div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TO_EVENT: Record<string, string> = {
  received: "job_received", diagnosing: "job_received", estimate: "estimate_ready", awaiting_approval: "approval_request",
  approved: "repair_update", in_progress: "repair_update", quality_check: "repair_update", ready: "vehicle_ready",
  delivered: "payment_confirmation", closed: "payment_confirmation",
};

function MessageCard({ job }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [event, setEvent] = useState(STATUS_TO_EVENT[job.status] ?? "custom");
  const [channel, setChannel] = useState("whatsapp");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    (supabase as any).from("garage_customer_messages").select("*").eq("job_id", job.id).order("created_at", { ascending: false })
      .then(({ data, error }: any) => { if (error) toast.error(error.message); setMessages(data ?? []); });
  };
  useEffect(load, [job.id]);

  useEffect(() => {
    setBody(buildMessage(event, {
      customerName: job.garage_customers?.name,
      vehicleLabel: [job.garage_vehicles?.make, job.garage_vehicles?.model].filter(Boolean).join(" "),
      problem: job.reported_problem,
    }));
  }, [event, job.id]);

  const logMessage = async () => {
    if (!body.trim()) return toast.error("Message body is empty");
    setSaving(true);
    const { error } = await (supabase as any).from("garage_customer_messages").insert({
      organisation_id: job.organisation_id, customer_id: job.customer_id, job_id: job.id,
      trigger_event: event, channel, message_body: body.trim(), status: "sent",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Logged");
    load();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium">Notify customer</h2>
      <p className="mb-3 text-xs text-muted-foreground">Send this yourself (WhatsApp, SMS, call…) and log it here — MachineCare doesn't send messages automatically.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">When</Label>
          <select value={event} onChange={(e) => setEvent(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {TRIGGER_EVENTS.map((ev) => <option key={ev} value={ev}>{TRIGGER_EVENT_LABEL[ev]}</option>)}
          </select>
        </div>
        <div><Label className="text-xs">Channel</Label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {["whatsapp", "sms", "email", "phone_call", "in_person", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="mt-3" />
      <Button size="sm" className="mt-2" onClick={logMessage} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log as sent"}</Button>

      {messages.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          {messages.map((m) => (
            <li key={m.id}>{formatDate(m.sent_at)} — {TRIGGER_EVENT_LABEL[m.trigger_event] ?? m.trigger_event} via {m.channel.replace("_", " ")}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INVOICE_ELIGIBLE = new Set(["ready", "delivered", "closed"]);

function invoiceTotal(invoice: any) {
  const itemsTotal = (invoice.garage_invoice_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total ?? it.quantity * it.unit_price), 0);
  return itemsTotal + Number(invoice.labour_cost || 0) + Number(invoice.other_cost || 0) - Number(invoice.discount || 0);
}

function InvoiceCard({ job, invoice, payments, onChanged }: any) {
  const [generating, setGenerating] = useState(false);
  const [payMode, setPayMode] = useState<"payment" | "refund" | null>(null);

  const generate = async () => {
    setGenerating(true);
    const { error } = await (supabase as any).rpc("generate_garage_invoice", { _job_id: job.id });
    setGenerating(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice generated");
    onChanged();
  };

  if (!invoice) {
    if (!INVOICE_ELIGIBLE.has(job.status)) return null;
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">Invoice</h2>
        <p className="mb-3 text-sm text-muted-foreground">Generate an invoice from the approved estimate.</p>
        <Button size="sm" onClick={generate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate invoice"}</Button>
      </div>
    );
  }

  const total = invoiceTotal(invoice);
  const paid = payments.filter((p: any) => p.type === "payment").reduce((s: number, p: any) => s + Number(p.amount), 0)
    - payments.filter((p: any) => p.type === "refund").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const outstanding = total - paid;
  const status = outstanding <= 0 ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid";
  const statusClass = outstanding <= 0 ? "bg-emerald-100 text-emerald-700" : paid > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Invoice INV-{invoice.invoice_year}-{String(invoice.invoice_number).padStart(4, "0")}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{status}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        {(invoice.garage_invoice_items ?? []).map((it: any) => (
          <div key={it.id} className="flex justify-between text-muted-foreground"><span>{it.description} × {it.quantity}</span><span>{formatMoney(it.line_total ?? it.quantity * it.unit_price)}</span></div>
        ))}
        {Number(invoice.labour_cost) > 0 && <div className="flex justify-between text-muted-foreground"><span>Labour</span><span>{formatMoney(invoice.labour_cost)}</span></div>}
        {Number(invoice.other_cost) > 0 && <div className="flex justify-between text-muted-foreground"><span>Other</span><span>{formatMoney(invoice.other_cost)}</span></div>}
        {Number(invoice.discount) > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatMoney(invoice.discount)}</span></div>}
        <div className="flex justify-between border-t border-border pt-1.5 font-medium"><span>Total</span><span>{formatMoney(total)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{formatMoney(paid)}</span></div>
        <div className="flex justify-between font-medium"><span>Outstanding</span><span>{formatMoney(outstanding)}</span></div>
      </div>

      <div className="mt-3 flex gap-2">
        {outstanding > 0 && <Button size="sm" onClick={() => setPayMode("payment")}>Record payment</Button>}
        {paid > 0 && <Button size="sm" variant="outline" onClick={() => setPayMode("refund")}>Record refund</Button>}
      </div>

      {payments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Payment history</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {payments.map((p: any) => (
              <li key={p.id}>{formatDate(p.paid_at)} — {p.type === "refund" ? "Refund " : ""}{formatMoney(p.amount)} via {p.method.replace("_", " ")}{p.reference ? ` (${p.reference})` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      <RecordPaymentDialog mode={payMode} setMode={setPayMode} invoice={invoice} outstanding={outstanding} paid={paid} onChanged={onChanged} />
    </div>
  );
}

function RecordPaymentDialog({ mode, setMode, invoice, outstanding, paid, onChanged }: any) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode) { setAmount(String(Math.max(0, mode === "refund" ? paid : outstanding))); setMethod("cash"); setReference(""); }
  }, [mode]);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter an amount");
    setSaving(true);
    const { error } = await (supabase as any).from("garage_payments").insert({
      organisation_id: invoice.organisation_id, invoice_id: invoice.id, type: mode, amount: Number(amount), method, reference: reference.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "refund" ? "Refund recorded" : "Payment recorded");
    setMode(null);
    onChanged();
  };

  return (
    <Dialog open={!!mode} onOpenChange={(v) => !v && setMode(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{mode === "refund" ? "Record refund" : "Record payment"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Amount *</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
          <div><Label>Method</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {["cash", "mobile_money", "bank", "other"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div><Label>Reference (optional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" placeholder="Transaction ID, receipt #…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
