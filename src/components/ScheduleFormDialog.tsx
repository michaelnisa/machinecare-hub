import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHEDULE_TYPES } from "@/lib/machine-constants";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  service_type: z.string(),
  interval_days: z.coerce.number().int().min(0).optional().or(z.literal("" as any)),
  interval_hours: z.coerce.number().min(0).optional().or(z.literal("" as any)),
  last_service_date: z.string().optional().or(z.literal("")),
  next_due_date: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  schedule?: any;
  onSaved?: () => void;
}

export function ScheduleFormDialog({ open, onOpenChange, machineId, schedule, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!schedule;
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { service_type: "small" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: schedule?.name ?? "",
        service_type: schedule?.service_type ?? "small",
        interval_days: schedule?.interval_days ?? ("" as any),
        interval_hours: schedule?.interval_hours ?? ("" as any),
        last_service_date: schedule?.last_service_date ?? "",
        next_due_date: schedule?.next_due_date ?? "",
      });
    }
  }, [open, schedule, reset]);

  // Auto-suggest next due
  const lastDate = watch("last_service_date");
  const intervalDays = watch("interval_days");
  useEffect(() => {
    if (lastDate && intervalDays && !isEdit) {
      const next = new Date(new Date(lastDate).getTime() + Number(intervalDays) * 86400000);
      setValue("next_due_date", next.toISOString().slice(0, 10));
    }
  }, [lastDate, intervalDays, isEdit, setValue]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload: any = {
        machine_id: machineId,
        name: values.name.trim(),
        service_type: values.service_type,
        interval_days: values.interval_days === "" || values.interval_days == null ? null : Number(values.interval_days),
        interval_hours: values.interval_hours === "" || values.interval_hours == null ? null : Number(values.interval_hours),
        last_service_date: values.last_service_date || null,
        next_due_date: values.next_due_date || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("service_schedules").update(payload).eq("id", schedule.id);
        if (error) throw error;
        toast.success("Schedule updated");
      } else {
        const { error } = await supabase.from("service_schedules").insert(payload);
        if (error) throw error;
        toast.success("Schedule added");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit schedule" : "Add service schedule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sname">Name *</Label>
            <Input id="sname" placeholder="e.g. Oil change every 250 hrs" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select {...register("service_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SCHEDULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Interval (days)</Label>
              <Input type="number" {...register("interval_days")} />
            </div>
            <div className="space-y-1.5">
              <Label>Interval (hours)</Label>
              <Input type="number" step="any" {...register("interval_hours")} />
            </div>
            <div className="space-y-1.5">
              <Label>Last service date</Label>
              <Input type="date" {...register("last_service_date")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Next due date</Label>
              <Input type="date" {...register("next_due_date")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
