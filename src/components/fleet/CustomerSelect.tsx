import React, { useState } from "react";
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
  isLogistixwareAccount,
} from "@/services/customerService";
import { Building2, Check, Sparkles } from "lucide-react";

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
  placeholder = "Select or type client name...",
  className,
  onAutoFillCargo,
}: CustomerSelectProps) {
  const isLogistix = isLogistixwareAccount(organisation);
  const customers = getRegisteredCustomers(organisation);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    if (!isLogistix) return true;
    if (!value) return false;
    return !customers.some((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  });

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

  // If not Logistixware, render clean input for custom client entry
  if (!isLogistix || customers.length === 0) {
    return (
      <div className={className}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "e.g. Commercial Consignee / Company Name"}
          className="h-9 text-sm"
        />
      </div>
    );
  }

  // When in Logistixware account:
  const currentMatch = customers.find(
    (c) => c.name.toLowerCase() === (value || "").trim().toLowerCase()
  );

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {/* Dropdown Selector */}
      <div className="flex items-center gap-2">
        <Select
          value={currentMatch ? currentMatch.name : (isCustomMode ? "__custom__" : "")}
          onValueChange={handleSelectChange}
        >
          <SelectTrigger className="h-9 text-xs sm:text-sm bg-background border-primary/30 font-medium">
            <SelectValue placeholder="— Select Logistixware Customer —" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Logistixware Clients ({customers.length})</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                Official
              </Badge>
            </div>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.name} className="cursor-pointer text-xs py-2">
                <div className="flex flex-col gap-0.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-primary shrink-0" />
                    <span>{c.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {c.industryCategory}
                  </span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value="__custom__" className="text-xs text-muted-foreground border-t border-border mt-1">
              ✏️ Type Custom / Other Customer Name...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom input entry if custom mode is enabled or user wants to customize */}
      {isCustomMode && (
        <div className="space-y-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter custom customer or consignee name..."
            className="h-9 text-xs sm:text-sm font-medium"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">
            Type custom client name or pick one of Logistixware's registered clients below.
          </p>
        </div>
      )}

      {/* Quick 1-Click Badges for Registered Clients */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10.5px] font-semibold text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          Logistixware Clients:
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
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
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
