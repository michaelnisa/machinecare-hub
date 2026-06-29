import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserCheck, Plus, Trash2, Loader2, Search, Play } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Inductee = {
  id: string;
  full_name: string;
  inductee_type: "employee" | "contractor" | "visitor";
  company: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  id_number: string | null;
  created_at: string;
};
type Programme = { id: string; name: string; inductee_type: string; is_active: boolean };
type RecordRow = { id: string; inductee_id: string; programme_id: string; status: string; expires_at: string | null; completed_at: string | null };

const TYPES = ["employee", "contractor", "visitor"] as const;

export default function InductionInductees() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const { t } = useI18n();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inductee[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Inductee | null>(null);
  const [assignProgrammeId, setAssignProgrammeId] = useState<string>("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: "", inductee_type: "employee" as Inductee["inductee_type"],
    company: "", department: "", email: "", phone: "", id_number: "",
  });

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: ind }, { data: progs }, { data: recs }] = await Promise.all([
      supabase.from("inductees").select("*").eq("organisation_id", profile.organisation_id).order("created_at", { ascending: false }),
      supabase.from("induction_programmes").select("id,name,inductee_type,is_active").eq("organisation_id", profile.organisation_id).eq("is_active", true).order("name"),
      supabase.from("induction_records").select("id,inductee_id,programme_id,status,expires_at,completed_at").eq("organisation_id", profile.organisation_id),
    ]);
    setItems((ind ?? []) as Inductee[]);
    setProgrammes((progs ?? []) as Programme[]);
    setRecords((recs ?? []) as RecordRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const openCreate = () => {
    setForm({ full_name: "", inductee_type: "employee", company: "", department: "", email: "", phone: "", id_number: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!profile) return;
    if (!form.full_name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.from("inductees").insert({
      organisation_id: profile.organisation_id,
      full_name: form.full_name.trim(),
      inductee_type: form.inductee_type,
      company: form.company.trim() || null,
      department: form.department.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      id_number: form.id_number.trim() || null,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t.induction.inducteeCreated);
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!removeId) return;
    const { error } = await supabase.from("inductees").delete().eq("id", removeId);
    if (error) { toast.error(error.message); return; }
    toast.success(t.induction.inducteeRemoved);
    setRemoveId(null);
    load();
  };

  const assign = async () => {
    if (!assignFor || !assignProgrammeId || !profile) return;
    setSaving(true);
    const { data, error } = await supabase.from("induction_records").insert({
      organisation_id: profile.organisation_id,
      inductee_id: assignFor.id,
      programme_id: assignProgrammeId,
      status: "in_progress",
      inducted_by: profile.id,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t.induction.programmeAssigned);
    setAssignFor(null);
    setAssignProgrammeId("");
    if (data?.id) nav(`/induction/run/${data.id}`);
  };

  const recordsFor = (inducteeId: string) => records.filter((r) => r.inductee_id === inducteeId);

  const filtered = items.filter((i) => {
    if (typeFilter !== "all" && i.inductee_type !== typeFilter) return false;
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [i.full_name, i.company, i.email, i.id_number].some((v) => v?.toLowerCase().includes(s));
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.induction.inductees}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.induction.inducteesSub}</p>
        </div>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t.induction.newInductee}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t.induction.fullName} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.induction.filterAll}</SelectItem>
            {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t.induction.typeBadge[tp]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-5 w-5" />}
          title={t.induction.noInductees}
          action={isManager ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t.induction.newInductee}</Button> : undefined}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.induction.fullName}</TableHead>
                <TableHead>{t.induction.inducteeType}</TableHead>
                <TableHead className="hidden md:table-cell">{t.induction.company}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const recs = recordsFor(i.id);
                const inProg = recs.find((r) => r.status === "in_progress");
                const completed = recs.filter((r) => r.status === "completed");
                const today = new Date();
                const expiredRec = completed.find((r) => r.expires_at && new Date(r.expires_at) < today);
                let statusLabel: string = t.induction.neverInducted;
                let statusClass = "bg-muted text-muted-foreground";
                if (inProg) { statusLabel = t.induction.inProgress; statusClass = "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200"; }
                else if (expiredRec) { statusLabel = t.induction.expired; statusClass = "bg-destructive/15 text-destructive"; }
                else if (completed.length > 0) { statusLabel = t.induction.passed; statusClass = "bg-primary-soft text-primary"; }
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.full_name}</div>
                      <div className="text-xs text-muted-foreground">{i.email ?? i.phone ?? i.id_number ?? "—"}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{t.induction.typeBadge[i.inductee_type]}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{i.company ?? "—"}</TableCell>
                    <TableCell><Badge className={statusClass}>{statusLabel}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {inProg ? (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => nav(`/induction/run/${inProg.id}`)}>
                            <Play className="h-3.5 w-3.5" /> {t.induction.resume}
                          </Button>
                        ) : (
                          isManager && (
                            <Button variant="outline" size="sm" onClick={() => { setAssignFor(i); setAssignProgrammeId(""); }}>
                              {t.induction.assignProgramme}
                            </Button>
                          )
                        )}
                        {isManager && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setRemoveId(i.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t.induction.newInductee}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.induction.fullName}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.induction.inducteeType}</Label>
                <Select value={form.inductee_type} onValueChange={(v: any) => setForm({ ...form, inductee_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t.induction.typeBadge[tp]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.induction.idNumber}</Label>
                <Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.induction.company}</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.induction.department}</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.induction.email}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.induction.phone}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
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

      <Dialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.induction.assignProgramme}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{assignFor?.full_name}</div>
            <Select value={assignProgrammeId} onValueChange={setAssignProgrammeId}>
              <SelectTrigger><SelectValue placeholder={t.induction.assignProgramme} /></SelectTrigger>
              <SelectContent>
                {programmes
                  .filter((p) => !assignFor || p.inductee_type === assignFor.inductee_type)
                  .map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignFor(null)}>{t.common.cancel}</Button>
            <Button onClick={assign} disabled={!assignProgrammeId || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.induction.startInduction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(v) => !v && setRemoveId(null)}
        title={t.induction.removeInducteeTitle}
        description={t.induction.removeInducteeDesc}
        onConfirm={remove}
      />
    </div>
  );
}
