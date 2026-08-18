import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemName: string;
  unit?: string | null;
  remaining: number;
  requesterName?: string;
  onConfirm: (quantity: number) => Promise<void>;
}

/**
 * Confirmation gate for physically handing over stock — issuing a material
 * request item is the one moment stock actually leaves the shelf, so it
 * gets an explicit "confirm the handover" step instead of a single click,
 * and a printed receipt is only reachable after this succeeds.
 */
export function IssueConfirmDialog({ open, onOpenChange, itemName, unit, remaining, requesterName, onConfirm }: Props) {
  const [quantity, setQuantity] = useState(String(remaining));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setQuantity(String(remaining));
  }, [open, remaining]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0 || qty > remaining) {
      toast.error(`Enter a quantity between 1 and ${formatNumber(remaining)}`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(qty);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /> Confirm handover</DialogTitle>
          <DialogDescription>
            Confirm you are physically handing {itemName} to {requesterName ?? "the requester"} now. This will deduct stock and cannot be undone from here — use a return if it comes back.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Quantity to issue *</Label>
          <Input type="number" min={1} max={remaining} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <p className="text-xs text-muted-foreground">Up to {formatNumber(remaining)} {unit ?? ""} remaining on this line.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
