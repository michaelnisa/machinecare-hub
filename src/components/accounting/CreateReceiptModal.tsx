import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  createAccountantReceipt,
  type ReceiptType,
  type PaymentMethod,
  type ReceiptLineItem,
  type AccountantReceipt,
} from "@/services/accountantService";
import {
  Wrench,
  Package,
  Plus,
  Trash2,
  Upload,
  Receipt,
  CheckCircle2,
  FileText,
  DollarSign,
  Truck,
  CreditCard,
  Building2,
} from "lucide-react";

interface CreateReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (receipt: AccountantReceipt) => void;
  defaultMachineId?: string;
  defaultWorkOrderId?: string;
  defaultType?: ReceiptType;
}

const CATEGORIES_BY_TYPE: Record<ReceiptType, string[]> = {
  spare_part: [
    "Spare Parts",
    "Brake Components",
    "Engine Parts",
    "Transmission & Clutch",
    "Tyres & Wheels",
    "Filters & Belts",
    "Lubricants & Oils",
    "Electrical & Batteries",
    "Suspension & Steering",
    "Hardware & Fasteners",
  ],
  maintenance_service: [
    "Preventive Maintenance (PM)",
    "Mechanical Overhaul",
    "Electrical Repair",
    "Diagnostic & Calibration",
    "External Workshop Labour",
    "Welding & Body Repair",
    "AC & Cooling Service",
    "Tyre Fitting & Alignment",
    "Emergency Roadside Service",
  ],
  other_service: [
    "Towing & Recovery",
    "Statutory Vehicle Inspection",
    "GPS & Telematics Installation",
    "Permits & Regulatory Fees",
    "Cleaning & Wash Bay",
    "Courier & Part Freight",
    "Miscellaneous Service",
  ],
};

export function CreateReceiptModal({
  open,
  onOpenChange,
  onSuccess,
  defaultMachineId,
  defaultWorkOrderId,
  defaultType = "spare_part",
}: CreateReceiptModalProps) {
  const { organisation, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [receiptType, setReceiptType] = useState<ReceiptType>(defaultType);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Spare Parts");
  const [payeeName, setPayeeName] = useState("");
  const [machineId, setMachineId] = useState(defaultMachineId || "");
  const [workOrderId, setWorkOrderId] = useState(defaultWorkOrderId || "");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("TZS");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidByName, setPaidByName] = useState(profile?.full_name || "Accountant");
  const [receivedByName, setReceivedByName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"paid" | "pending">("paid");

  // Multi-item Line Items
  const [items, setItems] = useState<ReceiptLineItem[]>([
    { description: "", part_number: "", quantity: 1, unit_price: 0, total: 0 },
  ]);

  // File Attachment
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  // Entities for Selection
  const [machines, setMachines] = useState<Array<{ id: string; name: string; plate_number: string | null }>>([]);
  const [workOrders, setWorkOrders] = useState<Array<{ id: string; title: string; wo_number: number | null; machine_id: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  // Load dropdown resources
  useEffect(() => {
    if (!open || !organisation?.id) return;

    // Set default paid by name
    if (profile?.full_name && !paidByName) {
      setPaidByName(profile.full_name);
    }

    (async () => {
      // 1. Machines
      const { data: machs } = await supabase
        .from("machines")
        .select("id, name, plate_number")
        .eq("organisation_id", organisation.id)
        .order("name");
      if (machs) setMachines(machs);

      // 2. Work Orders
      const { data: wos } = await supabase
        .from("work_orders")
        .select("id, title, wo_number, machine_id")
        .eq("organisation_id", organisation.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (wos) setWorkOrders(wos as any);

      // 3. Suppliers
      const { data: sups } = await (supabase as any)
        .from("suppliers")
        .select("id, name")
        .eq("organisation_id", organisation.id)
        .order("name");
      if (sups) setSuppliers(sups);

      // 4. Vendors
      const { data: vends } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("organisation_id", organisation.id)
        .order("name");
      if (vends) setVendors(vends);
    })();
  }, [open, organisation?.id, profile?.full_name]);

  // Sync category options on type change
  useEffect(() => {
    const defaultCat = CATEGORIES_BY_TYPE[receiptType][0] || "Spare Parts";
    setCategory(defaultCat);
  }, [receiptType]);

  // Line item handlers
  const handleItemChange = (index: number, field: keyof ReceiptLineItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "unit_price") {
      const q = field === "quantity" ? Number(value) || 0 : current.quantity;
      const p = field === "unit_price" ? Number(value) || 0 : current.unit_price;
      current.total = q * p;
    }

    updated[index] = current;
    setItems(updated);

    // Auto-update grand total
    const grand = updated.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    if (grand > 0) {
      setAmount(grand);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", part_number: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    const grand = updated.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    setAmount(grand);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentFile(file);
      if (file.type.startsWith("image/")) {
        setAttachmentPreview(URL.createObjectURL(file));
      } else {
        setAttachmentPreview(null);
      }
    }
  };

  // Filtered WOs based on selected machine
  const availableWorkOrders = useMemo(() => {
    if (!machineId) return workOrders;
    return workOrders.filter((w) => w.machine_id === machineId);
  }, [workOrders, machineId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    if (!title.trim()) {
      toast.error("Please enter a title / description for this payment");
      return;
    }
    if (!payeeName.trim()) {
      toast.error("Please specify who was paid (Vendor / Supplier / Person)");
      return;
    }
    if (amount <= 0) {
      toast.error("Please enter a valid payment amount greater than zero");
      return;
    }

    // Filter valid line items
    const validItems = items
      .filter((i) => i.description.trim().length > 0)
      .map((i) => ({
        description: i.description.trim(),
        part_number: i.part_number?.trim() || undefined,
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        total: (Number(i.quantity) || 1) * (Number(i.unit_price) || 0),
      }));

    setLoading(true);
    try {
      const res = await createAccountantReceipt(
        {
          organisation_id: organisation.id,
          receipt_type: receiptType,
          title: title.trim(),
          category,
          payee_name: payeeName.trim(),
          machine_id: machineId || null,
          work_order_id: workOrderId || null,
          amount,
          currency,
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim() || null,
          payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
          paid_by_name: paidByName.trim() || null,
          received_by_name: receivedByName.trim() || null,
          items: validItems,
          notes: notes.trim() || null,
          status,
        },
        attachmentFile
      );

      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to record payment receipt");
      }

      toast.success(`Payment voucher ${res.data.receipt_number} recorded successfully!`);
      onSuccess?.(res.data);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Create Payment Receipt / Disbursement Voucher</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Issue and record financial disbursements for spare parts and maintenance services.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Receipt Type Toggle */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Disbursement Type</Label>
            <Tabs value={receiptType} onValueChange={(v) => setReceiptType(v as ReceiptType)}>
              <TabsList className="grid grid-cols-3 h-9">
                <TabsTrigger value="spare_part" className="gap-1.5 text-xs">
                  <Package className="h-3.5 w-3.5" /> Buying Spare Parts
                </TabsTrigger>
                <TabsTrigger value="maintenance_service" className="gap-1.5 text-xs">
                  <Wrench className="h-3.5 w-3.5" /> Maintenance / Service
                </TabsTrigger>
                <TabsTrigger value="other_service" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" /> Other Service
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Payment Purpose / Title *</Label>
              <Input
                placeholder={
                  receiptType === "spare_part"
                    ? "e.g. Purchase of Scania brake linings & drums"
                    : "e.g. Engine overhaul labour & calibration"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES_BY_TYPE[receiptType].map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payee / Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Paid To (Supplier / Workshop / Payee) *</Label>
              <div className="flex gap-1.5 mt-1">
                <Input
                  placeholder="e.g. AutoCom Spares Ltd / Dar Workshop"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="h-8 text-xs flex-1"
                  required
                />
                {(suppliers.length > 0 || vendors.length > 0) && (
                  <Select
                    onValueChange={(val) => {
                      if (val) setPayeeName(val);
                    }}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-[11px] px-2 text-muted-foreground">
                      <SelectValue placeholder="Pick saved" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={`sup_${s.id}`} value={s.name} className="text-xs">
                          {s.name} (Supplier)
                        </SelectItem>
                      ))}
                      {vendors.map((v) => (
                        <SelectItem key={`ven_${v.id}`} value={v.name} className="text-xs">
                          {v.name} (Vendor)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Received By (Payee Contact / Rep)</Label>
              <Input
                placeholder="Name of person receiving payment"
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Vehicle & Work Order Linking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" /> Target Machine / Vehicle
              </Label>
              <Select value={machineId} onValueChange={(val) => setMachineId(val === "none" ? "" : val)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Select vehicle / machine (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    None / General Inventory
                  </SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.plate_number ? `${m.plate_number} — ${m.name}` : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-primary" /> Linked Work Order (Optional)
              </Label>
              <Select value={workOrderId} onValueChange={(val) => setWorkOrderId(val === "none" ? "" : val)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Link to work order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    None
                  </SelectItem>
                  {availableWorkOrders.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.wo_number ? `WO-${w.wo_number}: ` : ""}{w.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Multi-Item Line Builder */}
          <div className="border border-border rounded-xl p-3 space-y-2 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" /> Itemized Breakdown / Parts & Services
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>

            <div className="space-y-1.5 mt-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Item / part description *"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Part # (opt)"
                      value={item.part_number}
                      onChange={(e) => handleItemChange(idx, "part_number", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                      className="h-8 text-xs text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                      className="h-8 text-xs text-right font-mono"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-xl border border-border">
            <div>
              <Label className="text-xs font-medium">Total Amount *</Label>
              <div className="flex gap-1 mt-1">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-[85px] h-8 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TZS" className="text-xs">TZS</SelectItem>
                    <SelectItem value="USD" className="text-xs">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-8 text-xs font-mono font-bold flex-1 text-right"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                  <SelectItem value="bank_transfer" className="text-xs">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money" className="text-xs">Mobile Money (M-Pesa/Airtel/Tigo)</SelectItem>
                  <SelectItem value="cheque" className="text-xs">Cheque</SelectItem>
                  <SelectItem value="card" className="text-xs">Credit/Debit Card</SelectItem>
                  <SelectItem value="selcom" className="text-xs">Selcom Pay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Reference / Cheque #</Label>
              <Input
                placeholder="Txn ID, Cheque #, or Ref"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="h-8 text-xs font-mono mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
          </div>

          {/* Paid By & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Disbursed / Paid By (Accountant)</Label>
              <Input
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Payment Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid" className="text-xs text-emerald-600 font-semibold">
                    Paid (Completed)
                  </SelectItem>
                  <SelectItem value="pending" className="text-xs text-amber-600 font-semibold">
                    Pending Authorization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attachment Upload */}
          <div>
            <Label className="text-xs font-medium block mb-1">
              Supplier Receipt / Delivery Note / Invoice Scan (Optional)
            </Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground transition-colors">
                <Upload className="h-3.5 w-3.5" />
                <span>{attachmentFile ? attachmentFile.name : "Upload receipt scan / photo"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
              {attachmentPreview && (
                <img
                  src={attachmentPreview}
                  alt="Receipt Preview"
                  className="h-10 w-10 object-cover rounded border border-border"
                />
              )}
              {attachmentFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAttachmentFile(null);
                    setAttachmentPreview(null);
                  }}
                  className="h-7 text-xs text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-medium">Internal Notes & Remarks</Label>
            <Textarea
              placeholder="e.g. Approved under PO-2026-081. Emergency roadside purchase."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px] mt-1"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Recording..." : "Record Disbursement Voucher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
