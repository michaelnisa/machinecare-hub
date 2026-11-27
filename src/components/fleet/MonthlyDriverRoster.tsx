import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  RotateCcw,
  Sparkles,
  Users,
  Clock,
  Truck,
  CheckCircle2,
  FileText,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import type { FleetDriver } from "@/lib/fleet-metadata";

export type ShiftType = "D" | "N" | "LH" | "OFF" | "LV" | "STB";

export interface ShiftDefinition {
  code: ShiftType;
  label: string;
  hours: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
  printBg: string;
}

export const SHIFT_DEFINITIONS: Record<ShiftType, ShiftDefinition> = {
  D: {
    code: "D",
    label: "Day Shift (08:00 - 17:00)",
    hours: 9,
    bgClass: "bg-emerald-500/15 hover:bg-emerald-500/25",
    textClass: "text-emerald-700 dark:text-emerald-400 font-bold",
    borderClass: "border-emerald-500/30",
    printBg: "#ecfdf5",
  },
  N: {
    code: "N",
    label: "Night Shift (18:00 - 06:00)",
    hours: 12,
    bgClass: "bg-indigo-500/15 hover:bg-indigo-500/25",
    textClass: "text-indigo-700 dark:text-indigo-400 font-bold",
    borderClass: "border-indigo-500/30",
    printBg: "#eef2ff",
  },
  LH: {
    code: "LH",
    label: "Long Haul / Corridor Trip",
    hours: 14,
    bgClass: "bg-amber-500/15 hover:bg-amber-500/25",
    textClass: "text-amber-700 dark:text-amber-400 font-bold",
    borderClass: "border-amber-500/30",
    printBg: "#fffbeb",
  },
  OFF: {
    code: "OFF",
    label: "Off / Rest Day",
    hours: 0,
    bgClass: "bg-slate-500/15 hover:bg-slate-500/25",
    textClass: "text-slate-600 dark:text-slate-400 font-medium",
    borderClass: "border-slate-500/30",
    printBg: "#f1f5f9",
  },
  LV: {
    code: "LV",
    label: "Annual / Sick Leave",
    hours: 0,
    bgClass: "bg-rose-500/15 hover:bg-rose-500/25",
    textClass: "text-rose-700 dark:text-rose-400 font-bold",
    borderClass: "border-rose-500/30",
    printBg: "#fff1f2",
  },
  STB: {
    code: "STB",
    label: "Standby / Depot Reserve",
    hours: 8,
    bgClass: "bg-cyan-500/15 hover:bg-cyan-500/25",
    textClass: "text-cyan-700 dark:text-cyan-400 font-bold",
    borderClass: "border-cyan-500/30",
    printBg: "#ecfeff",
  },
};

const SHIFT_CYCLE: ShiftType[] = ["D", "N", "LH", "OFF", "STB", "LV"];

interface MonthlyDriverRosterProps {
  drivers: FleetDriver[];
  onClose?: () => void;
}

export function MonthlyDriverRoster({ drivers, onClose }: MonthlyDriverRosterProps) {
  const { organisation, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [selectedShiftForBrush, setSelectedShiftForBrush] = useState<ShiftType | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const storageKey = `fleet_monthly_roster_${organisation?.id || "default"}_${year}_${month + 1}`;

  // Days in month
  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
      const dayAbbr = date.toLocaleString("default", { weekday: "narrow" });
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      return { dayNum, dayOfWeek, dayAbbr, isWeekend, date };
    });
  }, [year, month, daysInMonth]);

  // Roster schedule state: { [driverId]: { [dayNum]: ShiftType } }
  const [roster, setRoster] = useState<Record<string, Record<number, ShiftType>>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to read saved roster:", e);
      }
    }
    return {};
  });

  // Reload roster when month/year changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setRoster(JSON.parse(saved));
          return;
        }
      } catch (e) {
        console.warn("Failed to reload roster:", e);
      }
    }
    // Generate default template if nothing saved
    const initial: Record<string, Record<number, ShiftType>> = {};
    drivers.forEach((d) => {
      initial[d.id] = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        // Default: Sunday off, others Day shift
        initial[d.id][day] = dayOfWeek === 0 ? "OFF" : "D";
      }
    });
    setRoster(initial);
  }, [storageKey, daysInMonth, year, month, drivers]);

  // Save to localStorage whenever roster changes
  const updateRoster = (newRoster: Record<string, Record<number, ShiftType>>) => {
    setRoster(newRoster);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newRoster));
      } catch (e) {
        console.warn("Failed to save roster:", e);
      }
    }
  };

  const handleCellClick = (driverId: string, dayNum: number) => {
    const currentShift = roster[driverId]?.[dayNum] || "D";
    let nextShift: ShiftType;

    if (selectedShiftForBrush) {
      nextShift = selectedShiftForBrush;
    } else {
      const idx = SHIFT_CYCLE.indexOf(currentShift);
      nextShift = SHIFT_CYCLE[(idx + 1) % SHIFT_CYCLE.length];
    }

    const updated = {
      ...roster,
      [driverId]: {
        ...(roster[driverId] || {}),
        [dayNum]: nextShift,
      },
    };
    updateRoster(updated);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Quick auto-populate presets
  const handleAutoFillStandard = () => {
    const updated: Record<string, Record<number, ShiftType>> = {};
    drivers.forEach((d, dIdx) => {
      updated[d.id] = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        // Alternate some drivers for Night shift or Sunday coverage
        if (dayOfWeek === 0) {
          updated[d.id][day] = "OFF";
        } else if (dIdx % 4 === 1 && dayOfWeek % 2 === 0) {
          updated[d.id][day] = "N";
        } else if (dIdx % 4 === 2 && day > 10 && day < 20) {
          updated[d.id][day] = "LH";
        } else {
          updated[d.id][day] = "D";
        }
      }
    });
    updateRoster(updated);
    toast.success(`Generated standard rotational roster for ${monthName} ${year}!`);
  };

  const handleClearRoster = () => {
    const updated: Record<string, Record<number, ShiftType>> = {};
    drivers.forEach((d) => {
      updated[d.id] = {};
      for (let day = 1; day <= daysInMonth; day++) {
        updated[d.id][day] = "OFF";
      }
    });
    updateRoster(updated);
    toast.info("Roster reset to OFF.");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ["Driver ID", "Driver Name", "Vehicle / Class", ...daysArray.map((d) => `Day ${d.dayNum}`), "Total Shifts", "Total Rest Days"];
    const rows = filteredDrivers.map((d) => {
      const driverShifts = roster[d.id] || {};
      let totalWork = 0;
      let totalOff = 0;
      const dayValues = daysArray.map((day) => {
        const shift = driverShifts[day.dayNum] || "OFF";
        if (shift === "D" || shift === "N" || shift === "LH" || shift === "STB") totalWork++;
        if (shift === "OFF") totalOff++;
        return shift;
      });
      return [
        `"${d.driver_code || ""}"`,
        `"${d.full_name}"`,
        `"${d.assigned_vehicle || d.licence_class || "Fleet"}"`,
        ...dayValues,
        totalWork,
        totalOff,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `driver_roster_${year}_${month + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered active drivers
  const activeDrivers = useMemo(() => {
    return drivers.filter((d) => d.status !== "inactive" && d.status !== "suspended");
  }, [drivers]);

  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return activeDrivers;
    const q = search.toLowerCase();
    return activeDrivers.filter(
      (d) =>
        d.full_name.toLowerCase().includes(q) ||
        (d.driver_code && d.driver_code.toLowerCase().includes(q)) ||
        (d.assigned_vehicle && d.assigned_vehicle.toLowerCase().includes(q))
    );
  }, [activeDrivers, search]);

  // Daily statistics
  const dailyStats = useMemo(() => {
    return daysArray.map((day) => {
      let onDuty = 0;
      let offDuty = 0;
      let onLeave = 0;
      activeDrivers.forEach((d) => {
        const shift = roster[d.id]?.[day.dayNum] || "OFF";
        if (shift === "D" || shift === "N" || shift === "LH" || shift === "STB") {
          onDuty++;
        } else if (shift === "OFF") {
          offDuty++;
        } else if (shift === "LV") {
          onLeave++;
        }
      });
      return { dayNum: day.dayNum, onDuty, offDuty, onLeave };
    });
  }, [daysArray, activeDrivers, roster]);

  const companyName = organisation?.name || "MachineCare Hub Commercial Fleet";
  const logoUrl = organisation?.logo_url;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ========================================================= */}
      {/* SCREEN CONTROLS BAR (Hidden in Print)                     */}
      {/* ========================================================= */}
      <div className="print:hidden space-y-4">
        {/* Header & Month Navigator */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Monthly Driver Roster & Shift Planning</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 uppercase text-[10px]">
                    Official Schedule
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Plan, allocate, and print monthly driver shift rotations, highway corridors, and rest days
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFillStandard}
              className="gap-1.5 cursor-pointer text-xs"
              title="Automatically assign standard rotational shifts"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Auto-Rotate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearRoster}
              className="gap-1.5 cursor-pointer text-xs text-muted-foreground"
              title="Reset all shifts to OFF"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Roster
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Back to Drivers
              </Button>
            )}
          </div>
        </div>

        {/* Month Selector & Shift Brush Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer" onClick={prevMonth} title="Previous Month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-base font-bold text-foreground min-w-[160px] text-center">
              {monthName} {year}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer" onClick={nextMonth} title="Next Month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs cursor-pointer" onClick={goToToday}>
              Current Month
            </Button>
          </div>

          {/* Quick Brush Selector */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Shift Stamp:
            </span>
            {(Object.keys(SHIFT_DEFINITIONS) as ShiftType[]).map((code) => {
              const def = SHIFT_DEFINITIONS[code];
              const isSelected = selectedShiftForBrush === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedShiftForBrush(isSelected ? null : code)}
                  className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                    isSelected ? "ring-2 ring-primary ring-offset-1 scale-105" : "opacity-85 hover:opacity-100"
                  } ${def.bgClass} ${def.textClass} ${def.borderClass}`}
                  title={`${def.label} — Click to select as brush`}
                >
                  {code}
                </button>
              );
            })}
            {selectedShiftForBrush && (
              <button
                type="button"
                onClick={() => setSelectedShiftForBrush(null)}
                className="text-[10px] text-muted-foreground underline ml-1 cursor-pointer"
              >
                Clear stamp
              </button>
            )}
          </div>
        </div>

        {/* Filter Input */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver by name, code, vehicle..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Showing <strong className="font-semibold text-foreground">{filteredDrivers.length}</strong> active drivers
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PRINT-ONLY CORPORATE DOCUMENT HEADER                      */}
      {/* ========================================================= */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-12 w-auto object-contain max-w-[140px]" />
            ) : (
              <div className="h-10 w-10 rounded border border-slate-900 flex items-center justify-center font-black text-slate-900 text-lg">
                {companyName.charAt(0)}
              </div>
            )}
            <div>
              <div className="text-lg font-black uppercase tracking-tight text-slate-900">
                {companyName}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Fleet Operations & Logistics Department · Central Depot
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] space-y-0.5">
            <div className="font-black text-sm text-slate-900 uppercase">
              MONTHLY DRIVER DUTY ROSTER
            </div>
            <div className="font-bold text-slate-700">
              OPERATING PERIOD: {monthName.toUpperCase()} {year}
            </div>
            <div className="text-slate-500">
              Generated: {formatDate(new Date())} · MachineCare Hub Standard
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ROSTER TABLE (Interactive on Screen / Printable Grid)     */}
      {/* ========================================================= */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs print:border-slate-800 print:shadow-none print:rounded-none">
        <table className="w-full border-collapse text-xs print:text-[9px]">
          <thead>
            {/* Day Numbers Row */}
            <tr className="bg-muted/30 border-b border-border print:bg-slate-100 print:border-slate-800">
              <th className="sticky left-0 z-20 bg-card print:bg-slate-100 px-3 py-2 text-left font-bold text-foreground print:text-slate-900 min-w-[160px] border-r border-border print:border-slate-400">
                Driver & Asset
              </th>
              {daysArray.map((d) => (
                <th
                  key={d.dayNum}
                  className={`px-1 py-1 text-center font-bold min-w-[28px] max-w-[34px] border-r border-border/60 print:border-slate-300 ${
                    d.isWeekend ? "bg-amber-500/5 text-amber-700 dark:text-amber-400 font-extrabold print:bg-slate-200" : "text-foreground"
                  }`}
                >
                  <div>{d.dayNum}</div>
                  <div className="text-[9px] font-medium text-muted-foreground uppercase print:text-slate-600">
                    {d.dayAbbr}
                  </div>
                </th>
              ))}
              <th className="px-2 py-1 text-center font-bold text-foreground min-w-[50px] border-r border-border print:border-slate-300">
                Work
              </th>
              <th className="px-2 py-1 text-center font-bold text-foreground min-w-[45px]">
                Rest
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map((d) => {
              const driverShifts = roster[d.id] || {};
              let workDays = 0;
              let restDays = 0;

              daysArray.forEach((day) => {
                const shift = driverShifts[day.dayNum] || "OFF";
                if (shift === "D" || shift === "N" || shift === "LH" || shift === "STB") workDays++;
                if (shift === "OFF") restDays++;
              });

              return (
                <tr
                  key={d.id}
                  className="border-b border-border hover:bg-muted/20 transition-colors print:border-slate-300 print:hover:bg-transparent"
                >
                  {/* Driver Name Column */}
                  <td className="sticky left-0 z-10 bg-card print:bg-white px-3 py-1.5 border-r border-border print:border-slate-400">
                    <div className="font-semibold text-foreground truncate max-w-[150px] print:text-slate-900">
                      {d.full_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground print:text-slate-600">
                      {d.driver_code && (
                        <span className="font-mono font-bold">{d.driver_code}</span>
                      )}
                      {d.assigned_vehicle && (
                        <span className="truncate max-w-[90px]">· {d.assigned_vehicle}</span>
                      )}
                    </div>
                  </td>

                  {/* Day Shift Cells */}
                  {daysArray.map((day) => {
                    const shift = driverShifts[day.dayNum] || "OFF";
                    const def = SHIFT_DEFINITIONS[shift] || SHIFT_DEFINITIONS.OFF;

                    return (
                      <td
                        key={day.dayNum}
                        onClick={() => handleCellClick(d.id, day.dayNum)}
                        className={`px-0.5 py-1 text-center border-r border-border/60 print:border-slate-300 cursor-pointer select-none transition-colors ${
                          day.isWeekend ? "bg-amber-500/5 print:bg-slate-50" : ""
                        }`}
                        title={`${d.full_name} - Day ${day.dayNum}: ${def.label} (Click to change)`}
                      >
                        <div
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] border print:border-slate-400 ${def.bgClass} ${def.textClass} ${def.borderClass}`}
                        >
                          {shift}
                        </div>
                      </td>
                    );
                  })}

                  {/* Totals */}
                  <td className="px-2 py-1 text-center font-bold text-foreground print:text-slate-900 border-r border-border print:border-slate-300">
                    {workDays}
                  </td>
                  <td className="px-2 py-1 text-center font-semibold text-muted-foreground print:text-slate-600">
                    {restDays}
                  </td>
                </tr>
              );
            })}

            {/* Daily Total Summary Row */}
            <tr className="bg-muted/40 font-bold border-t-2 border-border print:bg-slate-100 print:border-slate-800">
              <td className="sticky left-0 z-10 bg-card print:bg-slate-100 px-3 py-2 text-foreground print:text-slate-900 border-r border-border print:border-slate-400">
                Drivers On Duty
              </td>
              {dailyStats.map((stat) => (
                <td
                  key={stat.dayNum}
                  className="px-0.5 py-1.5 text-center text-[10px] text-foreground print:text-slate-900 border-r border-border/60 print:border-slate-300"
                >
                  <span className="font-mono font-bold text-emerald-600 print:text-slate-900">
                    {stat.onDuty}
                  </span>
                </td>
              ))}
              <td colSpan={2} className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                Total Roster
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* SHIFT CODES LEGEND (Visible on screen and in print)        */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 print:border-slate-800 print:p-2 print:space-y-1">
        <div className="text-xs font-bold text-foreground uppercase tracking-wider print:text-slate-900">
          Shift Classification & Legend
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs print:text-[8px]">
          {(Object.keys(SHIFT_DEFINITIONS) as ShiftType[]).map((code) => {
            const def = SHIFT_DEFINITIONS[code];
            return (
              <div
                key={code}
                className={`p-2 rounded-lg border flex items-center gap-2 ${def.bgClass} ${def.borderClass} print:bg-transparent print:border-slate-300`}
              >
                <span className={`font-mono font-black text-sm px-1.5 py-0.5 rounded bg-background/80 ${def.textClass}`}>
                  {def.code}
                </span>
                <span className="text-[11px] font-medium text-foreground print:text-slate-800 leading-tight">
                  {def.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* PRINT-ONLY OFFICIAL SIGNATURES & SIGN-OFF BLOCK           */}
      {/* ========================================================= */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-6 mt-6 border-t border-slate-400 text-[10px]">
        <div className="space-y-8">
          <div className="font-bold text-slate-800 uppercase tracking-wide">
            1. Prepared By:
          </div>
          <div className="border-t border-slate-700 pt-1 space-y-0.5">
            <div className="font-bold text-slate-900">{profile?.full_name || "Fleet Controller"}</div>
            <div className="text-slate-600">Lead Dispatcher / Roster Supervisor</div>
            <div className="text-slate-500 text-[9px]">Date: ________________________</div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="font-bold text-slate-800 uppercase tracking-wide">
            2. Verified HSE & Rest Compliance:
          </div>
          <div className="border-t border-slate-700 pt-1 space-y-0.5">
            <div className="font-bold text-slate-900">Safety & Compliance Officer</div>
            <div className="text-slate-600">Hours of Service (HOS) & Fatigue Audit</div>
            <div className="text-slate-500 text-[9px]">Date: ________________________</div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="font-bold text-slate-800 uppercase tracking-wide">
            3. Approved By:
          </div>
          <div className="border-t border-slate-700 pt-1 space-y-0.5">
            <div className="font-bold text-slate-900">Fleet Operations Manager</div>
            <div className="text-slate-600">Director of Transport & Logistics</div>
            <div className="text-slate-500 text-[9px]">Official Stamp & Date: _________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
