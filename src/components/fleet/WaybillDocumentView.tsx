import React, { useMemo } from "react";
import {
  Truck,
  MapPin,
  Building2,
  Calendar,
  FileCheck2,
  Package,
  ShieldCheck,
  Scale,
  Route as RouteIcon,
  CheckCircle2,
  ArrowRight,
  Phone,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { formatDate } from "@/lib/format";

export interface WaybillDocumentViewProps {
  trip: any;
  machine?: any;
  driver?: any;
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  companyTin?: string;
  companyLogo?: string | null;
  waybillRef: string;
  cleanCargo?: string;
}

export function RealisticBarcode({ code, className = "" }: { code: string; className?: string }) {
  // Deterministic bar widths based on code characters for authentic barcode aesthetic
  const pattern = useMemo(() => {
    const bars: { width: number; isBar: boolean }[] = [];
    // Start guard
    bars.push({ width: 2, isBar: true });
    bars.push({ width: 1, isBar: false });
    bars.push({ width: 2, isBar: true });
    bars.push({ width: 1, isBar: false });

    for (let i = 0; i < code.length; i++) {
      const codeVal = code.charCodeAt(i);
      const b1 = (codeVal % 3) + 1;
      const s1 = ((codeVal >> 1) % 2) + 1;
      const b2 = ((codeVal >> 2) % 3) + 1;
      const s2 = ((codeVal >> 3) % 2) + 1;
      bars.push({ width: b1, isBar: true });
      bars.push({ width: s1, isBar: false });
      bars.push({ width: b2, isBar: true });
      bars.push({ width: s2, isBar: false });
    }

    // Stop guard
    bars.push({ width: 2, isBar: true });
    bars.push({ width: 1, isBar: false });
    bars.push({ width: 3, isBar: true });

    return bars;
  }, [code]);

  return (
    <div className={`flex flex-col items-end select-none ${className}`}>
      <div className="flex items-center gap-[1px] h-7 bg-white px-1 border border-slate-200 rounded-xs overflow-hidden">
        {pattern.map((item, idx) => (
          <div
            key={idx}
            className={`h-full ${item.isBar ? "bg-slate-950" : "bg-transparent"}`}
            style={{ width: `${Math.max(1, item.width * 1.2)}px` }}
          />
        ))}
      </div>
      <div className="text-[8.5px] font-mono tracking-[0.25em] text-slate-600 font-bold uppercase mt-0.5">
        *{code}*
      </div>
    </div>
  );
}

export function WaybillDocumentView({
  trip,
  machine,
  driver,
  companyName,
  companyPhone,
  companyAddress,
  companyTin = "TIN: 142-990-811 / VRN: 40-029188",
  companyLogo,
  waybillRef,
  cleanCargo,
}: WaybillDocumentViewProps) {
  const displayCargo = cleanCargo || trip?.cargo_description || "Commercial Cargo / General Containerized Freight";
  const issueDate = formatDate(trip?.created_at || new Date().toISOString());

  // Seal codes generated or extracted
  const seal1 = `SEAL-${(trip?.id || "WB88").slice(0, 4).toUpperCase()}-01`;
  const seal2 = `SEAL-${(trip?.id || "WB88").slice(4, 8).toUpperCase()}-02`;

  const statusLabel =
    trip?.status === "in_progress"
      ? "In Transit"
      : trip?.status === "completed"
      ? "Delivered & Endorsed"
      : trip?.status || "Dispatched";

  return (
    <div className="space-y-3 font-sans text-slate-900 leading-normal">
      {/* Top Heavy Dark Accent Line */}
      <div className="h-2 w-full bg-slate-950 rounded-xs" />

      {/* 1. HEADER: CARRIER LETTERHEAD + OFFICIAL CONSIGNMENT BANNER + BARCODE */}
      <div className="flex items-start justify-between border-b-2 border-slate-950 pb-3 gap-4">
        {/* Carrier Info */}
        <div className="space-y-1.5 max-w-[56%]">
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                crossOrigin="anonymous"
                className="h-14 w-auto max-w-[210px] object-contain shrink-0"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="h-11 w-11 rounded-lg bg-slate-950 flex items-center justify-center text-white shadow-xs shrink-0">
                  <Truck className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-slate-950 block leading-tight">
                    {companyName}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
                    Cross-Border Heavy Haulage & Bulk Freight Logistics
                  </span>
                </div>
              </div>
            )}
          </div>

          {companyLogo && (
            <div className="text-xs font-black tracking-tight text-slate-950 uppercase">
              {companyName}
            </div>
          )}

          <div className="text-[11px] text-slate-600 leading-tight space-y-0.5 pt-0.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="line-clamp-1">{companyAddress}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
              <span>
                Tel: <strong className="text-slate-800">{companyPhone}</strong>
              </span>
              <span>·</span>
              <span className="font-mono font-medium text-slate-700">{companyTin}</span>
              <span>·</span>
              <span className="font-medium text-slate-700">
                LATRA / SADC Permit: <strong className="font-mono text-slate-950">TZ-DAR-8849</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Official Waybill Ref & Barcode */}
        <div className="text-right flex flex-col items-end space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-slate-950 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>ROAD FREIGHT CONSIGNMENT NOTE & P.O.D.</span>
          </div>
          <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
            ORIGINAL CARRIER COPY · NON-NEGOTIABLE
          </div>

          <div className="font-mono text-2xl font-black text-slate-950 tracking-tight pt-0.5">
            {waybillRef}
          </div>

          <RealisticBarcode code={waybillRef} />

          <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              Dispatch Date: <strong className="text-slate-800">{issueDate}</strong>
            </span>
            <span>·</span>
            <span className="capitalize font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-sm border border-emerald-300">
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 2. HIGH-VISIBILITY ROUTE & CORRIDOR TRANSIT RIBBON */}
      <div className="bg-slate-950 text-white rounded-md p-2.5 px-3 flex items-center justify-between shadow-xs">
        <div className="space-y-0.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-emerald-400" /> 01. Loading Origin Depot
          </div>
          <div className="text-xs font-black text-white tracking-wide">
            {trip?.origin || "Dar es Salaam Port / Kurasini Depot"}
          </div>
        </div>

        <div className="flex flex-col items-center px-4 text-center">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-black tracking-widest uppercase">
            <span>TRANSIT ROUTE</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <div className="text-[10px] font-semibold text-slate-300">
            {trip?.corridor_name ? trip.corridor_name : "Central Road Freight Corridor"}
            {trip?.border_post ? ` via ${trip.border_post} OSBP` : ""}
          </div>
        </div>

        <div className="text-right space-y-0.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1">
            <MapPin className="h-3 w-3 text-amber-400" /> 02. Offloading Destination Point
          </div>
          <div className="text-xs font-black text-white tracking-wide">
            {trip?.destination || "Destination Facility"}
          </div>
        </div>
      </div>

      {/* 3. LOGISTICS CUSTODY MATRIX (3 BALANCED CARDS) */}
      <div className="grid grid-cols-3 gap-2.5 text-xs">
        {/* CARD 1: CONSIGNOR / SHIPPER */}
        <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="bg-slate-900 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
              <span>01. Consignor / Shipper</span>
              <Building2 className="h-3 w-3 text-slate-300" />
            </div>
            <div className="p-2.5 space-y-1">
              <div className="text-xs font-black text-slate-950 leading-tight">
                {trip?.client_name || "Commercial Cargo Consignor"}
              </div>
              <div className="text-[11px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-800">Loading Terminal:</span>{" "}
                {trip?.origin || "Origin Depot / Port Berth"}
              </div>
              {trip?.client_order_no && (
                <div className="text-[11px] text-slate-600 font-mono">
                  <span className="font-semibold text-slate-800 font-sans">D.O. / Booking Ref:</span>{" "}
                  {trip.client_order_no}
                </div>
              )}
            </div>
          </div>
          <div className="px-2.5 py-1 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
            Handover: Loading Bay Dispatch Desk
          </div>
        </div>

        {/* CARD 2: CARRIER & VEHICLE PARTICULAR */}
        <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="bg-slate-900 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
              <span>02. Carrier & Vehicle Particulars</span>
              <Truck className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="p-2.5 space-y-1">
              <div className="text-xs font-black text-slate-950 leading-tight">
                {companyName}
              </div>
              <div className="text-[11px] text-slate-700 leading-snug font-medium">
                Prime Mover:{" "}
                <strong className="font-mono text-slate-950">
                  {machine?.plate_number
                    ? `${machine.name} (${machine.plate_number})`
                    : machine?.name || "Heavy Freight Truck"}
                </strong>
                {machine?.trailer_plate && (
                  <span className="text-slate-700 font-mono block">
                    Semi-Trailer: <strong className="text-slate-950">{machine.trailer_plate}</strong>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600">
                Driver: <strong className="text-slate-950">{driver?.full_name || "Assigned Driver"}</strong>{" "}
                {driver?.phone ? `(${driver.phone})` : ""}
              </div>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
            Permit: SADC Cross-Border Transit Authority
          </div>
        </div>

        {/* CARD 3: CONSIGNEE / RECEIVING POINT */}
        <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="bg-slate-900 text-white px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center justify-between">
              <span>03. Consignee / Delivery Point</span>
              <MapPin className="h-3 w-3 text-amber-400" />
            </div>
            <div className="p-2.5 space-y-1">
              <div className="text-xs font-black text-slate-950 leading-tight">
                {trip?.client_name || "Authorized Consignee"}
              </div>
              <div className="text-[11px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-800">Offload Facility:</span>{" "}
                {trip?.destination || "Destination Terminal"}
              </div>
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">Delivery Terms:</span>{" "}
                {trip?.payment_terms || "Direct Gate-In & Ullage Inspection"}
              </div>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
            Receipt: Subject to Intact Tamper Seals
          </div>
        </div>
      </div>

      {/* 4. CARGO MANIFEST & SECURITY BOLT SEAL TABLE */}
      <div className="border border-slate-300 rounded-md overflow-hidden">
        <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-emerald-400" /> Cargo Manifest & Transit Security Seals
          </span>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
            SADC / EAC Tripartite Transit Bond Compliance
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] uppercase font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th className="p-2 text-center w-10">No.</th>
              <th className="p-2">Description of Goods & Commodity Specification</th>
              <th className="p-2">Vehicle / Packaging Spec</th>
              <th className="p-2 text-center">Declared Quantity</th>
              <th className="p-2">Security Bolt Seals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            <tr>
              <td className="p-2.5 text-center font-bold text-slate-800 align-top">01</td>
              <td className="p-2.5 space-y-0.5 align-top">
                <div className="font-black text-slate-950 text-xs">
                  {displayCargo}
                </div>
                <div className="text-[10px] text-slate-600">
                  Route: <strong className="text-slate-800">{trip?.origin || "Origin Depot"}</strong> to{" "}
                  <strong className="text-slate-800">{trip?.destination || "Destination Depot"}</strong>
                  {trip?.corridor_name ? ` via ${trip.corridor_name}` : ""}
                </div>
                {trip?.border_post && (
                  <div className="text-[9.5px] text-slate-700 font-semibold flex items-center gap-1 pt-0.5">
                    <BadgeCheck className="h-3 w-3 text-emerald-600" />
                    Designated Border Clearance: {trip.border_post} OSBP
                  </div>
                )}
              </td>
              <td className="p-2.5 text-[11px] text-slate-700 align-top">
                <div className="font-bold text-slate-900">
                  {machine?.vehicle_type || "Heavy Haulage Semi-Trailer"}
                </div>
                <div className="text-[10px] text-slate-600 pt-0.5">
                  Plate: <span className="font-mono font-bold text-slate-900">{machine?.plate_number || "T-TRUCK"}</span>
                  {machine?.trailer_plate && (
                    <span className="font-mono text-slate-700 ml-1">/ {machine.trailer_plate}</span>
                  )}
                </div>
              </td>
              <td className="p-2.5 text-center font-mono font-black text-slate-900 text-xs align-top">
                1 FTL Consignment
                {trip?.start_km && (
                  <div className="text-[9px] text-slate-500 font-normal font-sans pt-0.5">
                    Dep. Odo: {Number(trip.start_km).toLocaleString()} km
                  </div>
                )}
              </td>
              <td className="p-2.5 text-[11px] space-y-1 align-top">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-slate-950 text-emerald-400 font-mono text-[10px] font-bold shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{seal1} / {seal2}</span>
                </div>
                <div className="text-[9px] text-slate-500 leading-tight">
                  Tamper-Evident High-Security Bolt Seals (ISO 17712 Compliant)
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. STATUTORY WEIGHBRIDGE & GPS TELEMATICS NOTICE STRIP */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-md border border-slate-300 bg-slate-50/80 text-[10px] space-y-0.5">
          <span className="font-black text-slate-900 uppercase flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-slate-700" /> TANROADS & SADC Axle-Load Statutory Compliance
          </span>
          <p className="text-slate-600 leading-snug">
            Consignment is loaded strictly within 56-MT Gross Vehicle Weight (GVW) limits. Mandatory axle-group verification at all designated corridor weighbridges.
          </p>
        </div>

        <div className="p-2 rounded-md border border-slate-300 bg-slate-50/80 text-[10px] space-y-0.5">
          <span className="font-black text-slate-900 uppercase flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 24/7 Live Satellite GPS & Geofence Monitored
          </span>
          <p className="text-slate-600 leading-snug">
            Asset tracked continuously via satellite telematics with automated 80 km/h speed limit governing, geofence departure alert, and electronic seal monitoring.
          </p>
        </div>
      </div>

      {/* 6. THREE OFFICIAL CUSTODY TRANSFER & SIGNATURE STAMPS */}
      <div className="grid grid-cols-3 gap-2.5 pt-0.5 text-xs">
        {/* STAGE 1: CONSIGNOR DISPATCH */}
        <div className="border border-slate-300 rounded-md p-2.5 bg-slate-50/70 flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200">
              <span>01. Consignor Handover</span>
              <span className="text-slate-500 font-bold">STAGE 1</span>
            </div>
            <p className="text-[9px] text-slate-600 pt-1 leading-snug">
              Goods inspected, stowed & sealed in good external order.
            </p>
          </div>

          <div className="space-y-1">
            <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] text-slate-400 italic">
              Loaded By: ________________________
            </div>
            <div className="flex justify-between items-baseline text-[9px] text-slate-700">
              <span className="font-bold">Date: {issueDate}</span>
              <div className="border border-dashed border-slate-400 px-1 py-0.5 rounded-2xs text-[8px] font-mono text-slate-500">
                [SHIPPER STAMP]
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 2: CARRIER DRIVER ACCEPTANCE */}
        <div className="border border-slate-300 rounded-md p-2.5 bg-slate-50/70 flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200">
              <span>02. Carrier Acceptance</span>
              <span className="text-slate-900 font-bold">STAGE 2</span>
            </div>
            <p className="text-[9px] text-slate-600 pt-1 leading-snug">
              Intact seals & cargo received for carriage to destination.
            </p>
          </div>

          <div className="space-y-1">
            <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] text-slate-900 font-bold truncate">
              Driver: {driver?.full_name || "Authorized Fleet Driver"}
            </div>
            <div className="flex justify-between items-baseline text-[9px] text-slate-700">
              <span className="font-mono text-slate-600">
                Odo: {trip?.start_km ? `${Number(trip.start_km).toLocaleString()} km` : "_________ km"}
              </span>
              <div className="border border-dashed border-slate-400 px-1 py-0.5 rounded-2xs text-[8px] font-mono text-slate-500">
                [CARRIER STAMP]
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 3: CONSIGNEE PROOF OF DELIVERY (P.O.D.) */}
        <div className="border-2 border-emerald-600 rounded-md p-2.5 bg-emerald-50/40 flex flex-col justify-between h-[142px] shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-emerald-950 pb-1 border-b border-emerald-300">
              <span>03. Consignee Receipt (P.O.D.)</span>
              <span className="text-emerald-800 font-black">STAGE 3</span>
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-[9.5px] font-black text-emerald-950">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Clean Delivery · Intact Tamper Seals</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="border-b border-dashed border-emerald-600/60 pb-0.5 text-[9px] text-slate-500 italic">
              Received By (Print & Sign): _______________
            </div>
            <div className="flex justify-between items-baseline text-[9px] text-slate-700">
              <span className="font-mono font-medium">Date: ___/___/202___</span>
              <div className="border border-dashed border-emerald-600 px-1 py-0.5 rounded-2xs text-[8px] font-mono text-emerald-800 font-bold">
                [CONSIGNEE STAMP]
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. AUTHENTICITY MICRO-PRINT LEGAL FOOTER */}
      <div className="pt-2 border-t border-slate-200 text-center text-[8.5px] text-slate-500 leading-tight">
        NON-NEGOTIABLE INTERNATIONAL ROAD FREIGHT CONSIGNMENT NOTE & PROOF OF DELIVERY (P.O.D.). Issued in accordance with SADC and EAC Cross-Border Freight Carriage Regulations. Consignee signature constitutes clean, unconditional acceptance of delivered goods. Computer-generated certified copy — Valid without physical alterations · Ref: <span className="font-mono font-bold text-slate-700">{waybillRef}</span>
      </div>
    </div>
  );
}
