import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Factory,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  ChevronRight,
  Info,
  Activity,
  Compass,
  Box,
  Truck,
  Eye,
  ArrowDownRight,
  Gauge,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PlantZone {
  id: string;
  lineNo: number;
  name: string;
  category: string;
  location: string;
  physicalLengthM: number;
  areaM2: number;
  status: "optimal" | "alert" | "maintenance";
  statusText: string;
  description: string;
  equipment: { name: string; tag: string; type: string; status: string; notes?: string }[];
  flowInFrom?: string;
  flowOutTo?: string;
  topPct: number;
  leftPct: number;
}

const PLANT_ZONES: PlantZone[] = [
  {
    id: "zone-1",
    lineNo: 1,
    name: "Raw Material Intake & Storage Silos",
    category: "Inbound Receiving",
    location: "North High-Bay Dock (Bay 1–3)",
    physicalLengthM: 42,
    areaM2: 2400,
    status: "optimal",
    statusText: "Active Intake Flow",
    description: "Vertical stainless storage silos, bulk ingredient receiving hoppers, and automated inclined screw conveyors delivering dry and liquid ingredients to processing.",
    flowOutTo: "Mixing & Batch Processing Tanks",
    topPct: 18,
    leftPct: 44,
    equipment: [
      { name: "Raw Ingestion Silo Cluster (4× 50T)", tag: "SILO-01..04", type: "Bulk Storage", status: "Operational" },
      { name: "Pneumatic Transfer Blower System", tag: "PN-BLW-01", type: "Pneumatics", status: "Operational" },
      { name: "Incline Sizer & Screen Conveyor", tag: "CNV-IN-01", type: "Belt Conveyor", status: "Operational (420 kg/h)" },
    ],
  },
  {
    id: "zone-2",
    lineNo: 2,
    name: "Mixing & Thermal Processing Tanks",
    category: "Batch Preparation",
    location: "Central Processing Hall",
    physicalLengthM: 38,
    areaM2: 1950,
    status: "optimal",
    statusText: "Continuous Batching (T1–T4)",
    description: "Multi-stage jacketed stainless mixing vessels T1 through T4 with high-shear emulsifiers, sanitary CIP pipelines, and overhead maintenance catwalks.",
    flowInFrom: "Raw Material Intake",
    flowOutTo: "Bottling & Canning Line",
    topPct: 36,
    leftPct: 34,
    equipment: [
      { name: "Jacketed Batch Reactor Tank T1", tag: "TNK-M01", type: "Sanitary Vessel 10,000L", status: "Active Batch 412" },
      { name: "Jacketed Batch Reactor Tank T2", tag: "TNK-M02", type: "Sanitary Vessel 10,000L", status: "Active Batch 413" },
      { name: "Secondary Blending Vessel T3", tag: "TNK-M03", type: "Agitator Tank 8,000L", status: "Holding (42°C)" },
      { name: "Fine Homogenizer Unit T4", tag: "HMG-04", type: "High-Pressure Emulsifier", status: "Operational" },
    ],
  },
  {
    id: "zone-3",
    lineNo: 3,
    name: "Bottling, Filling & Rotary Capping Line",
    category: "Primary Assembly & Packaging",
    location: "Mid-Plant Cleanroom Enclosure",
    physicalLengthM: 68,
    areaM2: 3200,
    status: "alert",
    statusText: "Alert: Capper C-103 Cap Jam",
    description: "High-speed continuous bottling conveyor line featuring rotary rinser, monobloc isobaric filler, automated crown/screw capper C-103, and maintenance bypass lane.",
    flowInFrom: "Mixing Tanks (Piped Feed)",
    flowOutTo: "Quality Control Tunnel",
    topPct: 54,
    leftPct: 62,
    equipment: [
      { name: "Rotary Air Rinser Unit", tag: "RNS-01", type: "De-ionizing Rinser", status: "Operational" },
      { name: "48-Valve Isobaric Liquid Filler", tag: "FIL-48", type: "Rotary Filling Carousel", status: "Operational (12,000 bph)" },
      { name: "Rotary Capping Turret C-103", tag: "C-103", type: "Automated Capper", status: "Stoppage / Cap Jam Sensor Tripped", notes: "Red alert beacon active on plant floor" },
      { name: "Scheduled Maintenance Bay", tag: "STN-4521", type: "Inline Overhaul Station", status: "Under Maintenance (W.O. 4521)" },
    ],
  },
  {
    id: "zone-4",
    lineNo: 4,
    name: "Continuous Quality Control & Laser Inspection",
    category: "Quality Assurance",
    location: "South-Central Inspection Corridor",
    physicalLengthM: 52,
    areaM2: 1800,
    status: "optimal",
    statusText: "100% Optical Inspection Active",
    description: "Illuminated conveyor inspection tunnel equipped with 360-degree Cognex AI vision scanners, fill-level gamma detector, checkweigher, and automated rejection pneumatic kickers.",
    flowInFrom: "Bottling & Canning Line",
    flowOutTo: "Packaging & Palletizing Yard",
    topPct: 68,
    leftPct: 45,
    equipment: [
      { name: "Cognex Vision AI Inspection Gate", tag: "VIS-GATE-01", type: "360° Optical Scanner", status: "99.8% Pass Rate" },
      { name: "Fill-Level & Cap Seal Detector", tag: "LVL-DET-02", type: "High-Speed Laser Sensor", status: "Operational" },
      { name: "Dynamic Inline Checkweigher", tag: "WGH-03", type: "Continuous Weighbelt", status: "Calibrated (0.1g tolerance)" },
      { name: "High-Speed Rejection Diverter", tag: "REJ-PNEU", type: "Pneumatic Arm", status: "Standby / Ready" },
    ],
  },
  {
    id: "zone-5",
    lineNo: 5,
    name: "Automated Packaging & Robotic Palletizing",
    category: "Outbound Dispatch Preparation",
    location: "South Dispatch Logistics Yard",
    physicalLengthM: 58,
    areaM2: 3600,
    status: "optimal",
    statusText: "Dual Robot Arms Active",
    description: "End-of-line packaging cell featuring automated corrugated carton erector, robotic case packer, dual orange articulated KUKA/Fanuc palletizer arms, stretch wrapper, and forklift dispatch bays.",
    flowInFrom: "Quality Control Tunnel",
    flowOutTo: "Outbound Truck Logistics Docks",
    topPct: 86,
    leftPct: 48,
    equipment: [
      { name: "Wrap-Around Case Packer & Sealer", tag: "CAS-PK-01", type: "Carton Packaging", status: "Operational (45 cartons/min)" },
      { name: "Robot Palletizer Cell Alpha (Orange)", tag: "ROB-PAL-A", type: "6-Axis Articulated Arm", status: "Palletizing (Euro Pallet 1200×800)" },
      { name: "Robot Palletizer Cell Beta (Yellow)", tag: "ROB-PAL-B", type: "Heavy-Duty Palletizer", status: "Palletizing Tier 4" },
      { name: "Automatic Rotary Pallet Stretch Wrapper", tag: "WRP-ROT", type: "Film Wrapper & Labeler", status: "Operational" },
      { name: "Forklift Staging & Buffer Bays", tag: "STG-BAY", type: "Yellow Floor Walkway Grid", status: "Staging Ready for Loading" },
    ],
  },
];

export default function Plant3DLayout() {
  const [selectedZone, setSelectedZone] = useState<PlantZone | null>(null);
  const [showFlowLines, setShowFlowLines] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "specs" | "flow">("visual");
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.8), 2.0));
  };

  const resetZoom = () => setZoomLevel(1);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none ${
        isFullscreen ? "p-4 md:p-6" : "p-4 md:p-6 rounded-2xl border border-slate-800 shadow-2xl my-2"
      }`}
    >
      {/* HEADER SECTION */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                3D Plant Arrangement & Line Flow
              </h1>
              <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 text-[11px] font-semibold">
                Physical Facility Twin
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Physical factory arrangement, spatial equipment positioning, material flow lines, and workstation zones
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab("visual")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "visual" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              3D Physical Plant
            </button>
            <button
              onClick={() => setActiveTab("specs")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "specs" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Arrangement Specs
            </button>
            <button
              onClick={() => setActiveTab("flow")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "flow" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Sequence & Flow
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFlowLines((v) => !v)}
            className={`text-xs h-9 px-3 border-slate-800 ${
              showFlowLines ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-900 text-slate-400"
            }`}
          >
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            {showFlowLines ? "Flow Lines ON" : "Flow Lines OFF"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 h-9 px-3 gap-1.5 text-xs font-semibold"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4 text-amber-400" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </Button>
        </div>
      </header>

      {/* QUICK FACILITY METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 my-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Total Plant Footprint</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">18,500 m²</span>
            <span className="text-[10px] text-slate-400">185m × 100m</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Line Arrangement</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-blue-400">5 Primary Lines</span>
            <span className="text-[10px] text-blue-500 font-semibold">Parallel Flow</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Flow Direction</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold text-emerald-400">North ➔ South</span>
            <span className="text-[10px] text-slate-400">Continuous</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Material Inbound</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold text-slate-200">North Bay 1–3</span>
            <span className="text-[10px] text-slate-400">Silo Loading</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Active Plant Alert</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold text-rose-400">C-103 Capper</span>
            <span className="text-[10px] text-rose-500">Cap Jam (Line 3)</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Safety Standards</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> ISO 22000
            </span>
            <span className="text-[10px] text-emerald-500">GMP Grade</span>
          </div>
        </div>
      </div>

      {/* MAIN VIEW CONTENT AREA */}
      {activeTab === "visual" && (
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/40 flex flex-col min-h-[560px]">
          {/* FLOATING ZOOM / CAMERA BAR */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-xl text-xs shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoom(0.15)}
              className="h-8 w-8 text-slate-200 hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoom(-0.15)}
              className="h-8 w-8 text-slate-200 hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetZoom}
              className="h-8 w-8 text-slate-200 hover:bg-slate-800"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-mono px-2 text-slate-400 border-l border-slate-800">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          {/* VIEWPORT CONTAINER */}
          <div className="relative flex-1 overflow-auto flex items-center justify-center p-2 bg-black/40">
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: "center center",
                transition: "transform 0.2s ease-out",
              }}
              className="relative max-w-full rounded-xl overflow-hidden shadow-2xl border border-slate-800"
            >
              {/* HIGH DEFINITION PHYSICAL PLANT IMAGE */}
              <img
                src="/factory-floor-topdown.jpg"
                alt="3D Plant Arrangement and Physical Line Flow"
                className="w-full max-h-[750px] object-contain block select-none"
              />

              {/* INTERACTIVE CLICKABLE HOTSPOTS POSITIONED OVER EACH LINE & WORKSTATION */}
              {PLANT_ZONES.map((zone) => {
                const isSelected = selectedZone?.id === zone.id;
                const isAlert = zone.status === "alert";

                return (
                  <div
                    key={zone.id}
                    style={{ top: `${zone.topPct}%`, left: `${zone.leftPct}%` }}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  >
                    <button
                      onClick={() => setSelectedZone(zone)}
                      className={`group flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md transition-all shadow-xl border cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white border-white ring-4 ring-blue-500/40 scale-110"
                          : isAlert
                          ? "bg-rose-950/90 text-rose-200 border-rose-500/80 animate-pulse hover:scale-105"
                          : "bg-slate-900/85 text-slate-100 border-slate-700/80 hover:border-blue-400 hover:bg-slate-800/90 hover:scale-105"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isAlert ? "bg-rose-400 animate-ping" : "bg-emerald-400"
                        }`}
                      />
                      <span className="text-xs font-bold whitespace-nowrap">
                        {zone.name}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOTTOM INSTRUCTION BAR */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-slate-400">
              <Info className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Click on any line badge above to inspect equipment footprint, capacity, and physical conveyor arrangement.</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Optimal Flow
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> C-103 Jam Alert
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Maintenance Bay W.O. 4521
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SPECS VIEW */}
      {activeTab === "specs" && (
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-blue-400" />
              Architectural Plant Specifications & Spatial Engineering
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Detailed engineering dimensions, building structural clearances, and manufacturing footprint.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Building Structure</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Total Enclosed Area:</span>
                  <span className="font-semibold text-white">18,500 m²</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Length × Width:</span>
                  <span className="font-semibold text-white">185m × 100m</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Clear Ceiling Height:</span>
                  <span className="font-semibold text-white">12.5 meters</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Floor Load Capacity:</span>
                  <span className="font-semibold text-white">5,000 kg/m²</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Safety & Traffic Lanes</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Pedestrian Walkway Width:</span>
                  <span className="font-semibold text-white">1.8 meters</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Forklift / AGV Lanes:</span>
                  <span className="font-semibold text-white">3.2 meters dual-way</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Floor Surface Coating:</span>
                  <span className="font-semibold text-white">Anti-static industrial epoxy</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Emergency Exits:</span>
                  <span className="font-semibold text-white">8 Direct Fire Doors</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Utilities & Energy Grid</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Substation Capacity:</span>
                  <span className="font-semibold text-white">2.5 MVA Transformer</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Compressed Air Loop:</span>
                  <span className="font-semibold text-white">7.5 Bar Constant</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">Process Water Supply:</span>
                  <span className="font-semibold text-white">35 m³/hr RO Water</span>
                </li>
                <li className="flex justify-between border-b border-slate-900 pb-1">
                  <span className="text-slate-400">HVAC Cleanroom Rating:</span>
                  <span className="font-semibold text-white">ISO Class 8 (Zone 3)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* INDIVIDUAL LINE BREAKDOWN */}
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            Production Line Physical Layout Dimensions
          </h3>
          <div className="space-y-3">
            {PLANT_ZONES.map((zone) => (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone)}
                className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      Line 0{zone.lineNo}
                    </span>
                    <h4 className="font-bold text-sm text-white">{zone.name}</h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold ${
                        zone.status === "alert"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {zone.statusText}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">{zone.description}</p>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Conveyor Length</span>
                    <span className="font-bold text-slate-100">{zone.physicalLengthM} meters</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Floor Footprint</span>
                    <span className="font-bold text-slate-100">{zone.areaM2} m²</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Equipment</span>
                    <span className="font-bold text-blue-400">{zone.equipment.length} Units</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEQUENCE & FLOW VIEW */}
      {activeTab === "flow" && (
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-blue-400" />
              Physical Material Flow Sequence (North ➔ South)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tracing raw material ingress through each processing station down to packaged pallet loadout.
            </p>
          </div>

          <div className="relative pl-6 border-l-2 border-blue-500/30 space-y-6 my-4">
            {PLANT_ZONES.map((zone, idx) => (
              <div key={zone.id} className="relative group">
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-slate-950 text-[10px] font-bold text-white">
                  {idx + 1}
                </span>
                <div
                  onClick={() => setSelectedZone(zone)}
                  className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 p-4 rounded-xl cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400 font-mono">Stage 0{zone.lineNo}</span>
                    <span className="text-xs text-slate-400">{zone.location}</span>
                  </div>
                  <h4 className="font-bold text-base text-white">{zone.name}</h4>
                  <p className="text-xs text-slate-300 mt-1">{zone.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {zone.equipment.map((eq) => (
                      <span key={eq.tag} className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {eq.name} ({eq.tag})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZONE & EQUIPMENT INSPECTION DIALOG */}
      <Dialog open={Boolean(selectedZone)} onOpenChange={(open) => !open && setSelectedZone(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Factory className="h-5 w-5 text-blue-400" />
                {selectedZone?.name}
              </DialogTitle>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 uppercase font-bold ${
                  selectedZone?.status === "alert"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {selectedZone?.statusText}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Location: {selectedZone?.location} · Physical Category: {selectedZone?.category}
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-300 leading-relaxed my-2">
            {selectedZone?.description}
          </p>

          <div className="grid grid-cols-3 gap-3 my-3 font-mono">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block">Conveyor Run</span>
              <span className="text-lg font-bold text-white">{selectedZone?.physicalLengthM} m</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block">Floor Footprint</span>
              <span className="text-lg font-bold text-white">{selectedZone?.areaM2} m²</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block">Flow Connection</span>
              <span className="text-xs font-bold text-blue-400 truncate block mt-1">
                {selectedZone?.flowOutTo ? `➔ ${selectedZone.flowOutTo}` : "End of Line"}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Installed Equipment & Spatial Layout
            </h4>
            <div className="space-y-2">
              {selectedZone?.equipment.map((eq) => (
                <div
                  key={eq.tag}
                  className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-400">{eq.tag}</span>
                      <span className="font-semibold text-white">{eq.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Type: {eq.type}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-semibold ${
                        eq.status.includes("Stoppage") || eq.status.includes("Alert")
                          ? "text-rose-400"
                          : eq.status.includes("Maintenance")
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {eq.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedZone(null)} className="text-xs border-slate-700">
              Close Details
            </Button>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5">
              <Link to="/machines">
                <Wrench className="h-3.5 w-3.5" />
                View Machine Records
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
