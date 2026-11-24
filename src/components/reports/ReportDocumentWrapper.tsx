import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Layers,
  LayoutDashboard,
} from "lucide-react";
import { formatDate } from "@/lib/format";

export interface ReportDocumentWrapperProps {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  reportPeriod?: string;
  classification?: string;
  documentType?: string;
  department?: string;
  signOff?: {
    preparedByTitle?: string;
    preparedByName?: string;
    reviewedByTitle?: string;
    reviewedByName?: string;
    approvedByTitle?: string;
    approvedByName?: string;
  };
  stampLabel?: string;
  viewMode?: "dashboard" | "document";
  onToggleViewMode?: () => void;
  onPrint?: () => void;
  onExportCsv?: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}

export function ReportDocumentWrapper({
  title,
  subtitle,
  referenceNumber,
  reportPeriod,
  classification = "CONFIDENTIAL · EXECUTIVE AUDIT REPORT",
  documentType = "OFFICIAL REPORT",
  department = "Fleet & Plant Asset Operations",
  signOff = {
    preparedByTitle: "Prepared By: Operations Analyst",
    preparedByName: "Lead Fleet/Plant Controller",
    reviewedByTitle: "Reviewed By: Technical Director",
    reviewedByName: "Head of Workshop & Engineering",
    approvedByTitle: "Approved By: Executive Management",
    approvedByName: "Managing Director / COO",
  },
  stampLabel = "OFFICIAL RECORD · AUDITED & VERIFIED",
  viewMode = "document",
  onToggleViewMode,
  onPrint = () => window.print(),
  onExportCsv,
  extraActions,
  children,
}: ReportDocumentWrapperProps) {
  const { organisation, user, profile } = useAuth();

  const generatedRef =
    referenceNumber ||
    `MCH-DOC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const companyName = organisation?.name || "MachineCare Hub Enterprise";
  const logoUrl = organisation?.logo_url;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* ACTION BAR & VIEW TOGGLE (Screen Only - Hidden in Print)  */}
      {/* ========================================================= */}
      <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Document Ready
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {subtitle || "Professional board and audit-ready document format."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleViewMode && (
            <div className="flex items-center bg-muted p-1 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={viewMode === "document" ? onToggleViewMode : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === "dashboard"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Interactive
              </button>
              <button
                type="button"
                onClick={viewMode === "dashboard" ? onToggleViewMode : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === "document"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Formal Document
              </button>
            </div>
          )}

          {extraActions}

          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="gap-1.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}

          <Button
            size="sm"
            onClick={onPrint}
            className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FORMAL CORPORATE DOCUMENT CONTAINER                       */}
      {/* ========================================================= */}
      <div className="bg-card text-card-foreground p-6 sm:p-10 rounded-2xl border-2 border-border/80 shadow-md print:border-none print:shadow-none print:p-0 print:bg-white print:text-black max-w-5xl mx-auto space-y-8 font-sans">
        {/* Top Letterhead Bar */}
        <div className="flex flex-wrap justify-between items-start gap-6 border-b-2 border-border/80 pb-6 print:border-slate-800">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-14 sm:h-16 w-auto max-w-[200px] object-contain rounded-lg p-1 bg-white/5 border border-border/30"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-black text-2xl flex items-center justify-center shadow-sm border border-primary/20">
                {companyName.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground print:text-slate-900 uppercase">
                  {companyName}
                </h1>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary print:text-slate-700 mt-0.5">
                {department}
              </p>
              <p className="text-[11px] text-muted-foreground print:text-slate-500 mt-0.5">
                MachineCare Enterprise Asset & ERP Platform · Automated Reconciled Record
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold text-[10px] tracking-wider uppercase border border-primary/20 print:border-slate-800 print:text-slate-900">
              <ShieldCheck className="h-3 w-3" />
              {classification}
            </div>
            <div className="text-xs font-mono font-bold text-foreground print:text-slate-900">
              REF: {generatedRef}
            </div>
            <div className="text-[11px] text-muted-foreground print:text-slate-600">
              Generated: {formatDate(new Date())} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Document Title & Period Banner */}
        <div className="bg-muted/40 print:bg-slate-50 rounded-xl p-4 sm:p-5 border border-border/60 print:border-slate-300 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
              {documentType}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground print:text-slate-900 tracking-tight mt-0.5">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground print:text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
                Reporting Horizon
              </div>
              <div className="text-sm font-extrabold text-foreground print:text-slate-900">
                {reportPeriod || "Current Fiscal Operating Period"}
              </div>
            </div>
          </div>
        </div>

        {/* Document Body (Injected Children) */}
        <div className="space-y-8">
          {children}
        </div>

        {/* ========================================================= */}
        {/* FORMAL SIGN-OFF & OFFICIAL VERIFICATION STAMP             */}
        {/* ========================================================= */}
        <div className="pt-8 border-t-2 border-border/80 print:border-slate-800 space-y-6 break-inside-avoid">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground print:text-slate-600">
              Corporate Authorization & Document Certification
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground print:text-slate-500">
              ISO 55001 Asset Management Framework
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Prepared By */}
            <div className="border border-border/80 print:border-slate-300 rounded-xl p-4 bg-muted/20 print:bg-transparent space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
                {signOff.preparedByTitle || "Prepared By"}
              </div>
              <div className="h-10 border-b border-dashed border-border/80 print:border-slate-400 flex items-end pb-1 font-mono text-xs italic text-muted-foreground print:text-slate-700">
                {profile?.full_name || signOff.preparedByName || "System Analyst"}
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground print:text-slate-600">
                <span>Sign & Date</span>
                <span>{new Date().toISOString().slice(0, 10)}</span>
              </div>
            </div>

            {/* Reviewed By */}
            <div className="border border-border/80 print:border-slate-300 rounded-xl p-4 bg-muted/20 print:bg-transparent space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-600">
                {signOff.reviewedByTitle || "Reviewed By"}
              </div>
              <div className="h-10 border-b border-dashed border-border/80 print:border-slate-400 flex items-end pb-1 font-mono text-xs italic text-muted-foreground print:text-slate-700">
                {signOff.reviewedByName || "Engineering Controller"}
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground print:text-slate-600">
                <span>Sign & Date</span>
                <span>{new Date().toISOString().slice(0, 10)}</span>
              </div>
            </div>

            {/* Authorized / Stamp Box */}
            <div className="border-2 border-primary/40 print:border-slate-900 rounded-xl p-4 bg-primary/5 print:bg-transparent space-y-2 relative overflow-hidden">
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary print:text-slate-900 flex items-center justify-between">
                <span>{signOff.approvedByTitle || "Approved By"}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="h-10 border-b border-dashed border-primary/30 print:border-slate-400 flex items-end pb-1 font-mono text-xs font-bold text-foreground print:text-slate-900">
                {signOff.approvedByName || "Managing Director / COO"}
              </div>

              {/* Stamp Graphic */}
              <div className="pt-1 flex items-center justify-center">
                <div className="border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 print:text-slate-800 print:border-slate-800 rounded-md px-3 py-1 text-[9px] font-black uppercase tracking-widest text-center rotate-[-2deg] bg-emerald-500/10 print:bg-transparent shadow-xs">
                  ★ {stampLabel} ★
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-muted-foreground print:text-slate-500 pt-2 border-t border-border/40 print:border-slate-200">
            This document is electronically verified and archived under corporate audit trail ID: <span className="font-mono">{generatedRef}</span>. Valid without handwritten signature under Digital Signatures Act.
          </div>
        </div>
      </div>
    </div>
  );
}
