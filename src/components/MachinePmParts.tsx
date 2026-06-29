import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Lock, Loader2, Package, Pencil, Plus, Trash2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

interface PmPart {
  id: string;
  machine_id: string;
  checklist_item_id: string | null;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  created_by: string | null;
}

interface ChecklistItem {
  id: string;
  title: string;
}

interface Props {
  machineId: string;
  /** When true, hides management buttons (used by mobile/QR view). Always read-only there. */
  compact?: boolean;
}

export function MachinePmParts({ machineId, compact = false }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<PmPart[]>([]);
  const [tasks, setTasks] = useState<ChecklistItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PmPart | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [pRes, tRes, profRes] = await Promise.all([
      supabase
        .from("machine_pm_parts" as any)
        .select("*")
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false }),
      supabase
        .from("machine_checklist_items")
        .select("id,title")
        .eq("machine_id", machineId)
        .order("sort_order"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setItems(((pRes.data as any) ?? []) as PmPart[]);
    setTasks((tRes.data as ChecklistItem[]) ?? []);
    const map: Record<string, string> = {};
    (profRes.data ?? []).forEach((p: any) => {
      map[p.id] = p.full_name ?? "—";
    });
    setProfilesMap(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [machineId]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("machine_pm_parts" as any).delete().eq("id", confirmDelete);
    if (error) return toast.error(error.message);
    toast.success(t.pmParts.removed);
    setConfirmDelete(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.common.loading}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t.pmParts.title}</h3>
            <p className="text-xs text-muted-foreground">{t.pmParts.subtitle}</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t.pmParts.addPart}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.pmParts.empty}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const isMine = p.created_by === user?.id;
            const linked = tasks.find((t) => t.id === p.checklist_item_id);
            return (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.part_name}</p>
                      {p.part_number && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {p.part_number}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {p.quantity} {p.unit}
                      </span>
                      {linked && (
                        <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                          → {linked.title}
                        </span>
                      )}
                    </div>
                    {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <UserIcon className="h-3 w-3" />
                      {p.created_by ? profilesMap[p.created_by] ?? "—" : "—"}
                      {!isMine && <Lock className="ml-1 h-3 w-3" />}
                    </div>
                  </div>
                  {!compact && isMine && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }} title={t.common.edit}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p.id)} title={t.common.delete}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PartForm
        open={formOpen}
        onOpenChange={setFormOpen}
        machineId={machineId}
        item={editing}
        tasks={tasks}
        userId={user?.id ?? null}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title={t.pmParts.removeTitle}
        description={t.pmParts.removeDesc}
        onConfirm={async () => { await handleDelete(); }}
      />
    </div>
  );
}

function PartForm({
  open,
  onOpenChange,
  machineId,
  item,
  tasks,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  item: PmPart | null;
  tasks: ChecklistItem[];
  userId: string | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [linked, setLinked] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(item?.part_name ?? "");
      setNumber(item?.part_number ?? "");
      setQty(item?.quantity?.toString() ?? "1");
      setUnit(item?.unit ?? "pcs");
      setLinked(item?.checklist_item_id ?? "");
      setNotes(item?.notes ?? "");
    }
  }, [open, item]);

  const submit = async () => {
    if (!name.trim()) return toast.error(t.pmParts.partName);
    setSaving(true);
    const payload: any = {
      machine_id: machineId,
      part_name: name.trim(),
      part_number: number.trim() || null,
      quantity: Number(qty) || 1,
      unit: unit.trim() || "pcs",
      checklist_item_id: linked || null,
      notes: notes.trim() || null,
    };
    if (!item) payload.created_by = userId;
    const { error } = item
      ? await supabase.from("machine_pm_parts" as any).update(payload).eq("id", item.id)
      : await supabase.from("machine_pm_parts" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(item ? t.pmParts.updated : t.pmParts.added);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? t.common.edit : t.pmParts.addPart}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pp-name">{t.pmParts.partName} *</Label>
            <Input id="pp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engine oil 5W-30" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pp-num">{t.pmParts.partNumber}</Label>
              <Input id="pp-num" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="pp-qty">{t.pmParts.quantity}</Label>
                <Input id="pp-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-unit">{t.pmParts.unit}</Label>
                <Input id="pp-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs / L / kg" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-link">{t.pmParts.linkedTask}</Label>
            <select
              id="pp-link"
              value={linked}
              onChange={(e) => setLinked(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t.pmParts.none}</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-notes">{t.pmParts.notes ?? "Notes"}</Label>
            <Textarea id="pp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
