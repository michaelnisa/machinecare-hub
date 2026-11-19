import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Radio,
  FileText,
  Upload,
  Camera,
  Video,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  MapPin,
  Gauge,
  Phone,
  User,
  Layers,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createDriverComplaint,
  SUBSYSTEM_CATEGORIES,
  type DriverComplaintType,
  type SubsystemCategory,
  type ComplaintAttachment,
  type DriverComplaintRecord,
} from "@/services/complaintsService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId: string;
  defaultVehicleId?: string;
  defaultVehiclePlate?: string;
  defaultVehicleName?: string;
  defaultReporterName?: string;
  defaultReporterPhone?: string;
  isDriverSession?: boolean;
  vehicles?: { id: string; name: string; plate_number?: string | null; current_odometer_km?: number | null; current_hours?: number | null }[];
  onComplaintSubmitted?: (complaint: DriverComplaintRecord) => void;
}

const COMMON_SYMPTOMS = [
  "Abnormal Engine Noise / Knocking",
  "Heavy Black / Blue Exhaust Smoke",
  "High Temperature Warning Light",
  "Air Pressure Leak / Alarm",
  "Excessive Vibration / Shaking",
  "Spongy / Failing Service Brakes",
  "Steering Play / Pulling to Side",
  "Oil / Coolant / Fuel Leak",
  "Clutch Slipping / Hard Gear Shift",
  "Electrical Malfunction / Charging Alarm",
];

export function DriverComplaintModal({
  open,
  onOpenChange,
  organisationId,
  defaultVehicleId,
  defaultVehiclePlate,
  defaultVehicleName,
  defaultReporterName,
  defaultReporterPhone,
  isDriverSession = false,
  vehicles = [],
  onComplaintSubmitted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [complaintType, setComplaintType] = useState<DriverComplaintType>("reported_defect");
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId || "");
  const [subsystem, setSubsystem] = useState<SubsystemCategory>("Brake System");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [gpsLocation, setGpsLocation] = useState("");
  const [odometer, setOdometer] = useState("");
  const [reporterName, setReporterName] = useState(defaultReporterName || "");
  const [reporterPhone, setReporterPhone] = useState(defaultReporterPhone || "");
  const [severity, setSeverity] = useState<"minor" | "major" | "critical_breakdown">("major");

  // Attachments State (Slide 10: Photos, reports, videos, supporting documents)
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentType, setNewAttachmentType] = useState<"photo" | "video" | "report_pdf" | "document">("photo");
  const [addAttachOpen, setAddAttachOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultVehicleId) setSelectedVehicleId(defaultVehicleId);
      if (defaultReporterName) setReporterName(defaultReporterName);
      if (defaultReporterPhone) setReporterPhone(defaultReporterPhone);
    }
  }, [open, defaultVehicleId, defaultReporterName, defaultReporterPhone]);

  // When selected vehicle changes, prefill current odo
  useEffect(() => {
    if (selectedVehicleId && vehicles.length > 0) {
      const v = vehicles.find((m) => m.id === selectedVehicleId);
      if (v) {
        if (v.current_odometer_km != null) setOdometer(String(v.current_odometer_km));
        else if (v.current_hours != null) setOdometer(String(v.current_hours));
      }
    }
  }, [selectedVehicleId, vehicles]);

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim()) {
      toast.error("Enter attachment name or caption");
      return;
    }
    const url = newAttachmentUrl.trim() || "/placeholder.svg";
    setAttachments((prev) => [
      ...prev,
      {
        name: newAttachmentName.trim(),
        url,
        file_type: newAttachmentType,
      },
    ]);
    setNewAttachmentName("");
    setNewAttachmentUrl("");
    setAddAttachOpen(false);
    toast.success("Attachment added");
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      toast.error("Please select an assigned vehicle or asset");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a short defect summary");
      return;
    }
    if (!description.trim()) {
      toast.error("Please describe what happened or abnormal symptoms observed");
      return;
    }
    if (!reporterName.trim()) {
      toast.error("Please provide reporter name");
      return;
    }

    const matchedVeh = vehicles.find((v) => v.id === selectedVehicleId);
    const vehiclePlate = matchedVeh?.plate_number || defaultVehiclePlate || matchedVeh?.name || "Asset";
    const vehicleName = matchedVeh?.name || defaultVehicleName || "Commercial Vehicle";

    setSubmitting(true);
    try {
      const record = await createDriverComplaint({
        organisation_id: organisationId,
        machine_id: selectedVehicleId,
        vehicle_plate: vehiclePlate,
        vehicle_name: vehicleName,
        complaint_type: complaintType,
        subsystem,
        title: title.trim(),
        description: description.trim(),
        abnormal_symptoms: selectedSymptoms,
        gps_location: gpsLocation.trim() || undefined,
        odometer_km: odometer.trim() ? parseFloat(odometer) : undefined,
        reporter_type: isDriverSession ? "driver" : "workshop_inspector",
        reporter_name: reporterName.trim(),
        reporter_phone: reporterPhone.trim() || "+255",
        severity,
        status: "open",
        attachments,
      });

      toast.success(
        complaintType === "breakdown_report"
          ? "🚨 Emergency breakdown alert transmitted to workshop and fleet dispatch!"
          : "Driver defect report captured and routed to workshop inspection queue."
      );

      onOpenChange(false);
      // Reset
      setTitle("");
      setDescription("");
      setSelectedSymptoms([]);
      setGpsLocation("");
      setAttachments([]);

      if (onComplaintSubmitted) onComplaintSubmitted(record);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit defect report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${
              complaintType === "breakdown_report"
                ? "bg-rose-500/15 text-rose-600"
                : complaintType === "abnormal_condition"
                ? "bg-amber-500/15 text-amber-600"
                : "bg-blue-500/15 text-blue-600"
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Driver Defect & Breakdown Report (Slide 10)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Capture defects, abnormal vehicle conditions, and corridor breakdowns with attachments
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 1. Complaint Nature Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Incident Nature *</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setComplaintType("reported_defect");
                  if (severity === "critical_breakdown") setSeverity("major");
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  complaintType === "reported_defect"
                    ? "border-blue-500 bg-blue-500/10 text-foreground shadow-sm ring-1 ring-blue-500"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>Reported Defect</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Worn part, minor damage, scheduled fix
                </div>
              </button>

              <button
                type="button"
                onClick={() => setComplaintType("abnormal_condition")}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  complaintType === "abnormal_condition"
                    ? "border-amber-500 bg-amber-500/10 text-foreground shadow-sm ring-1 ring-amber-500"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>Abnormal Condition</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Strange noise, smoke, heat, vibration
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setComplaintType("breakdown_report");
                  setSeverity("critical_breakdown");
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  complaintType === "breakdown_report"
                    ? "border-rose-500 bg-rose-500/10 text-foreground shadow-sm ring-1 ring-rose-500 animate-pulse"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-rose-600" />
                  <span>Breakdown Report</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Vehicle grounded / immobilized
                </div>
              </button>
            </div>
          </div>

          {/* 2. Target Vehicle & Component Subsystem (Slide 11) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Vehicle / Asset *</Label>
              {vehicles.length > 0 ? (
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select vehicle / asset…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number ? `${v.plate_number} · ${v.name}` : v.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={defaultVehiclePlate || "Active Vehicle"}
                  disabled
                  className="h-9 text-xs font-mono font-bold"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>11 Subsystem Classification (Slide 11) *</span>
              </Label>
              <select
                value={subsystem}
                onChange={(e) => setSubsystem(e.target.value as SubsystemCategory)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              >
                {SUBSYSTEM_CATEGORIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Title & Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Incident Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Air Brake Valve Hissing & Rapid Pressure Drop"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* 4. Common Abnormal Symptoms (Quick Tags) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Abnormal Symptoms Observed (Click to Tag):
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SYMPTOMS.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Detailed Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Detailed Description & Context *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what occurred, any warning alarms that fired, changes in steering/braking feel, or roadside assistance needed…"
              className="text-xs"
              required
            />
          </div>

          {/* 6. Corridor Location & Odometer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>Corridor GPS / Location</span>
              </Label>
              <Input
                value={gpsLocation}
                onChange={(e) => setGpsLocation(e.target.value)}
                placeholder="e.g. Mikumi Bypass Km 42 or Dar Workshop Bay 3"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-primary" />
                <span>Odometer (km) / Hours</span>
              </Label>
              <Input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 184500"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* 7. Reporter Details & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>Reporter Name *</span>
              </Label>
              <Input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Driver or Technician Name"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>Reporter Phone</span>
              </Label>
              <Input
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="+255 7XX XXX XXX"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Severity</Label>
              <select
                value={severity}
                onChange={(e: any) => setSeverity(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="minor">Minor (Safe to Drive to Depot)</option>
                <option value="major">Major (Attention Required)</option>
                <option value="critical_breakdown">CRITICAL (Grounded / Roadside Rescue)</option>
              </select>
            </div>
          </div>

          {/* 8. Attachments (Slide 10: Photos, reports, videos, docs) */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span>Attachments & Evidence ({attachments.length})</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddAttachOpen(true)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Attachment
              </Button>
            </div>

            {attachments.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                No attachments added. Add photos of broken components, video of engine noise, or inspection reports.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {att.file_type === "photo" ? (
                        <Camera className="h-4 w-4 text-blue-600 shrink-0" />
                      ) : att.file_type === "video" ? (
                        <Video className="h-4 w-4 text-purple-600 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate font-medium">{att.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline Attachment Modal */}
          {addAttachOpen && (
            <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
              <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span>Attach Evidence Media</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={newAttachmentName}
                  onChange={(e) => setNewAttachmentName(e.target.value)}
                  placeholder="Caption (e.g. Broken Spring Leaf)"
                  className="h-8 text-xs sm:col-span-1"
                />
                <Input
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  placeholder="File URL or path (optional)"
                  className="h-8 text-xs sm:col-span-1"
                />
                <select
                  value={newAttachmentType}
                  onChange={(e: any) => setNewAttachmentType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="photo">Photo / Picture</option>
                  <option value="video">Audio / Video Clip</option>
                  <option value="report_pdf">Inspection Report (PDF)</option>
                  <option value="document">Supporting Document</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddAttachOpen(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddAttachment}
                  className="h-7 text-xs"
                >
                  Confirm Attachment
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={`gap-1.5 text-white ${
                complaintType === "breakdown_report"
                  ? "bg-rose-600 hover:bg-rose-700 font-bold"
                  : "bg-primary hover:bg-primary/90"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transmitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {complaintType === "breakdown_report"
                    ? "Transmit Emergency Breakdown"
                    : "Submit Defect Report"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
