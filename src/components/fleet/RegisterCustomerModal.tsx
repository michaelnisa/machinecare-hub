import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  RegisteredCustomer,
  saveCustomCustomer,
} from "@/services/customerService";
import { toast } from "sonner";
import { Building2, Plus, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerRegistered?: (customer: RegisteredCustomer) => void;
}

const COMMON_CATEGORIES = [
  "Fast-Moving Consumer Goods & Beverages",
  "Beverage & Bottling",
  "Bulk Petroleum & Fuel Haulage",
  "International Shipping, Clearing & Forwarding",
  "Commercial Distribution & General Haulage",
  "Mining & Heavy Industrial Logistics",
  "Agricultural Produce & Grain Haulage",
  "Building Materials & Construction",
  "Other Commercial Consignment",
];

const COMMON_PAYMENT_TERMS = [
  "Within 30 Days (Direct Bank Transfer / EFT)",
  "Upon Delivery & Offloading",
  "Within 15 Days (Direct Bank Transfer)",
  "Within 7 Days of Invoicing",
  "50% Advance / 50% Upon Offloading",
  "Cash on Delivery / Lipa Namba",
];

export function RegisterCustomerModal({
  open,
  onOpenChange,
  onCustomerRegistered,
}: Props) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [industryCategory, setIndustryCategory] = useState(COMMON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [defaultCargo, setDefaultCargo] = useState("");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(COMMON_PAYMENT_TERMS[0]);
  const [customPaymentTerms, setCustomPaymentTerms] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isFuelCarrier, setIsFuelCarrier] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setShortName("");
    setIndustryCategory(COMMON_CATEGORIES[0]);
    setCustomCategory("");
    setDefaultCargo("");
    setDefaultPaymentTerms(COMMON_PAYMENT_TERMS[0]);
    setCustomPaymentTerms("");
    setPhone("");
    setEmail("");
    setIsFuelCarrier(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Please enter the official company or customer name");
      return;
    }

    setSaving(true);
    try {
      const finalCategory =
        industryCategory === "__custom__"
          ? customCategory.trim() || "Commercial Consignment"
          : industryCategory;

      const finalTerms =
        defaultPaymentTerms === "__custom__"
          ? customPaymentTerms.trim() || "Upon Delivery & Offloading"
          : defaultPaymentTerms;

      const newCustomer = saveCustomCustomer({
        name: cleanName.toUpperCase(),
        shortName: (shortName.trim() || cleanName),
        industryCategory: finalCategory,
        defaultCargo: defaultCargo.trim() || "Commercial Consignment / Bulk Cargo",
        defaultPaymentTerms: finalTerms,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        isFuelCarrier,
      });

      toast.success(`Customer "${newCustomer.name}" registered successfully`);
      onCustomerRegistered?.(newCustomer);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to register customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Register New Customer
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add a commercial client account to your customer directory for dispatch, receipting, and invoicing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Customer / Company Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Official Company / Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TOTALENERGIES TANZANIA / BAKHRESA GROUP"
              className="h-9 text-xs sm:text-sm font-semibold uppercase"
              autoFocus
              required
            />
          </div>

          {/* Short Name & Fuel Flag */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Short Display Name (For Pills)</Label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. TotalEnergies / Bakhresa"
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3 rounded-lg border border-border p-2 bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Petroleum / Fuel Carrier</Label>
                <p className="text-[10px] text-muted-foreground">Tanker / AGO / PMS</p>
              </div>
              <Switch checked={isFuelCarrier} onCheckedChange={setIsFuelCarrier} />
            </div>
          </div>

          {/* Industry Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Industry Category</Label>
            <Select value={industryCategory} onValueChange={setIndustryCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select industry category" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" className="text-xs text-primary font-medium">
                  + Other / Enter Custom Category...
                </SelectItem>
              </SelectContent>
            </Select>
            {industryCategory === "__custom__" && (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type industry category..."
                className="h-8 text-xs mt-1"
                autoFocus
              />
            )}
          </div>

          {/* Default Cargo Specification */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Default Cargo Specification</Label>
            <Input
              value={defaultCargo}
              onChange={(e) => setDefaultCargo(e.target.value)}
              placeholder="e.g. 40,000 Litres Bulk Petroleum Diesel (AGO) / Wheat Flour Bags"
              className="h-9 text-xs"
            />
            <p className="text-[10.5px] text-muted-foreground">
              Automatically populated when this client is selected during trip creation.
            </p>
          </div>

          {/* Default Payment Terms */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Default Payment Terms</Label>
            <Select value={defaultPaymentTerms} onValueChange={setDefaultPaymentTerms}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select default payment terms" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PAYMENT_TERMS.map((term) => (
                  <SelectItem key={term} value={term} className="text-xs">
                    {term}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" className="text-xs text-primary font-medium">
                  + Custom Payment Terms...
                </SelectItem>
              </SelectContent>
            </Select>
            {defaultPaymentTerms === "__custom__" && (
              <Input
                value={customPaymentTerms}
                onChange={(e) => setCustomPaymentTerms(e.target.value)}
                placeholder="Type custom payment terms..."
                className="h-8 text-xs mt-1"
                autoFocus
              />
            )}
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Contact Phone (Optional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 7XX XXX XXX"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Contact Email (Optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="logistics@client.co.tz"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full sm:w-auto h-9 text-xs gap-1.5 font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
