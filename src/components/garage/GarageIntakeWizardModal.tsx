import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ClipboardCheck, 
  User, 
  Car, 
  Wrench, 
  FileCheck2, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { formatJobNumber } from "@/lib/garage-constants";

const FUEL_LABELS = ["Empty", "¼", "½", "¾", "Full"];

interface GarageIntakeWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated?: (job: any) => void;
}

export function GarageIntakeWizardModal({ open, onOpenChange, onJobCreated }: GarageIntakeWizardModalProps) {
  const { profile, user, organisation } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"customer" | "vehicle" | "service" | "inspection">("customer");

  // Reference data
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerVehicles, setCustomerVehicles] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);

  // Step 1: Customer info
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", address: "" });

  // Step 2: Vehicle info
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: "",
    registration_number: "",
    vin: "",
    color: "",
    mileage: "",
  });

  // Step 3: Service complaint
  const [serviceInfo, setServiceInfo] = useState({
    reported_problem: "",
    priority: "normal",
    mechanic_id: "",
    expected_completion: "",
    notes: "",
  });

  // Step 4: Condition & Inspection
  const [inspection, setInspection] = useState({
    fuel_level: 2, // 1/2 tank
    mileage: "",
    damage_front: false,
    damage_rear: false,
    damage_left: false,
    damage_right: false,
    damage_roof: false,
    damage_notes: "",
    radio_present: true,
    spare_tyre_present: true,
    jack_present: true,
    vehicle_documents_present: true,
    other_items: "",
    general_notes: "",
  });

  // Completion state
  const [createdJob, setCreatedJob] = useState<any>(null);

  useEffect(() => {
    if (open) {
      resetWizard();
      loadData();
    }
  }, [open]);

  const resetWizard = () => {
    setActiveTab("customer");
    setIsNewCustomer(false);
    setSelectedCustomerId("");
    setNewCustomer({ name: "", phone: "", email: "", address: "" });
    setIsNewVehicle(false);
    setSelectedVehicleId("");
    setNewVehicle({ make: "", model: "", year: "", registration_number: "", vin: "", color: "", mileage: "" });
    setServiceInfo({ reported_problem: "", priority: "normal", mechanic_id: "", expected_completion: "", notes: "" });
    setInspection({
      fuel_level: 2,
      mileage: "",
      damage_front: false,
      damage_rear: false,
      damage_left: false,
      damage_right: false,
      damage_roof: false,
      damage_notes: "",
      radio_present: true,
      spare_tyre_present: true,
      jack_present: true,
      vehicle_documents_present: true,
      other_items: "",
      general_notes: "",
    });
    setCreatedJob(null);
  };

  const loadData = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      (supabase as any).from("garage_customers").select("id, name, phone, email").order("name"),
      (supabase as any).from("garage_mechanics").select("id, name").eq("status", "active").order("name"),
    ]);
    setCustomers(c ?? []);
    setMechanics(m ?? []);
  };

  // Load vehicles when a customer is picked
  useEffect(() => {
    if (!selectedCustomerId || isNewCustomer) {
      setCustomerVehicles([]);
      setIsNewVehicle(true);
      return;
    }
    (supabase as any)
      .from("garage_vehicles")
      .select("id, make, model, year, registration_number, mileage, color")
      .eq("customer_id", selectedCustomerId)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const list = data ?? [];
        setCustomerVehicles(list);
        if (list.length > 0) {
          setSelectedVehicleId(list[0].id);
          setIsNewVehicle(false);
          setInspection((prev) => ({ ...prev, mileage: String(list[0].mileage || "") }));
        } else {
          setIsNewVehicle(true);
          setSelectedVehicleId("");
        }
      });
  }, [selectedCustomerId, isNewCustomer]);

  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    const v = customerVehicles.find((x) => x.id === vId);
    if (v) {
      setInspection((prev) => ({ ...prev, mileage: String(v.mileage || "") }));
    }
  };

  const toggleDamage = (key: string) => {
    setInspection((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleItem = (key: string) => {
    setInspection((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const validate = () => {
    if (isNewCustomer) {
      if (!newCustomer.name.trim()) {
        toast.error("Customer name is required");
        setActiveTab("customer");
        return false;
      }
      if (!newCustomer.phone.trim()) {
        toast.error("Customer phone number is required");
        setActiveTab("customer");
        return false;
      }
    } else if (!selectedCustomerId) {
      toast.error("Please select or create a customer");
      setActiveTab("customer");
      return false;
    }

    if (isNewVehicle) {
      if (!newVehicle.make.trim() || !newVehicle.model.trim()) {
        toast.error("Vehicle Make and Model are required");
        setActiveTab("vehicle");
        return false;
      }
      if (!newVehicle.registration_number.trim()) {
        toast.error("Registration plate number is required");
        setActiveTab("vehicle");
        return false;
      }
    } else if (!selectedVehicleId) {
      toast.error("Please select or add a vehicle");
      setActiveTab("vehicle");
      return false;
    }

    if (!serviceInfo.reported_problem.trim()) {
      toast.error("Please describe the reported problem or service required");
      setActiveTab("service");
      return false;
    }

    return true;
  };

  const submitIntake = async () => {
    if (!validate()) return;
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return toast.error("Organization context missing");

    setSaving(true);
    try {
      // 1. Resolve or Create Customer
      let finalCustomerId = selectedCustomerId;
      if (isNewCustomer) {
        const { data: cust, error: cErr } = await (supabase as any)
          .from("garage_customers")
          .insert({
            organisation_id: orgId,
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim(),
            email: newCustomer.email.trim() || null,
            address: newCustomer.address.trim() || null,
            created_by: user?.id,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        finalCustomerId = cust.id;
      }

      // 2. Resolve or Create Vehicle
      let finalVehicleId = selectedVehicleId;
      const currentMileage = Number(inspection.mileage || newVehicle.mileage) || null;

      if (isNewVehicle) {
        const { data: veh, error: vErr } = await (supabase as any)
          .from("garage_vehicles")
          .insert({
            organisation_id: orgId,
            customer_id: finalCustomerId,
            make: newVehicle.make.trim(),
            model: newVehicle.model.trim(),
            year: newVehicle.year ? Number(newVehicle.year) : null,
            registration_number: newVehicle.registration_number.trim().toUpperCase(),
            vin: newVehicle.vin.trim().toUpperCase() || null,
            color: newVehicle.color.trim() || null,
            mileage: currentMileage,
            created_by: user?.id,
          })
          .select()
          .single();
        if (vErr) throw vErr;
        finalVehicleId = veh.id;
      } else if (currentMileage) {
        // Update vehicle mileage if higher
        await (supabase as any)
          .from("garage_vehicles")
          .update({ mileage: currentMileage })
          .eq("id", finalVehicleId);
      }

      // 3. Create Job
      const { data: job, error: jErr } = await (supabase as any)
        .from("garage_jobs")
        .insert({
          organisation_id: orgId,
          customer_id: finalCustomerId,
          vehicle_id: finalVehicleId,
          mechanic_id: serviceInfo.mechanic_id || null,
          reported_problem: serviceInfo.reported_problem.trim(),
          mileage_at_intake: currentMileage,
          priority: serviceInfo.priority,
          status: "received",
          expected_completion: serviceInfo.expected_completion || null,
          notes: serviceInfo.notes.trim() || null,
          created_by: user?.id,
        })
        .select("*, garage_customers(name, phone), garage_vehicles(make, model, registration_number)")
        .single();
      if (jErr) throw jErr;

      // 4. Create Intake Inspection Checklist
      const { error: iErr } = await (supabase as any)
        .from("garage_intake_checklists")
        .insert({
          organisation_id: orgId,
          job_id: job.id,
          fuel_level: inspection.fuel_level,
          mileage: currentMileage,
          damage_front: inspection.damage_front,
          damage_rear: inspection.damage_rear,
          damage_left: inspection.damage_left,
          damage_right: inspection.damage_right,
          damage_roof: inspection.damage_roof,
          damage_notes: inspection.damage_notes.trim() || null,
          radio_present: inspection.radio_present,
          spare_tyre_present: inspection.spare_tyre_present,
          jack_present: inspection.jack_present,
          vehicle_documents_present: inspection.vehicle_documents_present,
          other_items: inspection.other_items.trim() || null,
          general_notes: inspection.general_notes.trim() || null,
          inspected_by: user?.id,
        });
      if (iErr) {
        console.warn("Intake checklist save error (optional table):", iErr);
      }

      toast.success(`Walk-in intake complete: ${formatJobNumber(job)}`);
      setCreatedJob(job);
      if (onJobCreated) onJobCreated(job);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete intake");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Fast Walk-In Vehicle Intake</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register customer, vehicle, symptoms, and condition inspection in one fast flow.
              </p>
            </div>
          </div>

          {/* Wizard step tabs */}
          {!createdJob && (
            <div className="grid grid-cols-4 gap-1 pt-4">
              {[
                { id: "customer", label: "1. Customer", icon: User },
                { id: "vehicle", label: "2. Vehicle", icon: Car },
                { id: "service", label: "3. Service", icon: Wrench },
                { id: "inspection", label: "4. Inspection", icon: FileCheck2 },
              ].map((step) => {
                const Icon = step.icon;
                const isCurrent = activeTab === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveTab(step.id as any)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-md transition-colors border ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{step.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="p-6">
          {createdJob ? (
            /* Success confirmation screen */
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Vehicle Checked In Successfully!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Job created: <span className="font-semibold text-foreground">{formatJobNumber(createdJob)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[createdJob.garage_vehicles?.make, createdJob.garage_vehicles?.model].filter(Boolean).join(" ")} ({createdJob.garage_vehicles?.registration_number}) — {createdJob.garage_customers?.name}
                </p>
              </div>

              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/garage/jobs/${createdJob.id}/intake-print`, "_blank");
                  }}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Intake Handover Slip
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/garage/jobs/${createdJob.id}`);
                  }}
                  className="gap-2"
                >
                  Open Job Details
                </Button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetWizard}
                  className="text-xs text-primary hover:underline"
                >
                  + Intake another vehicle
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Customer */}
              {activeTab === "customer" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Customer Information
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(!isNewCustomer)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {isNewCustomer ? "← Select Existing Customer" : "+ Register New Customer"}
                    </button>
                  </div>

                  {!isNewCustomer ? (
                    <div>
                      <Label className="text-xs">Select Customer *</Label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select customer…</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}
                          </option>
                        ))}
                      </select>
                      {selectedCustomerId && (
                        <div className="mt-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                          {(() => {
                            const c = customers.find((x) => x.id === selectedCustomerId);
                            return (
                              <div className="flex gap-4">
                                <span>Phone: {c?.phone || "—"}</span>
                                <span>Email: {c?.email || "—"}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Full Name / Company *</Label>
                        <Input
                          placeholder="e.g. David Mwangi"
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Phone Number *</Label>
                        <Input
                          placeholder="e.g. +254 712 345 678"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email Address (optional)</Label>
                        <Input
                          type="email"
                          placeholder="e.g. customer@example.com"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Physical Address / City (optional)</Label>
                        <Input
                          placeholder="e.g. Nairobi, Westlands"
                          value={newCustomer.address}
                          onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Vehicle */}
              {activeTab === "vehicle" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vehicle Details
                    </span>
                    {!isNewCustomer && customerVehicles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsNewVehicle(!isNewVehicle)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {isNewVehicle ? "← Choose Saved Vehicle" : "+ Add New Vehicle"}
                      </button>
                    )}
                  </div>

                  {!isNewVehicle && customerVehicles.length > 0 ? (
                    <div>
                      <Label className="text-xs">Customer's Vehicles *</Label>
                      <div className="mt-2 grid gap-2">
                        {customerVehicles.map((v) => {
                          const isSel = selectedVehicleId === v.id;
                          return (
                            <div
                              key={v.id}
                              onClick={() => handleVehicleSelect(v.id)}
                              className={`cursor-pointer rounded-lg border p-3 flex items-center justify-between transition-colors ${
                                isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-sm">
                                  {[v.make, v.model].filter(Boolean).join(" ")}
                                  {v.year ? ` (${v.year})` : ""}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Plate: <span className="font-medium text-foreground">{v.registration_number}</span>
                                  {v.color ? ` · Color: ${v.color}` : ""}
                                  {v.mileage ? ` · ${v.mileage.toLocaleString()} km` : ""}
                                </div>
                              </div>
                              <Car className={`h-5 w-5 ${isSel ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Registration Plate *</Label>
                        <Input
                          placeholder="e.g. KDA 123X"
                          value={newVehicle.registration_number}
                          onChange={(e) =>
                            setNewVehicle({ ...newVehicle, registration_number: e.target.value.toUpperCase() })
                          }
                          className="mt-1 h-9 font-semibold uppercase"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Current Mileage (km)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 84500"
                          value={inspection.mileage || newVehicle.mileage}
                          onChange={(e) => {
                            setNewVehicle({ ...newVehicle, mileage: e.target.value });
                            setInspection({ ...inspection, mileage: e.target.value });
                          }}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Make *</Label>
                        <Input
                          placeholder="e.g. Toyota, Mercedes, Isuzu"
                          value={newVehicle.make}
                          onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Model *</Label>
                        <Input
                          placeholder="e.g. Land Cruiser, C200, FRR"
                          value={newVehicle.model}
                          onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Year</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 2021"
                          value={newVehicle.year}
                          onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Color / Body Type</Label>
                        <Input
                          placeholder="e.g. Silver / Station Wagon"
                          value={newVehicle.color}
                          onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">VIN / Chassis Number (optional)</Label>
                        <Input
                          placeholder="e.g. JT111JA..."
                          value={newVehicle.vin}
                          onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value.toUpperCase() })}
                          className="mt-1 h-9 uppercase"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Service Request */}
              {activeTab === "service" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Service & Problem Report
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs">Customer Reported Complaint / Service Required *</Label>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Vehicle vibrates heavily at 80 km/h, check brake pads and wheel alignment. Routine 60k service."
                      value={serviceInfo.reported_problem}
                      onChange={(e) => setServiceInfo({ ...serviceInfo, reported_problem: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Priority</Label>
                      <select
                        value={serviceInfo.priority}
                        onChange={(e) => setServiceInfo({ ...serviceInfo, priority: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Assign Mechanic</Label>
                      <select
                        value={serviceInfo.mechanic_id}
                        onChange={(e) => setServiceInfo({ ...serviceInfo, mechanic_id: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {mechanics.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Promised Completion</Label>
                      <Input
                        type="datetime-local"
                        value={serviceInfo.expected_completion}
                        onChange={(e) => setServiceInfo({ ...serviceInfo, expected_completion: e.target.value })}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Internal Workshop Notes (optional)</Label>
                    <Input
                      placeholder="e.g. Customer requested quote before opening gearbox"
                      value={serviceInfo.notes}
                      onChange={(e) => setServiceInfo({ ...serviceInfo, notes: e.target.value })}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Condition Inspection */}
              {activeTab === "inspection" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Intake Condition & Handover Checklist
                    </span>
                  </div>

                  {/* Fuel level selector */}
                  <div>
                    <Label className="text-xs">Fuel Level at Drop-off</Label>
                    <div className="mt-1.5 flex gap-1">
                      {FUEL_LABELS.map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setInspection({ ...inspection, fuel_level: idx })}
                          className={`flex-1 rounded-md border py-2 text-xs font-medium transition-colors ${
                            inspection.fuel_level === idx
                              ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exterior damage checkboxes */}
                  <div>
                    <Label className="text-xs">Pre-existing Exterior Damages</Label>
                    <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: "damage_front", label: "Front / Bumper" },
                        { key: "damage_rear", label: "Rear / Tailgate" },
                        { key: "damage_left", label: "Left / Driver Side" },
                        { key: "damage_right", label: "Right / Passenger" },
                        { key: "damage_roof", label: "Roof / Windshield" },
                      ].map((item) => {
                        const checked = (inspection as any)[item.key];
                        return (
                          <label
                            key={item.key}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                              checked
                                ? "border-amber-400 bg-amber-50 text-amber-900 font-medium"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDamage(item.key)}
                              className="h-3.5 w-3.5"
                            />
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                    {(inspection.damage_front ||
                      inspection.damage_rear ||
                      inspection.damage_left ||
                      inspection.damage_right ||
                      inspection.damage_roof) && (
                      <Input
                        placeholder="Describe damage details (e.g. Scratched front bumper, dent on left rear door)…"
                        value={inspection.damage_notes}
                        onChange={(e) => setInspection({ ...inspection, damage_notes: e.target.value })}
                        className="mt-2 h-9 text-xs"
                      />
                    )}
                  </div>

                  {/* Belongings in vehicle */}
                  <div>
                    <Label className="text-xs">Valuables & Equipment Present in Vehicle</Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {[
                        { key: "radio_present", label: "Radio / Head Unit" },
                        { key: "spare_tyre_present", label: "Spare Tyre Present" },
                        { key: "jack_present", label: "Jack & Wheel Spanner" },
                        { key: "vehicle_documents_present", label: "Vehicle Logbook / Docs" },
                      ].map((item) => {
                        const checked = (inspection as any)[item.key];
                        return (
                          <label
                            key={item.key}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                              checked
                                ? "border-emerald-400 bg-emerald-50 text-emerald-900 font-medium"
                                : "border-destructive/30 bg-destructive/5 text-destructive"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(item.key)}
                              className="h-3.5 w-3.5"
                            />
                            {item.label} {checked ? "✓" : "✗"}
                          </label>
                        );
                      })}
                    </div>
                    <Input
                      placeholder="Other personal items left in vehicle (e.g. dashcam, child seat, tools)…"
                      value={inspection.other_items}
                      onChange={(e) => setInspection({ ...inspection, other_items: e.target.value })}
                      className="mt-2 h-9 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!createdJob && (
          <DialogFooter className="p-6 pt-4 border-t border-border bg-card flex items-center justify-between sm:justify-between">
            <div className="flex gap-2">
              {activeTab !== "customer" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeTab === "vehicle") setActiveTab("customer");
                    else if (activeTab === "service") setActiveTab("vehicle");
                    else if (activeTab === "inspection") setActiveTab("service");
                  }}
                >
                  ← Previous
                </Button>
              )}
              {activeTab !== "inspection" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (activeTab === "customer") setActiveTab("vehicle");
                    else if (activeTab === "vehicle") setActiveTab("service");
                    else if (activeTab === "service") setActiveTab("inspection");
                  }}
                >
                  Next →
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitIntake}
                disabled={saving}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering…
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4" />
                    Complete Walk-in Intake
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
