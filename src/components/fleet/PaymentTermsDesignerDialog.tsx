import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  SlidersHorizontal,
  Sparkles,
  Check,
  Bookmark,
  Trash2,
  Calendar,
  CreditCard,
  FileCheck2,
  Clock,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const DEFAULT_PAYMENT_TERM_PRESETS = [
  "100% Full Payment",
  "Advance 70% and 30% after 30 days",
  "30 days after delivery Invoicing",
  "50% advance 50% after delivery",
] as const;

const LOCAL_STORAGE_KEY = "machinecare_custom_payment_terms";

interface PaymentTermsDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTerms: string;
  onApplyTerms: (designedTerms: string) => void;
}

export function PaymentTermsDesignerDialog({
  open,
  onOpenChange,
  currentTerms,
  onApplyTerms,
}: PaymentTermsDesignerDialogProps) {
  // Designer state
  const [advancePercent, setAdvancePercent] = useState<number>(70);
  const [advanceMilestone, setAdvanceMilestone] = useState<string>("upon loading & departure");
  const [balanceMilestone, setBalanceMilestone] = useState<string>("after 30 days of delivery invoicing");
  const [customDays, setCustomDays] = useState<number>(30);
  const [structureType, setStructureType] = useState<"split" | "invoicing" | "full">("split");
  const [extraClause, setExtraClause] = useState<string>("");
  const [previewTerms, setPreviewTerms] = useState<string>("");

  // Custom user presets stored in localStorage
  const [savedPresets, setSavedPresets] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setSavedPresets(parsed);
      }
    } catch (e) {
      console.error("Failed to load custom payment terms presets", e);
    }
  }, [open]);

  // When dialog opens, initialize from currentTerms if matched or fallback to defaults
  useEffect(() => {
    if (!open) return;

    if (currentTerms) {
      setPreviewTerms(currentTerms);
      // Try to detect percentage if possible
      const match70 = currentTerms.includes("70%");
      const match50 = currentTerms.includes("50%");
      const match100 = currentTerms.includes("100%");
      if (match70) {
        setStructureType("split");
        setAdvancePercent(70);
      } else if (match50) {
        setStructureType("split");
        setAdvancePercent(50);
      } else if (match100) {
        setStructureType("full");
        setAdvancePercent(100);
      }
    } else {
      setPreviewTerms("Advance 70% and 30% after 30 days");
    }
  }, [open, currentTerms]);

  // Re-calculate generated terms whenever parameters change
  useEffect(() => {
    let generated = "";

    if (structureType === "full") {
      generated = "100% Full Payment upon Booking";
    } else if (structureType === "invoicing") {
      generated = `${customDays} days after delivery Invoicing`;
    } else {
      // Split
      const balance = 100 - advancePercent;
      if (advancePercent === 100) {
        generated = `100% Full Payment ${advanceMilestone}`;
      } else if (advancePercent === 0) {
        generated = `100% Balance payable ${balanceMilestone}`;
      } else {
        generated = `Advance ${advancePercent}% ${advanceMilestone} and ${balance}% ${balanceMilestone}`;
      }
    }

    if (extraClause.trim()) {
      generated += ` · (${extraClause.trim()})`;
    }

    setPreviewTerms(generated);
  }, [structureType, advancePercent, advanceMilestone, balanceMilestone, customDays, extraClause]);

  const handleApply = () => {
    const final = previewTerms.trim();
    if (!final) {
      toast.error("Please enter or generate a payment term");
      return;
    }
    onApplyTerms(final);
    toast.success("Payment terms applied to trip");
    onOpenChange(false);
  };

  const handleSaveAsPreset = () => {
    const term = previewTerms.trim();
    if (!term) return;

    if (savedPresets.includes(term) || (DEFAULT_PAYMENT_TERM_PRESETS as readonly string[]).includes(term)) {
      toast.info("This payment term is already in your presets");
      return;
    }

    const updated = [term, ...savedPresets];
    setSavedPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      toast.success("Saved to custom payment terms presets!");
    } catch (e) {
      toast.error("Could not save preset");
    }
  };

  const handleDeletePreset = (index: number) => {
    const updated = savedPresets.filter((_, i) => i !== index);
    setSavedPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      toast.success("Preset removed");
    } catch (e) {}
  };

  const balancePercent = Math.max(0, 100 - advancePercent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Design & Customize Payment Terms
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Configure advance/balance payment splits, statutory credit periods, delivery invoicing terms, and milestone conditions.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Default Presets Quick Selection */}
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Standard Fleet Payment Presets
              </span>
              <span className="text-[10px] text-muted-foreground">Click to load</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_PAYMENT_TERM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setPreviewTerms(preset);
                    if (preset === "100% Full Payment") {
                      setStructureType("full");
                      setAdvancePercent(100);
                    } else if (preset === "Advance 70% and 30% after 30 days") {
                      setStructureType("split");
                      setAdvancePercent(70);
                      setAdvanceMilestone("");
                      setBalanceMilestone("after 30 days");
                    } else if (preset === "30 days after delivery Invoicing") {
                      setStructureType("invoicing");
                      setCustomDays(30);
                    } else if (preset === "50% advance 50% after delivery") {
                      setStructureType("split");
                      setAdvancePercent(50);
                      setAdvanceMilestone("");
                      setBalanceMilestone("after delivery");
                    }
                  }}
                  className={cn(
                    "text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                    previewTerms === preset
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border/60 bg-background hover:border-primary/40 text-foreground"
                  )}
                >
                  <span className="truncate">{preset}</span>
                  {previewTerms === preset && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Structure Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Payment Structure Model</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStructureType("split")}
                className={cn(
                  "p-2.5 rounded-lg border text-xs text-center font-medium transition-all",
                  structureType === "split"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border bg-background hover:bg-muted/40 text-foreground"
                )}
              >
                <Percent className="h-4 w-4 mx-auto mb-1 text-primary" />
                Advance + Balance Split
              </button>

              <button
                type="button"
                onClick={() => setStructureType("invoicing")}
                className={cn(
                  "p-2.5 rounded-lg border text-xs text-center font-medium transition-all",
                  structureType === "invoicing"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border bg-background hover:bg-muted/40 text-foreground"
                )}
              >
                <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
                Post-Delivery Invoicing
              </button>

              <button
                type="button"
                onClick={() => setStructureType("full")}
                className={cn(
                  "p-2.5 rounded-lg border text-xs text-center font-medium transition-all",
                  structureType === "full"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border bg-background hover:bg-muted/40 text-foreground"
                )}
              >
                <CreditCard className="h-4 w-4 mx-auto mb-1 text-primary" />
                100% Upfront Full
              </button>
            </div>
          </div>

          {/* Interactive Controls based on structure */}
          {structureType === "split" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Percentage Split Ratio:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant="outline" className="bg-primary/10 text-primary font-bold">
                      {advancePercent}% Advance
                    </Badge>
                    <span>:</span>
                    <Badge variant="outline" className="bg-muted font-bold text-foreground">
                      {balancePercent}% Balance
                    </Badge>
                  </div>
                </div>

                <div className="pt-2 px-1">
                  <Slider
                    value={[advancePercent]}
                    onValueChange={(val) => setAdvancePercent(val[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="cursor-pointer"
                  />
                </div>

                {/* Quick Split Pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { label: "70 / 30", adv: 70 },
                    { label: "50 / 50", adv: 50 },
                    { label: "30 / 70", adv: 30 },
                    { label: "80 / 20", adv: 80 },
                    { label: "100% Full", adv: 100 },
                  ].map((btn) => (
                    <Button
                      key={btn.label}
                      type="button"
                      variant={advancePercent === btn.adv ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => setAdvancePercent(btn.adv)}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label className="text-xs">Advance Payment Condition</Label>
                  <select
                    value={advanceMilestone}
                    onChange={(e) => setAdvanceMilestone(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  >
                    <option value="upon loading & departure">upon loading & departure</option>
                    <option value="upon order booking & dispatch">upon order booking & dispatch</option>
                    <option value="upfront before transit">upfront before transit</option>
                    <option value="upon arrival at pickup border">upon arrival at pickup border</option>
                    <option value="">(No extra condition)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Balance Payment Milestone</Label>
                  <select
                    value={balanceMilestone}
                    onChange={(e) => setBalanceMilestone(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  >
                    <option value="after 30 days of delivery invoicing">after 30 days of delivery invoicing</option>
                    <option value="after 30 days">after 30 days</option>
                    <option value="after delivery">after delivery</option>
                    <option value="upon delivery & offloading">upon delivery & offloading</option>
                    <option value="after 15 days of delivery">after 15 days of delivery</option>
                    <option value="after 45 days of delivery">after 45 days of delivery</option>
                    <option value="after 60 days of delivery">after 60 days of delivery</option>
                    <option value="upon verified POD and interchange return">upon verified POD & interchange return</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {structureType === "invoicing" && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <Label className="text-xs font-semibold">Credit Window (Days after Invoicing)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value) || 0)}
                  className="w-28 h-9 font-mono text-sm font-bold"
                />
                <span className="text-xs text-muted-foreground font-medium">Days credit terms</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[15, 30, 45, 60, 90].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={customDays === d ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px] px-2.5"
                    onClick={() => setCustomDays(d)}
                  >
                    Net {d} Days
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Extra Clause */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>Optional Special Clause / Compliance Note</span>
              <span className="text-[10px] text-muted-foreground">e.g. POD required, Bank transfer only</span>
            </Label>
            <Input
              value={extraClause}
              onChange={(e) => setExtraClause(e.target.value)}
              placeholder="e.g. Subject to verified empty container return / interchange receipt"
              className="h-8 text-xs"
            />
          </div>

          {/* Live Preview & Direct Editing Card */}
          <div className="space-y-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-3.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-primary" /> Live Formatted Payment Terms Output
              </Label>
              <Badge variant="outline" className="text-[10px] bg-background font-medium">
                Editable Direct
              </Badge>
            </div>

            <textarea
              rows={2}
              value={previewTerms}
              onChange={(e) => setPreviewTerms(e.target.value)}
              className="w-full text-xs font-medium rounded-lg border border-primary/30 bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
              placeholder="Payment terms text preview..."
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                This exact text will appear on the dispatch sheet, driver waybill, and client receipt.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSaveAsPreset}
                className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 shrink-0 font-medium"
              >
                <Bookmark className="h-3.5 w-3.5" /> Save as Preset
              </Button>
            </div>
          </div>

          {/* User's Custom Saved Presets */}
          {savedPresets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold text-muted-foreground">
                Your Saved Custom Presets ({savedPresets.length})
              </Label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {savedPresets.map((preset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewTerms(preset)}
                      className="text-left font-medium text-foreground hover:text-primary truncate flex-1"
                    >
                      {preset}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePreset(idx)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} className="gap-1.5">
            <Check className="h-4 w-4" /> Apply Terms to Trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
