import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId: string;
  machineCategory?: string | null;
}

export function StartInspectionDialog({ open, onOpenChange, machineId, machineCategory }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [hours, setHours] = useState("");
  const [performerName, setPerformerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPerformerName(profile?.full_name ?? "");
    supabase
      .from("checklist_templates")
      .select("id, name, version, machine_category, machine_id")
      .eq("status", "approved")
      .or(`machine_id.eq.${machineId},machine_id.is.null`)
      .order("name")
      .then(({ data }) => {
        const filtered = (data ?? []).filter((t: any) =>
          !t.machine_category || !machineCategory || t.machine_category === machineCategory
        );
        setTemplates(filtered);
        if (filtered[0]) setTemplateId(filtered[0].id);
        setLoading(false);
      });
  }, [open, machineId, machineCategory, profile]);

  const start = async () => {
    if (!templateId || !profile) return;
    setStarting(true);
    const tpl = templates.find((t) => t.id === templateId);
    const { data: items } = await supabase
      .from("checklist_template_items")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order");

    const { data: exec, error } = await supabase
      .from("checklist_executions")
      .insert({
        organisation_id: profile.organisation_id,
        template_id: templateId,
        template_version: tpl?.version ?? 1,
        machine_id: machineId,
        performed_by: user?.id ?? null,
        performed_by_name: performerName.trim() || profile.full_name || "Unknown",
        hours_at_execution: hours ? Number(hours) : null,
        status: "in_progress",
      })
      .select()
      .single();
    if (error || !exec) {
      setStarting(false);
      return toast.error(error?.message ?? "Failed to start");
    }

    if (items && items.length > 0) {
      const responses = items.map((it: any) => ({
        execution_id: exec.id,
        item_id: it.id,
        item_text_snapshot: it.text,
        item_type: it.item_type,
        severity_snapshot: it.severity,
        sort_order: it.sort_order,
      }));
      await supabase.from("checklist_execution_responses").insert(responses);
    }
    setStarting(false);
    onOpenChange(false);
    navigate(`/inspections/${exec.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Start inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template</Label>
            {loading ? (
              <div className="flex h-10 items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
            ) : templates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No approved templates available. Create and approve a template first.
              </p>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ins-name">Performed by</Label>
            <Input id="ins-name" value={performerName} onChange={(e) => setPerformerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ins-hours">Hours / km</Label>
            <Input id="ins-hours" type="number" min={0} placeholder="optional" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={start} disabled={starting || !templateId}>
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
