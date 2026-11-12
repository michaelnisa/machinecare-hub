import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, Search, Check, ChevronsUpDown, X, Container, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FleetVehicle } from "@/lib/fleet-metadata";

interface SearchableVehicleSelectProps {
  vehicles: FleetVehicle[];
  value: string;
  onChange: (vehicleId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function SearchableVehicleSelect({
  vehicles,
  value,
  onChange,
  placeholder = "Select vehicle or equipment...",
  disabled = false,
  className,
}: SearchableVehicleSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === value),
    [vehicles, value]
  );

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;

    return vehicles.filter((v) => {
      const name = (v.name || "").toLowerCase();
      const plate = (v.plate_number || "").toLowerCase();
      const code = (v.vehicle_code || "").toLowerCase();
      const trailer = (v.trailer_plate || v.linked_trailer_plate || "").toLowerCase();
      const make = (v.make || "").toLowerCase();
      const model = (v.model || "").toLowerCase();
      const cat = (v.category || "").toLowerCase();

      return (
        name.includes(q) ||
        plate.includes(q) ||
        code.includes(q) ||
        trailer.includes(q) ||
        make.includes(q) ||
        model.includes(q) ||
        cat.includes(q)
      );
    });
  }, [vehicles, search]);

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
              !selectedVehicle && "text-muted-foreground",
              open && "ring-2 ring-primary/20 border-primary"
            )}
          >
            {selectedVehicle ? (
              <div className="flex items-center gap-2 min-w-0 truncate">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">
                  {selectedVehicle.name}
                </span>
                {selectedVehicle.plate_number && (
                  <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0 shrink-0 font-bold bg-muted/50">
                    {selectedVehicle.plate_number}
                  </Badge>
                )}
                {selectedVehicle.has_trailer && selectedVehicle.trailer_plate && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary border border-primary/20">
                    + Trailer [{selectedVehicle.trailer_plate}]
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground truncate">
                <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{placeholder}</span>
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {selectedVehicle && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[340px] max-w-[600px] p-0 z-[100]" align="start">
          <div className="flex items-center border-b border-border px-3 py-2 bg-muted/20">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle name, plate, trailer, model..."
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

          <div className="max-h-72 overflow-y-auto p-1 divide-y divide-border/30">
            {filteredVehicles.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <Truck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-foreground">No vehicles found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No matching vehicle or equipment for "{search}"
                </p>
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isSelected = vehicle.id === value;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => {
                      onChange(vehicle.id);
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
                        <span className="font-semibold text-foreground truncate">
                          {vehicle.name}
                        </span>
                        {vehicle.plate_number && (
                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 bg-background font-bold">
                            {vehicle.plate_number}
                          </Badge>
                        )}
                        {vehicle.vehicle_code && vehicle.vehicle_code !== vehicle.plate_number && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                            {vehicle.vehicle_code}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                        {vehicle.has_trailer && (
                          <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                            <Container className="h-3 w-3" />
                            Trailer: {vehicle.trailer_plate || "Hitched"}
                          </span>
                        )}
                        {vehicle.total_tank_capacity_l ? (
                          <span>Tank: {vehicle.total_tank_capacity_l}L</span>
                        ) : null}
                        {vehicle.current_odometer_km != null && (
                          <span className="inline-flex items-center gap-0.5 font-mono">
                            <Gauge className="h-3 w-3 text-muted-foreground" />
                            {vehicle.current_odometer_km.toLocaleString()} km
                          </span>
                        )}
                        {vehicle.make && (
                          <span className="text-muted-foreground/80">
                            {vehicle.make} {vehicle.model || ""}
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
            <span>Showing {filteredVehicles.length} of {vehicles.length} vehicles</span>
            <span className="font-medium">Search by plate or name</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
