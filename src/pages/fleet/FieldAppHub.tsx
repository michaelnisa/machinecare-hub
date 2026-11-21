import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smartphone,
  Truck,
  Wrench,
  Navigation,
  Radio,
  QrCode,
  CheckCircle2,
  Copy,
  Download,
  Terminal,
  ShieldCheck,
  Zap,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function FieldAppHub() {
  const { organisation, user } = useAuth();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const supabaseUrl = "https://hvihfqlzwblsytdvkanz.supabase.co";
  const orgName = organisation?.name || "Logistixware Logistics Limited";
  const orgId = organisation?.id || "df6b0c4b-e56b-4694-838a-0381eb480043";

  // URL pointing to Expo Go or Mobile App pairing
  const pairingPayload = JSON.stringify({
    supabaseUrl,
    orgId,
    orgName,
    server: "track.machinecare.co.tz",
  });

  const copyToClipboard = (text: string, type: "url" | "code") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 md:p-8 text-white shadow-xl border border-emerald-900/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Live Cloud Sync · Supabase Connected
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700">
                React Native & Expo 52
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-emerald-400" />
              MachineCare Field Companion App
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm leading-relaxed">
              Standalone field mobile application purpose-built for commercial truck drivers, workshop mechanics,
              highway dispatchers, and GPS telematics field technicians. Operates offline in remote corridors with automatic cloud sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={() => copyToClipboard("cd mobile && npm install && npm start", "code")}
            >
              <Terminal className="w-4 h-4 mr-2 text-emerald-400" />
              {copiedCode ? "Command Copied!" : "Copy Start Command"}
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Multi-Persona Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Driver */}
        <Card className="border-emerald-500/30 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
              <Truck className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold text-white">Commercial Driver</CardTitle>
            <CardDescription className="text-xs text-slate-400">Dereva wa Safari & Malori</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>1-Tap QR truck coupling & linked trailer pairing</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>60s walkaround safety inspection checklist</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Safari Float road receipt snapper (TZS)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Emergency SOS breakdown beacon with GPS coordinates</span>
            </div>
          </CardContent>
        </Card>

        {/* Garage */}
        <Card className="border-blue-500/30 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
              <Wrench className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold text-white">Garage & Workshop</CardTitle>
            <CardDescription className="text-xs text-slate-400">Fundi Karakana & Matengenezo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Filterable digital Job Cards (Open / In Progress / Waiting Parts)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Step-by-step repair checklist & spare parts requisition</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Windshield QR scan to inspect service & defect history</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Rapid mechanical defect intake with severity levels</span>
            </div>
          </CardContent>
        </Card>

        {/* Dispatch */}
        <Card className="border-purple-500/30 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2">
              <Navigation className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold text-white">Logistics Dispatcher</CardTitle>
            <CardDescription className="text-xs text-slate-400">Msimamizi wa Safari & Magari</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Real-time GPS fleet list (Moving, Idle, Stopped, Off)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Highway corridor monitoring (Dar ➔ Kigali, Mombasa ➔ Kampala)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Quick fuel log entry (litres, station, and TZS cost)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Instant trip milestone tracking & remote trip closure</span>
            </div>
          </CardContent>
        </Card>

        {/* Telematics */}
        <Card className="border-amber-500/30 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2">
              <Radio className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold text-white">GPS Telematics Tech</CardTitle>
            <CardDescription className="text-xs text-slate-400">Fundi wa Ufungaji GPS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Scan tracker IMEI barcode & bind to truck plate in 5s</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Live satellite navigation fix (14 Satellites, 3D Fix, HDOP)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>ACC ignition wire splice test (Live ON/OFF dashboard response)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Main 24V battery check & remote fuel relay cut simulation</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment & Field Pairing Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Pairing Code */}
        <Card className="lg:col-span-1 border-slate-800 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-400" />
              Field Pairing QR Code
            </CardTitle>
            <CardDescription className="text-xs">
              Scan with your mobile device or Expo Go to run the companion app.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-white rounded-xl shadow-inner border border-slate-300">
              <QRCodeSVG
                value={pairingPayload}
                size={180}
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-white uppercase tracking-wider">{orgName}</p>
              <p className="text-[11px] text-slate-400 font-mono">Org ID: {orgId.slice(0, 18)}...</p>
            </div>
          </CardContent>
        </Card>

        {/* Live Technical Integration Details */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Seamless Web & Mobile Parity
            </CardTitle>
            <CardDescription className="text-xs">
              The mobile application connects directly to the same database backend without intermediary proxies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Backend Supabase Endpoint</span>
                <span className="font-mono text-emerald-400 font-medium break-all">{supabaseUrl}</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Active Connected Organisation</span>
                <span className="font-semibold text-white">{orgName}</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Offline Storage Engine</span>
                <span className="text-slate-200">AsyncStorage + Background Sync Queue</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Hardware Tracker Protocols</span>
                <span className="text-slate-200">Teltonika FMB920, Concox GT06, Coban, Jimi</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Terminal Setup & Local Execution
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                  onClick={() => copyToClipboard("cd mobile\nnpm install\nnpm start", "code")}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy Script
                </Button>
              </div>
              <pre className="text-xs text-emerald-300/90 font-mono bg-black/40 p-3 rounded-lg overflow-x-auto">
{`# 1. Switch to mobile app folder
cd mobile

# 2. Start Expo developer server
npm start

# 3. Build standalone Android APK
eas build -p android --profile preview`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
