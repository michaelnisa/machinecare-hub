import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  History,
  Undo2,
  X,
} from "lucide-react";
import {
  parseSpreadsheetFile,
  createXlsxTemplate,
  createCsvTemplate,
} from "@/lib/spreadsheetParser";

export type EntityType = "machine" | "vehicle" | "inventory";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  defaultValue?: string;
}

export interface RecentImportBatch {
  id: string;
  entity: EntityType;
  timestamp: string;
  fileName: string;
  recordCount: number;
  recordIds: string[];
}

const ENTITY_CONFIGS: Record<
  EntityType,
  {
    title: string;
    description: string;
    sampleFilename: string;
    fields: FieldDef[];
    sampleData: Record<string, string>[];
    targetTable: string;
  }
> = {
  machine: {
    title: "Import Machines & Plant Equipment",
    description: "Upload an Excel (.xlsx, .xls) or CSV file containing factory machines, generators, and industrial units.",
    sampleFilename: "machinecare_machines_template",
    fields: [
      { key: "name", label: "Asset Name", required: true, aliases: ["asset name", "equipment name", "machine", "name", "title"] },
      { key: "category", label: "Category", required: false, aliases: ["category", "type", "equipment type", "class"] },
      { key: "make", label: "Manufacturer / Make", required: false, aliases: ["make", "manufacturer", "brand"] },
      { key: "model", label: "Model", required: false, aliases: ["model", "model no", "model number"] },
      { key: "serial_number", label: "Serial Number", required: false, aliases: ["serial number", "serial no", "serial #", "s/n", "sn"] },
      { key: "current_hours", label: "Current Hours", required: false, aliases: ["hours", "current hours", "operating hours", "meter"] },
      { key: "department", label: "Department / Site", required: false, aliases: ["department", "dept", "location", "site", "section"] },
    ],
    sampleData: [
      { name: "CNC Milling Machine #1", category: "Machining", make: "Haas", model: "VF-2", serial_number: "SN-HAAS-8812", current_hours: "1250", department: "Machine Shop" },
      { name: "Industrial Air Compressor 50HP", category: "Facilities", make: "Atlas Copco", model: "GA37", serial_number: "SN-AC-9941", current_hours: "3400", department: "Utility Bay" },
      { name: "Hydraulic Stamping Press 200T", category: "Fabrication", make: "Schuler", model: "P-200", serial_number: "SN-SCH-4011", current_hours: "890", department: "Press Line" },
    ],
    targetTable: "machines",
  },
  vehicle: {
    title: "Import Fleet Vehicles",
    description: "Upload an Excel (.xlsx, .xls) or CSV file containing transport trucks, vans, pickups, and heavy trailers.",
    sampleFilename: "machinecare_fleet_vehicles_template",
    fields: [
      { key: "name", label: "Vehicle Name", required: true, aliases: ["vehicle name", "vehicle", "name", "truck", "fleet unit"] },
      { key: "plate_number", label: "Plate Number", required: true, aliases: ["plate number", "plate", "registration", "reg no", "licence"] },
      { key: "make", label: "Make / Brand", required: false, aliases: ["make", "brand", "manufacturer"] },
      { key: "model", label: "Model", required: false, aliases: ["model", "variant"] },
      { key: "year", label: "Model Year", required: false, aliases: ["year", "model year", "yr"] },
      { key: "current_odometer_km", label: "Odometer (km)", required: false, aliases: ["odometer", "km", "mileage", "current odo", "odo"] },
      { key: "fuel_type", label: "Fuel Type", required: false, aliases: ["fuel type", "fuel", "engine type"] },
      { key: "vin", label: "VIN / Chassis No", required: false, aliases: ["vin", "chassis", "chassis no", "serial number"] },
    ],
    sampleData: [
      { name: "Toyota Hilux 2.8D 4x4", plate_number: "T 123 ABC", make: "Toyota", model: "Hilux Double Cab", year: "2022", current_odometer_km: "45200", fuel_type: "Diesel", vin: "AHT112349912" },
      { name: "Scania R500 Heavy Hauler", plate_number: "T 789 XYZ", make: "Scania", model: "R500 6x4", year: "2021", current_odometer_km: "185000", fuel_type: "Diesel", vin: "YS2R6X400012" },
      { name: "Isuzu NPR 4.5T Delivery Truck", plate_number: "T 456 DEF", make: "Isuzu", model: "NPR 75", year: "2023", current_odometer_km: "28400", fuel_type: "Diesel", vin: "JAANPR750918" },
    ],
    targetTable: "machines",
  },
  inventory: {
    title: "Import Spare Parts & Inventory",
    description: "Upload an Excel (.xlsx, .xls) or CSV file containing spare parts, stock levels, unit costs, and SKU numbers. Status will automatically be marked as Received.",
    sampleFilename: "machinecare_inventory_parts_template",
    fields: [
      { key: "name", label: "Part Description", required: true, aliases: ["part name", "description", "item name", "name", "part description"] },
      { key: "part_number", label: "Part Number / SKU", required: true, aliases: ["part number", "part no", "part #", "sku", "item code", "code"] },
      { key: "category", label: "Category", required: false, aliases: ["category", "part category", "group", "type"] },
      { key: "unit", label: "Unit of Measure", required: false, aliases: ["unit", "uom", "unit of measure"] },
      { key: "unit_cost", label: "Unit Cost", required: false, aliases: ["cost", "unit cost", "price", "unit price", "rate"] },
      { key: "quantity", label: "Initial Quantity", required: false, aliases: ["qty", "quantity", "stock", "stock quantity", "balance", "count"] },
      { key: "reorder_level", label: "Reorder Minimum", required: false, aliases: ["reorder", "reorder level", "min stock", "min quantity", "minimum"] },
      { key: "order_status", label: "Order Status", required: false, defaultValue: "received", aliases: ["order status", "order_status", "status", "delivery status", "receiving status"] },
    ],
    sampleData: [
      { name: "High Pressure Hydraulic Seal Kit", part_number: "HYD-SEAL-01", category: "Hydraulics", unit: "PCS", unit_cost: "45000", quantity: "25", reorder_level: "5", order_status: "received" },
      { name: "ISO 68 Hydraulic Oil 20L Drum", part_number: "OIL-ISO-68", category: "Lubricants", unit: "DRUM", unit_cost: "180000", quantity: "12", reorder_level: "3", order_status: "received" },
      { name: "Heavy Duty Air Filter Element", part_number: "FLT-AIR-99", category: "Filters", unit: "PCS", unit_cost: "28000", quantity: "15", reorder_level: "4", order_status: "received" },
    ],
    targetTable: "inventory_items",
  },
};

interface Props {
  entity: EntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function BulkImporterModal({ entity, open, onOpenChange, onImported }: Props) {
  const { profile } = useAuth();
  const config = ENTITY_CONFIGS[entity];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "done">("upload");
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ total: number; success: number; failed: number }>({ total: 0, success: 0, failed: 0 });
  const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);
  const [recentBatch, setRecentBatch] = useState<RecentImportBatch | null>(null);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Load recent upload batch from localStorage whenever modal opens or entity changes
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem(`machinecare_last_import_${entity}`);
        if (stored) {
          const parsed = JSON.parse(stored) as RecentImportBatch;
          if (parsed && Array.isArray(parsed.recordIds) && parsed.recordIds.length > 0) {
            setRecentBatch(parsed);
          } else {
            setRecentBatch(null);
          }
        } else {
          setRecentBatch(null);
        }
      } catch (e) {
        console.error("Failed to load recent import batch:", e);
      }
    }
  }, [open, entity]);

  const resetState = () => {
    setStep("upload");
    setParsing(false);
    setIsDragging(false);
    setUploadedFileName("");
    setRawHeaders([]);
    setParsedRows([]);
    setColumnMapping({});
    setImportProgress(0);
    setImportResults({ total: 0, success: 0, failed: 0 });
    setLastImportedIds([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  // 1. Download Sample Templates
  const downloadExcelTemplate = () => {
    try {
      const headers = config.fields.map((f) => f.label);
      const fieldKeys = config.fields.map((f) => f.key);
      const xlsxBuffer = createXlsxTemplate(headers, config.sampleData, fieldKeys);
      const blob = new Blob([xlsxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${config.sampleFilename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Excel (.xlsx) sample template downloaded");
    } catch (err: any) {
      toast.error("Failed to generate Excel template: " + err.message);
    }
  };

  const downloadCsvTemplate = () => {
    try {
      const headers = config.fields.map((f) => f.label);
      const fieldKeys = config.fields.map((f) => f.key);
      const csvContent = createCsvTemplate(headers, config.sampleData, fieldKeys);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${config.sampleFilename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV sample template downloaded");
    } catch (err: any) {
      toast.error("Failed to generate CSV template: " + err.message);
    }
  };

  // 2. Parse Uploaded File (Excel XLSX, XLS, CSV, TSV)
  const processFile = async (file: File) => {
    try {
      setParsing(true);
      setUploadedFileName(file.name);
      const { headers, rows } = await parseSpreadsheetFile(file);
      if (rows.length === 0) {
        toast.error("No valid data rows found in spreadsheet");
        return;
      }

      setRawHeaders(headers);
      setParsedRows(rows);

      // Auto-map headers to known target fields
      const initialMapping: Record<string, string> = {};
      config.fields.forEach((field) => {
        const match = headers.find((h) => {
          const lowerH = h.toLowerCase().trim();
          return (
            lowerH === field.key.toLowerCase() ||
            lowerH === field.label.toLowerCase() ||
            field.aliases.some((alias) => lowerH === alias || lowerH.includes(alias))
          );
        });
        if (match) {
          initialMapping[field.key] = match;
        }
      });

      setColumnMapping(initialMapping);
      setStep("mapping");
      toast.success(`Loaded ${rows.length} rows from ${file.name}`);
    } catch (err: any) {
      console.error("Spreadsheet parsing error:", err);
      toast.error(err.message || "Failed to parse spreadsheet file");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 3. Validation
  const requiredFields = config.fields.filter((f) => f.required);
  const isMappingValid = requiredFields.every((f) => !!columnMapping[f.key]);

  const validatedRows = parsedRows.map((row) => {
    const transformed: Record<string, any> = {};
    let hasError = false;
    const errors: string[] = [];

    config.fields.forEach((f) => {
      const sourceCol = columnMapping[f.key];
      let val = sourceCol ? (row[sourceCol] ?? "").trim() : "";
      if (!val && f.defaultValue) {
        val = f.defaultValue;
      }
      if (f.required && !val) {
        hasError = true;
        errors.push(`${f.label} is required`);
      }
      transformed[f.key] = val;
    });

    return { row: transformed, hasError, errors };
  });

  const validRowCount = validatedRows.filter((r) => !r.hasError).length;

  // 4. Batch Insertion into Supabase
  const executeImport = async () => {
    if (!profile?.organisation_id) {
      toast.error("User organization not identified");
      return;
    }

    setStep("importing");
    setImportProgress(0);

    const rowsToInsert = validatedRows
      .filter((r) => !r.hasError)
      .map(({ row: item }) => {
        const payload: Record<string, any> = {
          organisation_id: profile.organisation_id,
        };

        if (entity === "machine") {
          payload.name = item.name;
          payload.category = item.category || "General";
          payload.make = item.make || null;
          payload.model = item.model || null;
          payload.serial_number = item.serial_number || null;
          payload.current_hours = item.current_hours ? Number(item.current_hours) : 0;
          payload.department = item.department || null;
          payload.status = "active";
        } else if (entity === "vehicle") {
          payload.name = item.name;
          payload.category = "Vehicle";
          payload.plate_number = item.plate_number;
          payload.make = item.make || null;
          payload.model = item.model || null;
          payload.year = item.year ? Number(item.year) : null;
          payload.current_odometer_km = item.current_odometer_km ? Number(item.current_odometer_km) : null;
          payload.current_hours = item.current_odometer_km ? Number(item.current_odometer_km) : null;
          payload.fuel_type = item.fuel_type || "Diesel";
          payload.vin = item.vin || null;
          payload.status = "active";
        } else if (entity === "inventory") {
          payload.name = item.name;
          payload.part_number = item.part_number || null;
          payload.category = item.category || "General";
          payload.unit = item.unit || "PCS";
          payload.unit_cost = item.unit_cost ? Number(item.unit_cost) : 0;
          payload.quantity = item.quantity ? Number(item.quantity) : 0;
          payload.reorder_level = item.reorder_level ? Number(item.reorder_level) : 5;
          // Order status is explicitly set to "received" for imported inventory stock
          const rawStatus = item.order_status?.toString().trim().toLowerCase();
          payload.order_status = rawStatus || "received";
          payload.status = "active";
        }

        return payload;
      });

    const chunkSize = 25;
    let totalSuccess = 0;
    let totalFailed = 0;
    const insertedIds: string[] = [];

    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from(config.targetTable as any)
        .insert(chunk as any)
        .select("id");

      if (error) {
        console.error("Batch insert error:", error);
        totalFailed += chunk.length;
      } else {
        totalSuccess += chunk.length;
        if (data && Array.isArray(data)) {
          const ids = data.map((d: any) => d.id).filter(Boolean);
          insertedIds.push(...ids);
        }
      }

      const progressPct = Math.round(((i + chunk.length) / rowsToInsert.length) * 100);
      setImportProgress(progressPct);
    }

    setLastImportedIds(insertedIds);
    setImportResults({
      total: rowsToInsert.length,
      success: totalSuccess,
      failed: totalFailed,
    });

    // Save batch metadata to localStorage for easy 1-click rollback
    if (insertedIds.length > 0) {
      const batchData: RecentImportBatch = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        entity,
        timestamp: new Date().toISOString(),
        fileName: uploadedFileName || "spreadsheet",
        recordCount: insertedIds.length,
        recordIds: insertedIds,
      };
      localStorage.setItem(`machinecare_last_import_${entity}`, JSON.stringify(batchData));
      setRecentBatch(batchData);
    }

    setStep("done");
    if (totalSuccess > 0) {
      toast.success(`Successfully imported ${totalSuccess} records!`);
      onImported?.();
    } else {
      toast.error("Failed to import records");
    }
  };

  // 5. Rollback / Cancel entire upload batch in 1 click
  const rollbackBatch = async (recordIds: string[]) => {
    if (!recordIds || recordIds.length === 0) return;
    setRollingBack(true);
    try {
      const chunkSize = 50;
      for (let i = 0; i < recordIds.length; i += chunkSize) {
        const chunk = recordIds.slice(i, i + chunkSize);
        const { error } = await supabase
          .from(config.targetTable as any)
          .delete()
          .in("id", chunk);
        if (error) throw error;
      }

      localStorage.removeItem(`machinecare_last_import_${entity}`);
      setRecentBatch(null);
      setLastImportedIds([]);
      toast.success(`Rollback complete! Successfully deleted all ${recordIds.length} uploaded records.`);
      onImported?.();
      resetState();
    } catch (err: any) {
      console.error("Rollback error:", err);
      toast.error("Failed to rollback records: " + err.message);
    } finally {
      setRollingBack(false);
      setRollbackConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Universal Excel / CSV Importer</span>
            </div>
            <DialogTitle className="text-xl font-bold">{config.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* STEP 1: FILE UPLOAD */}
            {step === "upload" && (
              <div className="space-y-4">
                {/* RECENT UPLOAD ROLLBACK BANNER */}
                {recentBatch && recentBatch.recordIds.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-amber-600" />
                        Previous Upload: <span className="font-mono font-medium">{recentBatch.fileName}</span> ({recentBatch.recordCount} records)
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Uploaded on {new Date(recentBatch.timestamp).toLocaleDateString()} at {new Date(recentBatch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Uploaded the wrong file? Remove all records in 1 click.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={rollingBack}
                        onClick={() => setRollbackConfirmOpen(true)}
                        className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 whitespace-nowrap text-xs font-semibold gap-1.5 h-8"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Rollback / Delete Upload
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Dismiss recent upload notification"
                        onClick={() => {
                          localStorage.removeItem(`machinecare_last_import_${entity}`);
                          setRecentBatch(null);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed transition-all p-8 text-center flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : "border-border/80 bg-muted/20 hover:bg-muted/30"
                  }`}
                >
                  <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                    {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Upload your spreadsheet
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Drag and drop your <b>Excel (.xlsx, .xls)</b> or <b>CSV</b> file here or browse from your computer
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      Supports Microsoft Excel, Google Sheets exports, LibreOffice, and CSV formats
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    disabled={parsing}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 text-xs font-semibold mt-2"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Parsing Spreadsheet...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" /> Select Excel / CSV File
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5 text-primary" /> Download Sample Templates
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pre-formatted templates with standard headers and example data rows.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadExcelTemplate}
                      className="whitespace-nowrap text-xs gap-1.5 font-semibold border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel (.xlsx)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadCsvTemplate}
                      className="whitespace-nowrap text-xs gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV (.csv)
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: COLUMN MAPPING & PREVIEW */}
            {step === "mapping" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        1. Map Spreadsheet Columns
                      </span>
                      {uploadedFileName && (
                        <p className="text-[11px] text-muted-foreground">
                          File: <span className="font-mono text-foreground font-medium">{uploadedFileName}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {parsedRows.length} Rows Detected
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStep("upload")}
                        className="text-xs h-7 gap-1 text-muted-foreground"
                      >
                        <Undo2 className="h-3 w-3" /> Change File
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {config.fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                          <span>
                            {field.label} {field.required && <span className="text-rose-500 font-bold">*</span>}
                          </span>
                          {columnMapping[field.key] ? (
                            <span className="text-[10px] text-emerald-600 font-medium">Mapped</span>
                          ) : field.defaultValue ? (
                            <span className="text-[10px] text-primary font-medium">Default: {field.defaultValue}</span>
                          ) : field.required ? (
                            <span className="text-[10px] text-rose-500 font-medium">Required</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60">Optional</span>
                          )}
                        </label>
                        <select
                          value={columnMapping[field.key] || ""}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full text-xs h-9 rounded-md border border-input bg-background px-3"
                        >
                          <option value="">
                            {field.defaultValue ? `-- Auto: "${field.defaultValue}" --` : "-- Select matching column --"}
                          </option>
                          {rawHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      2. Data Preview (First 5 Rows)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Valid: <b className="text-emerald-600">{validRowCount}</b> / {parsedRows.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Validation</th>
                          {config.fields.map((f) => (
                            <th key={f.key} className="px-3 py-2 whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validatedRows.slice(0, 5).map((item, idx) => (
                          <tr key={idx} className={item.hasError ? "bg-rose-500/5" : ""}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.hasError ? (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Error
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </Badge>
                              )}
                            </td>
                            {config.fields.map((f) => (
                              <td key={f.key} className="px-3 py-2 text-foreground font-mono text-[11px]">
                                {f.key === "order_status" ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-[10px] font-medium capitalize">
                                    {item.row[f.key] || "received"}
                                  </Badge>
                                ) : (
                                  item.row[f.key] || <span className="text-muted-foreground/40 italic">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: IMPORTING */}
            {step === "importing" && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-foreground">Importing your records into MachineCare</h3>
                  <p className="text-xs text-muted-foreground">Writing chunked batches to database...</p>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <Progress value={importProgress} className="h-2.5" />
                  <div className="text-[11px] font-mono text-muted-foreground">{importProgress}% Completed</div>
                </div>
              </div>
            )}

            {/* STEP 4: DONE */}
            {step === "done" && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
                <div className="h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Import Completed Successfully</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Successfully imported <b>{importResults.success}</b> records out of {importResults.total}.
                  </p>
                  {importResults.failed > 0 && (
                    <p className="text-xs text-rose-500 mt-0.5">
                      {importResults.failed} records failed due to database validation.
                    </p>
                  )}
                </div>

                {/* 1-CLICK CANCEL / ROLLBACK BANNER */}
                {lastImportedIds.length > 0 && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left w-full max-w-lg mt-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Uploaded the wrong file?
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        You can cancel this entire upload and delete all <b>{lastImportedIds.length}</b> newly added records now in 1 click.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={rollingBack}
                      onClick={() => setRollbackConfirmOpen(true)}
                      className="whitespace-nowrap text-xs gap-1.5 font-semibold shrink-0"
                    >
                      {rollingBack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Cancel & Delete Upload
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DIALOG FOOTER */}
          <DialogFooter className="border-t border-border pt-3 gap-2">
            {step === "mapping" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="gap-1.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button
                  size="sm"
                  disabled={!isMappingValid || validRowCount === 0}
                  onClick={executeImport}
                  className="gap-1.5 text-xs"
                >
                  Import {validRowCount} Records <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {step === "done" && (
              <Button size="sm" onClick={() => handleOpenChange(false)} className="text-xs">
                Done
              </Button>
            )}

            {step === "upload" && (
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} className="text-xs">
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM ROLLBACK DIALOG */}
      <ConfirmDialog
        open={rollbackConfirmOpen}
        onOpenChange={setRollbackConfirmOpen}
        title="Cancel & Rollback this entire upload?"
        description={`This will permanently remove all ${
          lastImportedIds.length || recentBatch?.recordCount || 0
        } records that were uploaded from this spreadsheet. You will not have to delete each item individually.`}
        confirmLabel="Yes, Delete All Uploaded Records"
        confirmVariant="destructive"
        onConfirm={async () => {
          const idsToDelete = lastImportedIds.length > 0 ? lastImportedIds : (recentBatch?.recordIds || []);
          await rollbackBatch(idsToDelete);
        }}
      />
    </>
  );
}
