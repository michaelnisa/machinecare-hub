import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Search, Check, ChevronsUpDown, X, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FleetDriver } from "@/lib/fleet-metadata";

interface SearchableDriverSelectProps {
  drivers: (FleetDriver | { id: string; full_name: string; driver_code?: string; phone?: string | null })[];
  value: string;
  onChange: (driverId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}

export function SearchableDriverSelect({
  drivers,
  value,
  onChange,
  placeholder = "Pick an active licensed driver...",
  disabled = false,
  className,
  allowClear = true,
}: SearchableDriverSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === value),
    [drivers, value]
  );

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;

    return drivers.filter((d) => {
      const name = (d.full_name || "").toLowerCase();
      const code = ((d as any).driver_code || "").toLowerCase();
      const phone = (d.phone || "").toLowerCase();
      const license = ((d as any).license_number || (d as any).licence_number || "").toLowerCase();

      return (
        name.includes(q) ||
        code.includes(q) ||
        phone.includes(q) ||
        license.includes(q)
      );
    });
  }, [drivers, search]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal text-left h-10 px-3 bg-background hover:bg-muted/40",
              !selectedDriver && "text-muted-foreground",
              open && "ring-2 ring-primary/20 border-primary"
            )}
          >
            {selectedDriver ? (
              <div className="flex items-center gap-2 min-w-0 truncate">
                <User className="h-4 w-4 text-primary shrink-0" />
                {(selectedDriver as any).driver_code && (
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0 font-bold bg-muted/50">
                    {(selectedDriver as any).driver_code}
                  </Badge>
                )}
                <span className="font-semibold text-foreground truncate">
                  {selectedDriver.full_name}
                </span>
                {selectedDriver.phone && (
                  <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                    ({selectedDriver.phone})
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground truncate">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{placeholder}</span>
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {selectedDriver && allowClear && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Clear driver selection"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[500px] p-0 z-[100]" align="start">
          <div className="flex items-center border-b border-border px-3 py-2 bg-muted/20">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver name, DRV code, phone..."
              className="h-8 border-none bg-transparent focus-visible:ring-0 shadow-none text-xs px-0 placeholder:text-muted-foreground"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/30">
            {/* Option to clear/leave unassigned */}
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between gap-2 text-muted-foreground hover:bg-muted/70",
                  !value && "bg-muted font-medium text-foreground"
                )}
              >
                <span className="italic flex items-center gap-2">
                  <User className="h-3.5 w-3.5 opacity-50" />
                  — Unassigned / No driver assigned
                </span>
                {!value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )}

            {filteredDrivers.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-foreground">No drivers found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No matching driver for "{search}"
                </p>
              </div>
            ) : (
              filteredDrivers.map((driver) => {
                const isSelected = driver.id === value;
                const dCode = (driver as any).driver_code;
                const license = (driver as any).license_number || (driver as any).licence_number;

                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => {
                      onChange(driver.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-start justify-between gap-2",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {dCode && (
                          <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 bg-background font-bold">
                            {dCode}
                          </Badge>
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {driver.full_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                        {driver.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {driver.phone}
                          </span>
                        )}
                        {license && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                            Lic: {license}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between px-3">
            <span>Showing {filteredDrivers.length} of {drivers.length} drivers</span>
            <span className="font-medium">Search by name or code</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
