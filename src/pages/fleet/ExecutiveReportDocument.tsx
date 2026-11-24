import React from "react";
import { ReportDocumentWrapper } from "@/components/reports/ReportDocumentWrapper";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/format";
import { Gauge, Wrench, Package, ShieldCheck, Truck, Building2, CheckCircle2 } from "lucide-react";

interface ExecutiveReportDocumentProps {
  companyDisplayName: string;
  activeFrequency: "daily" | "weekly" | "monthly";
  totalFleetCost: { maintenance: number; fuel: number; total: number };
  cpkVehicleAnalytics: any[];
  componentDistribution: any[];
  technicianPartsIssuance: any[];
  monthlySparesConsumption: any[];
  warrantyRegistry: any[];
  contractorPerformance: any[];
  vehicles: any[];
  workOrders: any[];
  partsIssuanceHistory: any[];
  onToggleViewMode: () => void;
  onPrint: () => void;
  onExportCsv: () => void;
}

export function ExecutiveReportDocument({
  companyDisplayName,
  activeFrequency,
  totalFleetCost,
  cpkVehicleAnalytics,
  componentDistribution,
  technicianPartsIssuance,
  monthlySparesConsumption,
  warrantyRegistry,
  contractorPerformance,
  vehicles,
  workOrders,
  partsIssuanceHistory,
  onToggleViewMode,
  onPrint,
  onExportCsv,
}: ExecutiveReportDocumentProps) {
  const totalFleetKm = vehicles.reduce((acc, v) => acc + (Number(v.current_odometer_km) || 0), 0);
  const avgCpk = totalFleetKm > 0 ? Math.round(totalFleetCost.total / totalFleetKm) : 1850;
  const operationalCount = vehicles.filter((v) => v.status === "active" || v.status === "operational").length;
  const operationalPct = vehicles.length > 0 ? Math.round((operationalCount / vehicles.length) * 100) : 100;

  return (
    <ReportDocumentWrapper
      title={`Executive Fleet Operations & Reliability Report (${activeFrequency.toUpperCase()})`}
      subtitle={`Audited Fleet Cost-per-Kilometer (CPK), 11-Subsystem Breakdown, Stores Consumption & Warranty Compliance for ${companyDisplayName}`}
      reportPeriod={`${activeFrequency.toUpperCase()} Operating Cycle · Fiscal Year ${new Date().getFullYear()}`}
      documentType="EXECUTIVE AUDIT STATEMENT & FLEET DOSSIER"
      department="Commercial Fleet & Workshop Asset Management Directorate"
      classification="CONFIDENTIAL · BOARD OF DIRECTORS AUDIT"
      viewMode="document"
      onToggleViewMode={onToggleViewMode}
      onPrint={onPrint}
      onExportCsv={onExportCsv}
      stampLabel="BOARD AUDITED · OFFICIAL RECORD"
      signOff={{
        preparedByTitle: "Prepared By: Fleet Controller",
        preparedByName: "Lead Fleet Data Analyst",
        reviewedByTitle: "Reviewed By: Technical Director",
        reviewedByName: "Head of Workshop & Spares Engineering",
        approvedByTitle: "Approved By: Chief Operating Officer",
        approvedByName: "Executive Operations Director",
      }}
    >
      {/* 1. EXECUTIVE OPERATING & FINANCIAL SUMMARY TILES */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-border/80 print:border-slate-800 pb-2">
          <Truck className="h-4 w-4 text-primary print:text-slate-900" />
          <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-slate-900">
            1. Executive Financial & Availability Summary
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-border/80 print:border-slate-300 bg-muted/20 print:bg-transparent space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
              Total Fleet Operating Cost
            </div>
            <div className="text-lg font-black text-foreground print:text-slate-900">
              {formatMoney(totalFleetCost.total, "TZS")}
            </div>
            <div className="text-[10px] text-muted-foreground print:text-slate-500">
              Fuel + Workshop & Spares
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 print:border-slate-300 bg-muted/20 print:bg-transparent space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
              Fleet Average CPK
            </div>
            <div className="text-lg font-black text-emerald-600 print:text-slate-900">
              TZS {avgCpk.toLocaleString()} / km
            </div>
            <div className="text-[10px] text-muted-foreground print:text-slate-500">
              Benchmark: TZS 1,850/km
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 print:border-slate-300 bg-muted/20 print:bg-transparent space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
              Fleet Operational Availability
            </div>
            <div className="text-lg font-black text-foreground print:text-slate-900">
              {operationalPct}% Ready
            </div>
            <div className="text-[10px] text-muted-foreground print:text-slate-500">
              {operationalCount} of {vehicles.length} assets active
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 print:border-slate-300 bg-muted/20 print:bg-transparent space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
              Active Job Cards
            </div>
            <div className="text-lg font-black text-foreground print:text-slate-900">
              {workOrders.length} Recorded
            </div>
            <div className="text-[10px] text-muted-foreground print:text-slate-500">
              {workOrders.filter((w) => ["done", "closed"].includes(w.status)).length} completed & certified
            </div>
          </div>
        </div>
      </div>

      {/* 2. COST-PER-KILOMETER (CPK) PER VEHICLE TABLE */}
      <div className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 print:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-emerald-600 print:text-slate-900" />
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-slate-900">
              2. Vehicle Cost-per-Kilometer (CPK) Efficiency Audit
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground print:text-slate-600">
            Slide 17 Cost Modeling
          </span>
        </div>

        <div className="border border-border/80 print:border-slate-400 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 print:bg-slate-100 text-left text-muted-foreground print:text-slate-700 font-bold uppercase tracking-wider border-b border-border/80 print:border-slate-400">
                <th className="p-2.5">Plate Number</th>
                <th className="p-2.5">Make & Model</th>
                <th className="p-2.5 text-right">Odometer</th>
                <th className="p-2.5 text-right">Maint. Spend</th>
                <th className="p-2.5 text-right">Fuel Spend</th>
                <th className="p-2.5 text-right">Total Spend</th>
                <th className="p-2.5 text-right">CPK (TZS/km)</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 print:divide-slate-200">
              {cpkVehicleAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    No vehicle operating records available.
                  </td>
                </tr>
              ) : (
                cpkVehicleAnalytics.slice(0, 15).map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 print:hover:bg-transparent">
                    <td className="p-2.5 font-mono font-bold text-foreground print:text-slate-900">
                      {item.plate}
                    </td>
                    <td className="p-2.5 text-muted-foreground print:text-slate-700">
                      {item.model}
                    </td>
                    <td className="p-2.5 text-right font-mono text-foreground print:text-slate-900">
                      {formatNumber(item.odoKm)} km
                    </td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground print:text-slate-700">
                      {formatMoney(item.maintSpend, "TZS")}
                    </td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground print:text-slate-700">
                      {formatMoney(item.fuelSpend, "TZS")}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-foreground print:text-slate-900">
                      {formatMoney(item.totalSpend, "TZS")}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-sm text-foreground print:text-slate-900">
                      TZS {item.cpk.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          item.rating === "optimal"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : item.rating === "high"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {item.rating === "optimal" ? "Optimal" : item.rating === "high" ? "High CPK" : "Normal"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 11 COMPONENT SUBSYSTEM FAILURE BREAKDOWN TABLE */}
      <div className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 print:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-purple-600 print:text-slate-900" />
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-slate-900">
              3. 11-Component Subsystem Failure & Cost Allocation Matrix
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground print:text-slate-600">
            Slide 11 & 17 Standard
          </span>
        </div>

        <div className="border border-border/80 print:border-slate-400 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 print:bg-slate-100 text-left text-muted-foreground print:text-slate-700 font-bold uppercase tracking-wider border-b border-border/80 print:border-slate-400">
                <th className="p-2.5">Commercial Subsystem</th>
                <th className="p-2.5 text-center">Failure Incidents</th>
                <th className="p-2.5 text-right">Maintenance Cost</th>
                <th className="p-2.5 text-right">Budget Share %</th>
                <th className="p-2.5 text-center">Trend Indicator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 print:divide-slate-200">
              {componentDistribution.map((c) => (
                <tr key={c.name} className="hover:bg-muted/20 print:hover:bg-transparent">
                  <td className="p-2.5 font-bold text-foreground print:text-slate-900 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-foreground print:text-slate-900">
                    {c.jobs} repairs
                  </td>
                  <td className="p-2.5 text-right font-mono font-medium text-foreground print:text-slate-900">
                    {formatMoney(c.cost, "TZS")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-foreground print:text-slate-900">
                    {c.pct}%
                  </td>
                  <td className="p-2.5 text-center font-mono text-xs">
                    <span className={c.delta.includes("-") ? "text-emerald-600" : "text-amber-600"}>
                      {c.delta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PARTS ISSUED PER TECHNICIAN TABLE */}
      <div className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 print:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600 print:text-slate-900" />
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-slate-900">
              4. Workshop Stores Issuance & Technician Accountability
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground print:text-slate-600">
            Slide 15 Stores Governance
          </span>
        </div>

        <div className="border border-border/80 print:border-slate-400 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 print:bg-slate-100 text-left text-muted-foreground print:text-slate-700 font-bold uppercase tracking-wider border-b border-border/80 print:border-slate-400">
                <th className="p-2.5">Technician / Mechanic</th>
                <th className="p-2.5">Specialization</th>
                <th className="p-2.5 text-center">Parts Count</th>
                <th className="p-2.5 text-right">Total Material Spend</th>
                <th className="p-2.5">Serviced Job Cards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 print:divide-slate-200">
              {technicianPartsIssuance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No parts issuance records logged for this period.
                  </td>
                </tr>
              ) : (
                technicianPartsIssuance.map((t) => (
                  <tr key={t.name} className="hover:bg-muted/20 print:hover:bg-transparent">
                    <td className="p-2.5 font-bold text-foreground print:text-slate-900">
                      {t.name}
                    </td>
                    <td className="p-2.5 text-muted-foreground print:text-slate-700">
                      {t.specialization}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground print:text-slate-900">
                      {t.partsCount} items
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-foreground print:text-slate-900">
                      {formatMoney(t.totalSpend, "TZS")}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground print:text-slate-600">
                      {Array.from(t.jobCards).slice(0, 3).join(", ") || "General Workshop"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. WARRANTY & DEALER COMPLIANCE AUDIT */}
      <div className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 print:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 print:text-slate-900" />
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-slate-900">
              5. OEM Warranty & Commercial Asset Coverage Status
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground print:text-slate-600">
            Slide 20 Warranty Radar
          </span>
        </div>

        <div className="border border-border/80 print:border-slate-400 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 print:bg-slate-100 text-left text-muted-foreground print:text-slate-700 font-bold uppercase tracking-wider border-b border-border/80 print:border-slate-400">
                <th className="p-2.5">Asset / Plate</th>
                <th className="p-2.5">OEM / Dealer</th>
                <th className="p-2.5">Coverage Scope</th>
                <th className="p-2.5">Expiry Date</th>
                <th className="p-2.5 text-center">Warranty Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 print:divide-slate-200">
              {warrantyRegistry.slice(0, 8).map((w, idx) => (
                <tr key={idx} className="hover:bg-muted/20 print:hover:bg-transparent">
                  <td className="p-2.5 font-bold font-mono text-foreground print:text-slate-900">
                    {w.unit} - {w.name}
                  </td>
                  <td className="p-2.5 text-muted-foreground print:text-slate-700">
                    {w.provider}
                  </td>
                  <td className="p-2.5 text-muted-foreground print:text-slate-700">
                    {w.coverage}
                  </td>
                  <td className="p-2.5 font-mono text-foreground print:text-slate-900">
                    {w.expiryDate}
                  </td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        w.status === "active"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : w.status === "expiring_soon"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {w.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportDocumentWrapper>
  );
}
