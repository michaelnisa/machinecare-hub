import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CoverImage } from "@/components/CoverImage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  CATEGORY_ICONS,
  scheduleStatus,
  KNOWLEDGE_CATEGORIES,
} from "@/lib/machine-constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Wrench,
  Calendar,
  FileText,
  BookOpen,
  Activity,
  Trash2,
  Download,
  Image as ImageIcon,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { MachineFormDialog } from "@/components/MachineFormDialog";
import { ScheduleFormDialog } from "@/components/ScheduleFormDialog";
import { ServiceLogDialog } from "@/components/ServiceLogDialog";
import { KnowledgeFormDialog } from "@/components/KnowledgeFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { Link as RouterLink } from "react-router-dom";
import { MachineInspections } from "@/components/MachineInspections";
import { MachinePmParts } from "@/components/MachinePmParts";
import { MachineHealthStrip } from "@/components/MachineHealthStrip";
import { MachineStatusControl } from "@/components/MachineStatusControl";
import { useAuth } from "@/contexts/AuthContext";

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [parts, setParts] = useState<Record<string, any[]>>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ type: string; id: string } | null>(
    null,
  );
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [openKnowledge, setOpenKnowledge] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [m, s, l, d, k] = await Promise.all([
        supabase.from("machines").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("service_schedules")
          .select("*")
          .eq("machine_id", id)
          .order("next_due_date", { nullsFirst: false }),
        supabase
          .from("service_logs")
          .select("*")
          .eq("machine_id", id)
          .order("performed_at", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .eq("machine_id", id)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("knowledge_items")
          .select("*")
          .eq("machine_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (m.error) throw m.error;
      setMachine(m.data);
      setSchedules(s.data ?? []);
      setLogs(l.data ?? []);
      setDocs(d.data ?? []);
      setKnowledge(k.data ?? []);

      const logIds = (l.data ?? []).map((x: any) => x.id);
      if (logIds.length > 0) {
        const { data: pData } = await supabase
          .from("service_parts")
          .select("*")
          .in("service_log_id", logIds);
        const grouped: Record<string, any[]> = {};
        (pData ?? []).forEach((p: any) => {
          (grouped[p.service_log_id] ||= []).push(p);
        });
        setParts(grouped);
      } else {
        setParts({});
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [id, profile]);

  const generateWoFromSchedule = async (s: any) => {
    if (!profile) return;
    const { error } = await supabase.from("work_orders").insert({
      organisation_id: profile.organisation_id,
      machine_id: machine.id,
      schedule_id: s.id,
      title: `PM: ${s.name}`,
      description: `Scheduled ${s.service_type} service${s.next_due_date ? ` (due ${s.next_due_date})` : ""}.`,
      priority:
        scheduleStatus(s.next_due_date) === "overdue" ? "high" : "normal",
      status: "open",
      due_date: s.next_due_date,
    });
    if (error) return toast.error(error.message);
    toast.success("Work order created");
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const tableMap: Record<string, string> = {
      schedule: "service_schedules",
      log: "service_logs",
      doc: "documents",
      knowledge: "knowledge_items",
    };
    const { error } = await supabase
      .from(tableMap[confirm.type] as any)
      .delete()
      .eq("id", confirm.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;
  if (!machine)
    return (
      <div className="space-y-4">
        <Link to="/machines" className="text-sm text-primary hover:underline">
          ← Back to machines
        </Link>
        <p className="text-muted-foreground">Machine not found.</p>
      </div>
    );

  const Icon = CATEGORY_ICONS[machine.category] ?? CATEGORY_ICONS.Other;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/machines"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Machines
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {machine.name}
            </h1>
            <MachineStatusControl
              machineId={machine.id}
              status={machine.status}
              onChanged={load}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {[machine.make, machine.model, machine.year]
              .filter(Boolean)
              .join(" · ") || machine.category}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQrOpen(true)}>
            <QrCode className="mr-2 h-4 w-4" /> QR code
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      <MachineHealthStrip
        machineId={machine.id}
        currentHours={machine.current_hours}
        onChanged={load}
      />

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="pm-parts">Spare parts</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-1">
              <div className="flex aspect-video items-center justify-center bg-muted/40">
                <CoverImage
                  value={machine.cover_image_url}
                  alt={machine.name}
                  className="h-full w-full object-cover"
                  fallback={
                    <Icon className="h-12 w-12 text-muted-foreground" />
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="mb-4 font-semibold">Machine details</h2>
              <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                <Detail label="Category" value={machine.category} />
                <Detail label="Make" value={machine.make} />
                <Detail label="Model" value={machine.model} />
                <Detail label="Year" value={machine.year} />
                <Detail label="Serial number" value={machine.serial_number} />
                <Detail
                  label="Registration"
                  value={machine.registration_number}
                />
                <Detail
                  label="Purchase date"
                  value={formatDate(machine.purchase_date)}
                />
                <Detail
                  label="Current hours/km"
                  value={formatNumber(machine.current_hours)}
                />
                {machine.notes && (
                  <Detail
                    label="Notes"
                    value={machine.notes}
                    className="sm:col-span-2"
                  />
                )}
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inspections" className="mt-6">
          <MachineInspections
            machineId={machine.id}
            machineCategory={machine.category}
          />
        </TabsContent>

        <TabsContent value="pm-parts" className="mt-6">
          <MachinePmParts machineId={machine.id} />
        </TabsContent>

        <TabsContent value="schedules" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingSchedule(null);
                setScheduleOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add schedule
            </Button>
          </div>
          {schedules.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No schedules yet"
              description="Add intervals so you know when this machine is next due."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Schedule</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Interval</th>
                    <th className="px-5 py-3 font-medium">Last done</th>
                    <th className="px-5 py-3 font-medium">Next due</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => {
                    const status = scheduleStatus(s.next_due_date);
                    const interval =
                      [
                        s.interval_days ? `${s.interval_days} d` : null,
                        s.interval_hours ? `${s.interval_hours} hr` : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—";
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-5 py-3 font-medium">{s.name}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {s.service_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {interval}
                        </td>
                        <td className="px-5 py-3">
                          {formatDate(s.last_service_date)}
                        </td>
                        <td className="px-5 py-3">
                          {formatDate(s.next_due_date)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateWoFromSchedule(s)}
                            title="Generate work order"
                          >
                            <Wrench className="mr-1 h-4 w-4" /> Generate WO
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingSchedule(s);
                              setScheduleOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setConfirm({ type: "schedule", id: s.id })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setLogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Log a service
            </Button>
          </div>
          {logs.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No service history yet"
              description="Log a service to start building this machine's history."
            />
          ) : (
            <ol className="space-y-3">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{l.title}</h3>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {l.service_type}
                        </span>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(l.performed_at)} · By{" "}
                        {l.performed_by ?? "—"}{" "}
                        {l.hours_at_service
                          ? `· ${formatNumber(l.hours_at_service)} hrs/km`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatMoney(l.cost, l.currency ?? "TZS")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOpenLog(openLog === l.id ? null : l.id)
                        }
                      >
                        {openLog === l.id ? "Hide" : "View details"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirm({ type: "log", id: l.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {openLog === l.id && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                      {l.description && (
                        <p className="text-muted-foreground">{l.description}</p>
                      )}
                      {parts[l.id]?.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium">Parts used</h4>
                          <div className="overflow-hidden rounded-md border border-border">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Part
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Qty
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Type
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Supplier
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium">
                                    Unit cost
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {parts[l.id].map((p) => (
                                  <tr
                                    key={p.id}
                                    className="border-t border-border"
                                  >
                                    <td className="px-3 py-2">
                                      <div className="font-medium">
                                        {p.part_name}
                                      </div>
                                      {p.part_number && (
                                        <div className="text-muted-foreground">
                                          {p.part_number}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {formatNumber(p.quantity)} {p.unit}
                                    </td>
                                    <td className="px-3 py-2 capitalize">
                                      {p.part_type}
                                    </td>
                                    <td className="px-3 py-2">
                                      {p.supplier ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {formatMoney(
                                        p.unit_cost,
                                        l.currency ?? "TZS",
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <UploadButton
              machineId={machine.id}
              orgId={profile!.organisation_id}
              onDone={load}
            />
          </div>
          {docs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No documents"
              description="Upload receipts, manuals or photos for this machine."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {docs.map((d) => (
                <a
                  key={d.id}
                  href={d.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:border-primary/40"
                >
                  <div className="flex h-32 items-center justify-center bg-muted/40">
                    {d.file_type === "image" ? (
                      <img
                        src={d.file_url}
                        alt={d.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 text-xs">
                    <span className="truncate">{d.name}</span>
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingKnowledge(null);
                setKnowledgeOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add knowledge item
            </Button>
          </div>
          {knowledge.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="No knowledge yet"
              description="Capture procedures, safety notes and specs for this machine."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {knowledge.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setOpenKnowledge(k)}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
                >
                  <span className="w-fit rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium capitalize text-primary">
                    {k.category}
                  </span>
                  <h3 className="font-semibold">{k.title}</h3>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {k.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MachineFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        machine={machine}
        onSaved={load}
      />
      <ScheduleFormDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        machineId={machine.id}
        schedule={editingSchedule}
        onSaved={load}
      />
      <ServiceLogDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        machines={[{ id: machine.id, name: machine.name }]}
        defaultMachineId={machine.id}
        onSaved={load}
      />
      <KnowledgeFormDialog
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
        machineId={machine.id}
        item={editingKnowledge}
        onSaved={load}
      />
      <MachineQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        machineId={machine.id}
        machineName={machine.name}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this item?"
        description="This action cannot be undone."
        onConfirm={async () => {
          await handleDelete();
        }}
      />

      {/* Knowledge view dialog */}
      {openKnowledge && (
        <KnowledgeView
          item={openKnowledge}
          onClose={() => setOpenKnowledge(null)}
          onEdit={() => {
            setEditingKnowledge(openKnowledge);
            setOpenKnowledge(null);
            setKnowledgeOpen(true);
          }}
          onDelete={() => {
            setConfirm({ type: "knowledge", id: openKnowledge.id });
            setOpenKnowledge(null);
          }}
        />
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  className = "",
}: {
  label: string;
  value: any;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function UploadButton({
  machineId,
  orgId,
  onDone,
}: {
  machineId: string;
  orgId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${orgId}/machines/${machineId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("machine-docs")
        .upload(path, file);
      if (error) {
        toast.error(`Failed: ${file.name}`);
        continue;
      }
      const { data: pub } = supabase.storage
        .from("machine-docs")
        .getPublicUrl(path);
      const fileType = file.type.startsWith("image/")
        ? "image"
        : file.type === "application/pdf"
          ? "pdf"
          : "document";
      await supabase
        .from("documents")
        .insert({
          machine_id: machineId,
          name: file.name,
          file_url: pub.publicUrl,
          file_type: fileType,
        });
    }
    setBusy(false);
    e.target.value = "";
    toast.success("Uploaded");
    onDone();
  };
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <ImageIcon className="h-4 w-4" />
      {busy ? "Uploading..." : "Upload files"}
      <input
        type="file"
        multiple
        className="hidden"
        disabled={busy}
        onChange={handle}
      />
    </label>
  );
}

function KnowledgeView({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: any;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium capitalize text-primary">
          {item.category}
        </span>
        <h2 className="mt-2 text-xl font-semibold">{item.title}</h2>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
          {item.content}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
