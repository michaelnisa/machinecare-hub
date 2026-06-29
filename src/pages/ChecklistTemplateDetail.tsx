import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArrowLeft, Plus, Trash2, ShieldCheck, Archive, GitBranch, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const ITEM_TYPES = [
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "measurement", label: "Measurement (numeric)" },
  { value: "text", label: "Text answer" },
  { value: "photo_required", label: "Photo required" },
];
const SEVERITIES = ["minor", "major", "critical"] as const;
const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-muted text-muted-foreground",
  major: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-destructive/15 text-destructive",
};

export default function ChecklistTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const { canAuthorTemplates } = useUserRole();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<null | "approve" | "archive" | "newVersion" | "delete">(null);
  const [working, setWorking] = useState(false);

  const isReadOnly = !canAuthorTemplates || template?.status === "approved" || template?.status === "archived";

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: t } = await supabase.from("checklist_templates").select("*").eq("id", id).maybeSingle();
    setTemplate(t);
    if (t) {
      const [{ data: its }, { data: vs }] = await Promise.all([
        supabase.from("checklist_template_items").select("*").eq("template_id", id).order("sort_order"),
        supabase.from("checklist_templates").select("id, version, status, approved_at, created_at").eq("name", t.name).eq("organisation_id", t.organisation_id).order("version", { ascending: false }),
      ]);
      setItems(its ?? []);
      setVersions(vs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { if (profile) load(); }, [id, profile]);

  if (loading) return <PageLoader />;
  if (!template) return (
    <div className="space-y-4">
      <Link to="/checklist-templates" className="text-sm text-primary hover:underline">← Back to templates</Link>
      <p className="text-muted-foreground">Template not found.</p>
    </div>
  );

  const saveMeta = async (patch: any) => {
    const { error } = await supabase.from("checklist_templates").update(patch).eq("id", template.id);
    if (error) return toast.error(error.message);
    load();
  };

  const addItem = async () => {
    const order = items.length;
    const { error } = await supabase.from("checklist_template_items").insert({
      template_id: template.id,
      sort_order: order,
      text: "New item",
      item_type: "pass_fail",
      severity: "minor",
    });
    if (error) return toast.error(error.message);
    load();
  };

  const updateItem = async (itemId: string, patch: any) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("checklist_template_items").update(patch).eq("id", itemId);
    if (error) toast.error(error.message);
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("checklist_template_items").delete().eq("id", itemId);
    if (error) return toast.error(error.message);
    load();
  };

  const approve = async () => {
    setWorking(true);
    const { error } = await supabase
      .from("checklist_templates")
      .update({ status: "approved", approved_by: user?.id ?? null, approved_at: new Date().toISOString() })
      .eq("id", template.id);
    setWorking(false);
    setConfirmAction(null);
    if (error) return toast.error(error.message);
    toast.success("Template approved");
    load();
  };

  const archive = async () => {
    setWorking(true);
    const { error } = await supabase.from("checklist_templates").update({ status: "archived" }).eq("id", template.id);
    setWorking(false);
    setConfirmAction(null);
    if (error) return toast.error(error.message);
    toast.success("Template archived");
    load();
  };

  const newVersion = async () => {
    setWorking(true);
    const newPayload = {
      organisation_id: template.organisation_id,
      name: template.name,
      description: template.description,
      machine_category: template.machine_category,
      machine_id: template.machine_id,
      version: template.version + 1,
      parent_template_id: template.id,
      status: "draft" as const,
      created_by: user?.id ?? null,
    };
    const { data: newT, error } = await supabase.from("checklist_templates").insert(newPayload).select().single();
    if (error || !newT) { setWorking(false); setConfirmAction(null); return toast.error(error?.message ?? "Failed"); }
    // Clone items
    if (items.length > 0) {
      const cloned = items.map((i) => ({
        template_id: newT.id,
        sort_order: i.sort_order,
        text: i.text,
        item_type: i.item_type,
        min_value: i.min_value,
        max_value: i.max_value,
        unit: i.unit,
        severity: i.severity,
      }));
      await supabase.from("checklist_template_items").insert(cloned);
    }
    setWorking(false);
    setConfirmAction(null);
    toast.success(`Created v${newT.version} draft`);
    navigate(`/checklist-templates/${newT.id}`);
  };

  const remove = async () => {
    setWorking(true);
    const { error } = await supabase.from("checklist_templates").delete().eq("id", template.id);
    setWorking(false);
    setConfirmAction(null);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate("/checklist-templates");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/checklist-templates" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Templates
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">v{template.version}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${template.status === "approved" ? "bg-primary/15 text-primary" : template.status === "archived" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
              {template.status}
            </span>
            {isReadOnly && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {template.machine_category ? `Category: ${template.machine_category}` : template.machine_id ? "Specific machine" : "Any machine"}
            {template.approved_at && ` · Approved ${formatDate(template.approved_at)}`}
          </p>
        </div>
        {canAuthorTemplates && (
          <div className="flex flex-wrap gap-2">
            {template.status === "draft" && (
              <Button onClick={() => setConfirmAction("approve")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Approve
              </Button>
            )}
            {template.status === "approved" && (
              <Button onClick={() => setConfirmAction("newVersion")}>
                <GitBranch className="mr-2 h-4 w-4" /> New version
              </Button>
            )}
            {template.status !== "archived" && (
              <Button variant="outline" onClick={() => setConfirmAction("archive")}>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </Button>
            )}
            {template.status === "draft" && (
              <Button variant="outline" onClick={() => setConfirmAction("delete")}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metadata edit */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Description</h2>
        {isReadOnly ? (
          <p className="text-sm text-muted-foreground">{template.description || "—"}</p>
        ) : (
          <Textarea
            rows={2}
            defaultValue={template.description ?? ""}
            onBlur={(e) => e.target.value !== (template.description ?? "") && saveMeta({ description: e.target.value })}
            placeholder="Short description of what this template checks"
          />
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Checklist items ({items.length})</h2>
          {!isReadOnly && <Button size="sm" onClick={addItem}><Plus className="mr-1 h-4 w-4" /> Add item</Button>}
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No items yet.
          </div>
        ) : (
          <ol className="space-y-2">
            {items.map((it, idx) => (
              <li key={it.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{idx + 1}</span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      {isReadOnly ? (
                        <p className="text-sm font-medium">{it.text}</p>
                      ) : (
                        <Input
                          defaultValue={it.text}
                          onBlur={(e) => e.target.value !== it.text && updateItem(it.id, { text: e.target.value })}
                          placeholder="Item question / instruction"
                        />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <select
                        value={it.item_type}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(it.id, { item_type: e.target.value })}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-70"
                      >
                        {ITEM_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Severity</Label>
                      <select
                        value={it.severity}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(it.id, { severity: e.target.value })}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-70"
                      >
                        {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {it.item_type === "measurement" && (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Min</Label>
                            <Input type="number" disabled={isReadOnly} defaultValue={it.min_value ?? ""} onBlur={(e) => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              if (v !== it.min_value) updateItem(it.id, { min_value: v });
                            }} />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Max</Label>
                            <Input type="number" disabled={isReadOnly} defaultValue={it.max_value ?? ""} onBlur={(e) => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              if (v !== it.max_value) updateItem(it.id, { max_value: v });
                            }} />
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs text-muted-foreground">Unit</Label>
                          <Input disabled={isReadOnly} defaultValue={it.unit ?? ""} placeholder="e.g. psi, °C, mm" onBlur={(e) => e.target.value !== (it.unit ?? "") && updateItem(it.id, { unit: e.target.value || null })} />
                        </div>
                      </>
                    )}
                    <div className="sm:col-span-2">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${SEVERITY_COLORS[it.severity]}`}>
                        {it.severity}
                      </span>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {versions.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Version history</h2>
          <ol className="space-y-1.5 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <Link
                  to={`/checklist-templates/${v.id}`}
                  className={`flex items-center gap-2 hover:text-primary ${v.id === template.id ? "font-semibold" : "text-muted-foreground"}`}
                >
                  <span>v{v.version}</span>
                  <span className="text-xs capitalize">· {v.status}</span>
                  {v.approved_at && <span className="text-xs">· {formatDate(v.approved_at)}</span>}
                </Link>
                {v.id === template.id && <span className="text-xs text-muted-foreground">current</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === "approve"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title="Approve this template?"
        description="Once approved, items become read-only. Create a new version to edit."
        onConfirm={async () => { await approve(); }}
      />
      <ConfirmDialog
        open={confirmAction === "archive"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title="Archive this template?"
        description="Archived templates can no longer be used for new inspections."
        onConfirm={async () => { await archive(); }}
      />
      <ConfirmDialog
        open={confirmAction === "newVersion"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title={`Create v${template.version + 1} draft?`}
        description="A new draft will be created with a copy of these items. The current approved version stays in use."
        onConfirm={async () => { await newVersion(); }}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title="Delete this draft?"
        description="This cannot be undone."
        onConfirm={async () => { await remove(); }}
      />
    </div>
  );
}
