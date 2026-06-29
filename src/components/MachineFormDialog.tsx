import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/machine-constants";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  category: z.string().min(1, "Required"),
  make: z.string().max(80).optional().or(z.literal("")),
  model: z.string().max(80).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("" as any)),
  serial_number: z.string().max(80).optional().or(z.literal("")),
  registration_number: z.string().max(40).optional().or(z.literal("")),
  purchase_date: z.string().optional().or(z.literal("")),
  current_hours: z.coerce.number().min(0).optional().or(z.literal("" as any)),
  status: z.string(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  machine?: any;
}

export function MachineFormDialog({ open, onOpenChange, onSaved, machine }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const isEdit = !!machine;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active", category: "Vehicle" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: machine?.name ?? "",
        category: machine?.category ?? "Vehicle",
        make: machine?.make ?? "",
        model: machine?.model ?? "",
        year: machine?.year ?? ("" as any),
        serial_number: machine?.serial_number ?? "",
        registration_number: machine?.registration_number ?? "",
        purchase_date: machine?.purchase_date ?? "",
        current_hours: machine?.current_hours ?? ("" as any),
        status: machine?.status ?? "active",
        notes: machine?.notes ?? "",
      });
      setCoverFile(null);
    }
  }, [open, machine, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    setSubmitting(true);
    try {
      let coverUrl: string | null = machine?.cover_image_url ?? null;
      if (coverFile) {
        if (coverFile.size > 5 * 1024 * 1024) {
          toast.error("Image too large. Please keep cover photos under 5 MB.");
          setSubmitting(false);
          return;
        }
        const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.organisation_id}/covers/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("machine-docs")
          .upload(path, coverFile, { contentType: coverFile.type, upsert: false });
        if (upErr) throw upErr;
        // Store the storage path; we resolve it to a signed URL at display time.
        coverUrl = path;
      }

      const payload: any = {
        name: values.name.trim(),
        category: values.category,
        make: values.make || null,
        model: values.model || null,
        year: values.year ? Number(values.year) : null,
        serial_number: values.serial_number || null,
        registration_number: values.registration_number || null,
        purchase_date: values.purchase_date || null,
        current_hours: values.current_hours === "" || values.current_hours == null ? 0 : Number(values.current_hours),
        status: values.status,
        notes: values.notes || null,
        cover_image_url: coverUrl,
      };

      if (isEdit) {
        const { error } = await supabase.from("machines").update(payload).eq("id", machine.id);
        if (error) throw error;
        toast.success("Machine updated");
      } else {
        payload.organisation_id = profile.organisation_id;
        const { error } = await supabase.from("machines").insert(payload);
        if (error) throw error;
        toast.success("Machine added");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit machine" : "Add machine"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="e.g. CAT 320 Excavator #3" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category *</Label>
              <select id="category" {...register("category")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register("status")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="under_maintenance">Under maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" {...register("make")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" {...register("model")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" {...register("year")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial_number">Serial number</Label>
              <Input id="serial_number" {...register("serial_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="registration_number">Registration number</Label>
              <Input id="registration_number" {...register("registration_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase_date">Purchase date</Label>
              <Input id="purchase_date" type="date" {...register("purchase_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current_hours">Current hours / km</Label>
              <Input id="current_hours" type="number" step="any" {...register("current_hours")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cover">Cover image</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{coverFile ? coverFile.name : "Choose file"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                </label>
                {coverFile && (
                  <span className="text-xs text-muted-foreground">
                    {(coverFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
                {machine?.cover_image_url && !coverFile && (
                  <span className="text-xs text-muted-foreground">Existing image will be kept</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG or PNG, landscape 16:9 (e.g. 1280×720 or 1600×900). Max 5 MB — aim for under 500 KB for fast loading.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add machine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
