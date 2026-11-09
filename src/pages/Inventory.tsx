import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Wrench,
  X,
  FileSpreadsheet,
  Download,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { setItemStockCount, exportInventoryToExcel } from "@/lib/stock-helpers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BulkImporterModal } from "@/components/BulkImporterModal";
import { CoverImage } from "@/components/CoverImage";

const CATEGORIES = [
  "filter",
  "oil",
  "belt",
  "tyre",
  "battery",
  "fluid",
  "electrical",
  "ppe",
  "other",
];
const UNITS = ["pcs", "litres", "kg", "metres", "set"];
const ITEM_TYPES = [
  "spare_part",
  "consumable",
  "raw_material",
  "production_material",
  "tool",
  "ppe",
  "safety_equipment",
  "chemical",
  "lubricant",
  "electrical_component",
  "mechanical_component",
  "other",
];
const CRITICALITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["active", "inactive", "discontinued"];
const CRITICALITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export default function Inventory() {
  const { profile } = useAuth();
  const { isManager } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter") ?? "all";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [machinesFor, setMachinesFor] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: bal }] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name"),
      (supabase as any)
        .from("stock_balances")
        .select("item_id, available_stock"),
    ]);
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    const map: Record<string, number> = {};
    (bal ?? []).forEach((b: any) => {
      map[b.item_id] = (map[b.item_id] ?? 0) + Number(b.available_stock);
    });
    setAvailable(map);
    setLoading(false);
  };
  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const filtered = useMemo(() => {
    let out = items;
    if (filterParam === "low_stock")
      out = out.filter((i) => {
        const a = available[i.id] ?? Number(i.quantity ?? 0);
        return a > 0 && a <= Number(i.reorder_level);
      });
    else if (filterParam === "out_of_stock")
      out = out.filter((i) => (available[i.id] ?? Number(i.quantity ?? 0)) <= 0);
    else if (filterParam === "critical")
      out = out.filter((i) => i.criticality === "critical");
    else if (filterParam === "inactive")
      out = out.filter(
        (i) => i.status === "inactive" || i.status === "discontinued",
      );
    else if (filterParam === "healthy")
      out = out.filter((i) => {
        const a = available[i.id] ?? Number(i.quantity ?? 0);
        return a > Number(i.reorder_level);
      });

    if (!search.trim()) return out;
    const q = search.toLowerCase();
    return out.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.part_number ?? "").toLowerCase().includes(q) ||
        (i.sku ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q),
    );
  }, [items, search, filterParam, available]);

  const lowStock = items.filter(
    (i) => Number(i.quantity) <= Number(i.reorder_level),
  ).length;

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Parts inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track stock and auto-deduct when parts are used in service logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportInventoryToExcel(filtered, available, "workshop_inventory.xlsx")}
            title="Download parts inventory as Excel spreadsheet"
          >
            <Download className="mr-2 h-4 w-4" /> Download Excel
          </Button>
          {(isManager || profile?.role === "admin" || profile?.role === "manager") && (
            <Button variant="outline" onClick={() => setImportOpen(true)} title="Import inventory from Excel or CSV file">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel / CSV
            </Button>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add part
          </Button>
        </div>
      </div>

      {lowStock > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {lowStock}{" "}
            {lowStock === 1 ? "item is" : "items are"} at or below reorder
            level.
          </span>
          <RouterLink
            to="/inventory/purchase-requests?new=1"
            className="text-amber-900 underline"
          >
            Create purchase request
          </RouterLink>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search parts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        {filterParam !== "all" && (
          <button
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs capitalize text-primary"
          >
            Filter: {filterParam.replace(/_/g, " ")} ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No parts in stock"
          description="Add parts you commonly use so they can be auto-deducted from service logs."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Part</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Criticality</th>
                  <th className="px-5 py-3 font-medium">In stock</th>
                  <th className="px-5 py-3 font-medium">Reorder at</th>
                  <th className="px-5 py-3 font-medium">Order status</th>
                  <th className="px-5 py-3 font-medium">Unit cost</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const low = Number(i.quantity) <= Number(i.reorder_level);
                  const status = i.order_status ?? "none";
                  const statusLabel: Record<string, string> = {
                    none: "—",
                    requested: "Requested",
                    ordered: "Ordered",
                    in_transit: "In transit",
                    received: "Received",
                  };
                  const statusClass: Record<string, string> = {
                    none: "text-muted-foreground",
                    requested: "text-amber-700 bg-amber-50 border-amber-200",
                    ordered: "text-blue-700 bg-blue-50 border-blue-200",
                    in_transit:
                      "text-indigo-700 bg-indigo-50 border-indigo-200",
                    received:
                      "text-emerald-700 bg-emerald-50 border-emerald-200",
                  };
                  return (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                            {i.image_url ? (
                              <CoverImage
                                value={i.image_url}
                                alt={i.name}
                                className="h-full w-full object-cover"
                                fallback={<Package className="h-5 w-5 text-muted-foreground/60" />}
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground/60" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{i.name}</div>
                            {i.part_number && (
                              <div className="text-xs text-muted-foreground">
                                {i.part_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 capitalize">
                        {i.category ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs capitalize ${CRITICALITY_CLASS[i.criticality ?? "low"]}`}
                        >
                          {i.criticality ?? "low"}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 font-medium ${low ? "text-amber-600" : ""}`}
                      >
                        {formatNumber(i.quantity)} {i.unit}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatNumber(i.reorder_level)}
                      </td>
                      <td className="px-5 py-3">
                        {status === "none" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusClass[status] ?? ""}`}
                          >
                            {statusLabel[status]}
                          </span>
                        )}
                        {i.order_note && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {i.order_note}
                          </div>
                        )}
                        {i.order_expected_at && (
                          <div className="text-xs text-muted-foreground">
                            ETA {i.order_expected_at}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">{formatMoney(i.unit_cost)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {i.supplier ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMachinesFor(i)}
                          title="Machines using this part"
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditing(i);
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirm(i.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InventoryDialog
        open={open}
        onOpenChange={setOpen}
        item={editing}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this part?"
        description="This action cannot be undone."
        onConfirm={async () => {
          await handleDelete();
        }}
      />
      <ItemMachinesDialog
        item={machinesFor}
        onClose={() => setMachinesFor(null)}
      />
      <BulkImporterModal
        entity="inventory"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />
    </div>
  );
}

interface WorkshopModelRow {
  model: string;
  quantity: string;
  sellingPrice?: string;
  unitCost?: string;
}

function InventoryDialog({ open, onOpenChange, item, onSaved }: any) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const [models, setModels] = useState<WorkshopModelRow[]>([{ model: "", quantity: "1", sellingPrice: "", unitCost: "" }]);
  const [quickInput, setQuickInput] = useState("");

  // Photo state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuickInput("");
      if (item) {
        setForm({
          ...item,
          quantity: item.quantity != null ? String(item.quantity) : "1",
          unit_cost: item.unit_cost != null ? String(item.unit_cost) : "0",
          selling_price: item.selling_price != null ? String(item.selling_price) : "",
        });
        setImageUrl(item.image_url ?? null);
        setImagePreview(null);
        setImageFile(null);
      } else {
        setForm({
          name: "",
          part_number: "",
          category: "filter",
          unit: "pcs",
          quantity: "1",
          reorder_level: 0,
          unit_cost: 0,
          selling_price: "",
          supplier: "",
          location: "",
          notes: "",
          order_status: "none",
          order_note: "",
          ordered_at: "",
          order_expected_at: "",
          sku: "",
          manufacturer_part_number: "",
          manufacturer: "",
          brand: "",
          barcode: "",
          item_type: "spare_part",
          criticality: "low",
          status: "active",
          max_stock: "",
          reorder_quantity: "",
          safety_stock: "",
          lead_time_days: "",
          avg_monthly_consumption: "",
          backup_supplier: "",
          technical_specs: "",
        });
        setModels([{ model: "", quantity: "1", sellingPrice: "", unitCost: "" }]);
        setImageUrl(null);
        setImagePreview(null);
        setImageFile(null);
      }
    }
  }, [open, item]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addModelRow = () => {
    setModels((prev) => [...prev, { model: "", quantity: "1", sellingPrice: "", unitCost: "" }]);
  };

  const updateModel = (idx: number, patch: Partial<WorkshopModelRow>) => {
    setModels((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeModel = (idx: number) => {
    if (models.length <= 1) {
      setModels([{ model: "", quantity: "1", sellingPrice: "", unitCost: "" }]);
      return;
    }
    setModels((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;
    const parts = quickInput
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    const newRows: WorkshopModelRow[] = parts.map((m) => ({
      model: m,
      quantity: "1",
      sellingPrice: "",
      unitCost: "",
    }));
    const firstIsEmpty = models.length === 1 && !models[0].model.trim();

    if (firstIsEmpty) {
      setModels(newRows);
    } else {
      setModels((prev) => [...prev, ...newRows]);
    }
    setQuickInput("");
    toast.success(`Added ${newRows.length} models to list`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const baseName = form.name?.trim();
    if (!baseName) return toast.error("Name required");
    setSubmitting(true);

    // Upload photo to machine-docs storage if selected
    let finalImageUrl = imageUrl;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${profile.organisation_id || "common"}/parts/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("machine-docs")
        .upload(path, imageFile, { upsert: true });
      if (upErr) {
        console.warn("Image upload warning:", upErr);
        toast.error("Photo upload failed: " + upErr.message);
      } else {
        finalImageUrl = path;
      }
    }

    const targetQty = form.quantity !== "" && !isNaN(Number(form.quantity)) ? Math.max(0, Number(form.quantity)) : 1;
    const basePayload: any = {
      organisation_id: profile.organisation_id,
      name: baseName,
      part_number: form.part_number || null,
      category: form.category || null,
      unit: form.unit || "pcs",
      quantity: targetQty,
      reorder_level: Number(form.reorder_level) || 0,
      unit_cost: Number(form.unit_cost) || 0,
      selling_price: form.selling_price === "" || form.selling_price == null ? null : Number(form.selling_price),
      image_url: finalImageUrl,
      supplier: form.supplier || null,
      location: form.location || null,
      notes: form.notes || null,
      order_status: form.order_status || "none",
      order_note: form.order_note || null,
      ordered_at: form.ordered_at || null,
      order_expected_at: form.order_expected_at || null,
      sku: form.sku || null,
      manufacturer_part_number: form.manufacturer_part_number || null,
      manufacturer: form.manufacturer || null,
      brand: form.brand || null,
      barcode: form.barcode || null,
      item_type: form.item_type || "spare_part",
      criticality: form.criticality || "low",
      status: form.status || "active",
      max_stock: form.max_stock === "" ? null : Number(form.max_stock),
      reorder_quantity:
        form.reorder_quantity === "" ? null : Number(form.reorder_quantity),
      safety_stock: form.safety_stock === "" ? null : Number(form.safety_stock),
      lead_time_days:
        form.lead_time_days === "" ? null : Number(form.lead_time_days),
      avg_monthly_consumption:
        form.avg_monthly_consumption === ""
          ? null
          : Number(form.avg_monthly_consumption),
      backup_supplier: form.backup_supplier || null,
      technical_specs: form.technical_specs || null,
    };

    if (item) {
      let { error } = await supabase.from("inventory_items").update(basePayload).eq("id", item.id);
      if (error && (error.message?.includes("image_url") || error.code === "PGRST204")) {
        const { image_url, ...fallback } = basePayload;
        const res = await supabase.from("inventory_items").update(fallback).eq("id", item.id);
        error = res.error;
      }
      if (error) {
        setSubmitting(false);
        return toast.error(error.message);
      }
      await setItemStockCount({
        itemId: item.id,
        orgId: profile.organisation_id,
        targetStock: targetQty,
        currentStock: Number(item.quantity ?? 0),
        reason: "Stock updated via edit in inventory",
      });
      setSubmitting(false);
      toast.success("Updated");
      onOpenChange(false);
      onSaved();
      return;
    }

    // Adding flow (can be 1 model or multiple models)
    const validRows = models.filter((r) => r.model.trim());
    const fallbackQty = form.quantity !== "" && !isNaN(Number(form.quantity)) ? Math.max(0, Number(form.quantity)) : 1;
    const rowsToProcess = validRows.length > 0
      ? validRows
      : [{ model: form.part_number || "", quantity: String(fallbackQty), sellingPrice: form.selling_price, unitCost: form.unit_cost }];

    const payloads = rowsToProcess.map((r) => {
      const code = r.model.trim();
      const fullName = code && validRows.length > 1 ? `${baseName} - ${code}` : baseName;
      const initialQty = Number(r.quantity) > 0 ? Number(r.quantity) : 1;
      const rowSellingPrice = r.sellingPrice && r.sellingPrice.trim() !== ""
        ? Number(r.sellingPrice)
        : form.selling_price === "" || form.selling_price == null ? null : Number(form.selling_price);
      const rowUnitCost = r.unitCost && r.unitCost.trim() !== ""
        ? Number(r.unitCost)
        : (Number(form.unit_cost) || 0);

      return {
        ...basePayload,
        name: fullName,
        part_number: code || basePayload.part_number,
        sku: code || basePayload.sku,
        quantity: initialQty,
        unit_cost: rowUnitCost,
        selling_price: rowSellingPrice,
        image_url: finalImageUrl,
      };
    });

    let { data: insertedItems, error } = await supabase
      .from("inventory_items")
      .insert(payloads)
      .select("id, name");

    if (error && (error.message?.includes("image_url") || error.code === "PGRST204")) {
      const fallbackPayloads = payloads.map(({ image_url, ...rest }: any) => rest);
      const res = await supabase
        .from("inventory_items")
        .insert(fallbackPayloads)
        .select("id, name");
      insertedItems = res.data;
      error = res.error;
    }

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    if (insertedItems && insertedItems.length > 0) {
      const promises = insertedItems.map((ins, idx) => {
        const qty = Number(rowsToProcess[idx]?.quantity) > 0 ? Number(rowsToProcess[idx]?.quantity) : 1;
        return setItemStockCount({
          itemId: ins.id,
          orgId: profile.organisation_id,
          targetStock: qty,
          currentStock: 0,
          reason: "Initial stock on registration",
        });
      });
      await Promise.all(promises);
    }

    setSubmitting(false);
    toast.success(rowsToProcess.length > 1 ? `Added ${rowsToProcess.length} models of ${baseName}` : "Added part");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit part" : "Add part"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={150}
                placeholder="e.g. Oil filter, Brakepad, Bearing"
              />
            </div>

            {/* Photo Upload Section */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Part Photo (Picha ya Spea) — <span className="font-normal italic">Optional</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <div className="mt-1.5 flex items-center gap-3">
                {imagePreview || imageUrl ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <CoverImage
                        value={imageUrl}
                        alt="Current photo"
                        className="h-full w-full object-cover"
                        fallback={<Package className="h-6 w-6 text-muted-foreground/60 m-auto mt-5" />}
                      />
                    )}
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                      title="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground transition hover:border-primary hover:text-primary"
                    title="Upload photo"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] mt-0.5 font-medium">Photo</span>
                  </div>
                )}

                <div className="flex-1 text-xs">
                  {imagePreview || imageUrl ? (
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-foreground">Photo selected</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 text-xs px-2"
                        >
                          Change Photo
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePhoto}
                          className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Upload Part Photo
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Take or upload a picture of the spare part or packaging.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={form.category ?? "filter"}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select
                value={form.unit ?? "pcs"}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Unit cost (Buying Price)</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.unit_cost ?? 0}
                onChange={(e) =>
                  setForm({ ...form, unit_cost: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Selling Price (Bei ya Kuuza)</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.selling_price ?? ""}
                onChange={(e) =>
                  setForm({ ...form, selling_price: e.target.value })
                }
                placeholder="e.g. 35000"
              />
            </div>

            {!item ? (
              /* Adding Models & Prices */
              <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Models / Numbers &amp; Prices (Modeli, Bei na Idadi)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Add each model/part number with its specific selling price and stock.
                  </p>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-[11px] font-medium text-muted-foreground">
                  <div className="col-span-5">Model / Part No.</div>
                  <div className="col-span-2">Stock</div>
                  <div className="col-span-2">Cost (optional)</div>
                  <div className="col-span-3">Selling Price (optional)</div>
                </div>

                <div className="space-y-2 pt-1 max-h-[240px] overflow-y-auto pr-1">
                  {models.map((row, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-border/70 bg-card space-y-2">
                      <div className="flex items-center justify-between gap-2 sm:hidden">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Model #{idx + 1}
                        </span>
                        {models.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeModel(idx)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <Label className="text-[10px] text-muted-foreground sm:hidden">Model / Part No.</Label>
                          <Input
                            placeholder={`Model ${idx + 1} (e.g. ${idx === 0 ? "3455" : "4567"})`}
                            value={row.model}
                            onChange={(e) => updateModel(idx, { model: e.target.value })}
                            className="h-8 text-xs font-medium bg-background"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground sm:hidden">Stock (pcs)</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={(e) => updateModel(idx, { quantity: e.target.value })}
                              className="h-8 text-xs font-semibold text-center bg-background"
                            />
                            <span className="text-[10px] text-muted-foreground font-medium">{form.unit || "pcs"}</span>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground sm:hidden">Cost</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder={form.unit_cost ? `Cost: ${form.unit_cost}` : "Cost"}
                            value={row.unitCost ?? ""}
                            onChange={(e) => updateModel(idx, { unitCost: e.target.value })}
                            className="h-8 text-xs bg-background"
                            title="Buying cost for this model"
                          />
                        </div>
                        <div className="sm:col-span-3 flex items-center gap-1">
                          <div className="flex-1">
                            <Label className="text-[10px] text-muted-foreground sm:hidden">Selling Price</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder={form.selling_price ? `Sell: ${form.selling_price}` : "Sell price"}
                              value={row.sellingPrice ?? ""}
                              onChange={(e) => updateModel(idx, { sellingPrice: e.target.value })}
                              className="h-8 text-xs font-semibold text-primary bg-background"
                              title="Selling price for this model"
                            />
                          </div>
                          {models.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeModel(idx)}
                              className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addModelRow}
                  className="w-full text-xs gap-1.5 h-8 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Model (Ongeza Namba Nyingine)
                </Button>

                <div className="pt-2 border-t border-border/60">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Or type numbers separated by comma (Mfano: 3455, 4567, 3456):
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      placeholder="3455, 4567, 3456..."
                      className="h-8 text-xs bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleQuickAdd();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleQuickAdd}
                      className="h-8 text-xs shrink-0"
                    >
                      + Add
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Edit Stock Controls */
              <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Stock in Hand / Quantity (Idadi ya Spea Ilivyopo Stoo)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Edit current count or tap quick buttons to add more if new stock arrived.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 font-bold text-base"
                    onClick={() => setForm((prev: any) => ({ ...prev, quantity: Math.max(0, (Number(prev.quantity) || 0) - 1) }))}
                  >
                    -
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      value={form.quantity ?? 1}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      className="h-10 text-center text-base font-semibold bg-background"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 font-bold text-base"
                    onClick={() => setForm((prev: any) => ({ ...prev, quantity: (Number(prev.quantity) || 0) + 1 }))}
                  >
                    +
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{form.unit || "pcs"}</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground">Add more:</span>
                  {[1, 5, 10, 20].map((addAmt) => (
                    <Button
                      key={addAmt}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium"
                      onClick={() => setForm((prev: any) => ({ ...prev, quantity: (Number(prev.quantity) || 0) + addAmt }))}
                    >
                      +{addAmt}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Part # / Model Code</Label>
              <Input
                value={form.part_number ?? ""}
                onChange={(e) =>
                  setForm({ ...form, part_number: e.target.value })
                }
                placeholder="e.g. 3455"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reorder level</Label>
              <Input
                type="number"
                step="any"
                value={form.reorder_level ?? 0}
                onChange={(e) =>
                  setForm({ ...form, reorder_level: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input
                value={form.supplier ?? ""}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={form.location ?? ""}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Shelf, bin..."
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">Item master details</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Item type</Label>
                <select
                  value={form.item_type ?? "spare_part"}
                  onChange={(e) =>
                    setForm({ ...form, item_type: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Criticality</Label>
                <select
                  value={form.criticality ?? "low"}
                  onChange={(e) =>
                    setForm({ ...form, criticality: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CRITICALITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={form.status ?? "active"}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input
                  value={form.sku ?? ""}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer part number</Label>
                <Input
                  value={form.manufacturer_part_number ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      manufacturer_part_number: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Barcode</Label>
                <Input
                  value={form.barcode ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer</Label>
                <Input
                  value={form.manufacturer ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, manufacturer: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input
                  value={form.brand ?? ""}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Backup supplier</Label>
                <Input
                  value={form.backup_supplier ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, backup_supplier: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Technical specifications</Label>
                <Textarea
                  rows={2}
                  value={form.technical_specs ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, technical_specs: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">Stock planning</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Maximum stock</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.max_stock ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, max_stock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder quantity</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.reorder_quantity ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, reorder_quantity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Safety stock</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.safety_stock ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, safety_stock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lead time (days)</Label>
                <Input
                  type="number"
                  value={form.lead_time_days ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, lead_time_days: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Average monthly consumption</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.avg_monthly_consumption ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      avg_monthly_consumption: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-medium">On-order tracking</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={form.order_status ?? "none"}
                  onChange={(e) =>
                    setForm({ ...form, order_status: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">Not on order</option>
                  <option value="requested">Requested</option>
                  <option value="ordered">Ordered</option>
                  <option value="in_transit">In transit</option>
                  <option value="received">Received</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ordered on</Label>
                <Input
                  type="date"
                  value={form.ordered_at ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, ordered_at: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expected by</Label>
                <Input
                  type="date"
                  value={form.order_expected_at ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, order_expected_at: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Where is the part / notes</Label>
                <Input
                  value={form.order_note ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, order_note: e.target.value })
                  }
                  placeholder="e.g. PO#1234 at Mantrac, picking up Tue"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemMachinesDialog({
  item,
  onClose,
}: {
  item: any;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    (supabase as any)
      .from("machine_parts")
      .select("id, is_required, quantity_per_unit, machines(id, name)")
      .eq("item_id", item.id)
      .then(({ data }: any) => {
        setLinks(data ?? []);
        setLoading(false);
      });
  }, [item]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any)
      .from("machine_parts")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    setLinks((l) => l.filter((x) => x.id !== id));
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Machines using {item?.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not linked to any machine yet. Link it from a machine's "Spare
            parts" tab.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {l.machines?.name}
                  {l.is_required && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                      required
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(l.id)}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
