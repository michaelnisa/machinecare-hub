import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ClipboardCheck, Plus, Loader2, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const RESULTS = ["pass", "fail", "observation", "na"] as const;
const RESULT_CLASS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  fail: "bg-red-100 text-red-700",
  observation: "bg-blue-100 text-blue-700",
  na: "bg-muted text-muted-foreground",
};
const OVERALL_CLASS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  fail: "bg-red-100 text-red-700",
  pass_with_findings: "bg-amber-100 text-amber-700",
};

export default function Inspections() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const canManageTemplates = isManager || profile?.department === "safety";
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [runTemplate, setRunTemplate] = useState<any>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: t }, { data: i }, { data: m }] = await Promise.all([
      (supabase as any).from("safety_inspection_templates").select("*").eq("is_active", true).order("name"),
      (supabase as any).from("safety_inspections").select("*, machines(name)").order("inspected_at", { ascending: false }).limit(50),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setTemplates(t ?? []);
    setInspections(i ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const stats = useMemo(() => {
    const last30 = inspections.filter((x) => Date.now() - new Date(x.inspected_at).getTime() < 30 * 86400000);
    return {
      total: inspections.length,
      failedItems: inspections.reduce((s, x) => s + (x.items ?? []).filter((it: any) => it.result === "fail").length, 0),
      last30: last30.length,
    };
  }, [inspections]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety inspections</h1>
          <p className="text-sm text-muted-foreground">Run checklist-based inspections. A failed item auto-creates a corrective action.</p>
        </div>
        {canManageTemplates && (
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New template</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Inspections (last 50)", value: stats.total },
          { label: "In last 30 days", value: stats.last30 },
          { label: "Failed items found", value: stats.failedItems },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Templates</h2>
        {templates.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No inspection templates yet" description={canManageTemplates ? "Create one to start running inspections." : "Ask Safety to create an inspection template."} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.category || "General"} · {(t.items ?? []).length} items</div>
                </div>
                <Button size="sm" onClick={() => setRunTemplate(t)}>Run</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Recent inspections</h2>
        {inspections.length === 0 ? (
          <EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="No inspections logged" description="Run your first inspection above." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Template</th>
                  <th className="px-5 py-3 font-medium">Machine</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Failed items</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((x) => {
                  const failed = (x.items ?? []).filter((it: any) => it.result === "fail").length;
                  return (
                    <tr key={x.id} className="border-t border-border">
                      <td className="px-5 py-3">{formatDate(x.inspected_at)}</td>
                      <td className="px-5 py-3">{x.template_name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{x.location ?? "—"}</td>
                      <td className="px-5 py-3">{failed}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${OVERALL_CLASS[x.overall_result] ?? "bg-muted"}`}>{x.overall_result?.replace(/_/g, " ")}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RunInspectionDialog template={runTemplate} onClose={() => setRunTemplate(null)} machines={machines} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
      <TemplateDialog open={templateDialogOpen} setOpen={setTemplateDialogOpen} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function RunInspectionDialog({ template, onClose, machines, userId, orgId, onSaved }: any) {
  const [machineId, setMachineId] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<Record<number, { result: string; comment: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setMachineId(""); setLocation("");
      const init: Record<number, { result: string; comment: string }> = {};
      (template.items ?? []).forEach((_: any, i: number) => { init[i] = { result: "pass", comment: "" }; });
      setResults(init);
    }
  }, [template]);

  if (!template) return null;

  const items = (template.items ?? []).map((it: any, i: number) => ({ label: it.label, ...results[i] }));
  const overall = items.some((it: any) => it.result === "fail") ? "fail" : items.some((it: any) => it.result === "observation") ? "pass_with_findings" : "pass";

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("safety_inspections").insert({
      organisation_id: orgId,
      template_id: template.id,
      template_name: template.name,
      machine_id: machineId || null,
      location: location || null,
      inspected_by: userId,
      items,
      overall_result: overall,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(overall === "fail" ? "Inspection submitted — corrective actions created for failed items" : "Inspection submitted");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!template} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Run inspection — {template.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Machine (optional)</Label>
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" /></div>
        </div>

        <div className="mt-4 space-y-3">
          {(template.items ?? []).map((it: any, i: number) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 text-sm font-medium">{it.label}</div>
              <div className="flex flex-wrap gap-2">
                {RESULTS.map((r) => (
                  <button key={r} onClick={() => setResults((cur) => ({ ...cur, [i]: { ...cur[i], result: r } }))}
                    className={`rounded-full border px-3 py-1 text-xs capitalize ${results[i]?.result === r ? RESULT_CLASS[r] + " border-transparent" : "border-border bg-background"}`}>
                    {r}
                  </button>
                ))}
              </div>
              {results[i]?.result === "fail" && (
                <Textarea rows={2} placeholder="What's wrong? (creates a corrective action)" className="mt-2" value={results[i]?.comment ?? ""}
                  onChange={(e) => setResults((cur) => ({ ...cur, [i]: { ...cur[i], comment: e.target.value } }))} />
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit inspection"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ open, setOpen, userId, orgId, onSaved }: any) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const lines = itemsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim()) return toast.error("Name required");
    if (lines.length === 0) return toast.error("Add at least one checklist item");
    setSaving(true);
    const { error } = await (supabase as any).from("safety_inspection_templates").insert({
      organisation_id: orgId,
      name: name.trim(),
      category: category.trim() || null,
      items: lines.map((label) => ({ label })),
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Template created");
    setOpen(false);
    setName(""); setCategory(""); setItemsText("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New inspection template</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. Workshop Safety Inspection" /></div>
          <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" placeholder="e.g. Fire, Electrical, PPE" /></div>
          <div><Label>Checklist items (one per line) *</Label>
            <Textarea rows={8} value={itemsText} onChange={(e) => setItemsText(e.target.value)} className="mt-1" placeholder={"Emergency exits clear\nMachine guards installed\nEmergency stop functional"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
