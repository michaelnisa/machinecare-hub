import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Check, CheckCircle2, ClipboardList, History, Loader2, Lock, Pencil, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";

interface Item {
  id: string;
  machine_id: string;
  title: string;
  description: string | null;
  applies_to: string;
  interval_days: number | null;
  interval_hours: number | null;
  sort_order: number;
  created_by: string | null;
}

interface Completion {
  id: string;
  checklist_item_id: string;
  completed_at: string;
  completed_by: string | null;
  completed_by_name: string | null;
  hours_at_completion: number | null;
  notes: string | null;
}

function useAppliesOptions() {
  const { t } = useI18n();
  return [
    { value: "any", label: t.checklist.anyService },
    { value: "small", label: t.checklist.smallService },
    { value: "major", label: t.checklist.majorService },
    { value: "inspection", label: t.checklist.inspection },
  ];
}

interface Props {
  machineId: string;
  /** Compact = mobile / QR view: hide management UI by default and show only "Tick to complete". */
  compact?: boolean;
  /** Optional: filter by service type (small/major/inspection). 'any' items are always shown. */
  filter?: string;
}

export function MachineChecklist({ machineId, compact = false, filter }: Props) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const APPLIES_OPTIONS = useAppliesOptions();
  const [items, setItems] = useState<Item[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<Item | null>(null);

  const load = async () => {
    setLoading(true);
    const [iRes, cRes, pRes] = await Promise.all([
      supabase.from("machine_checklist_items").select("*").eq("machine_id", machineId).order("sort_order").order("created_at"),
      supabase.from("checklist_completions").select("*").eq("machine_id", machineId).order("completed_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setItems((iRes.data as Item[]) ?? []);
    setCompletions((cRes.data as Completion[]) ?? []);
    const map: Record<string, string> = {};
    (pRes.data ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
    setProfilesMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [machineId]);

  const lastDoneFor = (itemId: string) => completions.find((c) => c.checklist_item_id === itemId);
  const visibleItems = filter && filter !== "any"
    ? items.filter((i) => i.applies_to === "any" || i.applies_to === filter)
    : items;

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("machine_checklist_items").delete().eq("id", confirmDelete);
    if (error) { toast.error(error.message); return; }
    toast.success(t.checklist.taskRemoved);
    setConfirmDelete(null);
    load();
  };

  const completeTask = async (item: Item, notes: string, completedByName: string, hours: string): Promise<void> => {
    const payload: any = {
      checklist_item_id: item.id,
      machine_id: item.machine_id,
      completed_by: user?.id ?? null,
      completed_by_name: completedByName.trim() || profile?.full_name || "Unknown",
      notes: notes.trim() || null,
      hours_at_completion: hours ? Number(hours) : null,
    };
    const { error } = await supabase.from("checklist_completions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(t.checklist.markedComplete);
    setCompleteFor(null);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.common.loading}</div>;
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t.checklist.title}</h3>
            <p className="text-xs text-muted-foreground">{t.checklist.subtitle}</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t.checklist.addTask}
          </Button>
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.checklist.empty}</p>
          {!compact && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> {t.checklist.addFirst}
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleItems.map((item) => {
            const last = lastDoneFor(item.id);
            const isMine = item.created_by === user?.id;
            const interval = [item.interval_days ? `${item.interval_days} d` : null, item.interval_hours ? `${item.interval_hours} hr` : null].filter(Boolean).join(" / ");
            return (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${last ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {last ? <CheckCircle2 className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{APPLIES_OPTIONS.find((o) => o.value === item.applies_to)?.label ?? item.applies_to}</span>
                      {interval && <span className="text-[11px] text-muted-foreground">· {interval}</span>}
                      {!isMine && !compact && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title={t.checklist.ownerLockHint}>
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                    {last && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary" />
                        <span>{t.checklist.lastDone} {formatDate(last.completed_at)}</span>
                        <span>·</span>
                        <User className="h-3.5 w-3.5" />
                        <span>{last.completed_by_name ?? (last.completed_by ? profilesMap[last.completed_by] : "—")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button size="sm" onClick={() => setCompleteFor(item)}>
                      <Check className="mr-1 h-4 w-4" /> {t.checklist.done}
                    </Button>
                    {!compact && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setHistoryFor(item)} title={t.checklist.historyTitle}>
                          <History className="h-4 w-4" />
                        </Button>
                        {isMine && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setFormOpen(true); }} title={t.common.edit}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(item.id)} title={t.common.delete}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} machineId={machineId} item={editing} userId={user?.id ?? null} onSaved={load} />
      <CompleteDialog open={!!completeFor} onOpenChange={(v) => !v && setCompleteFor(null)} item={completeFor} defaultName={profile?.full_name ?? ""} onConfirm={completeTask} />
      <HistoryDialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)} item={historyFor} completions={completions.filter((c) => c.checklist_item_id === historyFor?.id)} profilesMap={profilesMap} />
      <ConfirmDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)} title={t.checklist.removeTitle} description={t.checklist.removeDesc} onConfirm={async () => { await handleDelete(); }} />
    </div>
  );
}

function TaskFormDialog({ open, onOpenChange, machineId, item, userId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; machineId: string; item: Item | null; userId: string | null; onSaved: () => void }) {
  const { t } = useI18n();
  const APPLIES_OPTIONS = useAppliesOptions();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [appliesTo, setAppliesTo] = useState("any");
  const [intervalDays, setIntervalDays] = useState("");
  const [intervalHours, setIntervalHours] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setDescription(item?.description ?? "");
      setAppliesTo(item?.applies_to ?? "any");
      setIntervalDays(item?.interval_days?.toString() ?? "");
      setIntervalHours(item?.interval_hours?.toString() ?? "");
    }
  }, [open, item]);

  const submit = async () => {
    if (!title.trim()) return toast.error(t.checklist.titleRequired);
    setSaving(true);
    const basePayload: any = {
      machine_id: machineId,
      title: title.trim(),
      description: description.trim() || null,
      applies_to: appliesTo,
      interval_days: intervalDays ? parseInt(intervalDays, 10) : null,
      interval_hours: intervalHours ? Number(intervalHours) : null,
    };
    const { error } = item
      ? await supabase.from("machine_checklist_items").update(basePayload).eq("id", item.id)
      : await supabase.from("machine_checklist_items").insert({ ...basePayload, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(item ? t.checklist.taskUpdated : t.checklist.taskAdded);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? t.common.edit : t.checklist.addTask}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ct-title">{t.checklist.task} *</Label>
            <Input id="ct-title" placeholder="e.g. Change engine oil" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-desc">{t.checklist.instructions}</Label>
            <Textarea id="ct-desc" rows={3} placeholder="Optional details, parts, or steps" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-applies">{t.checklist.appliesTo}</Label>
            <select id="ct-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {APPLIES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-days">{t.checklist.everyDays}</Label>
              <Input id="ct-days" type="number" min={0} placeholder="e.g. 90" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-hours">{t.checklist.everyHours}</Label>
              <Input id="ct-hours" type="number" min={0} placeholder="e.g. 250" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ open, onOpenChange, item, defaultName, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; item: Item | null; defaultName: string; onConfirm: (item: Item, notes: string, name: string, hours: string) => Promise<void> | void }) {
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setNotes(""); setName(defaultName); setHours(""); }
  }, [open, defaultName]);

  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirm task complete</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{item.title}</p>
            {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-name">Done by *</Label>
            <Input id="cd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Technician name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-hours">Hours / km at completion</Label>
            <Input id="cd-hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-notes">Notes</Label>
            <Textarea id="cd-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — what was done, parts used, observations" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => { setSaving(true); await onConfirm(item, notes, name, hours); setSaving(false); }}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Confirm complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ open, onOpenChange, item, completions, profilesMap }: { open: boolean; onOpenChange: (v: boolean) => void; item: Item | null; completions: Completion[]; profilesMap: Record<string, string> }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>History — {item.title}</DialogTitle></DialogHeader>
        {completions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No completions yet.</p>
        ) : (
          <ol className="max-h-[60vh] space-y-2 overflow-y-auto">
            {completions.map((c) => (
              <li key={c.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.completed_by_name ?? (c.completed_by ? profilesMap[c.completed_by] : "—")}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.completed_at)}</span>
                </div>
                {c.hours_at_completion != null && <p className="mt-1 text-xs text-muted-foreground">At {c.hours_at_completion} hrs/km</p>}
                {c.notes && <p className="mt-2 text-xs">{c.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
