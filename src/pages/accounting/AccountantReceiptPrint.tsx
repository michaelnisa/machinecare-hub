import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import {
  Printer,
  ArrowLeft,
  Download,
  Building2,
  Calendar,
  Truck,
  Wrench,
  Package,
  Receipt,
  CreditCard,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import {
  getAccountantReceiptById,
  amountToWords,
  type AccountantReceipt,
} from "@/services/accountantService";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

function BarcodeGraphic({ code }: { code: string }) {
  const bars = [2, 1, 3, 1, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 1, 2, 4, 1, 2, 3, 2, 1, 3];
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-[1.5px] h-6 overflow-hidden py-0.5">
        {bars.map((w, i) => (
          <div key={i} className="bg-slate-900 h-full" style={{ width: `${w * 1.1}px` }} />
        ))}
      </div>
      <div className="text-[8px] font-mono tracking-[0.2em] text-slate-500 font-bold uppercase mt-0.5">
        *{code}*
      </div>
    </div>
  );
}

export default function AccountantReceiptPrint() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<AccountantReceipt | null>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const data = await getAccountantReceiptById(id);
      if (!data) {
        setLoading(false);
        return;
      }
      setReceipt(data);

      if (data.organisation_id) {
        const { data: orgData } = await supabase
          .from("organisations")
          .select("id, name, logo_url, address, phone, email")
          .eq("id", data.organisation_id)
          .maybeSingle();
        setOrg(orgData);
      }

      setLoading(false);
    })();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || !receipt) return;
    try {
      setDownloading(true);
      toast.info("Generating PDF disbursement voucher...");

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payment_Voucher_${receipt.receipt_number}.pdf`);
      toast.success("Voucher PDF downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageLoader message="Loading payment receipt..." />;

  if (!receipt) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <Receipt className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Payment Receipt Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested receipt or disbursement voucher does not exist.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/accounting">← Back to Accounting</Link>
        </Button>
      </div>
    );
  }

  const isSparePart = receipt.receipt_type === "spare_part";
  const isMaintenance = receipt.receipt_type === "maintenance_service";
  const companyName = org?.name || "LOGISTIXWARE LOGISTICS LIMITED";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 text-slate-900 print:bg-white print:p-0">
      {/* Action Toolbar (Hidden in Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <Link to="/accounting">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Accounting
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {receipt.attachment_url && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <a href={receipt.attachment_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> View Attached Invoice
              </a>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Exporting..." : "Download PDF"}
          </Button>

          <Button variant="default" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print Voucher
          </Button>
        </div>
      </div>

      {/* Official Sheet Container (A4 Proportions) */}
      <div
        ref={sheetRef}
        className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none text-slate-900 text-xs"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                MC
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {companyName}
                </h1>
                <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                  Finance &amp; Accounts Department
                </div>
              </div>
            </div>
            {org?.address && <div className="text-[11px] text-slate-600">{org.address}</div>}
            <div className="text-[10px] text-slate-500">
              {org?.phone && <span>Phone: {org.phone} • </span>}
              {org?.email && <span>Email: {org.email}</span>}
            </div>
          </div>

          <div className="text-right space-y-1.5">
            <BarcodeGraphic code={receipt.receipt_number} />
            <div className="text-sm font-black font-mono text-slate-900">{receipt.receipt_number}</div>
            <div className="text-[10px] text-slate-500 font-medium">
              Date: <strong>{formatDate(receipt.payment_date)}</strong>
            </div>
          </div>
        </div>

        {/* Voucher Title Banner */}
        <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 mb-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Official Document</div>
            <div className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
              {isSparePart ? (
                <>
                  <Package className="h-4 w-4 text-emerald-600" /> Spare Parts Purchase Receipt &amp; Voucher
                </>
              ) : isMaintenance ? (
                <>
                  <Wrench className="h-4 w-4 text-blue-600" /> Maintenance &amp; Repair Disbursement Voucher
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 text-purple-600" /> Official Payment Disbursement Voucher
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                receipt.status === "paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }`}
            >
              {receipt.status === "paid" ? "PAID / CLEARED" : "PENDING AUTHORIZATION"}
            </span>
          </div>
        </div>

        {/* Key Info Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Payee Info */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Payee / Beneficiary</div>
            <div className="font-bold text-sm text-slate-900">{receipt.payee_name}</div>
            <div className="text-[11px] text-slate-600 mt-1">
              Category: <strong>{receipt.category}</strong>
            </div>
            {receipt.received_by_name && (
              <div className="text-[11px] text-slate-600">
                Representative: {receipt.received_by_name}
              </div>
            )}
          </div>

          {/* Allocation & Machine */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
              Vehicle &amp; Work Order Allocation
            </div>
            {receipt.machines ? (
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-slate-600" />
                {receipt.machines.plate_number ? `${receipt.machines.plate_number} (${receipt.machines.name})` : receipt.machines.name}
              </div>
            ) : (
              <div className="font-semibold text-slate-700 italic">Central Fleet Inventory / Unallocated</div>
            )}
            {receipt.work_orders && (
              <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                <Wrench className="h-3 w-3 text-slate-500" />
                Work Order: <strong>WO-{receipt.work_orders.wo_number || receipt.work_orders.id.slice(0, 6)}</strong> ({receipt.work_orders.title})
              </div>
            )}
          </div>
        </div>

        {/* Purpose Description */}
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Purpose / Description</div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800">
            {receipt.title}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Itemized Particulars</div>
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-700">
                <th className="py-2 px-3 w-10 text-center">#</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 w-28">Part #</th>
                <th className="py-2 px-3 w-16 text-right">Qty</th>
                <th className="py-2 px-3 w-28 text-right">Unit Price</th>
                <th className="py-2 px-3 w-32 text-right">Total ({receipt.currency})</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items && receipt.items.length > 0 ? (
                receipt.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{it.description}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 text-[10px]">{it.part_number || "—"}</td>
                    <td className="py-2 px-3 text-right font-medium">{it.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {formatMoney(it.unit_price, receipt.currency)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatMoney(it.total, receipt.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 text-center text-slate-400">1</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{receipt.title}</td>
                  <td className="py-2 px-3 text-slate-400 font-mono">—</td>
                  <td className="py-2 px-3 text-right">1</td>
                  <td className="py-2 px-3 text-right font-mono">{formatMoney(receipt.amount, receipt.currency)}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {formatMoney(receipt.amount, receipt.currency)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                <td colSpan={5} className="py-2 px-3 text-right uppercase text-[11px] text-slate-700">
                  Total Disbursed:
                </td>
                <td className="py-2 px-3 text-right font-mono text-sm text-slate-950 font-black">
                  {formatMoney(receipt.amount, receipt.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Amount in Words</div>
          <div className="font-bold text-slate-900 italic mt-0.5">
            {amountToWords(receipt.amount, receipt.currency)}
          </div>
        </div>

        {/* Payment Instrument Details */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mb-8 text-[11px]">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Payment Channel</span>
            <strong className="text-slate-900 capitalize">{receipt.payment_method.replace("_", " ")}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Reference / Cheque #</span>
            <strong className="text-slate-900 font-mono">{receipt.payment_reference || "Cash Receipt"}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Disbursed By</span>
            <strong className="text-slate-900">{receipt.paid_by_name || "Accountant"}</strong>
          </div>
        </div>

        {receipt.notes && (
          <div className="mb-8 p-3 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-600">
            <strong>Notes / Audit Reference:</strong> {receipt.notes}
          </div>
        )}

        {/* 4-Tier Official Signature Authorization Blocks */}
        <div className="border-t-2 border-slate-900 pt-6 mt-8">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-6 text-center">
            Authorization &amp; Discharge Sign-off
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            {/* Box 1 */}
            <div className="space-y-8">
              <div className="h-10 border-b border-slate-300" />
              <div>
                <div className="font-bold text-slate-900">{receipt.paid_by_name || "Accountant"}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                  Prepared By (Accountant)
                </div>
              </div>
            </div>

            {/* Box 2 */}
            <div className="space-y-8">
              <div className="h-10 border-b border-slate-300" />
              <div>
                <div className="font-bold text-slate-900">Foreman / Storekeeper</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                  Verified &amp; Received In Stores
                </div>
              </div>
            </div>

            {/* Box 3 */}
            <div className="space-y-8">
              <div className="h-10 border-b border-slate-300" />
              <div>
                <div className="font-bold text-slate-900">Finance / Managing Director</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                  Authorized &amp; Approved
                </div>
              </div>
            </div>

            {/* Box 4 */}
            <div className="space-y-8">
              <div className="h-10 border-b border-slate-300" />
              <div>
                <div className="font-bold text-slate-900">{receipt.received_by_name || receipt.payee_name}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                  Payee / Vendor Discharge
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[9px] text-slate-400 mt-8 pt-4 border-t border-slate-100">
          Generated automatically by MachineCare Hub for {companyName} • Official internal accounting audit document.
        </div>
      </div>
    </div>
  );
}
