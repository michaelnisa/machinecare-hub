import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, Sparkles, Check, Edit3 } from "lucide-react";
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
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("machinecare_custom_payment_terms");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCustomPresets(parsed);
      }
    } catch (e) {}
  }, [designerOpen]);

  // Determine if the current value matches a standard preset or custom saved preset
  const matchedPreset = useMemo(() => {
    const val = value.trim().toLowerCase();
    const standard = DEFAULT_PAYMENT_TERM_PRESETS.find(
      (p) => p.trim().toLowerCase() === val
    );
    if (standard) return standard;
    const custom = customPresets.find((p) => p.trim().toLowerCase() === val);
    if (custom) return custom;
    return null;
  }, [value, customPresets]);

  const selectValue = matchedPreset || (value ? "custom" : "none");

  const handleSelectChange = (val: string) => {
    if (val === "custom") {
      setIsEditingCustom(true);
      if (!value) onChange("");
    } else if (val === "designer") {
      setDesignerOpen(true);
    } else {
      setIsEditingCustom(false);
      onChange(val);
    }
  };

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
          Design Terms
        </Button>
      </div>

      {/* Main Select Dropdown */}
      <div className="space-y-2">
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger className={cn("h-9 text-xs sm:text-sm bg-background font-medium", inputClassName)}>
            <SelectValue placeholder="Select Payment Terms..." />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Standard Commercial Terms
              </SelectLabel>
              {DEFAULT_PAYMENT_TERM_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset} className="text-xs py-2 font-medium">
                  {preset}
                </SelectItem>
              ))}
            </SelectGroup>

            {customPresets.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Saved Custom Presets
                  </SelectLabel>
                  {customPresets.map((cp) => (
                    <SelectItem key={cp} value={cp} className="text-xs py-2">
                      {cp}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}

            <SelectSeparator />
            <SelectItem value="custom" className="text-xs py-2 text-primary font-semibold">
              <span className="flex items-center gap-1.5">
                <Edit3 className="h-3.5 w-3.5" /> Custom / Free-form Terms...
              </span>
            </SelectItem>
            <SelectItem value="designer" className="text-xs py-2 text-primary font-semibold">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Open Visual Terms Designer...
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Free-form Custom Input (visible if value is custom or user clicked edit) */}
        {(selectValue === "custom" || isEditingCustom || (!matchedPreset && value.trim().length > 0)) && (
          <div className="relative animate-in fade-in-50 duration-200">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={cn("h-8 text-xs bg-muted/30 focus:bg-background", inputClassName)}
              autoFocus={isEditingCustom}
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Specify tailored milestone, retainage, or credit terms for this client.
            </span>
          </div>
        )}
      </div>

      {/* Quick Pills Bar (Subtle & clean) */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 shrink-0">
            <Sparkles className="h-3 w-3 text-amber-500" /> Presets:
          </span>
          {DEFAULT_PAYMENT_TERM_PRESETS.map((preset) => {
            const isActive = value.trim().toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setIsEditingCustom(false);
                  onChange(preset);
                }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border transition-all inline-flex items-center gap-1",
                  isActive
                    ? "border-primary bg-primary/15 text-primary font-bold shadow-2xs"
                    : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && <Check className="h-2.5 w-2.5 text-primary shrink-0" />}
                <span className="truncate max-w-[130px] sm:max-w-none">{preset}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Embedded Designer Dialog */}
      <PaymentTermsDesignerDialog
        open={designerOpen}
        onOpenChange={setDesignerOpen}
        currentTerms={value}
        onApplyTerms={(designed) => {
          setIsEditingCustom(false);
          onChange(designed);
        }}
      />
    </div>
  );
}
