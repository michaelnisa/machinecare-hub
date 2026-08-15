import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/PageLoader";
import { AlertTriangle, Phone, ExternalLink, CheckCircle2, ClipboardPlus, Image as ImageIcon, ClipboardCheck, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  machine_id: string;
  organisation_id: string;
  reporter_name: string;
  reporter_phone: string;
  description: string;
  status: string;
  severity: string;
  photo_url: string | null;
  dismiss_reason: string | null;
  duplicate_of: string | null;
  source_execution_id: string | null;
  work_order_id: string | null;
  created_at: string;
  machine?: { id: string; name: string; registration_number: string | null } | null;
};

const STATUS_VARIANTS: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  triaged: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  converted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  dismissed: "bg-muted text-muted-foreground",
  duplicate: "bg-muted text-muted-foreground line-through",
};

const SEVERITY_VARIANTS: Record<string, string> = {
  minor: "bg-muted text-muted-foreground",
  major: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-destructive/15 text-destructive",
};

const SEVERITY_TO_PRIORITY: Record<string, string> = {
  minor: "normal",
  major: "high",
  critical: "urgent",
};

export default function FaultReports() {
  const { profile, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open">("open");
  const [dismissTarget, setDismissTarget] = useState<Row | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [duplicateTarget, setDuplicateTarget] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("fault_reports")
      .select("*, machine:machines(id, name, registration_number)")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = filter === "open" ? rows.filter((r) => r.status === "new" || r.status === "triaged") : rows;

  // Possible duplicates: same machine, both still open (new/triaged), reported within 48h of each other.
  const possibleDuplicateCount = useMemo(() => {
    const counts: Record<string, number> = {};
    const openRows = rows.filter((r) => (r.status === "new" || r.status === "triaged"));
    for (const r of openRows) {
      const windowMs = 48 * 60 * 60 * 1000;
      const t = new Date(r.created_at).getTime();
      const similar = openRows.filter(
        (o) => o.id !== r.id && o.machine_id === r.machine_id && Math.abs(new Date(o.created_at).getTime() - t) <= windowMs,
      );
      counts[r.id] = similar.length;
    }
    return counts;
  }, [rows]);

  const openCandidatesFor = (r: Row) =>
    rows.filter((o) => o.id !== r.id && o.machine_id === r.machine_id && (o.status === "new" || o.status === "triaged"));

  const openPhoto = async (path: string, rowId: string) => {
    if (photoUrls[rowId]) return;
    const { data, error } = await supabase.storage.from("machine-docs").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return toast.error("Could not load photo");
    setPhotoUrls((prev) => ({ ...prev, [rowId]: data.signedUrl }));
  };

  const triage = async (r: Row) => {
    setBusyId(r.id);
    const { error } = await (supabase as any).from("fault_reports").update({ status: "triaged" }).eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Marked as triaged");
    load();
  };

  const convertToWO = async (r: Row) => {
    if (!profile) return;
    setBusyId(r.id);
    const { data: wo, error } = await supabase
      .from("work_orders")
      .insert({
        organisation_id: r.organisation_id,
        machine_id: r.machine_id,
        title: `Fault: ${r.description.slice(0, 80)}`,
        description: `Reported by ${r.reporter_name} (${r.reporter_phone})\n\n${r.description}`,
        priority: SEVERITY_TO_PRIORITY[r.severity] ?? "high",
        status: "open",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setBusyId(null);
    if (error || !wo) return toast.error(error?.message ?? "Failed");
    await (supabase as any).from("fault_reports").update({ status: "converted", work_order_id: wo.id }).eq("id", r.id);
    toast.success("Work order created");
    load();
  };

  const confirmDismiss = async () => {
    if (!dismissTarget) return;
    setBusyId(dismissTarget.id);
    const { error } = await (supabase as any)
      .from("fault_reports")
      .update({ status: "dismissed", dismiss_reason: dismissReason.trim() || null })
      .eq("id", dismissTarget.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Dismissed");
    setDismissTarget(null);
    setDismissReason("");
    load();
  };

  const markDuplicate = async (primaryId: string) => {
    if (!duplicateTarget) return;
    setBusyId(duplicateTarget.id);
    const { error } = await (supabase as any)
      .from("fault_reports")
      .update({ status: "duplicate", duplicate_of: primaryId })
      .eq("id", duplicateTarget.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Linked as duplicate");
    setDuplicateTarget(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Fault reports
          </h1>
          <p className="text-sm text-muted-foreground">Submitted via QR scan, in-app, or auto-raised from a failed pre-start inspection</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>Open</Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No fault reports {filter === "open" ? "open" : "yet"}.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const dupCount = possibleDuplicateCount[r.id] ?? 0;
            const isBusy = busyId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/machines/${r.machine_id}`} className="font-semibold hover:underline">
                        {r.machine?.name ?? "Machine"}
                      </Link>
                      {r.machine?.registration_number && (
                        <span className="text-xs text-muted-foreground">· {r.machine.registration_number}</span>
                      )}
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_VARIANTS[r.status] ?? "")}>
                        {r.status}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", SEVERITY_VARIANTS[r.severity] ?? "")}>
                        {r.severity}
                      </span>
                      {r.source_execution_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
                          <ClipboardCheck className="h-3 w-3" /> Auto: pre-start inspection
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">QR / Manual</span>
                      )}
                      {dupCount > 0 && (r.status === "new" || r.status === "triaged") && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                          <Layers className="h-3 w-3" /> {dupCount} possible duplicate{dupCount > 1 ? "s" : ""} on this machine
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{r.description}</p>
                    {r.photo_url && (
                      <div className="mt-2">
                        {photoUrls[r.id] ? (
                          <a href={photoUrls[r.id]} target="_blank" rel="noopener noreferrer">
                            <img src={photoUrls[r.id]} alt="Fault photo" className="h-28 w-28 rounded-lg border border-border object-cover" />
                          </a>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openPhoto(r.photo_url!, r.id)}>
                            <ImageIcon className="mr-1 h-4 w-4" /> View photo
                          </Button>
                        )}
                      </div>
                    )}
                    {r.status === "dismissed" && r.dismiss_reason && (
                      <p className="mt-2 text-xs italic text-muted-foreground">Dismissed: {r.dismiss_reason}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{r.reporter_name}</span>
                      <a href={`tel:${r.reporter_phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3 w-3" /> {r.reporter_phone}
                      </a>
                      <span>· {format(new Date(r.created_at), "d MMM yy HH:mm")}</span>
                      {r.work_order_id && (
                        <Link to="/work-orders" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Linked WO
                        </Link>
                      )}
                    </div>
                  </div>
                  {(r.status === "new" || r.status === "triaged") && (
                    <div className="flex shrink-0 flex-col gap-2">
                      {r.status === "new" && (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => triage(r)}>
                          {isBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1 h-4 w-4" />} Triage
                        </Button>
                      )}
                      <Button size="sm" disabled={isBusy} onClick={() => convertToWO(r)}>
                        <ClipboardPlus className="mr-1 h-4 w-4" /> Create WO
                      </Button>
                      {dupCount > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setDuplicateTarget(r)}>
                          <Layers className="mr-1 h-4 w-4" /> Mark duplicate
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setDismissTarget(r); setDismissReason(""); }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!dismissTarget} onOpenChange={(v) => !v && setDismissTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dismiss this report?</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional, but helps if it comes up again)</Label>
            <Textarea rows={3} value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} placeholder="e.g. Not reproducible, already fixed, false report…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissTarget(null)}>Cancel</Button>
            <Button onClick={confirmDismiss} disabled={busyId === dismissTarget?.id}>
              {busyId === dismissTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duplicateTarget} onOpenChange={(v) => !v && setDuplicateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Which report is this a duplicate of?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {duplicateTarget && openCandidatesFor(duplicateTarget).map((c) => (
              <button
                key={c.id}
                onClick={() => markDuplicate(c.id)}
                className="w-full rounded-lg border border-border p-3 text-left text-sm hover:border-primary/40"
              >
                <div className="font-medium">{c.description.slice(0, 100)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.reporter_name} · {format(new Date(c.created_at), "d MMM yy HH:mm")}</div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicateTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
