import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ProductionPlanning() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [plans, setPlans] = useState<any[]>([]);
  const [actuals, setActuals] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: p, error }, { data: a }] = await Promise.all([
      supabase.from("production_plans").select("*").eq("plan_date", date).order("production_line").order("shift"),
      supabase.from("production_kpis").select("production_line, shift, product, actual_units").eq("organisation_id", profile.organisation_id).eq("record_date", date),
    ]);
    if (error) toast.error(error.message);
    setPlans(p ?? []);
    setActuals(a ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile, date]);

  const rows = useMemo(() => {
    return plans.map((plan) => {
      const match = actuals.find(
        (a) =>
          (a.production_line ?? "") === (plan.production_line ?? "") &&
          (a.shift ?? "") === (plan.shift ?? "") &&
          (a.product ?? "") === (plan.product ?? ""),
      );
      const actual = match?.actual_units ?? null;
      const attainment = actual != null && plan.target_units > 0 ? (actual / plan.target_units) * 100 : null;
      return { ...plan, actual, attainment };
    });
  }, [plans, actuals]);

  const totals = useMemo(() => {
    const target = rows.reduce((s, r) => s + Number(r.target_units ?? 0), 0);
    const actual = rows.reduce((s, r) => s + Number(r.actual ?? 0), 0);
    return { target, actual, attainment: target > 0 ? (actual / target) * 100 : null };
  }, [rows]);

  const shiftDate = (deltaDays: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    setDate(toDateKey(d));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("production_plans").delete().eq("id", confirmDelete);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plan deleted");
    setConfirmDelete(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/production/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production Overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production Planning</h1>
          <p className="text-sm text-muted-foreground">Set targets ahead of time, per line and shift — compared against what actually gets logged.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New plan
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(toDateKey(new Date()))}>
          Today
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Planned</div>
            <div className="mt-1 text-2xl font-semibold">{totals.target.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Actual (logged)</div>
            <div className="mt-1 text-2xl font-semibold">{totals.actual.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Attainment</div>
            <div className={cn("mt-1 text-2xl font-semibold", totals.attainment == null ? "" : totals.attainment >= 95 ? "text-emerald-600" : totals.attainment >= 75 ? "text-amber-600" : "text-red-600")}>
              {totals.attainment == null ? "—" : `${Math.round(totals.attainment)}%`}
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="h-5 w-5" />}
          title="No plan for this day"
          description="Add a target for a line and shift so you can compare it against what actually gets logged."
          action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New plan</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Line</th>
                  <th className="px-5 py-3 font-medium">Shift</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Actual</th>
                  <th className="px-5 py-3 font-medium">Attainment</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{r.production_line || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.shift || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.product || "—"}</td>
                    <td className="px-5 py-3">{Number(r.target_units).toLocaleString()}</td>
                    <td className="px-5 py-3">{r.actual != null ? Number(r.actual).toLocaleString() : <span className="text-muted-foreground">Not logged</span>}</td>
                    <td className="px-5 py-3">
                      {r.attainment == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn("font-medium", r.attainment >= 95 ? "text-emerald-600" : r.attainment >= 75 ? "text-amber-600" : "text-red-600")}>
                          {Math.round(r.attainment)}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setDialogOpen(true); }} title="Edit plan">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r.id)} title="Delete plan">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editing}
        defaultDate={date}
        orgId={profile?.organisation_id}
        userId={profile?.id}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this plan?"
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}

function PlanDialog({ open, onOpenChange, plan, defaultDate, orgId, userId, onSaved }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const isEdit = !!plan;

  useEffect(() => {
    if (open) {
      setForm(
        plan ?? {
          plan_date: defaultDate,
          production_line: "",
          shift: "Day",
          product: "",
          target_units: "",
          planned_minutes: "",
          notes: "",
        },
      );
    }
  }, [open, plan, defaultDate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plan_date) return toast.error("Pick a date");
    if (!form.target_units || Number(form.target_units) <= 0) return toast.error("Target units must be greater than 0");
    setSubmitting(true);
    const payload: any = {
      plan_date: form.plan_date,
      production_line: form.production_line?.trim() || null,
      shift: form.shift?.trim() || null,
      product: form.product?.trim() || null,
      target_units: Number(form.target_units),
      planned_minutes: form.planned_minutes === "" || form.planned_minutes == null ? null : Number(form.planned_minutes),
      notes: form.notes?.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("production_plans").update(payload).eq("id", plan.id)
      : await supabase.from("production_plans").insert({ ...payload, organisation_id: orgId, created_by: userId });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Plan updated" : "Plan added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit plan" : "New production plan"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.plan_date ?? ""} onChange={(e) => setForm({ ...form, plan_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Input value={form.shift ?? ""} onChange={(e) => setForm({ ...form, shift: e.target.value })} placeholder="e.g. Day, Night" />
            </div>
            <div className="space-y-1.5">
              <Label>Production line</Label>
              <Input value={form.production_line ?? ""} onChange={(e) => setForm({ ...form, production_line: e.target.value })} placeholder="e.g. Line 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input value={form.product ?? ""} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Target units *</Label>
              <Input type="number" min={1} value={form.target_units ?? ""} onChange={(e) => setForm({ ...form, target_units: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Planned minutes</Label>
              <Input type="number" min={0} value={form.planned_minutes ?? ""} onChange={(e) => setForm({ ...form, planned_minutes: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isEdit ? "Save changes" : "Add plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
