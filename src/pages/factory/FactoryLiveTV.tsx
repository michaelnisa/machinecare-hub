import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  Factory,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Wrench,
  Boxes,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  X,
  RefreshCw,
  Zap,
  Sparkles,
  ArrowLeft,
  Tv,
} from "lucide-react";

export type LineStatus = "running" | "down" | "slow" | "changeover" | "idle";
export type AndonType = "maintenance" | "quality" | "material" | "safety" | null;

export interface ProductionLineState {
  id: string;
  name: string;
  code: string;
  sequence: number;
  stage: "Preparation" | "Processing" | "Filling & Packing" | "End-of-Line";
  status: LineStatus;
  currentProduct: string;
  sku: string;
  poNumber: string;
  targetUnitsShift: number;
  completedUnits: number;
  scrapUnits: number;
  currentSpeedUnitsPerMin: number;
  standardSpeedUnitsPerMin: number;
  oeePercent: number;
  availabilityPercent: number;
  performancePercent: number;
  qualityPercent: number;
  downtimeSeconds: number;
  downtimeReason?: string;
  assignedTechnician?: string;
  changeoverSecondsRemaining?: number;
  changeoverTargetProduct?: string;
  shiftLead: string;
  operatorsCount: number;
  andonAlert?: {
    type: AndonType;
    message: string;
    raisedAt: string;
  };
}

const INITIAL_MOCK_LINES: ProductionLineState[] = [
  {
    id: "line-1",
    name: "Line 1 — High-Speed Carbonated Bottling",
    code: "LINE-01",
    sequence: 1,
    stage: "Filling & Packing",
    status: "running",
    currentProduct: "500ml Sparking Citrus Drink",
    sku: "SKU-BEV-500",
    poNumber: "PO-2026-0412",
    targetUnitsShift: 18000,
    completedUnits: 14250,
    scrapUnits: 145,
    currentSpeedUnitsPerMin: 125,
    standardSpeedUnitsPerMin: 120,
    oeePercent: 88.5,
    availabilityPercent: 94.2,
    performancePercent: 95.8,
    qualityPercent: 99.0,
    downtimeSeconds: 0,
    shiftLead: "Rashid Kibwana",
    operatorsCount: 6,
  },
  {
    id: "line-2",
    name: "Line 2 — Aseptic Juice Carton Packing",
    code: "LINE-02",
    sequence: 2,
    stage: "Filling & Packing",
    status: "down",
    currentProduct: "1L Tropical Mango Nectar",
    sku: "SKU-JUC-1000",
    poNumber: "PO-2026-0398",
    targetUnitsShift: 12000,
    completedUnits: 6480,
    scrapUnits: 312,
    currentSpeedUnitsPerMin: 0,
    standardSpeedUnitsPerMin: 90,
    oeePercent: 62.4,
    availabilityPercent: 68.0,
    performancePercent: 92.5,
    qualityPercent: 95.2,
    downtimeSeconds: 864, // ~14m 24s
    downtimeReason: "Straw Applicator Jam & Sensor Fault",
    assignedTechnician: "Eng. Emmanuel J. (On Site)",
    shiftLead: "Amina Hassan",
    operatorsCount: 5,
    andonAlert: {
      type: "maintenance",
      message: "Straw Applicator Jam — Sensor re-alignment in progress",
      raisedAt: new Date(Date.now() - 864000).toISOString(),
    },
  },
  {
    id: "line-3",
    name: "Line 3 — Automated Case Packaging & Palletizer",
    code: "LINE-03",
    sequence: 3,
    stage: "End-of-Line",
    status: "running",
    currentProduct: "Corrugated Master Cartons (24x)",
    sku: "SKU-BOX-24",
    poNumber: "PO-2026-0415",
    targetUnitsShift: 2400,
    completedUnits: 1980,
    scrapUnits: 18,
    currentSpeedUnitsPerMin: 18,
    standardSpeedUnitsPerMin: 16,
    oeePercent: 91.2,
    availabilityPercent: 96.5,
    performancePercent: 95.0,
    qualityPercent: 99.2,
    downtimeSeconds: 0,
    shiftLead: "Baraka Msuya",
    operatorsCount: 3,
  },
  {
    id: "line-4",
    name: "Line 4 — Syrup Mixing & Batch Pasteurization",
    code: "LINE-04",
    sequence: 4,
    stage: "Preparation",
    status: "changeover",
    currentProduct: "Clean-In-Place (CIP) Sanitation",
    sku: "CIP-CYCLE-02",
    poNumber: "CIP-2026-089",
    targetUnitsShift: 10000,
    completedUnits: 10000,
    scrapUnits: 0,
    currentSpeedUnitsPerMin: 0,
    standardSpeedUnitsPerMin: 50,
    oeePercent: 82.0,
    availabilityPercent: 84.0,
    performancePercent: 98.0,
    qualityPercent: 100,
    downtimeSeconds: 0,
    changeoverSecondsRemaining: 920, // ~15m 20s
    changeoverTargetProduct: "Apple Malt Concentrate (Next Batch)",
    shiftLead: "Fatuma Mwamba",
    operatorsCount: 4,
  },
  {
    id: "line-5",
    name: "Line 5 — Blow Molding & Preform Extrusion",
    code: "LINE-05",
    sequence: 5,
    stage: "Processing",
    status: "slow",
    currentProduct: "28mm PCO Bottle Preforms",
    sku: "SKU-PRE-28",
    poNumber: "PO-2026-0402",
    targetUnitsShift: 25000,
    completedUnits: 16800,
    scrapUnits: 480,
    currentSpeedUnitsPerMin: 72,
    standardSpeedUnitsPerMin: 110,
    oeePercent: 74.8,
    availabilityPercent: 95.0,
    performancePercent: 79.2,
    qualityPercent: 97.1,
    downtimeSeconds: 0,
    downtimeReason: "Thermal Chiller High-Temp Warning (Micro-stoppages)",
    shiftLead: "David Mushi",
    operatorsCount: 4,
    andonAlert: {
      type: "quality",
      message: "Preform wall thickness variance alert (+4.2%)",
      raisedAt: new Date(Date.now() - 420000).toISOString(),
    },
  },
  {
    id: "line-6",
    name: "Line 6 — Heavy Industrial Can Canning",
    code: "LINE-06",
    sequence: 6,
    stage: "Filling & Packing",
    status: "idle",
    currentProduct: "Scheduled Shift Maintenance",
    sku: "SCH-MAINT",
    poNumber: "WO-2026-0881",
    targetUnitsShift: 0,
    completedUnits: 0,
    scrapUnits: 0,
    currentSpeedUnitsPerMin: 0,
    standardSpeedUnitsPerMin: 140,
    oeePercent: 0,
    availabilityPercent: 0,
    performancePercent: 0,
    qualityPercent: 0,
    downtimeSeconds: 0,
    shiftLead: "Kassim Juma",
    operatorsCount: 2,
  },
];

// Sound Synthesizer for Andon Bells (AudioContext)
function playAndonChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.4); // D5
    playTone(880.00, now + 0.15, 0.7); // A5
  } catch (e) {
    console.warn("Audio chime prevented:", e);
  }
}

export default function FactoryLiveTV() {
  const { organisation } = useAuth();
  const [lines, setLines] = useState<ProductionLineState[]>(INITIAL_MOCK_LINES);
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<"matrix" | "sequence">("matrix");
  const [autoRotate, setAutoRotate] = useState(true);
  const [carouselStep, setCarouselStep] = useState<"overview" | "bottleneck" | "leaderboard">("overview");
  const [simDrawerOpen, setSimDrawerOpen] = useState(false);

  // Live ticking timer & simulation pulse
  useEffect(() => {
    const clock = setInterval(() => {
      setNow(new Date());

      // Increment downtime counters & units produced
      setLines((prev) =>
        prev.map((l) => {
          if (l.status === "down") {
            return { ...l, downtimeSeconds: l.downtimeSeconds + 1 };
          }
          if (l.status === "changeover" && (l.changeoverSecondsRemaining || 0) > 0) {
            return {
              ...l,
              changeoverSecondsRemaining: Math.max(0, (l.changeoverSecondsRemaining || 0) - 1),
            };
          }
          if (l.status === "running") {
            // Live micro-increment of production units
            const add = Math.random() > 0.6 ? 2 : 1;
            return {
              ...l,
              completedUnits: Math.min(l.targetUnitsShift, l.completedUnits + add),
            };
          }
          return l;
        })
      );
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  // Carousel timer: rotate views every 25 seconds if autoRotate is on
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setCarouselStep((prev) => {
        if (prev === "overview") return "bottleneck";
        if (prev === "bottleneck") return "leaderboard";
        return "overview";
      });
    }, 25000);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Keep screen awake (WakeLock API)
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // ignore
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        wakeLockRef.current?.release?.();
      } catch {
        // ignore
      }
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Plant Summary Aggregations
  const plantSummary = useMemo(() => {
    const totalTarget = lines.reduce((acc, l) => acc + l.targetUnitsShift, 0);
    const totalCompleted = lines.reduce((acc, l) => acc + l.completedUnits, 0);
    const totalScrap = lines.reduce((acc, l) => acc + l.scrapUnits, 0);
    const attainmentPct = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
    const scrapPct = totalCompleted > 0 ? (totalScrap / totalCompleted) * 100 : 0;

    const activeLines = lines.filter((l) => l.status !== "idle");
    const avgOee =
      activeLines.length > 0
        ? activeLines.reduce((acc, l) => acc + l.oeePercent, 0) / activeLines.length
        : 0;

    const runningCount = lines.filter((l) => l.status === "running").length;
    const downCount = lines.filter((l) => l.status === "down").length;
    const slowCount = lines.filter((l) => l.status === "slow").length;
    const changeoverCount = lines.filter((l) => l.status === "changeover").length;

    const totalDowntimeMins = Math.round(
      lines.reduce((acc, l) => acc + l.downtimeSeconds, 0) / 60
    );

    const activeAlerts = lines.filter((l) => l.andonAlert != null);

    return {
      totalTarget,
      totalCompleted,
      totalScrap,
      attainmentPct,
      scrapPct,
      avgOee,
      runningCount,
      downCount,
      slowCount,
      changeoverCount,
      totalDowntimeMins,
      activeAlerts,
    };
  }, [lines]);

  // Bottleneck Line (Line currently down or with lowest OEE)
  const bottleneckLine = useMemo(() => {
    const down = lines.find((l) => l.status === "down");
    if (down) return down;
    const slow = lines.find((l) => l.status === "slow");
    if (slow) return slow;
    return lines[0];
  }, [lines]);

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Helper status styling
  const getStatusBadge = (status: LineStatus) => {
    switch (status) {
      case "running":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/40 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Running
          </span>
        );
      case "down":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/25 text-red-300 font-extrabold text-xs uppercase tracking-wider border border-red-500/50 animate-bounce">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Line Stoppage
          </span>
        );
      case "slow":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/40">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Slow Cycle
          </span>
        );
      case "changeover":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs uppercase tracking-wider border border-sky-500/40">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Changeover / CIP
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 font-semibold text-xs uppercase tracking-wider border border-zinc-700">
            <span className="h-2 w-2 rounded-full bg-zinc-500" />
            Idle / Off
          </span>
        );
    }
  };

  // Simulation controls
  const handleSimulateStoppage = (lineId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          if (soundEnabled) playAndonChime();
          return {
            ...l,
            status: "down",
            currentSpeedUnitsPerMin: 0,
            downtimeSeconds: 1,
            downtimeReason: "Emergency Stop Activated — Sealing Head Jam",
            assignedTechnician: "Eng. Juma M. (Dispatched)",
            andonAlert: {
              type: "maintenance",
              message: "Sealing Head Jam — Technician Dispatched to Line",
              raisedAt: new Date().toISOString(),
            },
          };
        }
        return l;
      })
    );
  };

  const handleClearAlert = (lineId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          return {
            ...l,
            status: "running",
            currentSpeedUnitsPerMin: l.standardSpeedUnitsPerMin,
            downtimeSeconds: 0,
            downtimeReason: undefined,
            assignedTechnician: undefined,
            andonAlert: undefined,
          };
        }
        return l;
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top TV Command Header */}
      <header className="px-6 py-4 border-b border-white/10 bg-[#0e131f] flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3.5">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-xs font-semibold"
            title="Return to Admin Portal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin Portal</span>
          </Link>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg text-white font-black">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                  <span>{organisation?.name || "MachineCare"} Plant TV</span>
                  <Badge className="bg-emerald-500 text-black font-extrabold text-[10px] px-1.5 py-0 uppercase">
                    LIVE
                  </Badge>
                </h1>
              </div>
              <div className="text-xs text-white/50 flex items-center gap-2">
                <span>Building A — Main Bottling & Packaging Floor</span>
                <span>•</span>
                <span className="font-semibold text-emerald-400">Shift 1 (06:00 - 14:00)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Clock & Shift Status */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <div className="text-2xl font-mono font-bold tracking-wider text-white">
              {now.toLocaleTimeString("en-GB")}
            </div>
            <div className="text-[11px] text-white/50 uppercase font-semibold">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
            {/* View Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode((v) => (v === "matrix" ? "sequence" : "matrix"))}
              className="h-8 px-2.5 text-xs font-bold text-white/80 hover:text-white gap-1.5"
              title="Toggle Grid Matrix vs Process Flow Sequence"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline capitalize">{viewMode}</span>
            </Button>

            {/* Auto Carousel Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRotate((a) => !a)}
              className={`h-8 px-2.5 text-xs font-bold gap-1.5 ${autoRotate ? "text-emerald-400 bg-emerald-500/10" : "text-white/60"}`}
              title="Toggle Auto TV Carousel rotation"
            >
              {autoRotate ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span className="hidden xl:inline">Carousel</span>
            </Button>

            {/* Sound Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSoundEnabled((s) => !s);
                if (!soundEnabled) playAndonChime();
              }}
              className={`h-8 w-8 p-0 ${soundEnabled ? "text-primary" : "text-white/40"}`}
              title="Sound Chime On/Off"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {/* Fullscreen Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0 text-white/80 hover:text-white"
              title="Toggle Fullscreen TV Mode (F11)"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Simulation Controller Drawer Toggle */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSimDrawerOpen(true)}
              className="h-8 px-3 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-md"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Simulate</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Active Andon Alert Broadcast Banner */}
      {plantSummary.activeAlerts.length > 0 && (
        <div className="bg-red-600/90 text-white px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm font-black tracking-wide border-b border-red-500/50 shadow-inner animate-pulse">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-red-600 shrink-0 font-extrabold text-xs">
              !
            </span>
            <span className="uppercase tracking-widest bg-black/30 px-2 py-0.5 rounded text-[11px]">
              CRITICAL ANDON CALL
            </span>
            <span className="truncate">
              <strong>{plantSummary.activeAlerts[0].name}:</strong>{" "}
              {plantSummary.activeAlerts[0].andonAlert?.message}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-white/90 text-xs hidden md:inline">
              Elapsed: {formatDuration(plantSummary.activeAlerts[0].downtimeSeconds)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleClearAlert(plantSummary.activeAlerts[0].id)}
              className="h-6 px-2 text-[10px] bg-black/40 hover:bg-black/60 text-white border-white/20 font-bold"
            >
              Acknowledge & Clear
            </Button>
          </div>
        </div>
      )}

      {/* Plant Executive Summary Ribbon */}
      <section className="px-6 py-3.5 bg-[#121929] border-b border-white/10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Plant Attainment */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Plant Output Attainment</div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-400">
              {plantSummary.attainmentPct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-white/50">
              {formatNumber(plantSummary.totalCompleted)} / {formatNumber(plantSummary.totalTarget)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, plantSummary.attainmentPct)}%` }} />
          </div>
        </div>

        {/* Operational Status */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Lines Operational</div>
          <div className="text-xl font-black text-white flex items-center gap-1.5">
            <span>{plantSummary.runningCount} / {lines.length}</span>
            <span className="text-xs font-normal text-white/50">Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Running" />
            <span>{plantSummary.runningCount}</span>
            <span className="h-2 w-2 rounded-full bg-red-400 ml-1" title="Down" />
            <span className="text-red-400 font-bold">{plantSummary.downCount}</span>
            <span className="h-2 w-2 rounded-full bg-sky-400 ml-1" title="Changeover" />
            <span>{plantSummary.changeoverCount}</span>
          </div>
        </div>

        {/* Plant OEE */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Plant Overall OEE</div>
          <div className="text-xl font-black text-blue-400 flex items-center justify-between">
            <span>{plantSummary.avgOee.toFixed(1)}%</span>
            <Activity className="h-4 w-4 text-blue-400/60" />
          </div>
          <div className="text-[10px] text-white/50">Target benchmark: 85.0%</div>
        </div>

        {/* Scrap & Defect Rate */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Plant Scrap Rate</div>
          <div className="text-xl font-black text-amber-400 flex items-center justify-between">
            <span>{plantSummary.scrapPct.toFixed(2)}%</span>
            <Flame className="h-4 w-4 text-amber-400/60" />
          </div>
          <div className="text-[10px] text-white/50">{formatNumber(plantSummary.totalScrap)} units defective</div>
        </div>

        {/* Total Downtime */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Downtime Today</div>
          <div className="text-xl font-black text-red-400 flex items-center justify-between">
            <span>{plantSummary.totalDowntimeMins} min</span>
            <Clock className="h-4 w-4 text-red-400/60" />
          </div>
          <div className="text-[10px] text-white/50">Across all production lines</div>
        </div>

        {/* Shift Pace / Takt */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Active Shift Remaining</div>
          <div className="text-xl font-black text-purple-400 flex items-center justify-between">
            <span>01h 42m</span>
            <Sparkles className="h-4 w-4 text-purple-400/60" />
          </div>
          <div className="text-[10px] text-white/50">Next: Shift 2 (Afternoon)</div>
        </div>
      </section>

      {/* Main TV Canvas: Overview Grid vs Bottleneck Focus vs Leaderboard */}
      <main className="p-6 flex-1 flex flex-col gap-6">
        {carouselStep === "overview" && (
          <div className="flex-1">
            {viewMode === "matrix" ? (
              /* GRID MATRIX VIEW — Optimized for wall mount 55"+ TVs */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {lines.map((line) => {
                  const attainment =
                    line.targetUnitsShift > 0
                      ? Math.round((line.completedUnits / line.targetUnitsShift) * 100)
                      : 0;
                  const isDown = line.status === "down";

                  return (
                    <div
                      key={line.id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all relative overflow-hidden ${
                        isDown
                          ? "bg-red-950/25 border-red-500/60 shadow-xl shadow-red-500/10 ring-2 ring-red-500/30"
                          : line.status === "changeover"
                          ? "bg-sky-950/20 border-sky-500/40"
                          : line.status === "slow"
                          ? "bg-amber-950/20 border-amber-500/40"
                          : "bg-[#111726] border-white/10 hover:border-white/20"
                      }`}
                    >
                      {/* Top Line Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                              {line.code}
                            </span>
                            <span className="text-[11px] uppercase tracking-wider text-white/50 font-bold">
                              {line.stage}
                            </span>
                          </div>
                          <h2 className="text-base font-black text-white mt-1 leading-snug line-clamp-1">
                            {line.name}
                          </h2>
                        </div>
                        {getStatusBadge(line.status)}
                      </div>

                      {/* Active Job Information */}
                      <div className="my-4 p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium">Batch / PO:</span>
                          <span className="font-mono font-bold text-white">{line.poNumber}</span>
                        </div>
                        <div className="text-xs font-bold text-blue-300 truncate">
                          {line.currentProduct}
                        </div>

                        {/* Attainment Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-white/60">Shift Output:</span>
                            <span className="text-white">
                              <strong>{formatNumber(line.completedUnits)}</strong> / {formatNumber(line.targetUnitsShift)} ({attainment}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isDown ? "bg-red-500" : line.status === "slow" ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, attainment)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Real-Time Trio Metrics (Speed, OEE, Scrap) */}
                      <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <div className="text-[10px] uppercase font-bold text-white/40">Speed</div>
                          <div className="text-base font-black text-white font-mono mt-0.5">
                            {line.currentSpeedUnitsPerMin} <span className="text-[10px] text-white/50 font-normal">/m</span>
                          </div>
                          <div className="text-[9px] text-white/40">Std: {line.standardSpeedUnitsPerMin}/m</div>
                        </div>

                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <div className="text-[10px] uppercase font-bold text-white/40">OEE Score</div>
                          <div className="text-base font-black text-blue-400 font-mono mt-0.5">
                            {line.oeePercent.toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-white/40">Avail {line.availabilityPercent.toFixed(0)}%</div>
                        </div>

                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <div className="text-[10px] uppercase font-bold text-white/40">Scrap Units</div>
                          <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                            {line.scrapUnits}
                          </div>
                          <div className="text-[9px] text-white/40">Yield {line.qualityPercent.toFixed(1)}%</div>
                        </div>
                      </div>

                      {/* Stoppage Alert Banner if Down */}
                      {isDown && (
                        <div className="mt-3 p-2.5 rounded-xl bg-red-600/20 border border-red-500/40 text-xs space-y-1">
                          <div className="flex items-center justify-between text-red-300 font-bold">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                              {line.downtimeReason || "Unplanned Stoppage"}
                            </span>
                            <span className="font-mono font-black text-red-200">
                              ⏱ {formatDuration(line.downtimeSeconds)}
                            </span>
                          </div>
                          {line.assignedTechnician && (
                            <div className="text-[11px] text-white/60">
                              Assigned: <strong className="text-white">{line.assignedTechnician}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Changeover Countdown if in changeover */}
                      {line.status === "changeover" && line.changeoverSecondsRemaining != null && (
                        <div className="mt-3 p-2 rounded-xl bg-sky-600/20 border border-sky-500/40 text-xs flex items-center justify-between text-sky-200 font-bold">
                          <span>Target: {line.changeoverTargetProduct}</span>
                          <span className="font-mono">⏳ {formatDuration(line.changeoverSecondsRemaining)}</span>
                        </div>
                      )}

                      {/* Shift Lead Footer */}
                      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-medium">
                        <span>Lead: <strong className="text-white/70">{line.shiftLead}</strong></span>
                        <span>{line.operatorsCount} Operators On Line</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* PROCESS FLOW SEQUENCE VIEW — Step-by-Step Production Line Pipeline */
              <div className="space-y-4">
                <div className="text-xs uppercase font-extrabold tracking-widest text-white/50 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Shop Floor Value Stream Pipeline (Raw Intake $\rightarrow$ Finished Goods)</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {lines.map((line, idx) => (
                    <div
                      key={line.id}
                      className="p-4 rounded-xl border border-white/10 bg-[#111726] flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-[240px]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-lg font-black text-white/70 border border-white/10">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-xs text-white/50 font-bold uppercase">{line.stage}</div>
                          <div className="text-base font-black text-white">{line.name}</div>
                          <div className="text-xs text-blue-300">{line.currentProduct} ({line.poNumber})</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-white/40">Attainment</div>
                          <div className="text-base font-bold text-white">
                            {formatNumber(line.completedUnits)} / {formatNumber(line.targetUnitsShift)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-white/40">Current Speed</div>
                          <div className="text-base font-mono font-bold text-white">
                            {line.currentSpeedUnitsPerMin} u/m
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-white/40">OEE Score</div>
                          <div className="text-base font-mono font-bold text-blue-400">
                            {line.oeePercent.toFixed(1)}%
                          </div>
                        </div>

                        <div>{getStatusBadge(line.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Carousel Mode B: Bottleneck Deep-Dive */}
        {carouselStep === "bottleneck" && bottleneckLine && (
          <div className="flex-1 p-8 rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950/40 via-[#111726] to-[#0a0d14] flex flex-col justify-between shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2 text-red-400 font-extrabold uppercase text-xs tracking-widest">
                  <AlertTriangle className="h-4 w-4" />
                  <span>PLANT BOTTLENECK ACTIVE INVESTIGATION</span>
                </div>
                <h2 className="text-3xl font-black text-white mt-2">
                  {bottleneckLine.name}
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Active Stoppage: <strong>{bottleneckLine.downtimeReason || "Line Speed Loss"}</strong>
                </p>
              </div>

              <div className="text-right">
                <div className="text-sm uppercase font-bold text-white/50">Downtime Duration</div>
                <div className="text-5xl font-mono font-black text-red-400 mt-1 animate-pulse">
                  ⏱ {formatDuration(bottleneckLine.downtimeSeconds)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 my-8">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-xs uppercase font-bold text-white/50">Assigned Technician</div>
                <div className="text-xl font-bold text-white mt-1">
                  {bottleneckLine.assignedTechnician || "Awaiting Dispatch"}
                </div>
                <div className="text-xs text-white/50 mt-1">Maintenance Engineering Unit</div>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-xs uppercase font-bold text-white/50">Production Impact</div>
                <div className="text-xl font-bold text-amber-400 mt-1">
                  -{Math.round((bottleneckLine.downtimeSeconds / 60) * bottleneckLine.standardSpeedUnitsPerMin)} units
                </div>
                <div className="text-xs text-white/50 mt-1">Unproduced output volume</div>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-xs uppercase font-bold text-white/50">Line Attainment</div>
                <div className="text-xl font-bold text-white mt-1">
                  {Math.round((bottleneckLine.completedUnits / bottleneckLine.targetUnitsShift) * 100)}%
                </div>
                <div className="text-xs text-white/50 mt-1">Target: {formatNumber(bottleneckLine.targetUnitsShift)}</div>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-xs uppercase font-bold text-white/50">Financial Penalty</div>
                <div className="text-xl font-bold text-red-400 mt-1">
                  TZS {formatNumber(Math.round(bottleneckLine.downtimeSeconds / 60) * 1500)}
                </div>
                <div className="text-xs text-white/50 mt-1">Calculated at plant downtime rate</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-white/50">
              <span>Shift Lead: {bottleneckLine.shiftLead} • {bottleneckLine.operatorsCount} Operators standby</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselStep("overview")}
                className="bg-white/10 text-white font-bold h-8"
              >
                Back to All Lines
              </Button>
            </div>
          </div>
        )}

        {/* Carousel Mode C: Shift Leaderboard */}
        {carouselStep === "leaderboard" && (
          <div className="flex-1 p-8 rounded-3xl border border-white/10 bg-[#111726] flex flex-col justify-between shadow-2xl">
            <div className="border-b border-white/10 pb-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>PLANT SHIFT PERFORMANCE LEADERBOARD</span>
                </div>
                <h2 className="text-2xl font-black text-white mt-1">
                  Line Attainment & OEE Rankings
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselStep("overview")}
                className="bg-white/10 text-white font-bold h-8"
              >
                Back to All Lines
              </Button>
            </div>

            <div className="space-y-3 my-6">
              {[...lines]
                .sort((a, b) => b.oeePercent - a.oeePercent)
                .map((l, rank) => (
                  <div
                    key={l.id}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-black text-sm ${
                        rank === 0 ? "bg-amber-500 text-black" : rank === 1 ? "bg-slate-300 text-black" : "bg-white/10 text-white"
                      }`}>
                        #{rank + 1}
                      </div>
                      <div>
                        <div className="font-bold text-white">{l.name}</div>
                        <div className="text-xs text-white/50">Lead: {l.shiftLead} • {l.currentProduct}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div>
                        <span className="text-xs text-white/40 block">Output</span>
                        <strong className="text-white">{formatNumber(l.completedUnits)}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-white/40 block">OEE</span>
                        <strong className="text-blue-400 font-mono text-base">{l.oeePercent.toFixed(1)}%</strong>
                      </div>
                      <div>{getStatusBadge(l.status)}</div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="text-xs text-white/40 border-t border-white/10 pt-3">
              Rankings updated live every 60 seconds from line telemetry and batch logs.
            </div>
          </div>
        )}
      </main>

      {/* Interactive Simulation Drawer for Admin / Demos */}
      {simDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#121929] border-l border-white/15 p-6 flex flex-col justify-between shadow-2xl h-full overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-white text-base">Live TV Simulation Center</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSimDrawerOpen(false)}
                  className="h-8 w-8 p-0 text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-white/60 mt-3 leading-relaxed">
                Test real-world factory shop floor events on the Live TV: trigger line breakdowns, simulate sensor faults, raise Andon alerts, or restore lines to optimal speed.
              </p>

              <div className="space-y-4 mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Select Production Line to Control:
                </h4>

                {lines.map((l) => (
                  <div key={l.id} className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="truncate max-w-[200px]">{l.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {l.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {l.status !== "down" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSimulateStoppage(l.id)}
                          className="h-7 text-[11px] font-bold"
                        >
                          Trigger Stoppage
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleClearAlert(l.id)}
                          className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500"
                        >
                          Clear & Run
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setLines((prev) =>
                            prev.map((item) =>
                              item.id === l.id
                                ? { ...item, status: "changeover", changeoverSecondsRemaining: 600 }
                                : item
                            )
                          );
                        }}
                        className="h-7 text-[11px] font-bold"
                      >
                        Start CIP / Clean
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => {
                  setLines(INITIAL_MOCK_LINES);
                  setSimDrawerOpen(false);
                }}
                className="w-full text-xs font-bold text-white border-white/20 h-9"
              >
                Reset to Default Factory State
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
