import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSmartSpares,
  issuePartToJobCard,
  type CommercialSparePart,
} from "@/services/smartPartsService";
import { formatMoney } from "@/lib/format";
import {
  Search,
  Package,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Wrench,
  Check,
  Building,
  RefreshCw,
  Truck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface SmartPartsFinderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleModel?: string;
  onSelectPart?: (part: CommercialSparePart) => void;
  jobCardNumber?: string;
  vehiclePlate?: string;
}

const COMMON_FLEET_MODELS = [
  { label: "All Vehicles & Equipment", value: "ALL" },
  { label: "Scania Heavy Trucks (R500 / R420 / G460)", value: "Scania" },
  { label: "Sinotruk Howo (371 / 380 / A7)", value: "Howo" },
  { label: "Mercedes-Benz Actros (3340 / 2640)", value: "Actros" },
  { label: "Heavy Commercial Trailers (BPW / Tri-Axle)", value: "Universal Trailer" },
  { label: "Stationary Cummins / Perkins Generators", value: "Generator" },
  { label: "Atlas Copco Industrial Compressors", value: "Compressor" },
  { label: "Toyota / TCM Warehouse Forklifts", value: "Forklift" },
  { label: "Heavy Industrial Water Pumps", value: "Pump" },
];

const SUBSYSTEM_CATEGORIES = [
  "ALL",
  "Engine System",
  "Fuel System",
  "Brake System",
  "Suspension System",
  "Steering System",
  "Transmission System",
  "Electrical System",
  "Air System",
  "Body Works",
  "General Spares",
];

export function SmartPartsFinderModal({
  open,
  onOpenChange,
  initialVehicleModel,
  onSelectPart,
  jobCardNumber,
  vehiclePlate,
}: SmartPartsFinderModalProps) {
  const { organisation, profile } = useAuth();
  const orgId = organisation?.id || profile?.organisation_id || "default_org";

  const [selectedModel, setSelectedModel] = useState<string>(initialVehicleModel || "ALL");
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [parts, setParts] = useState<CommercialSparePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Issuance state
  const [issuingPart, setIssuingPart] = useState<CommercialSparePart | null>(null);
  const [issueQty, setIssueQty] = useState(1);
  const [issueTargetPlate, setIssueTargetPlate] = useState(vehiclePlate || "");
  const [issueTargetJobCard, setIssueTargetJobCard] = useState(jobCardNumber || "");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  useEffect(() => {
    if (initialVehicleModel) {
      setSelectedModel(initialVehicleModel);
    }
  }, [initialVehicleModel]);

  const loadParts = async () => {
    setLoading(true);
    try {
      const modelFilter = selectedModel === "ALL" ? undefined : selectedModel;
      const data = await getSmartSpares(orgId, modelFilter);
      setParts(data);
    } catch (err) {
      console.error("Failed to load smart spare parts:", err);
      toast.error("Could not load spare parts catalogue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadParts();
    }
  }, [open, selectedModel, orgId]);

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      // Subsystem filter
      if (selectedSubsystem !== "ALL" && p.system_category !== selectedSubsystem) {
        return false;
      }
      // Text search
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesNum = p.part_number.toLowerCase().includes(q);
        const matchesAlt = p.alternative_part_number?.toLowerCase().includes(q);
        const matchesBin = p.bin_location.toLowerCase().includes(q);
        const matchesSup = p.supplier_name.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesAlt && !matchesBin && !matchesSup) {
          return false;
        }
      }
      return true;
    });
  }, [parts, selectedSubsystem, searchQuery]);

  const handleCopyPartNumber = (partNumber: string, id: string) => {
    navigator.clipboard.writeText(partNumber);
    setCopiedId(id);
    toast.success(`Copied OEM Part #: ${partNumber}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecuteIssuance = async () => {
    if (!issuingPart) return;
    if (issueQty <= 0) {
      toast.error("Enter a valid quantity greater than zero");
      return;
    }
    if (issueQty > issuingPart.stock_quantity) {
      toast.error(`Cannot issue ${issueQty}. Only ${issuingPart.stock_quantity} available in ${issuingPart.bin_location}`);
      return;
    }

    setIsSubmittingIssue(true);
    try {
      const res = await issuePartToJobCard(orgId, {
        organisation_id: orgId,
        part_id: issuingPart.id,
        part_number: issuingPart.part_number,
        part_name: issuingPart.name,
        job_card_number: issueTargetJobCard || "JC-DIRECT-ISSUE",
        vehicle_plate: issueTargetPlate || "DEPOT-FLEET",
        technician_name: profile?.full_name || "Stores In-Charge",
        quantity: issueQty,
        unit_price: issuingPart.unit_price_tzs,
        total_cost: issueQty * issuingPart.unit_price_tzs,
        issued_by: profile?.full_name || "Warehouse Stores",
      });

      if (!res.success) {
        toast.error(res.error || "Failed to issue part");
      } else {
        toast.success(`Issued ${issueQty}x ${issuingPart.name} to Job Card. New Stock: ${res.newStock}`);
        setIssuingPart(null);
        await loadParts();
      }
    } catch (e: any) {
      toast.error(e.message || "Error issuing part");
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Smart Parts Identification & Compatibility (Slide 14)
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Vehicle model-compatible spare parts matching, bin locations, interchange cross-references, and stores availability.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadParts}
              disabled={loading}
              className="gap-1.5 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 bg-muted/40 p-3 rounded-xl border border-border">
          {/* Target Model Select */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Target Vehicle / Equipment Model
            </label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select Model..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_FLEET_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subsystem Category Select */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> Subsystem Category (Slide 11)
            </label>
            <Select value={selectedSubsystem} onValueChange={setSelectedSubsystem}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select Subsystem..." />
              </SelectTrigger>
              <SelectContent>
                {SUBSYSTEM_CATEGORIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All Subsystems" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keyword Search */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Search Part # / Name / Bin
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="e.g. SCA-2195142, Filter, BIN-04..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background"
              />
            </div>
          </div>
        </div>

        {/* Parts Results Table */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/70 text-muted-foreground font-semibold uppercase tracking-wider text-left border-b border-border">
              <tr>
                <th className="p-3">OEM Part #</th>
                <th className="p-3">Part Description & Subsystem</th>
                <th className="p-3">Compatible Makes</th>
                <th className="p-3">Bin Location</th>
                <th className="p-3">Stock Level</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No spare parts found matching the selected vehicle model and filters.
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => {
                  const isOutOfStock = part.stock_quantity <= 0;
                  const isLowStock = !isOutOfStock && part.stock_quantity <= part.min_reorder_level;

                  return (
                    <tr
                      key={part.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Part Number & Interchange */}
                      <td className="p-3 align-top font-mono">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{part.part_number}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPartNumber(part.part_number, part.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                            title="Copy Part Number"
                          >
                            {copiedId === part.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        {part.alternative_part_number && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Alt: <span className="text-amber-600 font-semibold">{part.alternative_part_number}</span>
                          </div>
                        )}
                      </td>

                      {/* Name & Subsystem */}
                      <td className="p-3 align-top">
                        <div className="font-semibold text-foreground text-sm leading-tight">
                          {part.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-medium bg-muted/60">
                            {part.system_category}
                          </Badge>
                          {part.supplier_name && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Building className="h-2.5 w-2.5" />
                              {part.supplier_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Compatible Makes & Models */}
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {part.compatible_makes.map((mk) => (
                            <span
                              key={mk}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                            >
                              {mk}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[140px]">
                          {part.compatible_models.join(", ")}
                        </div>
                      </td>

                      {/* Bin Location */}
                      <td className="p-3 align-top font-mono font-medium">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                          <MapPin className="h-3 w-3 text-primary" />
                          {part.bin_location}
                        </span>
                      </td>

                      {/* Stock Level & Status */}
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">{part.stock_quantity}</span>
                          <span className="text-[10px] text-muted-foreground">in stock</span>
                        </div>
                        <div className="mt-1">
                          {isOutOfStock ? (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[10px]">
                              <XCircle className="h-2.5 w-2.5 mr-1" /> Stockout
                            </Badge>
                          ) : isLowStock ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Reorder ({part.min_reorder_level})
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Available
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="p-3 align-top text-right font-mono font-semibold text-foreground">
                        {formatMoney(part.unit_price_tzs, "TZS")}
                      </td>

                      {/* Action */}
                      <td className="p-3 align-top text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {onSelectPart ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs px-2.5 gap-1"
                              onClick={() => {
                                onSelectPart(part);
                                onOpenChange(false);
                              }}
                            >
                              <Check className="h-3 w-3" /> Select
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 gap-1 hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                setIssuingPart(part);
                                setIssueQty(1);
                              }}
                              disabled={isOutOfStock}
                            >
                              <Wrench className="h-3 w-3" /> Issue Part
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Issuance Drawer / Sub-dialog */}
        {issuingPart && (
          <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-primary" />
                  Issue Spare Part to Job Card: {issuingPart.name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  OEM Part #: {issuingPart.part_number} · Available: {issuingPart.stock_quantity} in {issuingPart.bin_location}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIssuingPart(null)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground">Quantity to Issue</label>
                <Input
                  type="number"
                  min={1}
                  max={issuingPart.stock_quantity}
                  value={issueQty}
                  onChange={(e) => setIssueQty(parseInt(e.target.value) || 1)}
                  className="h-8 mt-1 bg-background"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Job Card #</label>
                <Input
                  placeholder="e.g. JC-2026-081"
                  value={issueTargetJobCard}
                  onChange={(e) => setIssueTargetJobCard(e.target.value)}
                  className="h-8 mt-1 bg-background"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Vehicle Plate / Unit ID</label>
                <Input
                  placeholder="e.g. T 412 DSE / GEN-01"
                  value={issueTargetPlate}
                  onChange={(e) => setIssueTargetPlate(e.target.value)}
                  className="h-8 mt-1 bg-background"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleExecuteIssuance}
                  disabled={isSubmittingIssue}
                  className="w-full h-8 text-xs font-semibold"
                >
                  {isSubmittingIssue ? "Processing..." : `Confirm Issue (${formatMoney(issueQty * issuingPart.unit_price_tzs, "TZS")})`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
