import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Sparkles, Check } from "lucide-react";
import {
  PaymentTermsDesignerDialog,
  DEFAULT_PAYMENT_TERM_PRESETS,
} from "./PaymentTermsDesignerDialog";
import { cn } from "@/lib/utils";

interface PaymentTermsInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showPresets?: boolean;
}

export function PaymentTermsInput({
  value,
  onChange,
  label = "Payment Terms",
  placeholder = "e.g. Advance 70% and 30% after 30 days",
  className,
  inputClassName,
  showPresets = true,
}: PaymentTermsInputProps) {
  const [designerOpen, setDesignerOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("machinecare_custom_payment_terms");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCustomPresets(parsed);
      }
    } catch (e) {}
  }, [designerOpen]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{label}</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDesignerOpen(true)}
          className="h-7 text-[11px] px-2.5 text-primary border-primary/30 hover:bg-primary/10 hover:text-primary gap-1 font-semibold"
        >
          <SlidersHorizontal className="h-3 w-3" />
          Design Payment Terms
        </Button>
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("h-9 text-xs sm:text-sm bg-background", inputClassName)}
        />
      </div>

      {showPresets && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="h-3 w-3 text-amber-500" /> Quick Payment Presets:
            </span>
            <span>Click to select</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_PAYMENT_TERM_PRESETS.map((preset) => {
              const isActive = value.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition-all inline-flex items-center gap-1 font-medium",
                    isActive
                      ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                      : "border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                  <span>{preset}</span>
                </button>
              );
            })}

            {/* Display first 2 custom saved presets if any */}
            {customPresets.slice(0, 2).map((cp) => {
              const isActive = value.trim().toLowerCase() === cp.toLowerCase();
              return (
                <button
                  key={cp}
                  type="button"
                  onClick={() => onChange(cp)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition-all inline-flex items-center gap-1 font-medium italic",
                    isActive
                      ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                      : "border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  title={`Custom preset: ${cp}`}
                >
                  {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                  <span className="truncate max-w-[160px]">{cp}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Embedded Designer Dialog */}
      <PaymentTermsDesignerDialog
        open={designerOpen}
        onOpenChange={setDesignerOpen}
        currentTerms={value}
        onApplyTerms={(designed) => onChange(designed)}
      />
    </div>
  );
}
