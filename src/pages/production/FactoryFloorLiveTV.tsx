import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Factory,
  Tv,
  Maximize2,
  Minimize2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  Flame,
  ArrowRight,
  TrendingUp,
  Volume2,
  VolumeX,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Zap,
  Wrench,
  X,
  Gauge,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface MachineStation {
  id: string;
  name: string;
  code: string;
  status: "running" | "idle" | "warning" | "stopped";
  tempC: number;
  vibrationMmS: number;
  speedRpm: number;
  operator: string;
  uptimePct: number;
}

interface FactoryLine {
  id: string;
  lineNo: number;
  name: string;
  zone: string;
  status: "running" | "idle" | "warning" | "stopped";
  oee: number;
  outputActual: number;
  outputTarget: number;
  tactTimeSec: number;
  activeSku: string;
  topPct: number;
  leftPct: number;
  machines: MachineStation[];
}

const INITIAL_LINES: FactoryLine[] = [
  {
    id: "line-1",
    lineNo: 1,
    name: "Line 1: Raw Material Ingestion & Prep",
    zone: "North Bay A1",
    status: "running",
    oee: 92.4,
    outputActual: 1840,
    outputTarget: 2000,
    tactTimeSec: 28,
    activeSku: "SKU-STL-041 Coil Feeder",
    topPct: 24,
    leftPct: 20,
    machines: [
      { id: "m-101", name: "Hydraulic De-Coiler", code: "DC-01", status: "running", tempC: 44, vibrationMmS: 1.2, speedRpm: 1200, operator: "Juma Said", uptimePct: 98.2 },
      { id: "m-102", name: "High-Speed Blanking Sizer", code: "BS-04", status: "running", tempC: 52, vibrationMmS: 1.8, speedRpm: 1850, operator: "Rashid Ali", uptimePct: 95.4 },
      { id: "m-103", name: "Roller Leveler & Cleaner", code: "RL-02", status: "running", tempC: 38, vibrationMmS: 0.9, speedRpm: 950, operator: "Auto-Cell", uptimePct: 99.1 },
    ],
  },
  {
    id: "line-2",
    lineNo: 2,
    name: "Line 2: Precision Stamping & CNC Forming",
    zone: "Central Press Hall B",
    status: "running",
    oee: 88.6,
    outputActual: 1520,
    outputTarget: 1700,
    tactTimeSec: 42,
    activeSku: "SKU-CHAS-881 Chassis Frame",
    topPct: 38,
    leftPct: 38,
    machines: [
      { id: "m-201", name: "400T Progressive Press", code: "PR-400", status: "running", tempC: 61, vibrationMmS: 2.4, speedRpm: 720, operator: "Emmanuel Mollel", uptimePct: 93.8 },
      { id: "m-202", name: "5-Axis CNC Milling Center", code: "CNC-05", status: "running", tempC: 56, vibrationMmS: 1.5, speedRpm: 4500, operator: "Frank Massawe", uptimePct: 96.0 },
      { id: "m-203", name: "Hydraulic Deep Draw Cell", code: "HD-12", status: "idle", tempC: 34, vibrationMmS: 0.4, speedRpm: 0, operator: "Standby Operator", uptimePct: 89.5 },
    ],
  },
  {
    id: "line-3",
    lineNo: 3,
    name: "Line 3: Robotic Welding & Assembly Cells",
    zone: "Mid-Plant Cell C",
    status: "running",
    oee: 94.1,
    outputActual: 1680,
    outputTarget: 1750,
    tactTimeSec: 36,
    activeSku: "SKU-WLD-505 Bracket Joint",
    topPct: 54,
    leftPct: 56,
    machines: [
      { id: "m-301", name: "KUKA 6-Axis Robot Welder Alpha", code: "ROB-K1", status: "running", tempC: 48, vibrationMmS: 1.1, speedRpm: 2400, operator: "Supervised Autonomous", uptimePct: 99.4 },
      { id: "m-302", name: "KUKA 6-Axis Robot Welder Beta", code: "ROB-K2", status: "running", tempC: 49, vibrationMmS: 1.3, speedRpm: 2400, operator: "Supervised Autonomous", uptimePct: 98.8 },
      { id: "m-303", name: "Rotary Fixture Index Table", code: "ROT-01", status: "running", tempC: 41, vibrationMmS: 0.8, speedRpm: 120, operator: "Baraka Mlay", uptimePct: 97.5 },
    ],
  },
  {
    id: "line-4",
    lineNo: 4,
    name: "Line 4: Surface Coating & Curing Tunnel",
    zone: "Thermal Treatment Bay D",
    status: "warning",
    oee: 79.5,
    outputActual: 1390,
    outputTarget: 1650,
    tactTimeSec: 50,
    activeSku: "SKU-CT-922 Epoxy Coated",
    topPct: 36,
    leftPct: 76,
    machines: [
      { id: "m-401", name: "Ultrasonic Degreasing Tank", code: "DEG-01", status: "running", tempC: 68, vibrationMmS: 0.7, speedRpm: 300, operator: "Kelvin Joseph", uptimePct: 96.2 },
      { id: "m-402", name: "Electrostatic Powder Spray Booth", code: "PDR-03", status: "warning", tempC: 32, vibrationMmS: 2.1, speedRpm: 600, operator: "Sarah Kimaro", uptimePct: 84.1 },
      { id: "m-403", name: "Infrared Curing Tunnel Oven", code: "OVN-02", status: "running", tempC: 195, vibrationMmS: 0.5, speedRpm: 150, operator: "System Controlled", uptimePct: 94.7 },
    ],
  },
  {
    id: "line-5",
    lineNo: 5,
    name: "Line 5: Quality Inspection, Packaging & Palletizing",
    zone: "Dispatch Gateway E",
    status: "running",
    oee: 96.8,
    outputActual: 1920,
    outputTarget: 1950,
    tactTimeSec: 22,
    activeSku: "SKU-FIN-701 Export Ready",
    topPct: 68,
    leftPct: 78,
    machines: [
      { id: "m-501", name: "Cognex High-Res Vision AI Scanner", code: "VIS-90", status: "running", tempC: 36, vibrationMmS: 0.3, speedRpm: 0, operator: "AI Quality Gate", uptimePct: 99.8 },
      { id: "m-502", name: "Automated Case Packer & Taper", code: "CP-14", status: "running", tempC: 43, vibrationMmS: 1.2, speedRpm: 880, operator: "Neema Mbise", uptimePct: 97.1 },
      { id: "m-503", name: "Fanuc Robot Palletizer Cell", code: "PAL-01", status: "running", tempC: 47, vibrationMmS: 1.0, speedRpm: 1800, operator: "Autonomous AGV Link", uptimePct: 98.9 },
    ],
  },
];

export default function FactoryFloorLiveTV() {
  const [lines, setLines] = useState<FactoryLine[]>(INITIAL_LINES);
  const [selectedLine, setSelectedLine] = useState<FactoryLine | null>(null);
  const [viewMode, setViewMode] = useState<"physical" | "schematic">("physical");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastTick, setLastTick] = useState<string>(new Date().toLocaleTimeString());
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen handlers
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Real-time live simulator: update output counters, temperatures, and tact times every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLines((prev) =>
        prev.map((l) => {
          const delta = Math.random() > 0.4 ? 1 : 0;
          const newActual = l.outputActual + delta;
          const updatedMachines = l.machines.map((m) => {
            const tempDelta = (Math.random() - 0.5) * 0.8;
            return {
              ...m,
              tempC: Math.round((m.tempC + tempDelta) * 10) / 10,
            };
          });
          return {
            ...l,
            outputActual: newActual,
            machines: updatedMachines,
          };
        })
      );
      setLastTick(new Date().toLocaleTimeString());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Aggregated KPIs
  const totalActual = lines.reduce((acc, l) => acc + l.outputActual, 0);
  const totalTarget = lines.reduce((acc, l) => acc + l.outputTarget, 0);
  const avgOee = (lines.reduce((acc, l) => acc + l.oee, 0) / lines.length).toFixed(1);
  const runningLinesCount = lines.filter((l) => l.status === "running").length;

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none ${
        isFullscreen ? "p-4 md:p-6" : "p-4 md:p-6 rounded-2xl border border-slate-800 shadow-2xl my-2"
      }`}
    >
      {/* TOP BROADCAST BAR */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/20">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Factory Floor Live TV
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  LIVE ON-AIR
                </Badge>
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Main Plant Floor · 5 Primary Production Lines</span>
              <span>·</span>
              <span className="font-mono text-slate-300">Updated: {lastTick}</span>
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode("physical")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === "physical"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              3D Physical Overhead
            </button>
            <button
              onClick={() => setViewMode("schematic")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === "schematic"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Line Schematic Flow
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled((v) => !v)}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 h-9 px-2.5"
            title={soundEnabled ? "Mute Line Alerts" : "Unmute Line Alerts"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 h-9 px-3 gap-1.5 font-semibold"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4 text-amber-400" />
                <span className="text-xs">Exit TV</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs">TV Fullscreen</span>
              </>
            )}
          </Button>

          {!isFullscreen && (
            <Button asChild size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          )}
        </div>
      </header>

      {/* PLANT KPIS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 my-4">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Overall Plant OEE</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{avgOee}%</span>
            <span className="text-[10px] text-emerald-500 font-bold">Target &gt; 85%</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Shift Output</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalActual.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">/ {totalTarget.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Line Availability</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400">{runningLinesCount} / {lines.length}</span>
            <span className="text-[10px] text-emerald-400 font-bold">Active</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Shift Schedule</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-200">Shift A</span>
            <span className="text-[10px] text-slate-400">06:00 – 14:00</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Bottleneck Watch</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-400">Line 4 Buffer</span>
            <span className="text-[10px] text-amber-500">Wait &lt; 4m</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Safety Status</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> 0 Incident
            </span>
            <span className="text-[10px] text-emerald-500">418 Days Safe</span>
          </div>
        </div>
      </div>

      {/* MAIN VIEW CONTAINER */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {viewMode === "physical" ? (
          /* 3D PHYSICAL OVERHEAD VIEW */
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center min-h-[520px]">
            {/* BACKGROUND HIGH-RESOLUTION OVERHEAD RENDER */}
            <img
              src="/factory-floor-topdown.jpg"
              alt="Factory Shop Floor Top-Down View"
              className="absolute inset-0 w-full h-full object-cover opacity-80 filter brightness-95 contrast-105"
            />

            {/* SCANLINE & GRID HUD OVERLAY */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70 pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

            {/* OVERHEAD HUD TITLE BADGE */}
            <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider text-slate-300">
                OVERHEAD FACILITY TWIN · REAL-TIME ARRANGEABLE LAYOUT
              </span>
            </div>

            {/* INTERACTIVE PRODUCTION LINE HOTSPOTS */}
            {lines.map((line) => {
              const isSelected = selectedLine?.id === line.id;
              const isWarning = line.status === "warning";
              const isRunning = line.status === "running";

              return (
                <div
                  key={line.id}
                  style={{ top: `${line.topPct}%`, left: `${line.leftPct}%` }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-105"
                >
                  <button
                    onClick={() => setSelectedLine(line)}
                    className={`group relative text-left rounded-xl p-3 backdrop-blur-md transition-all shadow-2xl border ${
                      isSelected
                        ? "bg-slate-900/95 border-emerald-400 ring-4 ring-emerald-500/20 shadow-emerald-500/30"
                        : isWarning
                        ? "bg-slate-900/90 border-amber-500/60 ring-2 ring-amber-500/20"
                        : "bg-slate-900/85 border-slate-700/80 hover:border-emerald-500/50"
                    }`}
                  >
                    {/* Pulsing Beacon Indicator */}
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`relative flex h-3 w-3 items-center justify-center ${
                            isWarning ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          <span
                            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                              isWarning ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 ${
                              isWarning ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          />
                        </span>
                        <span className="text-xs font-black tracking-wide text-white font-mono">
                          L{line.lineNo}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 font-bold uppercase ${
                          isWarning
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {line.status}
                      </Badge>
                    </div>

                    <div className="text-xs font-bold text-slate-100 max-w-[170px] truncate">
                      {line.name.split(":")[1] || line.name}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] border-t border-slate-800 pt-1.5 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[9px]">OEE</span>
                        <span className={`font-bold ${line.oee >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                          {line.oee}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">OUTPUT</span>
                        <span className="text-white font-bold">{line.outputActual}</span>
                      </div>
                    </div>

                    <div className="mt-1 text-[9px] text-slate-400 truncate max-w-[170px]">
                      {line.activeSku}
                    </div>
                  </button>
                </div>
              );
            })}

            {/* BOTTOM HUD LEGEND */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Optimal Flow
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Buffer / Micro-Stop
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Stoppage
              </span>
            </div>
          </div>
        ) : (
          /* DIGITAL LINE SCHEMATIC VIEW */
          <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 overflow-x-auto min-h-[520px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Sequential Shop Floor Routing & Station Buffers
                </h3>
                <p className="text-xs text-slate-400">Continuous takt flow from Ingestion to Automated Warehouse Dispatch</p>
              </div>
              <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-400 bg-cyan-500/10">
                5 Primary Cells Synchronized
              </Badge>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch gap-3 min-w-[900px] h-full">
              {lines.map((line, idx) => {
                const isSelected = selectedLine?.id === line.id;
                return (
                  <div key={line.id} className="flex-1 flex flex-col justify-between">
                    <div
                      onClick={() => setSelectedLine(line)}
                      className={`h-full rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-slate-800/95 border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : "bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Stage 0{line.lineNo}
                          </span>
                          <span className="text-xs font-bold text-slate-300 font-mono">{line.oee}% OEE</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{line.name.split(":")[1] || line.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{line.zone}</p>
                      </div>

                      {/* Station Machines Pill List */}
                      <div className="my-4 space-y-1.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                          Active Workstations
                        </span>
                        {line.machines.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-lg"
                          >
                            <span className="font-medium text-slate-200 truncate pr-2">{m.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">{m.tempC}°C</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block">OUTPUT</span>
                          <span className="font-bold text-white">
                            {line.outputActual} / {line.outputTarget}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">TAKT TIME</span>
                          <span className="font-bold text-cyan-400">{line.tactTimeSec}s</span>
                        </div>
                      </div>
                    </div>

                    {idx < lines.length - 1 && (
                      <div className="hidden lg:flex items-center justify-center py-2 text-slate-600">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM RUNNING LINE TICKER */}
      <footer className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> All Conveyor Interlocks Engaged
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">Telemetry Frequency: 3000ms</span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">ERP Batch Sync: Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span>MachineCare Plant Digital Twin 2026</span>
        </div>
      </footer>

      {/* LINE & MACHINE INSPECTOR MODAL */}
      <Dialog open={Boolean(selectedLine)} onOpenChange={(open) => !open && setSelectedLine(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Factory className="h-5 w-5 text-emerald-400" />
                {selectedLine?.name}
              </DialogTitle>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 uppercase font-bold ${
                  selectedLine?.status === "warning"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {selectedLine?.status}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Zone: {selectedLine?.zone} · Active SKU: {selectedLine?.activeSku}
            </DialogDescription>
          </DialogHeader>

          {/* Performance Overview */}
          <div className="grid grid-cols-3 gap-3 my-3">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Line OEE</span>
              <span className="text-xl font-black text-emerald-400">{selectedLine?.oee}%</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Shift Output</span>
              <span className="text-xl font-black text-white">
                {selectedLine?.outputActual} / {selectedLine?.outputTarget}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Cycle Tact Time</span>
              <span className="text-xl font-black text-cyan-400">{selectedLine?.tactTimeSec} sec</span>
            </div>
          </div>

          {/* Workstations Telemetry List */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Individual Machine Telemetry & Operators
            </h4>
            <div className="space-y-2">
              {selectedLine?.machines.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">{m.code}</span>
                      <span className="font-semibold text-sm text-white">{m.name}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Operator: <span className="text-slate-200 font-medium">{m.operator}</span> · Uptime: {m.uptimePct}%
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase">Temperature</span>
                      <span className={`font-bold ${m.tempC > 65 ? "text-amber-400" : "text-slate-200"}`}>
                        {m.tempC}°C
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase">Vibration</span>
                      <span className="font-bold text-slate-200">{m.vibrationMmS} mm/s</span>
                    </div>
                    {m.speedRpm > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block uppercase">RPM</span>
                        <span className="font-bold text-cyan-400">{m.speedRpm}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedLine(null)} className="text-xs border-slate-700">
              Close Inspector
            </Button>
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5">
              <Link to="/oee">
                <Gauge className="h-3.5 w-3.5" />
                Open OEE Breakdown
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
