import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const WO_STATUSES = ["open", "assigned", "in_progress", "waiting_parts", "done", "closed"] as const;
export type WoStatus = typeof WO_STATUSES[number];

const LABELS: Record<WoStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_parts: "Waiting parts",
  done: "Done",
  closed: "Closed",
};

const ALLOWED: Record<WoStatus, WoStatus[]> = {
  open: ["assigned", "in_progress", "closed"],
  assigned: ["in_progress", "open", "closed"],
  in_progress: ["waiting_parts", "done", "assigned"],
  waiting_parts: ["in_progress", "done"],
  done: ["closed", "in_progress"],
  closed: ["open"],
};

export function StatusPipelineBar({
  status,
  onTransition,
  disabled,
}: {
  status: WoStatus;
  onTransition: (to: WoStatus, note?: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [prompt, setPrompt] = useState<{ to: WoStatus; label: string; placeholder: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const currentIdx = WO_STATUSES.indexOf(status);
  const allowed = ALLOWED[status] ?? [];

  const handleClick = async (to: WoStatus) => {
    if (disabled || to === status) return;
    if (!allowed.includes(to)) return;
    if (to === "waiting_parts") {
      setPrompt({ to, label: "Which part are you waiting for?", placeholder: "e.g. hydraulic filter 5I-8670" });
      setNote("");
      return;
    }
    if (status === "done" && to === "in_progress") {
      setPrompt({ to, label: "Reason for reopening", placeholder: "e.g. issue returned after 2 hours" });
      setNote("");
      return;
    }
    await onTransition(to);
  };

  const submitPrompt = async () => {
    if (!prompt) return;
    if (!note.trim()) return;
    setBusy(true);
    try {
      await onTransition(prompt.to, note.trim());
      setPrompt(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status pipeline</div>
        <div className="flex flex-wrap items-center gap-1">
          {WO_STATUSES.map((s, i) => {
            const passed = i < currentIdx;
            const current = i === currentIdx;
            const canGo = allowed.includes(s);
            const clickable = !disabled && (canGo || current);
            return (
              <div key={s} className="flex items-center">
                <button
                  type="button"
                  disabled={!clickable || current}
                  onClick={() => handleClick(s)}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    current
                      ? "bg-primary text-primary-foreground"
                      : passed
                      ? "bg-emerald-100 text-emerald-800"
                      : canGo
                      ? "border border-dashed border-primary/40 text-primary hover:bg-primary/10"
                      : "border border-border text-muted-foreground opacity-60",
                  ].join(" ")}
                >
                  {passed && <Check className="h-3 w-3" />}
                  {LABELS[s]}
                </button>
                {i < WO_STATUSES.length - 1 && <div className="mx-0.5 h-px w-3 bg-border" />}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!prompt} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{prompt?.label}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Note (required)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={prompt?.placeholder}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPrompt(null)}>Cancel</Button>
            <Button onClick={submitPrompt} disabled={!note.trim() || busy}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
