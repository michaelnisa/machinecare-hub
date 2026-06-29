import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_TYPES } from "@/lib/machine-constants";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const partSchema = z.object({
  inventory_item_id: z.string().optional().or(z.literal("")),
  part_name: z.string().trim().min(1, "Required").max(100),
  part_number: z.string().max(80).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0),
  unit: z.string().max(20),
  part_type: z.string(),
  supplier: z.string().max(100).optional().or(z.literal("")),
  unit_cost: z.coerce.number().min(0),
});

const schema = z.object({
  machine_id: z.string().min(1, "Choose a machine"),
  schedule_id: z.string().optional(),
  title: z.string().trim().min(1, "Required").max(200),
  service_type: z.string(),
  performed_by: z.string().max(120).optional().or(z.literal("")),
  performed_at: z.string().min(1, "Required"),
  hours_at_service: z.coerce.number().optional().or(z.literal("" as any)),
  cost: z.coerce.number().min(0),
  currency: z.string(),
  status: z.string(),
  description: z.string().max(2000).optional().or(z.literal("")),
  parts: z.array(partSchema),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machines: { id: string; name: string }[];
  defaultMachineId?: string;
  onSaved?: () => void;
}

export function ServiceLogDialog({ open, onOpenChange, machines, defaultMachineId, onSaved }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [schedules, setSchedules] = useState<{ id: string; name: string }[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      machine_id: defaultMachineId ?? "",
      title: "",
      service_type: "small_service",
      performed_at: new Date().toISOString().slice(0, 10),
      currency: "TZS",
      status: "completed",
      cost: 0,
      parts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "parts" });
  const machineId = watch("machine_id");

  useEffect(() => {
    if (open) {
      reset({
        machine_id: defaultMachineId ?? "",
        title: "",
        service_type: "small_service",
        performed_at: new Date().toISOString().slice(0, 10),
        currency: "TZS",
        status: "completed",
        cost: 0,
        performed_by: "",
        description: "",
        parts: [],
      });
      setFiles([]);
    }
  }, [open, defaultMachineId, reset]);

  useEffect(() => {
    if (!machineId) { setSchedules([]); return; }
    supabase.from("service_schedules").select("id, name").eq("machine_id", machineId).then(({ data }) => {
      setSchedules((data as any) ?? []);
    });
  }, [machineId]);

  useEffect(() => {
    if (!open || !profile) return;
    supabase.from("inventory_items").select("id, name, part_number, unit, unit_cost, supplier, quantity")
      .eq("organisation_id", profile.organisation_id).order("name")
      .then(({ data }) => setInventory(data ?? []));
  }, [open, profile]);

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    setSubmitting(true);
    try {
      const insertPayload: any = {
        machine_id: values.machine_id,
        schedule_id: values.schedule_id || null,
        title: values.title.trim(),
        description: values.description || null,
        service_type: values.service_type,
        performed_by: values.performed_by || null,
        performed_at: values.performed_at,
        hours_at_service: values.hours_at_service === "" || values.hours_at_service == null ? null : Number(values.hours_at_service),
        cost: Number(values.cost) || 0,
        currency: values.currency,
        status: values.status,
      };

      const { data: log, error } = await supabase.from("service_logs").insert(insertPayload).select("id").single();
      if (error) throw error;

      if (values.parts.length > 0) {
        const parts = values.parts.map((p) => ({
          ...p,
          inventory_item_id: p.inventory_item_id || null,
          service_log_id: log.id,
        }));
        const { error: pErr } = await supabase.from("service_parts").insert(parts);
        if (pErr) throw pErr;
      }

      // Update schedule last_service info
      if (values.schedule_id) {
        const { data: sched } = await supabase.from("service_schedules").select("interval_days, interval_hours").eq("id", values.schedule_id).maybeSingle();
        const next_due_date = sched?.interval_days
          ? new Date(new Date(values.performed_at).getTime() + sched.interval_days * 86400000).toISOString().slice(0, 10)
          : null;
        const next_due_hours = sched?.interval_hours && values.hours_at_service !== undefined && values.hours_at_service !== ("" as any)
          ? Number(values.hours_at_service) + Number(sched.interval_hours)
          : null;
        await supabase.from("service_schedules").update({
          last_service_date: values.performed_at,
          last_service_hours: values.hours_at_service === "" || values.hours_at_service == null ? null : Number(values.hours_at_service),
          next_due_date,
          next_due_hours,
        }).eq("id", values.schedule_id);
      }

      // Update machine current_hours if provided
      if (values.hours_at_service !== "" && values.hours_at_service != null) {
        await supabase.from("machines").update({ current_hours: Number(values.hours_at_service) }).eq("id", values.machine_id);
      }

      // Upload files
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${profile.organisation_id}/logs/${log.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("machine-docs").upload(path, file);
        if (upErr) { toast.error(`Failed to upload ${file.name}`); continue; }
        const { data: pub } = supabase.storage.from("machine-docs").getPublicUrl(path);
        const fileType = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "document";
        await supabase.from("documents").insert({
          machine_id: values.machine_id,
          service_log_id: log.id,
          name: file.name,
          file_url: pub.publicUrl,
          file_type: fileType,
        });
      }

      toast.success("Service logged");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to log service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Log a service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="machine_id">Machine *</Label>
              <select id="machine_id" {...register("machine_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {errors.machine_id && <p className="text-xs text-destructive">{errors.machine_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule_id">Linked schedule</Label>
              <select id="schedule_id" {...register("schedule_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— None —</option>
                {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="e.g. 250hr oil & filter change" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service_type">Service type</Label>
              <select id="service_type" {...register("service_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register("status")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="completed">Completed</option>
                <option value="in_progress">In progress</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="performed_by">Performed by</Label>
              <Input id="performed_by" {...register("performed_by")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="performed_at">Date *</Label>
              <Input id="performed_at" type="date" {...register("performed_at")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours_at_service">Hours / km at service</Label>
              <Input id="hours_at_service" type="number" step="any" {...register("hours_at_service")} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost</Label>
              <div className="flex gap-2">
                <Input type="number" step="any" {...register("cost")} />
                <select {...register("currency")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="KES">KES</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Parts used</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ part_name: "", quantity: 1, unit: "pcs", part_type: "original", unit_cost: 0 } as any)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add part
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No parts added.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={f.id} className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-12">
                    <select
                      className="sm:col-span-12 h-10 rounded-md border border-input bg-background px-2 text-sm"
                      {...register(`parts.${i}.inventory_item_id` as const, {
                        onChange: (e) => {
                          const item = inventory.find((x) => x.id === e.target.value);
                          if (item) {
                            setValue(`parts.${i}.part_name`, item.name);
                            setValue(`parts.${i}.part_number`, item.part_number ?? "");
                            setValue(`parts.${i}.unit`, item.unit ?? "pcs");
                            setValue(`parts.${i}.unit_cost`, Number(item.unit_cost ?? 0));
                            if (item.supplier) setValue(`parts.${i}.supplier`, item.supplier);
                          }
                        },
                      })}
                    >
                      <option value="">— Custom part (not from inventory) —</option>
                      {inventory.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}{it.part_number ? ` · ${it.part_number}` : ""} · stock {Number(it.quantity)} {it.unit}
                        </option>
                      ))}
                    </select>
                    <Input placeholder="Part name" className="sm:col-span-3" {...register(`parts.${i}.part_name` as const)} />
                    <Input placeholder="Part #" className="sm:col-span-2" {...register(`parts.${i}.part_number` as const)} />
                    <Input type="number" step="any" placeholder="Qty" className="sm:col-span-1" {...register(`parts.${i}.quantity` as const)} />
                    <select className="sm:col-span-1 h-10 rounded-md border border-input bg-background px-2 text-sm" {...register(`parts.${i}.unit` as const)}>
                      <option value="pcs">pcs</option>
                      <option value="litres">litres</option>
                      <option value="kg">kg</option>
                      <option value="metres">metres</option>
                    </select>
                    <select className="sm:col-span-2 h-10 rounded-md border border-input bg-background px-2 text-sm" {...register(`parts.${i}.part_type` as const)}>
                      <option value="original">Original</option>
                      <option value="aftermarket">Aftermarket</option>
                      <option value="reconditioned">Reconditioned</option>
                    </select>
                    <Input placeholder="Supplier" className="sm:col-span-2" {...register(`parts.${i}.supplier` as const)} />
                    <Input type="number" step="any" placeholder="Unit cost" className="sm:col-span-1" {...register(`parts.${i}.unit_cost` as const)} />
                    <Button type="button" variant="ghost" size="icon" className="sm:col-span-12 sm:w-auto sm:justify-self-end" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Attach photos / documents</Label>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>{files.length > 0 ? `${files.length} file(s) selected` : "Choose files"}</span>
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
