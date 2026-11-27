import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TRUCK_LAYOUTS,
  normalizeTyrePosition,
  formatPositionName,
  TYRE_MIN_TREAD_MM,
  type TruckLayoutConfigId,
  type TruckLayoutConfig,
  type AxleDefinition,
} from "@/lib/fleet-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Disc,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Wrench,
  Gauge,
  Plus,
  Info,
} from "lucide-react";
import { formatNumber, formatDate } from "@/lib/format";

export interface TireRecord {
  id: string;
  machine_id: string;
  position: string;
  brand?: string | null;
  pattern?: string | null;
  size?: string | null;
  serial?: string | null;
  current_tread_mm?: number | null;
  fitted_odo?: number | null;
  fitted_at?: string | null;
  target_replace_km?: number | null;
}

interface TireAxleMatrixProps {
  vehicle: {
    id: string;
    name: string;
    plate_number?: string | null;
    axle_configuration?: string | null;
    current_odometer_km?: number | null;
  };
  tyres: TireRecord[];
  className?: string;
}

export function TireAxleMatrix({ vehicle, tyres, className = "" }: TireAxleMatrixProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Determine axle layout
  const layoutId = useMemo<TruckLayoutConfigId>(() => {
    const raw = vehicle.axle_configuration;
    if (raw && TRUCK_LAYOUTS[raw as TruckLayoutConfigId]) {
      return raw as TruckLayoutConfigId;
    }
    // Default to 6x4 if heavy truck or trailer
    const name = (vehicle.name || "").toLowerCase();
    if (name.includes("trailer")) return "trailer_tri";
    return "6x4";
  }, [vehicle.axle_configuration, vehicle.name]);

  const layout: TruckLayoutConfig = TRUCK_LAYOUTS[layoutId] || TRUCK_LAYOUTS["6x4"];

  // Map tyres by normalized position
  const tyresByPosition = useMemo(() => {
    const map = new Map<string, TireRecord>();
    for (const t of tyres) {
      const norm = normalizeTyrePosition(t.position);
      map.set(norm, t);
      map.set(t.position, t);
    }
    return map;
  }, [tyres]);

  // Tyre statistics
  const stats = useMemo(() => {
    const totalSlots = layout.totalTyres;
    const fittedCount = tyres.length;
    const depths = tyres
      .map((t) => t.current_tread_mm)
      .filter((d): d is number => d != null && !Number.isNaN(d));

    const avgDepth = depths.length > 0
      ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)
      : null;

    const criticalCount = tyres.filter(
      (t) => t.current_tread_mm != null && t.current_tread_mm <= TYRE_MIN_TREAD_MM
    ).length;

    const warningCount = tyres.filter(
      (t) =>
        t.current_tread_mm != null &&
        t.current_tread_mm > TYRE_MIN_TREAD_MM &&
        t.current_tread_mm <= 5.0
    ).length;

    return { totalSlots, fittedCount, avgDepth, criticalCount, warningCount };
  }, [layout, tyres]);

  const selectedTyre = selectedSlot ? tyresByPosition.get(selectedSlot) : null;

  const getTreadStatusColor = (treadMm?: number | null) => {
    if (treadMm == null) return "text-muted-foreground border-border bg-muted/40";
    if (treadMm <= TYRE_MIN_TREAD_MM) return "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10";
    if (treadMm <= 5.0) return "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10";
    return "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  };

  const getTreadBarColor = (treadMm?: number | null) => {
    if (treadMm == null) return "bg-muted";
    if (treadMm <= TYRE_MIN_TREAD_MM) return "bg-rose-500";
    if (treadMm <= 5.0) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className={`space-y-5 rounded-2xl border border-border bg-card p-5 ${className}`}>
      {/* Header & Quick Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              Commercial Axle Matrix &amp; Tread Lifecycle (Slide 18)
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {layout.name}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Top-down chassis visualization with real-time tread wear gauges and dual-wheel positions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link to={`/fleet/tyres?vehicle=${vehicle.id}&tab=chassis`}>
              <Disc className="h-3.5 w-3.5 text-primary" />
              Tyre Workshop Console
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Fitted Tyres</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">{stats.fittedCount}</span>
            <span className="text-xs text-muted-foreground">/ {stats.totalSlots} slots</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Avg Tread Depth</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">
              {stats.avgDepth ? `${stats.avgDepth} mm` : "—"}
            </span>
            <span className="text-[11px] text-muted-foreground">(New: 14-16mm)</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Critical (&lt; 3mm)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-bold ${stats.criticalCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {stats.criticalCount}
            </span>
            <span className="text-xs text-muted-foreground">require replacement</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Warning (3-5mm)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-600">{stats.warningCount}</span>
            <span className="text-xs text-muted-foreground">monitor wear</span>
          </div>
        </div>
      </div>

      {/* Visual Chassis Canvas */}
      <div className="relative mx-auto max-w-2xl rounded-2xl border border-border bg-gradient-to-b from-muted/30 via-background to-muted/20 p-6">
        {/* Front Cabin Indicator */}
        <div className="mx-auto mb-6 flex max-w-[200px] flex-col items-center justify-center rounded-t-2xl border-t-2 border-x-2 border-primary/40 bg-primary/5 py-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            ▲ FRONT CABIN / ENGINE ▲
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {vehicle.plate_number || vehicle.name}
          </span>
        </div>

        {/* Axle Stack */}
        <div className="space-y-8 relative">
          {/* Vertical Chassis Rails (Background) */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -ml-12 w-6 border-x border-border/80 bg-muted/30 opacity-60" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 ml-6 w-6 border-x border-border/80 bg-muted/30 opacity-60" />

          {layout.axles.map((axle, idx) => {
            const leftSlots = axle.slots.filter((s) => s.side === "left");
            const rightSlots = axle.slots.filter((s) => s.side === "right");

            return (
              <div key={axle.id} className="relative z-10 space-y-2">
                {/* Axle Label & Bar */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground">{axle.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({axle.isDual ? "Dual Wheel Hubs" : "Single Steer Hubs"})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">Axle {axle.id}</span>
                </div>

                {/* Horizontal Axle Bar + Wheel Slots */}
                <div className="relative flex items-center justify-between rounded-xl border border-border bg-card/90 p-3 shadow-xs">
                  {/* Axle Steel Shaft Line */}
                  <div className="pointer-events-none absolute inset-x-8 top-1/2 h-1.5 -translate-y-1/2 bg-slate-400/40 dark:bg-slate-700 rounded-full" />

                  {/* Left Wheel(s) */}
                  <div className="relative z-10 flex items-center gap-2">
                    {leftSlots.map((slot) => {
                      const tyre = tyresByPosition.get(slot.id);
                      const isSelected = selectedSlot === slot.id;
                      const tread = tyre?.current_tread_mm ?? null;

                      return (
                        <button
                          type="button"
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`group relative flex flex-col items-center justify-between rounded-lg border-2 p-2 text-center transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20 scale-105"
                              : tyre
                              ? "border-border bg-card hover:border-primary/50"
                              : "border-dashed border-border/80 bg-muted/20 hover:bg-muted/40"
                          } w-24 h-28 cursor-pointer`}
                        >
                          {/* Tyre Shape Header */}
                          <div className="w-full flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-primary">{slot.id}</span>
                            {slot.tier && (
                              <span className="text-[9px] uppercase text-muted-foreground">
                                {slot.tier === "outer" ? "OUT" : "INN"}
                              </span>
                            )}
                          </div>

                          {/* Tyre Tread Graphic */}
                          {tyre ? (
                            <div className="w-full space-y-1 my-auto">
                              <span className="block truncate font-semibold text-[11px] text-foreground">
                                {tyre.brand || "Commercial"}
                              </span>
                              <span className="block truncate font-mono text-[9px] text-muted-foreground">
                                {tyre.serial ? `SN: ${tyre.serial}` : tyre.size || "315/80R"}
                              </span>

                              {/* Tread Meter Bar */}
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getTreadBarColor(tread)}`}
                                  style={{
                                    width: `${Math.min(100, ((tread ?? 0) / 16) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="my-auto text-[10px] text-muted-foreground italic flex flex-col items-center gap-1">
                              <Disc className="h-4 w-4 opacity-40" />
                              <span>Empty</span>
                            </div>
                          )}

                          {/* Bottom Tread Badge */}
                          {tyre ? (
                            <span
                              className={`inline-block w-full rounded border px-1 py-0.5 text-[10px] font-bold font-mono ${getTreadStatusColor(
                                tread
                              )}`}
                            >
                              {tread != null ? `${tread} mm` : "No read"}
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground font-mono">Unfitted</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Differential Center Hub */}
                  <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-mono font-bold text-muted-foreground shadow-inner">
                    {axle.type === "rear_drive" ? "DIFF" : "HUB"}
                  </div>

                  {/* Right Wheel(s) */}
                  <div className="relative z-10 flex items-center gap-2">
                    {rightSlots.map((slot) => {
                      const tyre = tyresByPosition.get(slot.id);
                      const isSelected = selectedSlot === slot.id;
                      const tread = tyre?.current_tread_mm ?? null;

                      return (
                        <button
                          type="button"
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`group relative flex flex-col items-center justify-between rounded-lg border-2 p-2 text-center transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20 scale-105"
                              : tyre
                              ? "border-border bg-card hover:border-primary/50"
                              : "border-dashed border-border/80 bg-muted/20 hover:bg-muted/40"
                          } w-24 h-28 cursor-pointer`}
                        >
                          <div className="w-full flex items-center justify-between text-[10px]">
                            {slot.tier && (
                              <span className="text-[9px] uppercase text-muted-foreground">
                                {slot.tier === "outer" ? "OUT" : "INN"}
                              </span>
                            )}
                            <span className="font-mono font-bold text-primary">{slot.id}</span>
                          </div>

                          {tyre ? (
                            <div className="w-full space-y-1 my-auto">
                              <span className="block truncate font-semibold text-[11px] text-foreground">
                                {tyre.brand || "Commercial"}
                              </span>
                              <span className="block truncate font-mono text-[9px] text-muted-foreground">
                                {tyre.serial ? `SN: ${tyre.serial}` : tyre.size || "315/80R"}
                              </span>

                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getTreadBarColor(tread)}`}
                                  style={{
                                    width: `${Math.min(100, ((tread ?? 0) / 16) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="my-auto text-[10px] text-muted-foreground italic flex flex-col items-center gap-1">
                              <Disc className="h-4 w-4 opacity-40" />
                              <span>Empty</span>
                            </div>
                          )}

                          {tyre ? (
                            <span
                              className={`inline-block w-full rounded border px-1 py-0.5 text-[10px] font-bold font-mono ${getTreadStatusColor(
                                tread
                              )}`}
                            >
                              {tread != null ? `${tread} mm` : "No read"}
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground font-mono">Unfitted</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Spare Wheel Carrier */}
        <div className="mt-8 border-t border-dashed border-border pt-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-bold text-foreground">Under-Chassis Spare Carrier</span>
            <span className="text-[10px] text-muted-foreground">Mounted Emergency Tyres</span>
          </div>
          <div className="flex justify-center gap-4">
            {["Spare1", "Spare2"].map((spareId, sIdx) => {
              const tyre = tyresByPosition.get(spareId);
              const isSelected = selectedSlot === spareId;
              const tread = tyre?.current_tread_mm ?? null;

              return (
                <button
                  type="button"
                  key={spareId}
                  onClick={() => setSelectedSlot(spareId)}
                  className={`flex flex-col items-center justify-between rounded-lg border-2 p-2 text-center transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 scale-105"
                      : tyre
                      ? "border-border bg-card hover:border-primary/50"
                      : "border-dashed border-border/80 bg-muted/20 hover:bg-muted/40"
                  } w-28 h-24 cursor-pointer`}
                >
                  <div className="w-full flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-primary">Spare {sIdx + 1}</span>
                    <Disc className="h-3 w-3 text-muted-foreground" />
                  </div>
                  {tyre ? (
                    <div className="w-full truncate text-[11px] font-semibold text-foreground my-1">
                      {tyre.brand || "Spare"} · {tyre.current_tread_mm != null ? `${tyre.current_tread_mm}mm` : ""}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic my-1">Carrier Empty</span>
                  )}
                  <span className="text-[9px] font-mono text-muted-foreground">{spareId}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Slot Detailed Dossier */}
      {selectedSlot && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 animate-fade-in space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground">
                Slot {selectedSlot}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatPositionName(selectedSlot)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
                <Link to={`/fleet/tyres?vehicle=${vehicle.id}&tab=chassis&slot=${selectedSlot}`}>
                  <ArrowRightLeft className="h-3 w-3" /> Rotate / Swap Slot
                </Link>
              </Button>
            </div>
          </div>

          {selectedTyre ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Serial Number:</span>
                <div className="font-mono font-bold text-foreground">
                  {selectedTyre.serial || "No Serial Recorded"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Brand &amp; Size:</span>
                <div className="font-semibold text-foreground">
                  {selectedTyre.brand || "—"} ({selectedTyre.size || "315/80R22.5"})
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Current Tread Depth:</span>
                <div className="font-mono font-bold text-foreground">
                  {selectedTyre.current_tread_mm != null
                    ? `${selectedTyre.current_tread_mm} mm`
                    : "Not measured"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Fitment Date / Odo:</span>
                <div className="font-medium text-foreground">
                  {selectedTyre.fitted_at ? formatDate(selectedTyre.fitted_at) : "—"}{" "}
                  {selectedTyre.fitted_odo != null && `(${formatNumber(selectedTyre.fitted_odo)} km)`}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between py-2 text-xs">
              <span className="text-muted-foreground">
                This axle wheel hub currently has no tyre assigned.
              </span>
              <Button size="sm" asChild className="h-7 text-xs gap-1">
                <Link to={`/fleet/tyres?vehicle=${vehicle.id}&tab=chassis&fit=${selectedSlot}`}>
                  <Plus className="h-3 w-3" /> Fit Tyre to Slot
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
