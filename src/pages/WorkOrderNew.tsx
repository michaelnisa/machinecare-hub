import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  MachineSearchSelect,
  type MachineOption,
} from "@/components/MachineSearchSelect";
import {
  WorkOrderPreview,
  formatWoNumber,
} from "@/components/WorkOrderPreview";

const WORK_TYPES = [
  { value: "breakdown", label: "Breakdown" },
  { value: "preventive", label: "Preventive" },
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "modification", label: "Modification" },
];
const PRIORITIES = ["low", "normal", "high", "critical"];

const PRIORITY_DUE_DAYS: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 7,
  low: 14,
};

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function WorkOrderNew() {
  const { profile, user, organisation } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberOpenCount, setMemberOpenCount] = useState<
    Record<string, number>
  >({});
  const [vendors, setVendors] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [nextNumber, setNextNumber] = useState<number | null>(null);

  const [form, setForm] = useState<any>({
    machine_id: "",
    work_type: "repair",
    checklist_template_id: "",
    title: "",
    description: "",
    priority: "normal",
    assignee_id: "",
    due_date: addDays(new Date(), 7),
    is_outsourced: false,
    vendor_id: "",
    promised_date: "",
    vendor_cost: "",
    remarks: "",
    // GSM-style request fields
    requested_by_name: "",
    department: "",
    plant_area: "",
    nature_of_problem: "",
    proposed_remedy: "",
    equipment_label: "",
    model_no: "",
    serial_no: "",
    permit_cold_work: false,
    permit_hot_work: false,
    permit_jsea: false,
    permit_isolation: false,
    permit_confined_space: false,
  });
  const [dueTouched, setDueTouched] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const year = new Date().getFullYear();
      const [
        { data: m },
        { data: p },
        { data: v },
        { data: t },
        { data: c },
        { data: openWos },
      ] = await Promise.all([
        supabase
          .from("machines")
          .select(
            "id,name,status,current_hours,category,make,model,year,registration_number,serial_number",
          )
          .order("name"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("organisation_id", profile.organisation_id),
        supabase
          .from("vendors")
          .select("id, name, category, phone, email")
          .eq("active", true)
          .order("name"),
        supabase
          .from("checklist_templates")
          .select("id, name, machine_category, machine_id, status")
          .eq("status", "approved"),
        supabase
          .from("org_wo_counters")
          .select("next_number")
          .eq("organisation_id", profile.organisation_id)
          .eq("year", year)
          .maybeSingle(),
        supabase
          .from("work_orders")
          .select("assignee_id")
          .in("status", ["open", "assigned", "in_progress", "waiting_parts"]),
      ]);
      setMachines(m ?? []);
      setMembers(p ?? []);
      setVendors(v ?? []);
      setTemplates(t ?? []);
      setNextNumber(c?.next_number ?? 1);
      const counts: Record<string, number> = {};
      (openWos ?? []).forEach((w: any) => {
        if (w.assignee_id)
          counts[w.assignee_id] = (counts[w.assignee_id] ?? 0) + 1;
      });
      setMemberOpenCount(counts);
      setLoading(false);
    })();
  }, [profile]);

  const selectedMachine =
    machines.find((m) => m.id === form.machine_id) ?? null;
  const selectedVendor = vendors.find((v) => v.id === form.vendor_id) ?? null;
  const selectedAssignee =
    members.find((p) => p.id === form.assignee_id) ?? null;
  const selectedTemplate =
    templates.find((t) => t.id === form.checklist_template_id) ?? null;

  const filteredTemplates = useMemo(() => {
    if (!selectedMachine) return templates;
    return templates.filter((t) =>
      !t.machine_id && !t.machine_category
        ? true
        : t.machine_id === selectedMachine.id ||
          t.machine_category === selectedMachine.category,
    );
  }, [templates, selectedMachine]);

  const setPriority = (priority: string) => {
    setForm((f: any) => {
      const next: any = { ...f, priority };
      if (!dueTouched)
        next.due_date = addDays(new Date(), PRIORITY_DUE_DAYS[priority] ?? 7);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.machine_id) return toast.error("Pick a machine");
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.work_type) return toast.error("Pick a work type");
    if (form.is_outsourced && !form.vendor_id)
      return toast.error("Pick a vendor");
    setSubmitting(true);
    const payload: any = {
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      status: "open",
      work_type: form.work_type,
      checklist_template_id: form.checklist_template_id || null,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      created_by: user?.id,
      is_outsourced: !!form.is_outsourced,
      vendor_id: form.is_outsourced ? form.vendor_id : null,
      sent_date: form.is_outsourced
        ? new Date().toISOString().slice(0, 10)
        : null,
      promised_date: form.is_outsourced ? form.promised_date || null : null,
      vendor_cost:
        form.is_outsourced && form.vendor_cost !== ""
          ? Number(form.vendor_cost)
          : null,
      vendor_currency: form.is_outsourced ? "TZS" : null,
      remarks: form.remarks?.trim() || null,
      requested_by_name: form.requested_by_name?.trim() || null,
      department: form.department?.trim() || null,
      plant_area: form.plant_area?.trim() || null,
      nature_of_problem: form.nature_of_problem?.trim() || null,
      proposed_remedy: form.proposed_remedy?.trim() || null,
      equipment_label: form.equipment_label?.trim() || null,
      model_no: form.model_no?.trim() || null,
      serial_no: form.serial_no?.trim() || null,
      permit_cold_work: !!form.permit_cold_work,
      permit_hot_work: !!form.permit_hot_work,
      permit_jsea: !!form.permit_jsea,
      permit_isolation: !!form.permit_isolation,
      permit_confined_space: !!form.permit_confined_space,
    };
    const { data: inserted, error } = await supabase
      .from("work_orders")
      .insert(payload)
      .select("id, wo_number, wo_year")
      .maybeSingle();
    if (error || !inserted) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed");
    }

    // Auto-populate required service tasks from machine PM schedule for preventive/inspection WOs
    if (form.work_type === "preventive" || form.work_type === "inspection") {
      await supabase.rpc("populate_wo_tasks_from_pm", { _wo_id: inserted.id });
    }

    // Notify assignee
    if (form.assignee_id) {
      await supabase.from("maintenance_notifications").insert({
        organisation_id: profile.organisation_id,
        machine_id: form.machine_id,
        title: `New work order assigned: ${form.title.trim()}`,
        description: `${formatWoNumber(inserted.wo_year, inserted.wo_number)} — priority ${form.priority}`,
        severity: form.priority === "critical" ? "high" : "medium",
        reported_by: user?.id,
        work_order_id: inserted.id,
      });
    }
    toast.success(
      `Created ${formatWoNumber(inserted.wo_year, inserted.wo_number)}`,
    );
    navigate(`/work-orders/${inserted.id}`);
  };

  if (loading) return <PageLoader />;

  const previewData = {
    wo_number: nextNumber,
    wo_year: new Date().getFullYear(),
    title: form.title,
    description: form.description,
    priority: form.priority,
    status: "open",
    work_type: form.work_type,
    due_date: form.due_date,
    created_at: new Date().toISOString(),
    is_outsourced: form.is_outsourced,
    promised_date: form.promised_date,
    vendor_cost: form.vendor_cost,
    vendor_currency: "TZS",
    requested_by_name: form.requested_by_name,
    department: form.department,
    plant_area: form.plant_area,
    nature_of_problem: form.nature_of_problem,
    proposed_remedy: form.proposed_remedy,
    equipment_label: form.equipment_label,
    model_no: form.model_no,
    serial_no: form.serial_no,
    permit_cold_work: form.permit_cold_work,
    permit_hot_work: form.permit_hot_work,
    permit_jsea: form.permit_jsea,
    permit_isolation: form.permit_isolation,
    permit_confined_space: form.permit_confined_space,
    logo_url: organisation?.logo_url ?? null,
    machine: selectedMachine ?? undefined,
    org: organisation ?? undefined,
    assignee: selectedAssignee
      ? { full_name: selectedAssignee.full_name }
      : undefined,
    vendor: selectedVendor ?? undefined,
    createdBy: profile ? { full_name: profile.full_name } : undefined,
    checklist: selectedTemplate ? { name: selectedTemplate.name } : undefined,
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link
          to="/work-orders"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to work orders
        </Link>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {formatWoNumber(new Date().getFullYear(), nextNumber)} (preview)
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border border-border bg-card p-5"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              New work order
            </h1>
            <p className="text-xs text-muted-foreground">
              Auto-numbered. Preview updates as you type.
            </p>
          </div>

          <MachineSearchSelect
            machines={machines}
            value={form.machine_id}
            onChange={(id) =>
              setForm((f: any) => ({
                ...f,
                machine_id: id,
                checklist_template_id: "",
              }))
            }
          />

          <div className="space-y-2">
            <Label>Work type *</Label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_TYPES.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() =>
                    setForm((f: any) => ({
                      ...f,
                      work_type: w.value,
                      checklist_template_id: "",
                    }))
                  }
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                    form.work_type === w.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  ].join(" ")}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {(form.work_type === "preventive" ||
            form.work_type === "inspection") && (
            <div className="space-y-1.5">
              <Label>Attach checklist</Label>
              <select
                value={form.checklist_template_id ?? ""}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    checklist_template_id: e.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {filteredTemplates.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No approved checklists for this machine.{" "}
                  <Link
                    to="/checklist-templates"
                    className="text-primary hover:underline"
                  >
                    Manage templates
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Replace hydraulic filter"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={2000}
            />
          </div>

          {["Manufacturing", "Mining", "Energy", "Construction"].includes(
            organisation?.industry ?? "",
          ) && (
            <details
              className="rounded-lg border border-border bg-muted/30"
              open
            >
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium">
                {organisation?.name ?? "Company"} fields{" "}
                <span className="text-xs text-muted-foreground">
                  (request, equipment, permits, remedy)
                </span>
              </summary>
              <div className="space-y-3 p-4 pt-0">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Requested by</Label>
                    <Input
                      value={form.requested_by_name}
                      onChange={(e) =>
                        setForm({ ...form, requested_by_name: e.target.value })
                      }
                      placeholder="Requester name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Input
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                      placeholder="e.g. Production"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plant area</Label>
                    <Input
                      value={form.plant_area}
                      onChange={(e) =>
                        setForm({ ...form, plant_area: e.target.value })
                      }
                      placeholder="e.g. Water Line"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nature of the problem</Label>
                  <textarea
                    rows={2}
                    value={form.nature_of_problem}
                    onChange={(e) =>
                      setForm({ ...form, nature_of_problem: e.target.value })
                    }
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Proposed remedy</Label>
                  <textarea
                    rows={2}
                    value={form.proposed_remedy}
                    onChange={(e) =>
                      setForm({ ...form, proposed_remedy: e.target.value })
                    }
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    maxLength={2000}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>
                      Equipment{" "}
                      <span className="text-xs text-muted-foreground">
                        (override)
                      </span>
                    </Label>
                    <Input
                      value={form.equipment_label}
                      onChange={(e) =>
                        setForm({ ...form, equipment_label: e.target.value })
                      }
                      placeholder="Equipment label"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Model No.</Label>
                    <Input
                      value={form.model_no}
                      onChange={(e) =>
                        setForm({ ...form, model_no: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Serial No.</Label>
                    <Input
                      value={form.serial_no}
                      onChange={(e) =>
                        setForm({ ...form, serial_no: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Permits &amp; certificates</Label>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {[
                      { key: "permit_cold_work", label: "Cold Work Permit" },
                      { key: "permit_hot_work", label: "Hot Work Permit" },
                      { key: "permit_jsea", label: "JSEA" },
                      {
                        key: "permit_isolation",
                        label: "Isolation Certificate",
                      },
                      { key: "permit_confined_space", label: "Confined Space" },
                    ].map((p) => (
                      <label
                        key={p.key}
                        className="inline-flex items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={!!form[p.key]}
                          onChange={(e) =>
                            setForm({ ...form, [p.key]: e.target.checked })
                          }
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          )}

          <div className="space-y-1.5">
            <Label>
              Manager remarks{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              rows={2}
              placeholder="Internal notes for the technician or vendor…"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={[
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium border capitalize transition-colors",
                    form.priority === p
                      ? p === "critical"
                        ? "border-red-500 bg-red-500 text-white"
                        : p === "high"
                          ? "border-amber-500 bg-amber-500 text-white"
                          : p === "low"
                            ? "border-slate-400 bg-slate-400 text-white"
                            : "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-suggests due date: critical=today, high=+1d, normal=+7d,
              low=+14d.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => {
                  setDueTouched(true);
                  setForm({ ...form, due_date: e.target.value });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <select
                value={form.assignee_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, assignee_id: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? "—"} ({memberOpenCount[m.id] ?? 0} open)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={!!form.is_outsourced}
                onChange={(e) =>
                  setForm({ ...form, is_outsourced: e.target.checked })
                }
              />
              Outsourced to external vendor
            </label>
            {form.is_outsourced && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Vendor *</Label>
                  <select
                    value={form.vendor_id ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, vendor_id: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Promised return</Label>
                  <Input
                    type="date"
                    value={form.promised_date ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, promised_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated cost (TZS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.vendor_cost ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, vendor_cost: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/work-orders")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              Create work order
            </Button>
          </div>
        </form>

        {/* Live preview */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Live document preview
          </div>
          <div className="overflow-auto rounded-xl border border-border bg-muted/30 p-4 max-h-[80vh]">
            <WorkOrderPreview data={previewData} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
