import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Truck, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  UserCog, 
  Calendar, 
  Gauge, 
  Fuel, 
  Layers, 
  FileText, 
  Clock, 
  Building2,
  CheckSquare,
  Sparkles,
  Info,
  X,
  PackageCheck,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { TechnicianDialog, type WorkshopTechnician } from "@/pages/fleet/Technicians";
import { formatNumber, formatDate } from "@/lib/format";
import { isLogistixwareAccount } from "@/services/customerService";
import { isEnterpriseFleet } from "@/lib/fleetTiers";
import { getSmartSpares, issuePartToJobCard, type CommercialSparePart } from "@/services/smartPartsService";

export interface FleetVehicleOption {
  id: string;
  name: string;
  category?: string;
  plate_number?: string | null;
  vehicle_code?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  current_odometer_km?: number | null;
  current_hours?: number | null;
  status?: string;
  assigned_driver?: string | null;
}

const VEHICLE_WORK_TYPES = [
  { 
    id: "preventive", 
    dbType: "preventive", 
    label: "Scheduled PM Service", 
    desc: "Engine oil, oil filters, fuel filters, lube & greasing", 
    icon: CheckCircle2,
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
  },
  { 
    id: "brakes", 
    dbType: "repair", 
    label: "Brakes & Suspension", 
    desc: "Linings, drums, air valves, springs, shock absorbers", 
    icon: Wrench,
    badgeColor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" 
  },
  { 
    id: "engine", 
    dbType: "repair", 
    label: "Engine & Powertrain", 
    desc: "Diesel engine, clutch, transmission gearbox, differential", 
    icon: Gauge,
    badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" 
  },
  { 
    id: "electrical", 
    dbType: "repair", 
    label: "Electrical & Battery", 
    desc: "Alternator, starter motor, ECM wiring, vehicle lighting", 
    icon: Sparkles,
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" 
  },
  { 
    id: "tyres", 
    dbType: "repair", 
    label: "Tyres & Alignment", 
    desc: "Tyre rotation, replacement, puncture, wheel alignment", 
    icon: Layers,
    badgeColor: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20" 
  },
  { 
    id: "inspection", 
    dbType: "inspection", 
    label: "Inspection / COVT", 
    desc: "Pre-trip transit check, LATRA / Police safety inspection", 
    icon: FileText,
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" 
  },
  { 
    id: "body", 
    dbType: "modification", 
    label: "Body & Trailer Chassis", 
    desc: "Fifth wheel, trailer chassis, welding, panel beating", 
    icon: Truck,
    badgeColor: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20" 
  },
  { 
    id: "breakdown", 
    dbType: "breakdown", 
    label: "Emergency Breakdown", 
    desc: "Roadside emergency recovery & transit repair", 
    icon: AlertTriangle,
    badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" 
  },
];

export const COMPONENT_SYSTEMS = [
  "Brake System",
  "Engine System",
  "Fuel System",
  "Suspension System",
  "Steering System",
  "Transmission System",
  "Electrical System",
  "Electronics System",
  "Air System",
  "Body Works",
  "Accident Repairs",
];

export const REPAIR_LOCATIONS = [
  { id: "onsite", label: "Onsite (Company Workshop)" },
  { id: "offsite", label: "Offsite / Roadside Field Rescue" },
  { id: "outsourced", label: "Outsourced (Contractors & Dealers)" },
];

const STANDARD_PM_TASKS = [
  "Engine Oil & Oil Filter Replacement",
  "Primary & Secondary Fuel Filters Replacement",
  "Air Cleaner / Filter Inspection & Cleaning",
  "Differential & Transmission Gearbox Oil Level Check",
  "Air Brake Pressure & Brake Linings / Shoes Check",
  "Chassis, Kingpins & Prop-shaft Universal Joints Greasing",
  "Tyre Pressures, Tread Depth & Wheel Nut Torques Check",
  "Battery Terminal Clean & Charging Alternator Voltage Test",
  "Coolant Level, Radiator & Hose Condition Inspection",
];

const QUICK_TITLE_SUGGESTIONS: Record<string, string[]> = {
  preventive: [
    "Scheduled 10,000 km A-Service (Oil & Filters)",
    "Scheduled 25,000 km B-Service (Full Fluids & Greasing)",
    "Engine Oil & Full Filter Service",
    "Chassis & Axle Greasing Service",
  ],
  brakes: [
    "Replace Worn Front & Rear Brake Linings",
    "Air Brake Leak & Relay Valve Service",
    "Brake Chamber Diaphragm Replacement",
    "Trailer Air Line & Gladhand Connector Repair",
  ],
  engine: [
    "Clutch Disc & Pressure Plate Overhaul",
    "Turbocharger & Exhaust Manifold Gasket Replacement",
    "Fuel Injector Nozzles Service",
    "Water Pump & Serpentine Belt Replacement",
  ],
  electrical: [
    "Alternator Charging Issue & Wiring Repair",
    "Replace Heavy Duty Batteries (2x 12V 200Ah)",
    "Trailer Tail Lights & Marker Wiring Harness Fix",
    "Starter Motor Solenoid Repair",
  ],
  tyres: [
    "Replace Worn Drive Axle Tyres (315/80R22.5)",
    "Steer Axle Balancing & Wheel Alignment",
    "Trailer Tyre Puncture Repair & Valve Stem Fix",
  ],
  inspection: [
    "Pre-Trip Cross-Border Corridor Inspection",
    "LATRA Commercial Roadworthiness Check",
    "Post-Trip Vehicle Defect Inspection",
  ],
  body: [
    "Trailer Kingpin & Fifth Wheel Plate Overhaul",
    "Chassis Crossmember Crack Welding",
    "Cabinet Door Lock & Mudguard Bracket Repair",
  ],
  breakdown: [
    "Corridor Emergency Roadside Rescue & Repair",
    "Blown Air Hose / Compressor Breakdown Rescue",
    "Engine Overheating Roadside Recovery",
  ],
};

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function FleetWorkOrderForm({
  machines,
  preselectMachineId,
  nextNumber,
}: {
  machines: FleetVehicleOption[];
  preselectMachineId?: string | null;
  nextNumber: number | null;
}) {
  const { profile, user, organisation } = useAuth();
  const navigate = useNavigate();
  const isLogistix = isLogistixwareAccount(organisation);

  const [submitting, setSubmitting] = useState(false);
  const [technicians, setTechnicians] = useState<WorkshopTechnician[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [techModalOpen, setTechModalOpen] = useState(false);

  // Form State
  const [selectedMachineId, setSelectedMachineId] = useState(preselectMachineId ?? "");
  const [workType, setWorkType] = useState<string>("preventive");
  const [title, setTitle] = useState("");
  const [defectReport, setDefectReport] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [dueDate, setDueDate] = useState(addDays(new Date(), 7));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [pmTasksList, setPmTasksList] = useState<string[]>([...STANDARD_PM_TASKS]);
  const [newCustomTask, setNewCustomTask] = useState("");
  const [remarks, setRemarks] = useState("");
  const [componentSystem, setComponentSystem] = useState<string>("Brake System");
  const [repairLocation, setRepairLocation] = useState<string>("onsite");

  // Outsourcing State
  const [isOutsourced, setIsOutsourced] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [vendorCost, setVendorCost] = useState("");

  // Load Technicians, Vendors, and Profiles
  const loadResources = async () => {
    if (!profile) return;
    try {
      const [{ data: techs }, { data: vList }, { data: profs }] = await Promise.all([
        (supabase as any)
          .from("garage_mechanics")
          .select("*")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("vendors")
          .select("id, name, category")
          .eq("active", true)
          .order("name"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("organisation_id", profile.organisation_id)
          .order("full_name"),
      ]);

      setTechnicians((techs as WorkshopTechnician[]) || []);
      setVendors(vList || []);
      setMembers(profs || []);
    } catch (_err) {
      // Ignore
    }
  };

  useEffect(() => {
    loadResources();
  }, [profile]);

  // Selected Machine
  const selectedMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || null;
  }, [machines, selectedMachineId]);

  // When selected machine changes, auto-fill odometer
  useEffect(() => {
    if (selectedMachine) {
      if (selectedMachine.current_odometer_km != null) {
        setOdometerKm(String(selectedMachine.current_odometer_km));
      } else if (selectedMachine.current_hours != null) {
        setOdometerKm(String(selectedMachine.current_hours));
      }
    }
  }, [selectedMachine]);

  // Selected Technician details
  const selectedTechnician = useMemo(() => {
    return technicians.find((t) => t.id === selectedTechnicianId) || null;
  }, [technicians, selectedTechnicianId]);

  // Current work type config
  const currentWorkTypeConfig = useMemo(() => {
    return VEHICLE_WORK_TYPES.find((w) => w.id === workType) || VEHICLE_WORK_TYPES[0];
  }, [workType]);

  // Suggestions for Title
  const titleSuggestions = useMemo(() => {
    return QUICK_TITLE_SUGGESTIONS[workType] || [];
  }, [workType]);

  // Priority Change handler
  const handlePriorityChange = (p: "low" | "normal" | "high" | "critical") => {
    setPriority(p);
    if (p === "critical") setDueDate(addDays(new Date(), 0));
    else if (p === "high") setDueDate(addDays(new Date(), 1));
    else if (p === "normal") setDueDate(addDays(new Date(), 7));
    else if (p === "low") setDueDate(addDays(new Date(), 14));
  };

  // Toggle PM task
  const toggleTask = (task: string) => {
    setSelectedTasks((prev) => 
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  const handleAddPmTask = () => {
    const trimmed = newCustomTask.trim();
    if (!trimmed) return;
    if (!pmTasksList.includes(trimmed)) {
      setPmTasksList((prev) => [...prev, trimmed]);
    }
    if (!selectedTasks.includes(trimmed)) {
      setSelectedTasks((prev) => [...prev, trimmed]);
    }
    setNewCustomTask("");
  };

  const handleRemovePmTask = (taskToRemove: string) => {
    setPmTasksList((prev) => prev.filter((t) => t !== taskToRemove));
    setSelectedTasks((prev) => prev.filter((t) => t !== taskToRemove));
  };

  // Enterprise Smart Stores & Compatible Spares State (Slide 15)
  const isEnterprise = isEnterpriseFleet(organisation);
  const [compatibleSpares, setCompatibleSpares] = useState<CommercialSparePart[]>([]);
  const [selectedSpares, setSelectedSpares] = useState<{ partId: string; quantity: number }[]>([]);
  const [spareFilter, setSpareFilter] = useState("");

  useEffect(() => {
    if (!isEnterprise || !selectedMachine) {
      setCompatibleSpares([]);
      setSelectedSpares([]);
      return;
    }
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    const vehicleQuery = `${selectedMachine.make || ""} ${selectedMachine.model || ""}`.trim();
    getSmartSpares(orgId, vehicleQuery).then((spares) => {
      setCompatibleSpares(spares);
    });
  }, [isEnterprise, selectedMachine, organisation?.id, profile?.organisation_id]);

  const handleToggleSpare = (partId: string) => {
    setSelectedSpares((prev) => {
      const exists = prev.find((p) => p.partId === partId);
      if (exists) {
        return prev.filter((p) => p.partId !== partId);
      } else {
        return [...prev, { partId, quantity: 1 }];
      }
    });
  };

  const handleUpdateSpareQty = (partId: string, delta: number) => {
    setSelectedSpares((prev) => {
      return prev
        .map((p) => {
          if (p.partId === partId) {
            const newQty = Math.max(1, p.quantity + delta);
            return { ...p, quantity: newQty };
          }
          return p;
        })
        .filter((p) => p.quantity > 0);
    });
  };

  const filteredCompatibleSpares = useMemo(() => {
    if (!spareFilter.trim()) return compatibleSpares;
    const q = spareFilter.toLowerCase();
    return compatibleSpares.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.part_number.toLowerCase().includes(q) ||
        s.system_category.toLowerCase().includes(q) ||
        s.bin_location.toLowerCase().includes(q)
    );
  }, [compatibleSpares, spareFilter]);

  const totalSparesCost = useMemo(() => {
    return selectedSpares.reduce((sum, item) => {
      const part = compatibleSpares.find((p) => p.id === item.partId);
      return sum + (part ? part.unit_price_tzs * item.quantity : 0);
    }, 0);
  }, [selectedSpares, compatibleSpares]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!selectedMachineId) {
      toast.error("Please select a vehicle or trailer for maintenance");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a maintenance service title");
      return;
    }

    setSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const numOdo = odometerKm.trim() ? parseFloat(odometerKm) : null;

      // Compile tasks description
      let fullDescription = "";
      if (defectReport.trim()) {
        fullDescription += `[Driver / Defect Complaint]:\n${defectReport.trim()}\n\n`;
      }
      if (workType === "preventive" && selectedTasks.length > 0) {
        fullDescription += `[Service PM Checklist Items]:\n${selectedTasks.map((t) => `• ${t}`).join("\n")}\n\n`;
      }
      if (numOdo != null) {
        fullDescription += `[Vehicle Service Odometer]: ${formatNumber(numOdo)} km\n`;
      }
      if (selectedTechnician) {
        fullDescription += `[Assigned Workshop Technician]: ${selectedTechnician.name} (${selectedTechnician.specialization || "Technician"})\n`;
      }
      if (componentSystem) {
        fullDescription += `[Component System Classification]: ${componentSystem}\n`;
      }
      if (repairLocation) {
        const locObj = REPAIR_LOCATIONS.find((l) => l.id === repairLocation);
        fullDescription += `[Repair Location Source]: ${locObj ? locObj.label : repairLocation}\n`;
      }

      if (isEnterprise && selectedSpares.length > 0) {
        fullDescription += `\n[Requisitioned Workshop Stores Spares]:\n`;
        for (const item of selectedSpares) {
          const part = compatibleSpares.find((p) => p.id === item.partId);
          if (part) {
            fullDescription += `• ${part.part_number} - ${part.name} (Qty: ${item.quantity}) [Bin: ${part.bin_location}] @ TZS ${part.unit_price_tzs.toLocaleString()}\n`;
          }
        }
        fullDescription += `Total Spares Value: TZS ${totalSparesCost.toLocaleString()}\n`;
      }

      // Check if selectedTechnicianId matches a profile user id or a garage_mechanics id
      const matchingProfile = members.find((m) => m.id === selectedTechnicianId);
      const assigneeId = matchingProfile ? matchingProfile.id : null;

      const remedyText = `[COMPONENT:${componentSystem}] [LOCATION:${repairLocation}] ${workType === "preventive" ? selectedTasks.join(", ") : ""}`.trim();
      const outsourcedFlag = isOutsourced || repairLocation === "outsourced";

      const payload: any = {
        organisation_id: profile.organisation_id,
        machine_id: selectedMachineId,
        title: title.trim(),
        description: fullDescription.trim() || null,
        work_type: currentWorkTypeConfig.dbType,
        priority,
        status: (selectedTechnician || assigneeId) ? "assigned" : "open",
        assignee_id: assigneeId,
        due_date: dueDate || null,
        nature_of_problem: defectReport.trim() || null,
        proposed_remedy: remedyText || null,
        technician_comment: null,
        remarks: remarks.trim() || null,
        is_outsourced: outsourcedFlag,
        vendor_id: outsourcedFlag && vendorId ? vendorId : null,
        promised_date: outsourcedFlag && promisedDate ? promisedDate : null,
        vendor_cost: outsourcedFlag && vendorCost ? parseFloat(vendorCost) : null,
        vendor_currency: "TZS",
        created_by: profile.id,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("work_orders")
        .insert(payload)
        .select("id, wo_number, wo_year")
        .single();

      if (insertErr || !inserted) throw insertErr || new Error("Failed to create work order");

      // Auto-issue parts from smart stores with audit trail (Slide 15)
      if (isEnterprise && selectedSpares.length > 0) {
        for (const item of selectedSpares) {
          const part = compatibleSpares.find((p) => p.id === item.partId);
          if (part) {
            try {
              await issuePartToJobCard(profile.organisation_id, {
                organisation_id: profile.organisation_id,
                part_id: part.id,
                part_number: part.part_number,
                part_name: part.name,
                job_card_number: formatWoNumber(inserted.wo_year, inserted.wo_number),
                vehicle_plate: selectedMachine?.plate_number || selectedMachine?.name || "Vehicle",
                technician_name: selectedTechnician?.name || profile.full_name || "Mechanic",
                quantity: item.quantity,
                unit_price: part.unit_price_tzs,
                total_cost: part.unit_price_tzs * item.quantity,
                issued_by: profile.id,
              });
            } catch (_e) {
              // Non-blocking for spares issuance
            }
          }
        }
      }

      // Update vehicle odometer in machines if modern and greater
      if (numOdo != null && !Number.isNaN(numOdo) && numOdo > 0) {
        const shouldUpdateOdo = !selectedMachine?.current_odometer_km || numOdo >= selectedMachine.current_odometer_km;
        if (shouldUpdateOdo) {
          await supabase
            .from("machines")
            .update({ current_odometer_km: numOdo })
            .eq("id", selectedMachineId);
        }
      }

      toast.success(`Vehicle Work Order ${formatWoNumber(inserted.wo_year, inserted.wo_number)} created!`);
      navigate(`/work-orders/${inserted.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create work order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/work-orders"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to maintenance orders
        </Link>
        <div className="text-xs uppercase font-mono tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-md">
          {formatWoNumber(new Date().getFullYear(), nextNumber)} (preview)
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Form (7 cols on desktop) */}
        <form onSubmit={submit} className="lg:col-span-7 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Vehicle Maintenance Work Order
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Create a vehicle service, mechanical repair, or breakdown recovery order for your fleet.
            </p>
          </div>

          {/* 1. Vehicle Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Select Fleet Vehicle / Trailer *</span>
              {selectedMachine && (
                <span className="text-[11px] font-mono text-primary font-medium">
                  {selectedMachine.plate_number || selectedMachine.name}
                </span>
              )}
            </Label>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose truck, bus, or trailer..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center justify-between gap-4 py-0.5 w-full">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-mono text-primary uppercase font-bold text-xs">
                          {m.plate_number || m.name}
                        </span>
                        {m.vehicle_code && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({m.vehicle_code})
                          </span>
                        )}
                        <span className="text-xs text-foreground">
                          {[m.make, m.model].filter(Boolean).join(" ")}
                        </span>
                      </div>
                      {m.current_odometer_km != null && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {formatNumber(m.current_odometer_km)} km
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selected Vehicle Info Card */}
            {selectedMachine && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/30 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-foreground font-mono text-sm">
                      {selectedMachine.plate_number || selectedMachine.name}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {[selectedMachine.make, selectedMachine.model, selectedMachine.year].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Current Odometer</div>
                    <div className="font-mono font-bold text-foreground">
                      {selectedMachine.current_odometer_km != null ? `${formatNumber(selectedMachine.current_odometer_km)} km` : "Not recorded"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Service / Work Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Maintenance Service Category *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VEHICLE_WORK_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = workType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setWorkType(type.id)}
                    className={`flex flex-col items-start text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-xs leading-tight">{type.label}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{type.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Service Title & Quick Suggestions */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Service Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 10,000 km A-Service / Replace Brake Linings"
              className="h-10 text-sm font-medium"
              required
            />
            {titleSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground mr-1">Quick Suggestions:</span>
                {titleSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTitle(sug)}
                    className="text-[10px] bg-muted/60 hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded-md border border-border/60 transition-colors text-muted-foreground cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3b. Component System Classification (Slide 11) & Repair Location (Slide 12) */}
          <div className="grid gap-4 sm:grid-cols-2 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Component System Classification *
              </Label>
              <Select value={componentSystem} onValueChange={setComponentSystem}>
                <SelectTrigger className="h-10 bg-background text-xs">
                  <SelectValue placeholder="Select vehicle component..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_SYSTEMS.map((sys) => (
                    <SelectItem key={sys} value={sys}>
                      {sys}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Classified for failure trend analytics</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Repair Location Source *
              </Label>
              <Select
                value={repairLocation}
                onValueChange={(val) => {
                  setRepairLocation(val);
                  if (val === "outsourced") {
                    setIsOutsourced(true);
                  }
                }}
              >
                <SelectTrigger className="h-10 bg-background text-xs">
                  <SelectValue placeholder="Select repair location..." />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_LOCATIONS.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">In-house workshop vs field breakdown vs outsourced</p>
            </div>
          </div>

          {/* 4. Service Odometer & Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Odometer at Service (km)</span>
                <span className="text-[10px] text-muted-foreground">Syncs with vehicle</span>
              </Label>
              <div className="relative">
                <Gauge className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                  placeholder="e.g. 184500"
                  className="pl-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority Level</Label>
              <div className="grid grid-cols-4 gap-1 h-10">
                {(["low", "normal", "high", "critical"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePriorityChange(p)}
                    className={`rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      priority === p
                        ? p === "critical"
                          ? "bg-red-600 text-white shadow-xs"
                          : p === "high"
                          ? "bg-amber-600 text-white shadow-xs"
                          : p === "low"
                          ? "bg-slate-500 text-white shadow-xs"
                          : "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/20 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Workshop Technician Assignment */}
          <div className="space-y-2 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <UserCog className="h-4 w-4 text-primary" />
                Assign Workshop Technician / Mechanic
              </Label>
              <button
                type="button"
                onClick={() => setTechModalOpen(true)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Register Technician
              </button>
            </div>

            <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select workshop mechanic / technician..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Workshop Mechanics ({technicians.length})
                </div>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center justify-between gap-4 py-0.5 w-full">
                      <span className="font-medium text-xs text-foreground">{t.name}</span>
                      {t.specialization && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          ({t.specialization})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}

                {members.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 border-t border-border">
                      System Users / Team
                    </div>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="text-xs">{m.full_name || "Team Member"}</span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            {selectedTechnician && (
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-background p-2 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{selectedTechnician.name}</span>
                  {selectedTechnician.specialization && (
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      {selectedTechnician.specialization}
                    </Badge>
                  )}
                </div>
                {selectedTechnician.phone && (
                  <span className="font-mono text-[11px]">{selectedTechnician.phone}</span>
                )}
              </div>
            )}
          </div>

          {/* 6. PM Checklist (visible when Scheduled PM is selected) */}
          {workType === "preventive" && (
            <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4" />
                  Standard PM Service Tasks ({selectedTasks.length}/{pmTasksList.length})
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTasks([...pmTasksList])}
                    className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTasks([])}
                    className="text-[10px] text-muted-foreground hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                {pmTasksList.map((task) => {
                  const isChecked = selectedTasks.includes(task);
                  return (
                    <div
                      key={task}
                      className={`group flex items-start justify-between gap-2 p-2 rounded-lg border text-xs transition-colors ${
                        isChecked 
                          ? "bg-background border-primary/40 text-foreground font-medium" 
                          : "bg-muted/30 border-transparent text-muted-foreground hover:bg-background"
                      }`}
                    >
                      <label className="flex items-start gap-2 flex-1 cursor-pointer">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleTask(task)}
                          className="mt-0.5"
                        />
                        <span className="leading-tight">{task}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemovePmTask(task)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 transition-opacity cursor-pointer"
                        title="Remove task"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom PM Task Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-primary/10">
                <Input
                  value={newCustomTask}
                  onChange={(e) => setNewCustomTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPmTask();
                    }
                  }}
                  placeholder="Add custom PM task (e.g. Inspect Kingpins, Drain Water Separator)..."
                  className="h-8 text-xs bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPmTask}
                  disabled={!newCustomTask.trim()}
                  className="h-8 text-xs shrink-0 cursor-pointer"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Task
                </Button>
              </div>
            </div>
          )}

          {/* Enterprise Stores & Smart Parts Requisition (Slide 15) */}
          {isEnterprise && selectedMachine && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <PackageCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">
                      Workshop Stores & Smart Parts Requisition (Slide 15)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Compatible parts for {selectedMachine.make || ""} {selectedMachine.model || "Vehicle"}. Stock decrements upon creation.
                    </p>
                  </div>
                </div>
                {selectedSpares.length > 0 && (
                  <Badge variant="outline" className="text-xs font-mono border-purple-500/30 text-purple-600 dark:text-purple-400">
                    {selectedSpares.length} {selectedSpares.length === 1 ? "part" : "parts"} · TZS {totalSparesCost.toLocaleString()}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Search compatible parts by name, OEM part #, or bin location..."
                  value={spareFilter}
                  onChange={(e) => setSpareFilter(e.target.value)}
                  className="h-8 text-xs"
                />

                {filteredCompatibleSpares.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">
                    No compatible spare parts catalogued for this vehicle model yet.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCompatibleSpares.map((sp) => {
                      const selectedItem = selectedSpares.find((s) => s.partId === sp.id);
                      const isSelected = Boolean(selectedItem);
                      const isLowStock = sp.stock_quantity <= sp.min_reorder_level;

                      return (
                        <div
                          key={sp.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                            isSelected
                              ? "border-purple-500/40 bg-purple-500/5"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSpare(sp.id)}
                              id={`part-${sp.id}`}
                            />
                            <div className="min-w-0">
                              <label
                                htmlFor={`part-${sp.id}`}
                                className="font-medium text-foreground cursor-pointer block truncate"
                              >
                                {sp.name}
                              </label>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-mono">{sp.part_number}</span>
                                <span>•</span>
                                <span className="font-mono text-primary">Bin: {sp.bin_location}</span>
                                <span>•</span>
                                <span className={isLowStock ? "text-amber-600 font-semibold" : ""}>
                                  Stock: {sp.stock_quantity}
                                </span>
                                <span>•</span>
                                <span>TZS {sp.unit_price_tzs.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {isSelected && selectedItem && (
                            <div className="flex items-center gap-1.5 shrink-0 pl-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleUpdateSpareQty(sp.id, -1)}
                              >
                                -
                              </Button>
                              <span className="font-mono font-semibold text-xs min-w-[20px] text-center">
                                {selectedItem.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleUpdateSpareQty(sp.id, 1)}
                              >
                                +
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. Driver Complaint / Defect Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Driver / Operator Reported Complaint or Defect
            </Label>
            <Textarea
              rows={3}
              value={defectReport}
              onChange={(e) => setDefectReport(e.target.value)}
              placeholder="e.g. Driver reported low air pressure warning on hills, clutch slipping in 4th gear, and minor coolant seepage near radiator bottom tank."
              className="text-xs"
            />
          </div>

          {/* 8. Due Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Completion / Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Internal Manager Instructions</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Inspect brake linings before ordering parts"
                className="h-10 text-xs"
              />
            </div>
          </div>

          {/* 9. Outsourced Work (Optional) */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <Checkbox
                checked={isOutsourced}
                onCheckedChange={(c) => setIsOutsourced(Boolean(c))}
              />
              <span>Outsource to external specialist workshop / vendor</span>
            </label>

            {isOutsourced && (
              <div className="grid gap-3 sm:grid-cols-3 pt-2">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label className="text-xs">Specialist Vendor / Workshop *</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger className="h-9 bg-background text-xs">
                      <SelectValue placeholder="Choose vendor (e.g. Diesel Injector Specialist)..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.category ? `(${v.category})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Promised Return</Label>
                  <Input
                    type="date"
                    value={promisedDate}
                    onChange={(e) => setPromisedDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Estimated Cost (TZS)</Label>
                  <Input
                    type="number"
                    value={vendorCost}
                    onChange={(e) => setVendorCost(e.target.value)}
                    placeholder="e.g. 450,000"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/work-orders")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-[150px] shadow-xs">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Work Order
            </Button>
          </div>
        </form>

        {/* Live Job Card Summary Preview (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-start justify-between border-b border-border pb-3 gap-2">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">
                  Live Job Card Summary
                </span>
                <h3 className="text-base font-bold text-foreground">
                  {formatWoNumber(new Date().getFullYear(), nextNumber)}
                </h3>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">
                  {organisation?.name || "Company"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {organisation?.logo_url ? (
                  <img
                    src={organisation.logo_url}
                    alt={organisation.name || "Company Logo"}
                    className="h-10 w-auto max-w-[130px] object-contain rounded"
                  />
                ) : (
                  <div className="h-8 px-2.5 rounded bg-muted/60 border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                    {organisation?.name || "Logo"}
                  </div>
                )}
                <Badge className={currentWorkTypeConfig.badgeColor}>
                  {currentWorkTypeConfig.label}
                </Badge>
              </div>
            </div>

            {/* Vehicle Preview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Vehicle Asset</span>
              {selectedMachine ? (
                <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-primary text-sm">
                      {selectedMachine.plate_number || selectedMachine.name}
                    </span>
                    <span className="text-xs font-mono font-semibold">
                      {odometerKm ? `${formatNumber(parseFloat(odometerKm))} km` : "No odo"}
                    </span>
                  </div>
                  <div className="text-xs text-foreground font-medium">
                    {[selectedMachine.make, selectedMachine.model].filter(Boolean).join(" ")}
                  </div>
                  {selectedMachine.category && (
                    <div className="text-[10px] text-muted-foreground">Category: {selectedMachine.category}</div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Select a vehicle on the left to preview details
                </div>
              )}
            </div>

            {/* Title & Priority */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Service Scope</span>
              <div className="font-semibold text-sm text-foreground">
                {title || <span className="italic text-muted-foreground font-normal">Service Title...</span>}
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground">Priority:</span>
                <span className="capitalize font-bold text-foreground">{priority}</span>
                <span className="text-muted-foreground">· Target:</span>
                <span className="font-medium text-foreground">{formatDate(dueDate)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20">
                  <Layers className="h-3 w-3" /> {componentSystem}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400 border border-purple-500/20">
                  <Building2 className="h-3 w-3" /> {REPAIR_LOCATIONS.find((l) => l.id === repairLocation)?.label || repairLocation}
                </span>
              </div>
            </div>

            {/* Technician */}
            <div className="space-y-1 border-t border-border pt-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Assigned Mechanic</span>
              <div className="flex items-center gap-2 text-xs">
                <UserCog className="h-4 w-4 text-primary" />
                {selectedTechnician ? (
                  <span className="font-medium text-foreground">
                    {selectedTechnician.name} ({selectedTechnician.specialization || "General Mechanic"})
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">Unassigned (will be assigned in workshop)</span>
                )}
              </div>
            </div>

            {/* Tasks Summary */}
            {workType === "preventive" && selectedTasks.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Service Checklist ({selectedTasks.length} tasks)
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-[11px] text-muted-foreground">
                  {selectedTasks.map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span className="truncate">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requisitioned Stores Spares Preview (Slide 15) */}
            {isEnterprise && selectedSpares.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Stores Spares ({selectedSpares.length})
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    TZS {totalSparesCost.toLocaleString()}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-[11px] text-muted-foreground">
                  {selectedSpares.map((item) => {
                    const sp = compatibleSpares.find((p) => p.id === item.partId);
                    if (!sp) return null;
                    return (
                      <div key={item.partId} className="flex items-center justify-between text-xs py-0.5">
                        <div className="truncate mr-2">
                          <span className="font-medium text-foreground">{sp.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({sp.bin_location})</span>
                        </div>
                        <span className="font-mono shrink-0">
                          {item.quantity} × {formatNumber(sp.unit_price_tzs)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {defectReport.trim() && (
              <div className="space-y-1 border-t border-border pt-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Reported Defect</span>
                <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/20 p-2 rounded-lg">
                  {defectReport}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Register Technician Dialog */}
      <TechnicianDialog
        open={techModalOpen}
        onOpenChange={setTechModalOpen}
        editing={null}
        orgId={profile?.organisation_id}
        userId={user?.id}
        onSaved={(created) => {
          loadResources();
          if (created?.id) {
            setSelectedTechnicianId(created.id);
          }
        }}
      />
    </div>
  );
}
