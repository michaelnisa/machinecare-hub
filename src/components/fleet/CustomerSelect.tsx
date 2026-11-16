import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  RegisteredCustomer,
  getRegisteredCustomers,
} from "@/services/customerService";
import { Building2, Check, Sparkles, Edit3 } from "lucide-react";

interface CustomerSelectProps {
  value: string;
  onChange: (customerName: string, customerMeta?: RegisteredCustomer) => void;
  organisation?: { id?: string | null; name?: string | null } | null;
  placeholder?: string;
  className?: string;
  onAutoFillCargo?: (suggestedCargo: string, suggestedTerms?: string) => void;
}

export function CustomerSelect({
  value,
  onChange,
  organisation,
  placeholder = "Select client from dropdown...",
  className,
  onAutoFillCargo,
}: CustomerSelectProps) {
  const customers = getRegisteredCustomers(organisation);

  // Check if current value matches one of the registered customers
  const currentMatch = customers.find(
    (c) => c.name.toLowerCase() === (value || "").trim().toLowerCase()
  );

  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    if (!value) return false;
    return !currentMatch;
  });

  useEffect(() => {
    if (value && !currentMatch) {
      setIsCustomMode(true);
    }
  }, [value, currentMatch]);

  const handleSelectChange = (val: string) => {
    if (val === "__custom__") {
      setIsCustomMode(true);
      return;
    }

    const matched = customers.find((c) => c.name === val);
    if (matched) {
      setIsCustomMode(false);
      onChange(matched.name, matched);
      if (onAutoFillCargo) {
        onAutoFillCargo(matched.defaultCargo, matched.defaultPaymentTerms);
      }
    }
  };

  const handlePillClick = (cust: RegisteredCustomer) => {
    setIsCustomMode(false);
    onChange(cust.name, cust);
    if (onAutoFillCargo) {
      onAutoFillCargo(cust.defaultCargo, cust.defaultPaymentTerms);
    }
  };

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {/* Primary Customer Dropdown */}
      <Select
        value={currentMatch ? currentMatch.name : (isCustomMode ? "__custom__" : "")}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="h-10 text-xs sm:text-sm bg-background border-primary/30 font-semibold text-foreground">
          <SelectValue placeholder="— Select Customer / Client —" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50">
            <span>Registered Commercial Customers ({customers.length})</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
              Verified
            </Badge>
          </div>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.name} className="cursor-pointer text-xs py-2">
              <div className="flex flex-col gap-0.5 text-left">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{c.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {c.industryCategory}
                </span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="__custom__" className="text-xs text-muted-foreground border-t border-border mt-1">
            ✏️ Other / Enter Custom Client Name...
          </SelectItem>
        </SelectContent>
      </Select>

      {/* If Custom Mode or user wants to edit/type custom name */}
      {isCustomMode && (
        <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1 text-primary">
              <Edit3 className="h-3 w-3" />
              Custom / Unlisted Client Name:
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                if (customers.length > 0) handlePillClick(customers[0]);
              }}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Back to Registered List
            </button>
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Type custom customer or consignee name..."}
            className="h-9 text-xs sm:text-sm font-semibold bg-background"
            autoFocus
          />
        </div>
      )}

      {/* 1-Click Quick Select Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10.5px] font-semibold text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          Quick Pick:
        </span>
        {customers.map((cust) => {
          const isSelected = value?.trim().toLowerCase() === cust.name.toLowerCase();
          return (
            <button
              key={cust.id}
              type="button"
              onClick={() => handlePillClick(cust)}
              className={`text-[10.5px] px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 border ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                  : "bg-muted/40 hover:bg-muted text-foreground border-border/70 hover:border-primary/40"
              }`}
              title={`${cust.name} · ${cust.industryCategory}`}
            >
              {isSelected && <Check className="h-2.5 w-2.5 shrink-0" />}
              <span>{cust.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
