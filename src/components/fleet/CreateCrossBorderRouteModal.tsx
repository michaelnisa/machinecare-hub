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
import {
  CrossBorderCorridor,
  CorridorExpenseItem,
  saveCustomCorridor,
  DEFAULT_USD_TO_TZS_RATE,
  convertUsdToTzs,
  daysAndHoursToHours,
} from "@/services/crossBorderCorridors";
import { Plus, Trash2, Route, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorridorCreated?: (corridor: CrossBorderCorridor) => void;
}

const TRANSIT_COUNTRIES = [
  "Tanzania",
  "Zambia",
  "Zimbabwe",
  "Botswana",
  "South Africa",
  "DRC",
  "Kenya",
  "Uganda",
  "Rwanda",
  "Burundi",
  "Malawi",
  "Mozambique",
  "Namibia",
];

export function CreateCrossBorderRouteModal({
  open,
  onOpenChange,
  onCorridorCreated,
}: Props) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Tanzania ➔ Zambia");
  const [borderPost, setBorderPost] = useState("Tunduma / Nakonde Border Post");
  const [defaultOrigin, setDefaultOrigin] = useState("Dar es Salaam Port");
  const [defaultDestination, setDefaultDestination] = useState("Lusaka / Kitwe");
  const [estDays, setEstDays] = useState<number | string>(7);
  const [estHours, setEstHours] = useState<number | string>(0);
  const [description, setDescription] = useState("");

  const [expenses, setExpenses] = useState<CorridorExpenseItem[]>([
    {
      id: "exp_1",
      title: "Tanzania Heavy Vehicle Highway Transit Toll",
      category: "toll",
      defaultAmountUsd: 30,
      defaultAmountTzs: 78000,
      localCurrency: "TZS",
      defaultAmountLocal: 78000,
      isRequired: true,
      countryStage: "Tanzania",
      notes: "Heavy commercial highway road maintenance",
    },
    {
      id: "exp_2",
      title: "Zambia Road User Transit Toll (RDA)",
      category: "toll",
      defaultAmountUsd: 50,
      defaultAmountTzs: 130000,
      localCurrency: "ZMW",
      defaultAmountLocal: 1375,
      isRequired: true,
      countryStage: "Zambia",
      notes: "Road Development Agency heavy vehicle transit access",
    },
  ]);

  const [saving, setSaving] = useState(false);

  const handleAddExpense = () => {
    const newId = `exp_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setExpenses((prev) => [
      ...prev,
      {
        id: newId,
        title: "Cross-Border Transit Fee / Toll",
        category: "toll",
        defaultAmountUsd: 25,
        defaultAmountTzs: 65000,
        localCurrency: "USD",
        defaultAmountLocal: 25,
        isRequired: true,
        countryStage: "Tanzania",
        notes: "",
      },
    ]);
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleExpenseChange = (id: string, field: keyof CorridorExpenseItem, value: any) => {
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const updated = { ...e, [field]: value };
        if (field === "defaultAmountUsd") {
          const usdNum = Number(value) || 0;
          updated.defaultAmountTzs = convertUsdToTzs(usdNum);
        }
        return updated;
      })
    );
  };

  const resetForm = () => {
    setName("");
    setCountry("Tanzania ➔ Zambia");
    setBorderPost("Tunduma / Nakonde Border Post");
    setDefaultOrigin("Dar es Salaam Port");
    setDefaultDestination("Lusaka / Kitwe");
    setEstDays(7);
    setEstHours(0);
    setDescription("");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Please enter a route / corridor name");
      return;
    }

    setSaving(true);
    try {
      const totalHours = daysAndHoursToHours(estDays, estHours) || 168;
      const corridorId = `corridor_custom_${Date.now()}`;

      const newCorridor: CrossBorderCorridor = {
        id: corridorId,
        name: cleanName,
        country: country.trim() || "Regional Cross-Border",
        countryCode: "CUSTOM-TRANSIT",
        flag: "🌍",
        borderPost: borderPost.trim() || "Cross-Border Post",
        defaultOrigin: defaultOrigin.trim() || "Dar es Salaam Port",
        defaultDestination: defaultDestination.trim() || "Destination",
        estimatedRoundtripHours: totalHours,
        description:
          description.trim() ||
          `Custom statutory heavy commercial cross-border route via ${borderPost}.`,
        expenses: expenses.map((exp, index) => ({
          ...exp,
          id: `${corridorId}_exp_${index + 1}`,
          title: exp.title.trim() || `Transit Fee ${index + 1}`,
          defaultAmountUsd: Number(exp.defaultAmountUsd) || 0,
          defaultAmountTzs:
            Number(exp.defaultAmountTzs) ||
            convertUsdToTzs(Number(exp.defaultAmountUsd) || 0),
        })),
      };

      saveCustomCorridor(newCorridor);
      toast.success(`Cross-border route "${newCorridor.name}" created successfully`);
      onCorridorCreated?.(newCorridor);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create cross-border route");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Create Cross-Border Route & Fee Corridor
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure a custom international or transit route with its designated border posts and automated statutory road user fees.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Route Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Route / Corridor Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dar es Salaam to Lubumbashi via Tunduma & Kasumbalesa (DRC)"
              className="h-9 text-xs sm:text-sm font-semibold"
              autoFocus
              required
            />
          </div>

          {/* Transit Countries & Border Post */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Transit Countries / Stages</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Tanzania ➔ Zambia ➔ DRC"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Designated Border Posts</Label>
              <Input
                value={borderPost}
                onChange={(e) => setBorderPost(e.target.value)}
                placeholder="e.g. Tunduma/Nakonde ➔ Kasumbalesa"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Origin Loading Point</Label>
              <Input
                value={defaultOrigin}
                onChange={(e) => setDefaultOrigin(e.target.value)}
                placeholder="e.g. Dar es Salaam Port / Kurasini Depot"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Destination Offload Point</Label>
              <Input
                value={defaultDestination}
                onChange={(e) => setDefaultDestination(e.target.value)}
                placeholder="e.g. Lubumbashi Mining Terminal"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Estimated Turnaround Time */}
          <div className="space-y-1.5 rounded-lg border border-border p-3 bg-muted/20">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Estimated Turnaround Duration (Roundtrip)
            </Label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Days:</span>
                <Input
                  type="number"
                  min={0}
                  value={estDays}
                  onChange={(e) => setEstDays(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Hours:</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={estHours}
                  onChange={(e) => setEstHours(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              Used to forecast vehicle return and driver safari allowance reconciliation.
            </p>
          </div>

          {/* Statutory Expenses & Transit Fees */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Statutory Transit Expenses & Road User Fees ({expenses.length})
                </Label>
                <p className="text-[10.5px] text-muted-foreground">
                  These fees will automatically populate when this route is selected for a trip.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddExpense}
                className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" />
                Add Fee
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {expenses.map((exp, idx) => (
                <div
                  key={exp.id}
                  className="rounded-lg border border-border p-2.5 bg-card space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-primary text-[11px]">
                      Fee #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExpense(exp.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                      title="Remove Fee"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10.5px] text-muted-foreground">Fee Description</Label>
                      <Input
                        value={exp.title}
                        onChange={(e) => handleExpenseChange(exp.id, "title", e.target.value)}
                        placeholder="e.g. Weighbridge Clearance / Carbon Tax"
                        className="h-8 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10.5px] text-muted-foreground">Transit Country Stage</Label>
                      <Select
                        value={exp.countryStage || "Tanzania"}
                        onValueChange={(val) => handleExpenseChange(exp.id, "countryStage", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSIT_COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                    <div className="space-y-1">
                      <Label className="text-[10.5px] text-muted-foreground">Amount (USD $)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={exp.defaultAmountUsd}
                        onChange={(e) => handleExpenseChange(exp.id, "defaultAmountUsd", e.target.value)}
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10.5px] text-muted-foreground">Est. TZS (≈)</Label>
                      <div className="h-8 flex items-center px-2 text-xs font-mono font-bold bg-muted/30 rounded border border-input">
                        {Number(exp.defaultAmountTzs || 0).toLocaleString()} TZS
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-1 col-span-2">
                      <Label className="text-[10.5px] text-muted-foreground">Category</Label>
                      <Select
                        value={exp.category}
                        onValueChange={(val) => handleExpenseChange(exp.id, "category", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="toll" className="text-xs">Road Toll / Bridge Fee</SelectItem>
                          <SelectItem value="receipt" className="text-xs">Customs / Border Clearance</SelectItem>
                          <SelectItem value="fuel" className="text-xs">Transit Fuel Refill</SelectItem>
                          <SelectItem value="parking" className="text-xs">Secure Border Parking</SelectItem>
                          <SelectItem value="repair" className="text-xs">En-Route Maintenance</SelectItem>
                          <SelectItem value="other" className="text-xs">Driver Allowance / Per Diem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
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
              Save Cross-Border Route
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
