import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertOctagon,
  Receipt,
  Upload,
  Camera,
  Loader2,
  X,
  FileText,
  DollarSign,
  Car,
} from "lucide-react";
import { toast } from "sonner";

export const EXPENSE_CATEGORIES = [
  { id: "fine", label: "Traffic Fine / Penalty", icon: AlertOctagon, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { id: "receipt", label: "General Receipt", icon: Receipt, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "toll", label: "Toll / Weighbridge", icon: Car, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "parking", label: "Parking Fee", icon: DollarSign, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { id: "fuel", label: "Fuel Receipt", icon: Receipt, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { id: "repair", label: "Roadside Repair / Tyre", icon: FileText, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { id: "other", label: "Other Expense", icon: FileText, color: "text-slate-600 bg-slate-50 border-slate-200" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  machineId: string;
  orgId?: string | null;
  defaultType?: "fine" | "receipt" | "toll" | "parking" | "fuel" | "repair" | "other";
  onSaved?: () => void;
}

export function TripExpenseDialog({
  open,
  onOpenChange,
  tripId,
  machineId,
  orgId,
  defaultType = "receipt",
  onSaved,
}: Props) {
  const { user, profile } = useAuth();
  const [expenseType, setExpenseType] = useState<string>(defaultType);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setExpenseType(defaultType);
    setTitle("");
    setAmount("");
    setReferenceNumber("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0 || !amount.trim()) {
      return toast.error("Please enter a valid amount");
    }

    const defaultTitle =
      expenseType === "fine"
        ? "Traffic Fine / Penalty"
        : expenseType === "toll"
        ? "Toll / Weighbridge Pass"
        : expenseType === "fuel"
        ? "Road Fuel Receipt"
        : "Trip Expense Receipt";

    setSubmitting(true);
    try {
      let uploadedReceiptUrl: string | null = null;

      // 1. Upload photo if selected
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const cleanName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const targetOrg = orgId || profile?.organisation_id || "public";
        const storagePath = `${targetOrg}/trips/${tripId}/${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("machine-docs")
          .upload(storagePath, photoFile, { upsert: true });

        if (uploadError) {
          console.warn("Photo upload error:", uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from("machine-docs")
            .getPublicUrl(storagePath);
          uploadedReceiptUrl = publicUrlData?.publicUrl || null;
        }
      }

      // 2. Try RPC first
      const { data: rpcId, error: rpcErr } = await (supabase as any).rpc(
        "add_trip_expense_public",
        {
          _trip_id: tripId,
          _expense_type: expenseType,
          _title: title.trim() || defaultTitle,
          _amount: numAmount,
          _reference_number: referenceNumber.trim() || null,
          _receipt_url: uploadedReceiptUrl,
          _notes: notes.trim() || null,
        }
      );

      if (rpcErr || !rpcId) {
        // Fallback to direct table insert
        const fallbackOrgId = orgId || profile?.organisation_id;
        const payload: any = {
          trip_id: tripId,
          machine_id: machineId,
          expense_type: expenseType,
          title: title.trim() || defaultTitle,
          amount: numAmount,
          currency: "TZS",
          reference_number: referenceNumber.trim() || null,
          receipt_url: uploadedReceiptUrl,
          notes: notes.trim() || null,
          created_by: user?.id ?? null,
        };
        if (fallbackOrgId) payload.organisation_id = fallbackOrgId;

        const { error: insertErr } = await (supabase as any)
          .from("trip_expenses")
          .insert(payload);

        if (insertErr) throw insertErr;
      }

      toast.success(
        expenseType === "fine"
          ? "Fine logged to trip successfully"
          : "Receipt / expense added to trip successfully"
      );
      resetForm();
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            {expenseType === "fine" ? (
              <AlertOctagon className="h-5 w-5 text-rose-600" />
            ) : (
              <Receipt className="h-5 w-5 text-emerald-600" />
            )}
            {expenseType === "fine" ? "Add Traffic Fine / Ticket" : "Upload Receipt or Expense"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Record costs, tolls, tickets or purchases incurred during this trip.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Category Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Expense Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = expenseType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setExpenseType(cat.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 font-bold text-primary shadow-xs ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount & Reference Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="te-amount" className="text-xs font-semibold">
                Amount (TZS) *
              </Label>
              <Input
                id="te-amount"
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 30000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="font-mono text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-ref" className="text-xs font-semibold">
                {expenseType === "fine" ? "Ticket / Fine No." : "Receipt No."}
              </Label>
              <Input
                id="te-ref"
                placeholder="e.g. F-94812"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Description / Title */}
          <div className="space-y-1.5">
            <Label htmlFor="te-title" className="text-xs font-semibold">
              Description / Reason
            </Label>
            <Input
              id="te-title"
              placeholder={
                expenseType === "fine"
                  ? "e.g. Speed check Morogoro highway"
                  : "e.g. Weighbridge toll receipt, coolant fluid"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Photo / Receipt Camera Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {expenseType === "fine" ? "Fine Ticket Photo" : "Receipt Photo / Document"}
            </Label>
            {photoPreview ? (
              <div className="relative rounded-xl border border-border overflow-hidden bg-black/5 p-2">
                <img
                  src={photoPreview}
                  alt="Receipt Preview"
                  className="max-h-48 w-full object-contain rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={removePhoto}
                  className="absolute top-3 right-3 h-7 w-7 rounded-full shadow-md"
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="mt-1 text-[11px] text-center text-muted-foreground truncate">
                  {photoFile?.name}
                </p>
              </div>
            ) : photoFile ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 text-xs">
                <span className="truncate">{photoFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePhoto}
                  className="h-6 px-2 text-destructive"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer text-center transition-colors">
                  <Camera className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold">Take Photo</span>
                  <span className="text-[10px] text-muted-foreground">Open Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
                <label className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer text-center transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Upload File</span>
                  <span className="text-[10px] text-muted-foreground">Images or PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="te-notes" className="text-xs font-semibold">
              Notes (optional)
            </Label>
            <Textarea
              id="te-notes"
              rows={2}
              placeholder="Additional comments, location, or police station"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Record Cost"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
