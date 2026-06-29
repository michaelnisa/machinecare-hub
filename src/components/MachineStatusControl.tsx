import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";

const STATUSES = ["active", "under_maintenance", "retired"] as const;

interface Props {
  machineId: string;
  status: string;
  onChanged: () => void;
}

export function MachineStatusControl({ machineId, status, onChanged }: Props) {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("machine_status_history")
      .select("*")
      .eq("machine_id", machineId)
      .order("changed_at", { ascending: false });
    setHistory(data ?? []);
  };

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen]);

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) {
      toast.error(t.machine.reasonRequired);
      return;
    }
    setSaving(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("machines").update({ status: target }).eq("id", machineId),
      supabase.from("machine_status_history").insert({
        organisation_id: profile!.organisation_id,
        machine_id: machineId,
        from_status: status,
        to_status: target,
        reason: reason.trim(),
        changed_by: user?.id ?? null,
      }),
    ]);
    setSaving(false);
    if (e1 || e2) return toast.error((e1 || e2)!.message);
    toast.success(t.machine.statusChanged);
    setTarget(null);
    setReason("");
    onChanged();
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <StatusBadge status={status} />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUSES.filter((s) => s !== status).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setTarget(s)}>
                {t.machine.changeTo} <StatusBadge status={s} className="ml-2" />
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" /> {t.machine.statusHistory}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.machine.changeStatus}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <StatusBadge status={status} />
              <span className="text-muted-foreground">→</span>
              {target && <StatusBadge status={target} />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t.machine.reason} *</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.machine.reasonPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>{t.common.cancel}</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.machine.statusHistory}</DialogTitle></DialogHeader>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.machine.noHistory}</p>
          ) : (
            <ol className="max-h-[60vh] space-y-2 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {h.from_status && <StatusBadge status={h.from_status} />}
                      <span className="text-muted-foreground">→</span>
                      <StatusBadge status={h.to_status} />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</span>
                  </div>
                  {h.reason && <p className="mt-2 text-xs text-muted-foreground">{h.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
