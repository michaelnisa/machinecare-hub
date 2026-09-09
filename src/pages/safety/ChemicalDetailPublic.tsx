import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Flame,
  Skull,
  ShieldAlert,
  Eye,
  Wind,
  Droplets,
  HeartPulse,
  FileText,
  PhoneCall,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const GHS_MAP: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  flammable: {
    label: "Flammable",
    icon: Flame,
    color: "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    desc: "Catch fire easily around sparks or open flames",
  },
  corrosive: {
    label: "Corrosive",
    icon: Droplets,
    color: "border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    desc: "Severe skin burns & eye damage; corrosive to metals",
  },
  toxic: {
    label: "Acute Toxicity",
    icon: Skull,
    color: "border-red-700 bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200",
    desc: "Fatal or toxic if swallowed, inhaled, or absorbed through skin",
  },
  health_hazard: {
    label: "Health Hazard",
    icon: HeartPulse,
    color: "border-purple-600 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
    desc: "Respiratory sensitizer, carcinogen, or target organ toxin",
  },
  irritant: {
    label: "Harmful / Irritant",
    icon: AlertTriangle,
    color: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    desc: "Skin and eye irritation, dermal sensitization",
  },
  oxidizer: {
    label: "Oxidizer",
    icon: Zap,
    color: "border-yellow-600 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
    desc: "Can cause or intensify fire; oxidizing agent",
  },
  environment: {
    label: "Environmental Hazard",
    icon: ShieldAlert,
    color: "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    desc: "Toxic to aquatic life with long-lasting effects",
  },
  compressed_gas: {
    label: "Compressed Gas",
    icon: Wind,
    color: "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    desc: "Contains gas under pressure; may explode if heated",
  },
};

export const PPE_ITEMS = [
  { id: "splash_goggles", label: "Chemical Splash Goggles", icon: "🥽" },
  { id: "face_shield", label: "Full Face Shield", icon: "🛡️" },
  { id: "nitrile_gloves", label: "Nitrile / Chemical Gloves", icon: "🧤" },
  { id: "respirator", label: "Vapor / Particulate Respirator", icon: "😷" },
  { id: "chemical_apron", label: "Chemical Resistant Apron", icon: "🦺" },
  { id: "rubber_boots", label: "Impervious Safety Boots", icon: "🥾" },
  { id: "ear_protection", label: "Hearing Protection", icon: "🎧" },
];

export default function ChemicalDetailPublic() {
  const { id } = useParams<{ id: string }>();
  const [chemical, setChemical] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChem() {
      if (!id) return;
      try {
        const { data, error } = await (supabase as any)
          .from("safety_chemicals")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        setChemical(data);
      } catch (e) {
        console.error("Failed to load chemical:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchChem();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00A651]" />
      </div>
    );
  }

  if (!chemical) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Substance Not Found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          The chemical registry code or drum QR tag you scanned could not be retrieved. Please report this to the site safety officer immediately.
        </p>
        <Link to="/login" className="mt-6">
          <Button className="bg-[#00A651] hover:bg-[#008f45]">Return to Portal</Button>
        </Link>
      </div>
    );
  }

  const pictograms = Array.isArray(chemical.ghs_pictograms)
    ? chemical.ghs_pictograms
    : typeof chemical.ghs_pictograms === "string"
    ? JSON.parse(chemical.ghs_pictograms || "[]")
    : [];

  const ppeList = Array.isArray(chemical.required_ppe)
    ? chemical.required_ppe
    : typeof chemical.required_ppe === "string"
    ? JSON.parse(chemical.required_ppe || "[]")
    : [];

  const isDanger = chemical.signal_word?.toLowerCase() === "danger";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      {/* Top Emergency Banner */}
      <div
        className={`px-4 py-3 text-white flex items-center justify-between shadow-md ${
          isDanger ? "bg-red-600" : "bg-amber-600"
        }`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 animate-pulse" />
          <div>
            <div className="text-xs uppercase font-bold tracking-wider opacity-90">
              GHS HAZCOM EMERGENCY RESPONSE CARD
            </div>
            <div className="text-lg font-black tracking-wide leading-tight">
              SIGNAL WORD: {chemical.signal_word?.toUpperCase() || "WARNING"}
            </div>
          </div>
        </div>

        {chemical.emergency_phone && (
          <a
            href={`tel:${chemical.emergency_phone}`}
            className="flex items-center gap-1.5 bg-white text-red-700 font-bold px-3 py-1.5 rounded-lg text-xs shadow hover:bg-slate-100 transition-colors"
          >
            <PhoneCall className="h-4 w-4 text-red-600" />
            <span className="hidden sm:inline">Emergency:</span> {chemical.emergency_phone}
          </a>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/safety"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Safety Portal
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground font-mono">
              CAS: {chemical.cas_number || "N/A"}
            </span>
            {chemical.un_number && (
              <span className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 px-2.5 py-1 rounded-md font-mono font-bold">
                UN {chemical.un_number}
              </span>
            )}
          </div>
        </div>

        {/* Chemical Identity Card */}
        <Card className="border-t-4 border-t-[#00A651] shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {chemical.name}
                </CardTitle>
                {chemical.trade_name && (
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    Trade / Common Name: <span className="text-foreground">{chemical.trade_name}</span>
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={`capitalize font-bold px-3 py-1 text-xs border ${
                  isDanger
                    ? "border-red-600 text-red-600 bg-red-50 dark:bg-red-950/30"
                    : "border-amber-600 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                {chemical.container_type || "Drum / Storage"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
              <MapPin className="h-4 w-4 text-[#00A651] shrink-0" />
              <span>
                Designated Storage Location:{" "}
                <strong className="text-foreground">{chemical.storage_location}</strong>
              </span>
            </div>

            {/* GHS Hazard Diamonds */}
            {pictograms.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  GHS Hazard Classifications & Pictograms
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {pictograms.map((key: string) => {
                    const info = GHS_MAP[key] || {
                      label: key,
                      icon: AlertTriangle,
                      color: "border-gray-400 bg-gray-50 text-gray-800",
                      desc: "Hazard substance",
                    };
                    const IconComponent = info.icon;
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border-2 ${info.color} shadow-xs`}
                      >
                        <div className="p-2 rounded-md bg-white dark:bg-slate-900 shadow-xs">
                          <IconComponent className="h-6 w-6 shrink-0" />
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-snug">{info.label}</div>
                          <div className="text-[10px] opacity-80 line-clamp-2 mt-0.5">{info.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {chemical.hazard_statements && (
              <div className="p-3 bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-900 dark:text-red-200 space-y-1">
                <span className="font-bold uppercase tracking-wide">Hazard Statements:</span>
                <p className="leading-relaxed">{chemical.hazard_statements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Action Tabs */}
        <Tabs defaultValue="first-aid" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-slate-200 dark:bg-slate-800 p-1">
            <TabsTrigger value="first-aid" className="text-xs font-bold gap-1">
              <Eye className="h-3.5 w-3.5" /> First Aid
            </TabsTrigger>
            <TabsTrigger value="spill" className="text-xs font-bold gap-1">
              <Droplets className="h-3.5 w-3.5" /> Spill Response
            </TabsTrigger>
            <TabsTrigger value="ppe" className="text-xs font-bold gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Mandatory PPE
            </TabsTrigger>
            <TabsTrigger value="sds" className="text-xs font-bold gap-1">
              <FileText className="h-3.5 w-3.5" /> SDS / Specs
            </TabsTrigger>
          </TabsList>

          {/* First Aid Measures */}
          <TabsContent value="first-aid" className="mt-4 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-red-600">
                  <HeartPulse className="h-5 w-5" /> Emergency First Aid Procedures (OSHA 1910.1200)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {/* Eyes */}
                <div className="border border-border p-3.5 rounded-lg bg-card space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Eye className="h-4 w-4 text-blue-600" /> Eye Contact
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chemical.first_aid_eyes ||
                      "Flush immediately with copious amounts of water for at least 15 minutes, holding eyelids open. Remove contact lenses if present and easy to do. Seek urgent medical attention."}
                  </p>
                </div>

                {/* Skin */}
                <div className="border border-border p-3.5 rounded-lg bg-card space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Droplets className="h-4 w-4 text-amber-600" /> Skin Contact
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chemical.first_aid_skin ||
                      "Immediately remove contaminated clothing. Wash affected skin thoroughly with soap and copious water for at least 15 minutes. If irritation or burns develop, seek medical advice."}
                  </p>
                </div>

                {/* Inhalation */}
                <div className="border border-border p-3.5 rounded-lg bg-card space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Wind className="h-4 w-4 text-emerald-600" /> Inhalation (Breathing)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chemical.first_aid_inhalation ||
                      "Move exposed person to fresh air immediately. Keep warm and at rest in a position comfortable for breathing. If not breathing, administer artificial respiration and call paramedics."}
                  </p>
                </div>

                {/* Ingestion */}
                <div className="border border-border p-3.5 rounded-lg bg-card space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4 text-red-600" /> Ingestion (Swallowing)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chemical.first_aid_ingestion ||
                      "Rinse mouth thoroughly with fresh water. DO NOT induce vomiting unless directed to do so by medical personnel. Never give anything by mouth to an unconscious person. Call Poison Control."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spill & Fire Response */}
          <TabsContent value="spill" className="mt-4 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
                  <Droplets className="h-5 w-5" /> Chemical Spill & Leak Containment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3.5 rounded-lg text-xs space-y-2">
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    Spill Response & Neutralization Protocol:
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {chemical.spill_response_procedure ||
                      "1. Evacuate immediate area. Eliminate all ignition sources.\n2. Don full required chemical PPE before approaching.\n3. Stop leak if safe to do so. Contain spill using chemical spill kit absorbent pillows or vermiculite.\n4. Do not allow chemical to enter drains, sewers, or waterways.\n5. Transfer contaminated absorbent into sealed, labeled hazardous waste drums for licensed disposal."}
                  </p>
                </div>

                {chemical.fire_fighting_measures && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3.5 rounded-lg text-xs space-y-2">
                    <div className="font-bold text-red-900 dark:text-red-200 flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-red-600" /> Fire Fighting Measures:
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {chemical.fire_fighting_measures}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mandatory PPE */}
          <TabsContent value="ppe" className="mt-4 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-[#00A651]">
                  <ShieldAlert className="h-5 w-5" /> Mandatory Personal Protective Equipment (PPE)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PPE_ITEMS.map((item) => {
                    const isRequired = ppeList.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                          isRequired
                            ? "border-[#00A651] bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                            : "border-border bg-card/40 opacity-40 text-muted-foreground"
                        }`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <div className="text-xs">
                          <div>{item.label}</div>
                          <div className="text-[10px] mt-0.5">
                            {isRequired ? "REQUIRED" : "Optional / As needed"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SDS Documents */}
          <TabsContent value="sds" className="mt-4 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" /> Safety Data Sheet (SDS) & Technical Specs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  The complete 16-section Safety Data Sheet compliant with OSHA HazCom 2012 / GHS Revision 7 is stored on the MachineCare safety repository.
                </p>

                {chemical.sds_document_url ? (
                  <div className="flex items-center justify-between p-3.5 border border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="text-xs font-bold text-foreground">Official Safety Data Sheet (SDS)</div>
                        <div className="text-[10px] text-muted-foreground">PDF Document • 16 Sections</div>
                      </div>
                    </div>
                    <a
                      href={chemical.sds_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold px-3 py-1.5 rounded shadow"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open SDS
                    </a>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground text-center">
                    No external SDS PDF URL attached to this entry. Contact your EHS officer for physical binder copies.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center pt-6 text-xs text-muted-foreground space-y-1">
          <div>MachineCare Hub Safety System • ISO 45001 & OSHA 1910.1200 HazCom</div>
          <div>Authorized Emergency Access Terminal • Confidential Safety Registry</div>
        </div>
      </div>
    </div>
  );
}
