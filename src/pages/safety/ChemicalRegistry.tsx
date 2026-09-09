import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldAlert,
  Plus,
  Search,
  Printer,
  QrCode,
  ExternalLink,
  Flame,
  Droplets,
  Skull,
  AlertTriangle,
  Edit2,
  Trash2,
  MapPin,
  FileText,
  Filter,
  CheckCircle2,
  PhoneCall,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ChemicalDrumQrModal } from "@/components/safety/ChemicalDrumQrModal";
import { GHS_MAP, PPE_ITEMS } from "@/pages/safety/ChemicalDetailPublic";

export default function ChemicalRegistry() {
  const { profile } = useAuth();
  const orgId = profile?.organisation_id;

  const [chemicals, setChemicals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const [selectedChemicalForQr, setSelectedChemicalForQr] = useState<any>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Add / Edit Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialForm = {
    name: "",
    trade_name: "",
    cas_number: "",
    un_number: "",
    storage_location: "",
    container_type: "drum",
    signal_word: "Warning",
    ghs_pictograms: [] as string[],
    hazard_statements: "",
    precautionary_statements: "",
    first_aid_inhalation: "",
    first_aid_skin: "",
    first_aid_eyes: "",
    first_aid_ingestion: "",
    spill_response_procedure: "",
    fire_fighting_measures: "",
    required_ppe: [] as string[],
    sds_document_url: "",
    emergency_phone: profile?.safety_emergency_phone || "",
    max_storage_quantity: 200,
    current_quantity: 50,
    unit: "Liters",
  };

  const [formData, setFormData] = useState(initialForm);

  const loadChemicals = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("safety_chemicals")
        .select("*")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChemicals(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load chemical registry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChemicals();
  }, [orgId]);

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData(initialForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
    setEditingId(item.id);
    const pictograms = Array.isArray(item.ghs_pictograms)
      ? item.ghs_pictograms
      : typeof item.ghs_pictograms === "string"
      ? JSON.parse(item.ghs_pictograms || "[]")
      : [];
    const ppe = Array.isArray(item.required_ppe)
      ? item.required_ppe
      : typeof item.required_ppe === "string"
      ? JSON.parse(item.required_ppe || "[]")
      : [];

    setFormData({
      name: item.name || "",
      trade_name: item.trade_name || "",
      cas_number: item.cas_number || "",
      un_number: item.un_number || "",
      storage_location: item.storage_location || "",
      container_type: item.container_type || "drum",
      signal_word: item.signal_word || "Warning",
      ghs_pictograms: pictograms,
      hazard_statements: item.hazard_statements || "",
      precautionary_statements: item.precautionary_statements || "",
      first_aid_inhalation: item.first_aid_inhalation || "",
      first_aid_skin: item.first_aid_skin || "",
      first_aid_eyes: item.first_aid_eyes || "",
      first_aid_ingestion: item.first_aid_ingestion || "",
      spill_response_procedure: item.spill_response_procedure || "",
      fire_fighting_measures: item.fire_fighting_measures || "",
      required_ppe: ppe,
      sds_document_url: item.sds_document_url || "",
      emergency_phone: item.emergency_phone || "",
      max_storage_quantity: item.max_storage_quantity || 0,
      current_quantity: item.current_quantity || 0,
      unit: item.unit || "Liters",
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.storage_location.trim()) {
      toast.error("Please provide a chemical name and storage location");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        organisation_id: orgId,
        name: formData.name.trim(),
        trade_name: formData.trade_name.trim() || null,
        cas_number: formData.cas_number.trim() || null,
        un_number: formData.un_number.trim() || null,
        storage_location: formData.storage_location.trim(),
        container_type: formData.container_type,
        signal_word: formData.signal_word,
        ghs_pictograms: formData.ghs_pictograms,
        hazard_statements: formData.hazard_statements.trim() || null,
        precautionary_statements: formData.precautionary_statements.trim() || null,
        first_aid_inhalation: formData.first_aid_inhalation.trim() || null,
        first_aid_skin: formData.first_aid_skin.trim() || null,
        first_aid_eyes: formData.first_aid_eyes.trim() || null,
        first_aid_ingestion: formData.first_aid_ingestion.trim() || null,
        spill_response_procedure: formData.spill_response_procedure.trim() || null,
        fire_fighting_measures: formData.fire_fighting_measures.trim() || null,
        required_ppe: formData.required_ppe,
        sds_document_url: formData.sds_document_url.trim() || null,
        emergency_phone: formData.emergency_phone.trim() || null,
        max_storage_quantity: Number(formData.max_storage_quantity) || 0,
        current_quantity: Number(formData.current_quantity) || 0,
        unit: formData.unit,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from("safety_chemicals")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Substance details updated");
      } else {
        payload.created_by = profile?.id;
        const { error } = await (supabase as any).from("safety_chemicals").insert(payload);
        if (error) throw error;
        toast.success("Hazardous chemical registered successfully");
      }

      setDialogOpen(false);
      loadChemicals();
    } catch (err: any) {
      toast.error(err.message || "Failed to save chemical");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the chemical registry?`)) return;
    try {
      const { error } = await (supabase as any).from("safety_chemicals").delete().eq("id", id);
      if (error) throw error;
      toast.success("Substance removed from registry");
      setChemicals((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete substance");
    }
  };

  const togglePictogram = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      ghs_pictograms: prev.ghs_pictograms.includes(key)
        ? prev.ghs_pictograms.filter((k) => k !== key)
        : [...prev.ghs_pictograms, key],
    }));
  };

  const togglePPE = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      required_ppe: prev.required_ppe.includes(id)
        ? prev.required_ppe.filter((k) => k !== id)
        : [...prev.required_ppe, id],
    }));
  };

  // Filter & Search
  const filteredChemicals = chemicals.filter((chem) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      chem.name?.toLowerCase().includes(query) ||
      chem.trade_name?.toLowerCase().includes(query) ||
      chem.cas_number?.toLowerCase().includes(query) ||
      chem.un_number?.toLowerCase().includes(query) ||
      chem.storage_location?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filterType === "danger") return chem.signal_word?.toLowerCase() === "danger";
    if (filterType === "flammable") {
      const pics = Array.isArray(chem.ghs_pictograms) ? chem.ghs_pictograms : [];
      return pics.includes("flammable");
    }
    if (filterType === "corrosive") {
      const pics = Array.isArray(chem.ghs_pictograms) ? chem.ghs_pictograms : [];
      return pics.includes("corrosive");
    }
    return true;
  });

  const dangerCount = chemicals.filter((c) => c.signal_word?.toLowerCase() === "danger").length;
  const flammableCount = chemicals.filter((c) => {
    const p = Array.isArray(c.ghs_pictograms) ? c.ghs_pictograms : [];
    return p.includes("flammable");
  }).length;
  const corrosiveCount = chemicals.filter((c) => {
    const p = Array.isArray(c.ghs_pictograms) ? c.ghs_pictograms : [];
    return p.includes("corrosive");
  }).length;

  if (loading && chemicals.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Chemical Storage & Drum QR Registry</h1>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-[#00A651] border-[#00A651]/30">
              OSHA 1910.1200 / GHS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage hazardous substances, generate scannable drum QR codes, and provide instant first-aid access for technicians.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/safety">
            <Button variant="outline" className="text-xs">
              Safety Dashboard
            </Button>
          </Link>
          <Button
            onClick={openCreateDialog}
            className="gap-1.5 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold"
          >
            <Plus className="h-4 w-4" /> Register Chemical Substance
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-medium text-muted-foreground">Total Substances</div>
              <div className="text-2xl font-bold mt-1">{chemicals.length}</div>
            </div>
            <div className="p-2.5 rounded-full bg-emerald-50 text-[#00A651]">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-medium text-muted-foreground">Signal: DANGER</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{dangerCount}</div>
            </div>
            <div className="p-2.5 rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-medium text-muted-foreground">Flammables</div>
              <div className="text-2xl font-bold mt-1 text-amber-600">{flammableCount}</div>
            </div>
            <div className="p-2.5 rounded-full bg-amber-50 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-medium text-muted-foreground">Corrosives</div>
              <div className="text-2xl font-bold mt-1 text-purple-600">{corrosiveCount}</div>
            </div>
            <div className="p-2.5 rounded-full bg-purple-50 text-purple-600">
              <Droplets className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chemical name, trade name, CAS#, UN#, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[180px] text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Hazards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Substances</SelectItem>
              <SelectItem value="danger">Signal Word: Danger</SelectItem>
              <SelectItem value="flammable">Flammables</SelectItem>
              <SelectItem value="corrosive">Corrosives</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chemicals Table */}
      {filteredChemicals.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8 text-muted-foreground" />}
          title="No hazardous substances found"
          description={
            searchTerm
              ? "No chemicals match your search query."
              : "Register your facility's chemicals, lubricants, and solvents to generate drum QR labels and enable emergency SDS access."
          }
          action={
            <Button
              onClick={openCreateDialog}
              className="mt-4 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add First Chemical
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3 font-semibold">Substance / Chemical</th>
                <th className="px-5 py-3 font-semibold">CAS & UN</th>
                <th className="px-5 py-3 font-semibold">Storage Location</th>
                <th className="px-5 py-3 font-semibold">Signal Word & GHS</th>
                <th className="px-5 py-3 font-semibold">Inventory Level</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredChemicals.map((chem) => {
                const pictograms = Array.isArray(chem.ghs_pictograms)
                  ? chem.ghs_pictograms
                  : typeof chem.ghs_pictograms === "string"
                  ? JSON.parse(chem.ghs_pictograms || "[]")
                  : [];

                const isDanger = chem.signal_word?.toLowerCase() === "danger";

                return (
                  <tr key={chem.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name & Trade Name */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{chem.name}</div>
                      {chem.trade_name && (
                        <div className="text-xs text-muted-foreground">{chem.trade_name}</div>
                      )}
                      <span className="inline-block mt-1 text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {chem.container_type || "Drum"}
                      </span>
                    </td>

                    {/* CAS & UN */}
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                      <div>CAS: {chem.cas_number || "—"}</div>
                      {chem.un_number && (
                        <div className="text-amber-700 dark:text-amber-300 font-bold">
                          UN {chem.un_number}
                        </div>
                      )}
                    </td>

                    {/* Storage Location */}
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-[#00A651] shrink-0" />
                        {chem.storage_location}
                      </div>
                    </td>

                    {/* Signal Word & GHS */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            isDanger
                              ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300"
                              : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {chem.signal_word || "Warning"}
                        </Badge>
                        {pictograms.slice(0, 3).map((p: string) => (
                          <span
                            key={p}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                          >
                            {GHS_MAP[p]?.label || p}
                          </span>
                        ))}
                        {pictograms.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            +{pictograms.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Inventory */}
                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-foreground">
                        {chem.current_quantity || 0} / {chem.max_storage_quantity || "∞"} {chem.unit}
                      </div>
                      <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-[#00A651] h-full"
                          style={{
                            width: `${Math.min(
                              100,
                              ((chem.current_quantity || 0) /
                                (chem.max_storage_quantity || 100)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedChemicalForQr(chem);
                            setQrModalOpen(true);
                          }}
                          className="h-8 gap-1 border-emerald-600/40 text-[#00A651] hover:bg-emerald-50 text-xs font-bold"
                          title="Generate & Print Drum QR Label"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Drum QR
                        </Button>

                        <Link to={`/safety/chemical/${chem.id}`} target="_blank">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Open Mobile Emergency Card"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </Link>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(chem)}
                          className="h-8 w-8 p-0"
                          title="Edit Substance"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(chem.id, chem.name)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete Substance"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drum QR & Print Modal */}
      <ChemicalDrumQrModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        chemical={selectedChemicalForQr}
      />

      {/* Add / Edit Substance Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ShieldAlert className="h-5 w-5 text-[#00A651]" />
              {editingId ? "Edit Hazardous Substance" : "Register Chemical & Hazardous Substance"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Identity Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Chemical / Substance Name *</Label>
                <Input
                  required
                  placeholder="e.g. Isopropyl Alcohol 99%, Caustic Soda"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Trade / Common Name</Label>
                <Input
                  placeholder="e.g. Degreaser Ultra, Coolant X-40"
                  value={formData.trade_name}
                  onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">CAS Registry Number</Label>
                <Input
                  placeholder="e.g. 67-63-0"
                  value={formData.cas_number}
                  onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                  className="text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">UN Hazardous Material Number</Label>
                <Input
                  placeholder="e.g. 1219"
                  value={formData.un_number}
                  onChange={(e) => setFormData({ ...formData, un_number: e.target.value })}
                  className="text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Storage Location *</Label>
                <Input
                  required
                  placeholder="e.g. Flammable Cabinet 2 - Bay B"
                  value={formData.storage_location}
                  onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Container Type</Label>
                  <Select
                    value={formData.container_type}
                    onValueChange={(val) => setFormData({ ...formData, container_type: val })}
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drum">Steel / Plastic Drum</SelectItem>
                      <SelectItem value="carboy">Carboy / Jug</SelectItem>
                      <SelectItem value="ibc">IBC Tote (1000L)</SelectItem>
                      <SelectItem value="cylinder">Gas Cylinder</SelectItem>
                      <SelectItem value="bottle">Safety Bottle</SelectItem>
                      <SelectItem value="cabinet">Storage Cabinet</SelectItem>
                      <SelectItem value="bulk_tank">Bulk Tank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Signal Word</Label>
                  <Select
                    value={formData.signal_word}
                    onValueChange={(val) => setFormData({ ...formData, signal_word: val })}
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Danger">DANGER (Severe)</SelectItem>
                      <SelectItem value="Warning">WARNING (Moderate)</SelectItem>
                      <SelectItem value="None">None (Low risk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* GHS Pictograms Selection */}
            <div className="space-y-2 border-t border-border pt-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                GHS Hazard Diamonds (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(GHS_MAP).map(([key, info]) => {
                  const selected = formData.ghs_pictograms.includes(key);
                  const Icon = info.icon;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => togglePictogram(key)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                        selected
                          ? "border-red-600 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 font-bold"
                          : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-red-600" />
                      <span className="truncate">{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hazards & Precautionary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <Label className="text-xs">Hazard Statements (H-Codes)</Label>
                <Textarea
                  placeholder="e.g. H225: Highly flammable liquid and vapor. H319: Causes serious eye irritation."
                  value={formData.hazard_statements}
                  onChange={(e) => setFormData({ ...formData, hazard_statements: e.target.value })}
                  className="text-xs mt-1 h-16"
                />
              </div>

              <div>
                <Label className="text-xs">Precautionary Statements (P-Codes)</Label>
                <Textarea
                  placeholder="e.g. P210: Keep away from heat, hot surfaces, sparks, open flames. P280: Wear protective gloves/clothing."
                  value={formData.precautionary_statements}
                  onChange={(e) =>
                    setFormData({ ...formData, precautionary_statements: e.target.value })
                  }
                  className="text-xs mt-1 h-16"
                />
              </div>
            </div>

            {/* First Aid Measures */}
            <div className="border-t border-border pt-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                First Aid Measures (Rapid Emergency Display)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Eye Contact Flush Procedure</Label>
                  <Input
                    placeholder="Flush eyes immediately for 15 minutes..."
                    value={formData.first_aid_eyes}
                    onChange={(e) => setFormData({ ...formData, first_aid_eyes: e.target.value })}
                    className="text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Skin Contact & Wash</Label>
                  <Input
                    placeholder="Remove contaminated clothes, wash with soap..."
                    value={formData.first_aid_skin}
                    onChange={(e) => setFormData({ ...formData, first_aid_skin: e.target.value })}
                    className="text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Inhalation / Airway</Label>
                  <Input
                    placeholder="Move person to fresh air, give oxygen if needed..."
                    value={formData.first_aid_inhalation}
                    onChange={(e) =>
                      setFormData({ ...formData, first_aid_inhalation: e.target.value })
                    }
                    className="text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Ingestion Procedure</Label>
                  <Input
                    placeholder="Do not induce vomiting, rinse mouth, call poison control..."
                    value={formData.first_aid_ingestion}
                    onChange={(e) =>
                      setFormData({ ...formData, first_aid_ingestion: e.target.value })
                    }
                    className="text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Spill & Fire Protocol */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <Label className="text-xs">Spill Response Protocol</Label>
                <Textarea
                  placeholder="Contain spill with vermiculite absorbent pillows, seal in waste drums..."
                  value={formData.spill_response_procedure}
                  onChange={(e) =>
                    setFormData({ ...formData, spill_response_procedure: e.target.value })
                  }
                  className="text-xs mt-1 h-16"
                />
              </div>

              <div>
                <Label className="text-xs">Fire Fighting Media & Restrictions</Label>
                <Textarea
                  placeholder="Use CO2, dry chemical powder, alcohol-resistant foam. Do NOT use direct water jet."
                  value={formData.fire_fighting_measures}
                  onChange={(e) =>
                    setFormData({ ...formData, fire_fighting_measures: e.target.value })
                  }
                  className="text-xs mt-1 h-16"
                />
              </div>
            </div>

            {/* Mandatory PPE */}
            <div className="border-t border-border pt-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Mandatory PPE Checklist
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PPE_ITEMS.map((item) => {
                  const active = formData.required_ppe.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => togglePPE(item.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                        active
                          ? "border-[#00A651] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold"
                          : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SDS Document & Emergency Hotline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Official SDS PDF Document URL</Label>
                <Input
                  placeholder="https://... /sds/substance-data-sheet.pdf"
                  value={formData.sds_document_url}
                  onChange={(e) => setFormData({ ...formData, sds_document_url: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Emergency Phone</Label>
                <Input
                  placeholder="+1 (555) 911-0000"
                  value={formData.emergency_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            {/* Stock Quantities */}
            <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
              <div>
                <Label className="text-xs">Current Quantity</Label>
                <Input
                  type="number"
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({ ...formData, current_quantity: Number(e.target.value) })}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Max Permitted Storage</Label>
                <Input
                  type="number"
                  value={formData.max_storage_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, max_storage_quantity: Number(e.target.value) })
                  }
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold"
              >
                {saving ? "Saving..." : editingId ? "Update Substance" : "Register Substance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
