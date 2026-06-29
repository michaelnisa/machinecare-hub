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
import { KNOWLEDGE_CATEGORIES } from "@/lib/machine-constants";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string(),
  content: z.string().trim().min(1).max(20000),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  item?: any;
  onSaved?: () => void;
}

export function KnowledgeFormDialog({ open, onOpenChange, machineId, item, onSaved }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!item;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "procedure" },
  });

  useEffect(() => {
    if (open) reset({
      title: item?.title ?? "",
      category: item?.category ?? "procedure",
      content: item?.content ?? "",
    });
  }, [open, item, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("knowledge_items").update(values).eq("id", item.id);
        if (error) throw error;
        toast.success("Knowledge updated");
      } else {
        const { error } = await supabase.from("knowledge_items").insert({ ...values, machine_id: machineId, created_by: profile?.id });
        if (error) throw error;
        toast.success("Knowledge added");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit knowledge item" : "Add knowledge item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ktitle">Title *</Label>
            <Input id="ktitle" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select {...register("category")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kcontent">Content *</Label>
            <Textarea id="kcontent" rows={10} {...register("content")} placeholder="Procedure, safety notes, specs..." />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
