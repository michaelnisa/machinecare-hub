import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ClipboardCheck, ShieldCheck, Archive, Loader2, FileStack } from "lucide-react";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CATEGORIES } from "@/lib/machine-constants";
import { CHECKLIST_SAMPLES } from "@/lib/checklist-samples";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground line-through",
};

export default function ChecklistTemplates() {
  const { profile, user } = useAuth();
  const { canAuthorTemplates } = useUserRole();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "archived">("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("checklist_templates")
      .select("*")
      .order("name")
      .order("version", { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

  // Group: for each (name + machine_category/machine_id) keep latest version row
  const grouped: any[] = (() => {
    const byKey: Record<string, any> = {};
    templates.forEach((t) => {
      const key = `${t.name}|${t.machine_category ?? ""}|${t.machine_id ?? ""}`;
      if (!byKey[key] || t.version > byKey[key].version) byKey[key] = t;
    });
    return Object.values(byKey);
  })();

  const visible = filter === "all" ? grouped : grouped.filter((t) => t.status === filter);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Checklist templates</h1>
          <p className="text-sm text-muted-foreground">Controlled, versioned inspection forms. Only owners and engineers can edit or approve.</p>
        </div>
        {canAuthorTemplates && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New template</Button>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "draft", "approved", "archived"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No templates yet"
          description={canAuthorTemplates ? "Create your first inspection template." : "Templates will appear here once an engineer creates one."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Link
              key={t.id}
              to={`/checklist-templates/${t.id}`}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{t.name}</h3>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                v{t.version} · {t.machine_category ? `Category: ${t.machine_category}` : t.machine_id ? "Specific machine" : "Any machine"}
              </p>
              {t.status === "approved" && (
                <p className="flex items-center gap-1 text-[11px] text-primary">
                  <ShieldCheck className="h-3 w-3" /> Approved {formatDate(t.approved_at)}
                </p>
              )}
              {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
            </Link>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={profile!.organisation_id}
        userId={user?.id ?? null}
        onCreated={load}
      />
    </div>
  );
}

function CreateTemplateDialog({ open, onOpenChange, orgId, userId, onCreated }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [machineCategory, setMachineCategory] = useState<string>("");
  const [machineId, setMachineId] = useState<string>("");
  const [machines, setMachines] = useState<{ id: string; name: string; registration_number: string | null }[]>([]);
  const [sampleKey, setSampleKey] = useState<string>("blank");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setDescription(""); setMachineCategory(""); setMachineId(""); setSampleKey("blank"); }
  }, [open]);

  useEffect(() => {
    if (!open || !orgId) return;
    supabase
      .from("machines")
      .select("id, name, registration_number")
      .eq("organisation_id", orgId)
      .order("name")
      .then(({ data }) => setMachines(data ?? []));
  }, [open, orgId]);

  const applySample = (key: string) => {
    setSampleKey(key);
    const sample = CHECKLIST_SAMPLES.find((s) => s.key === key);
    if (sample) {
      setName(sample.name);
      setDescription(sample.description);
      setMachineCategory(sample.machine_category ?? "");
    } else {
      setName("");
      setDescription("");
      setMachineCategory("");
    }
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { data: newTemplate, error } = await supabase
      .from("checklist_templates")
      .insert({
        organisation_id: orgId,
        name: name.trim(),
        description: description.trim() || null,
        machine_category: machineId ? null : (machineCategory || null),
        machine_id: machineId || null,
        version: 1,
        status: "draft",
        created_by: userId,
      })
      .select()
      .single();
    if (error || !newTemplate) {
      setSaving(false);
      return toast.error(error?.message ?? "Failed to create template");
    }

    const sample = CHECKLIST_SAMPLES.find((s) => s.key === sampleKey);
    if (sample) {
      const rows = sample.items.map((it, idx) => ({
        template_id: newTemplate.id,
        sort_order: idx,
        text: it.text,
        item_type: it.item_type,
        severity: it.severity,
        min_value: it.min_value ?? null,
        max_value: it.max_value ?? null,
        unit: it.unit ?? null,
      }));
      const { error: itemsError } = await supabase.from("checklist_template_items").insert(rows);
      if (itemsError) toast.error(`Template created, but sample items failed: ${itemsError.message}`);
    }

    setSaving(false);
    toast.success(sample ? `Template created with ${sample.items.length} sample items` : "Template created");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New checklist template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Start from</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => applySample("blank")}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                  sampleKey === "blank" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
                )}
              >
                <FileStack className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">Blank template</div>
                  <div className="text-xs text-muted-foreground">Start from scratch</div>
                </div>
              </button>
              {CHECKLIST_SAMPLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => applySample(s.key)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    sampleKey === s.key ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
                  )}
                >
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.items.length} items</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily pre-start — Excavator" />
          </div>
          <div className="space-y-1.5">
            <Label>Applies to category</Label>
            <select
              value={machineCategory}
              onChange={(e) => setMachineCategory(e.target.value)}
              disabled={!!machineId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">Any machine</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Or applies to one specific machine</Label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— None (use category above) —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.registration_number ? `${m.name} (${m.registration_number})` : m.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Picking a machine here locks this template to that machine only — e.g. a daily inspection specific to one piece of equipment.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
