import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCHEDULE_TYPES } from "@/lib/machine-constants";
import { Loader2, Gauge, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { STANDARD_FLEET_PM_PACKAGES } from "@/services/fleetPmService";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  service_type: z.string(),
  metric_type: z.enum(["km", "hours"]),
  interval_metric: z.coerce.number().min(1, "Interval must be > 0").optional().or(z.literal("" as any)),
  interval_days: z.coerce.number().int().min(0).optional().or(z.literal("" as any)),
  last_service_metric: z.coerce.number().min(0).optional().or(z.literal("" as any)),
  next_due_metric: z.coerce.number().min(0).optional().or(z.literal("" as any)),
  last_service_date: z.string().optional().or(z.literal("")),
  next_due_date: z.string().optional().or(z.literal("")),
  instructions: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId?: string;
  machines?: { id: string; name: string; category?: string; current_odometer_km?: number | null; current_hours?: number | null }[];
  schedule?: any;
  onSaved?: () => void;
}

export function ScheduleFormDialog({ open, onOpenChange, machineId, machines, schedule, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState(machineId ?? "");
  const isEdit = !!schedule;
  const needsMachinePicker = !machineId && !!machines;

  const currentMachine = useMemo(() => {
    const id = machineId ?? selectedMachineId;
    return (machines ?? []).find((m) => m.id === id);
  }, [machineId, selectedMachineId, machines]);

  const isVehicle = useMemo(() => {
    if (!currentMachine) return true; // Default to vehicle in fleet mode
    return currentMachine.category === "Vehicle" || currentMachine.category === "Trailer" || (currentMachine.current_odometer_km ?? 0) > 0;
  }, [currentMachine]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { service_type: "small", metric_type: "km" },
  });

  const selectedMetric = watch("metric_type");

  useEffect(() => {
    if (open) {
      const metric = isVehicle ? "km" : "hours";
      const initialInterval = schedule?.interval_hours ?? (isVehicle ? 10000 : 250);
      const currentOdo = currentMachine?.current_odometer_km || 0;
      const initialLast = schedule?.last_service_hours ?? (isVehicle ? currentOdo : 0);
      const initialNext = schedule?.next_due_hours ?? (initialLast + initialInterval);

      reset({
        name: schedule?.name ?? "",
        service_type: schedule?.service_type ?? "small",
        metric_type: metric,
        interval_metric: initialInterval,
        interval_days: schedule?.interval_days ?? (isVehicle ? 90 : ("" as any)),
        last_service_metric: initialLast,
        next_due_metric: initialNext,
        last_service_date: schedule?.last_service_date ?? "",
        next_due_date: schedule?.next_due_date ?? "",
        instructions: schedule?.instructions ?? "",
      });
      setSelectedMachineId(machineId ?? schedule?.machine_id ?? "");
    }
  }, [open, schedule, reset, machineId, isVehicle, currentMachine]);

  // Auto-calculate next due odometer / hours when interval changes
  const intervalMetric = watch("interval_metric");
  const lastServiceMetric = watch("last_service_metric");
  useEffect(() => {
    if (intervalMetric && !isEdit) {
      const last = Number(lastServiceMetric || 0);
      setValue("next_due_metric", last + Number(intervalMetric));
    }
  }, [intervalMetric, lastServiceMetric, isEdit, setValue]);

  // Auto-suggest next due date
  const lastDate = watch("last_service_date");
  const intervalDays = watch("interval_days");
  useEffect(() => {
    if (lastDate && intervalDays && !isEdit) {
      const next = new Date(new Date(lastDate).getTime() + Number(intervalDays) * 86400000);
      setValue("next_due_date", next.toISOString().slice(0, 10));
    }
  }, [lastDate, intervalDays, isEdit, setValue]);

  const applyPackagePreset = (pkg: typeof STANDARD_FLEET_PM_PACKAGES[0]) => {
    const currentOdo = currentMachine?.current_odometer_km || 0;
    const nextDue = currentOdo > 0 ? Math.ceil((currentOdo + 1) / pkg.intervalKm) * pkg.intervalKm : pkg.intervalKm;
    const lastOdo = Math.max(0, nextDue - pkg.intervalKm);

    setValue("name", pkg.name);
    setValue("service_type", pkg.serviceType);
    setValue("metric_type", "km");
    setValue("interval_metric", pkg.intervalKm);
    setValue("interval_days", pkg.intervalDays ?? 90);
    setValue("last_service_metric", lastOdo);
    setValue("next_due_metric", nextDue);
    setValue("instructions", pkg.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n"));
    if (pkg.intervalDays) {
      const nextDate = new Date(Date.now() + pkg.intervalDays * 86400000).toISOString().slice(0, 10);
      setValue("next_due_date", nextDate);
    }
    toast.success(`Preset applied: ${pkg.name}`);
  };

  const onSubmit = async (values: FormValues) => {
    const targetMachine = machineId ?? selectedMachineId;
    if (needsMachinePicker && !targetMachine) {
      toast.error("Pick a machine or vehicle");
      return;
    }
    setSubmitting(true);
    try {
      const intervalVal = values.interval_metric === "" || values.interval_metric == null ? null : Number(values.interval_metric);
      const lastVal = values.last_service_metric === "" || values.last_service_metric == null ? null : Number(values.last_service_metric);
      const nextVal = values.next_due_metric === "" || values.next_due_metric == null ? null : Number(values.next_due_metric);

      const payload: any = {
        machine_id: targetMachine,
        name: values.name.trim(),
        service_type: values.service_type,
        interval_hours: intervalVal, // stores km or hours
        last_service_hours: lastVal,
        next_due_hours: nextVal,
        interval_days: values.interval_days === "" || values.interval_days == null ? null : Number(values.interval_days),
        last_service_date: values.last_service_date || null,
        next_due_date: values.next_due_date || null,
        instructions: values.instructions ? values.instructions.trim() : null,
      };

      if (isEdit) {
        const { error } = await supabase.from("service_schedules").update(payload).eq("id", schedule.id);
        if (error) throw error;
        toast.success("Schedule updated");
      } else {
        const { error } = await supabase.from("service_schedules").insert(payload);
        if (error) throw error;
        toast.success("Service schedule created");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Service Schedule" : "Add Service Interval & Schedule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {needsMachinePicker && (
            <div className="space-y-1.5">
              <Label>Vehicle / Machine *</Label>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select vehicle or machine</option>
                {machines!.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.current_odometer_km ? `(${m.current_odometer_km.toLocaleString()} km)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Presets for Vehicles */}
          {!isEdit && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quick Fleet Service Presets:
              </div>
              <div className="flex flex-wrap gap-2">
                {STANDARD_FLEET_PM_PACKAGES.map((pkg) => (
                  <Button
                    key={pkg.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-card hover:border-primary"
                    onClick={() => applyPackagePreset(pkg)}
                  >
                    <Gauge className="h-3 w-3 text-primary" />
                    {pkg.intervalKm.toLocaleString()} km ({pkg.name.split(":")[0]})
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sname">Schedule Name *</Label>
            <Input id="sname" placeholder="e.g. Service A: Oil & Filter (10,000 km)" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service Category</Label>
              <select {...register("service_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SCHEDULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Tracking Metric</Label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-2 flex-1 justify-center bg-card hover:bg-muted/50">
                  <input type="radio" value="km" {...register("metric_type")} />
                  <Gauge className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Kilometres (km)</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-2 flex-1 justify-center bg-card hover:bg-muted/50">
                  <input type="radio" value="hours" {...register("metric_type")} />
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span>Hours</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Interval ({selectedMetric === "km" ? "Kilometres" : "Hours"}) *</Label>
              <Input
                type="number"
                step="any"
                placeholder={selectedMetric === "km" ? "10000" : "250"}
                {...register("interval_metric")}
              />
              {errors.interval_metric && <p className="text-xs text-destructive">{errors.interval_metric.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Interval (Calendar Days - optional)</Label>
              <Input type="number" placeholder="90" {...register("interval_days")} />
            </div>

            <div className="space-y-1.5">
              <Label>Last Serviced ({selectedMetric === "km" ? "km" : "hrs"})</Label>
              <Input type="number" step="any" {...register("last_service_metric")} />
            </div>

            <div className="space-y-1.5">
              <Label>Next Due Target ({selectedMetric === "km" ? "km" : "hrs"})</Label>
              <Input type="number" step="any" {...register("next_due_metric")} />
            </div>

            <div className="space-y-1.5">
              <Label>Last Service Date</Label>
              <Input type="date" {...register("last_service_date")} />
            </div>

            <div className="space-y-1.5">
              <Label>Next Due Date</Label>
              <Input type="date" {...register("next_due_date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Maintenance Checklist & Instructions</Label>
            <Textarea
              rows={3}
              placeholder="1. Replace oil & filter&#10;2. Check brake linings&#10;3. Inspect tyres"
              {...register("instructions")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

