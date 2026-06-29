import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GraduationCap, Plus, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Programme = {
  id: string;
  name: string;
  inductee_type: "employee" | "contractor" | "visitor";
  description: string | null;
  pass_mark_percent: number;
  validity_days: number | null;
  is_active: boolean;
  created_at: string;
};

const TYPES = ["employee", "contractor", "visitor"] as const;

export default function InductionProgrammes() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Programme[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programme | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    inductee_type: "employee" as Programme["inductee_type"],
    description: "",
    pass_mark_percent: 80,
    validity_days: "" as string,
    is_active: true,
  });

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("induction_programmes")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Programme[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", inductee_type: "employee", description: "", pass_mark_percent: 80, validity_days: "", is_active: true });
    setOpen(true);
  };
  const openEdit = (p: Programme) => {
    setEditing(p);
    setForm({
      name: p.name,
      inductee_type: p.inductee_type,
      description: p.description ?? "",
      pass_mark_percent: p.pass_mark_percent,
      validity_days: p.validity_days?.toString() ?? "",
      is_active: p.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!profile) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload: any = {
      organisation_id: profile.organisation_id,
      name: form.name.trim(),
      inductee_type: form.inductee_type,
      description: form.description.trim() || null,
      pass_mark_percent: Number(form.pass_mark_percent) || 80,
      validity_days: form.validity_days ? Number(form.validity_days) : null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("induction_programmes").update(payload).eq("id", editing.id)
      : await supabase.from("induction_programmes").insert({ ...payload, created_by: profile.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? t.induction.programmeUpdated : t.induction.programmeCreated);
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!removeId) return;
    const { error } = await supabase.from("induction_programmes").delete().eq("id", removeId);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.programmeRemoved);
    setRemoveId(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.induction.programmes}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.induction.programmesSub}</p>
        </div>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.induction.newProgramme}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title={t.induction.empty}
          action={isManager ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t.induction.newProgramme}</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/induction/programmes/${p.id}`} className="block truncate text-base font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{t.induction.typeBadge[p.inductee_type]}</Badge>
                    {p.is_active ? (
                      <Badge className="bg-primary-soft text-primary">{t.induction.active}</Badge>
                    ) : (
                      <Badge variant="outline">{t.induction.inactive}</Badge>
                    )}
                  </div>
                </div>
                {isManager && (
                  <Button variant="ghost" size="icon" onClick={() => setRemoveId(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">{p.pass_mark_percent}%</span> {t.induction.passMark.toLowerCase()}</div>
                <div>
                  {p.validity_days ? <><span className="font-medium text-foreground">{p.validity_days}d</span> {t.induction.validityDays.toLowerCase()}</> : t.induction.noExpiry}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{formatDate(p.created_at)}</span>
                <div className="flex items-center gap-2">
                  {isManager && <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>{t.common.edit}</Button>}
                  <Link to={`/induction/programmes/${p.id}`} className="inline-flex items-center text-primary hover:underline">
                    Open <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.induction.newProgramme}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.induction.programmeName}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.induction.inducteeType}</Label>
                <Select value={form.inductee_type} onValueChange={(v: any) => setForm({ ...form, inductee_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>{t.induction.typeBadge[tp]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.induction.passMark}</Label>
                <Input type="number" min={0} max={100} value={form.pass_mark_percent} onChange={(e) => setForm({ ...form, pass_mark_percent: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.induction.validityDays}</Label>
                <Input type="number" placeholder={t.induction.noExpiry} value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">{form.is_active ? t.induction.active : t.induction.inactive}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.induction.description}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(v) => !v && setRemoveId(null)}
        title={t.induction.removeProgrammeTitle}
        description={t.induction.removeProgrammeDesc}
        onConfirm={remove}
      />
    </div>
  );
}
