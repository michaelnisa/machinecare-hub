import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import { parseCargoMeta, extractCleanCargo } from "@/lib/fleet-metadata";
import { Badge } from "@/components/ui/badge";
import { FinanceNavHeader } from "./FinanceNavHeader";
import {
  getFinanceInvoices,
  createFinanceInvoice,
  updateFinanceInvoicePayment,
  type FinanceInvoice,
  type InvoiceStatus,
} from "@/services/financeService";
import {
  FileText,
  Search,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  CreditCard,
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  Check,
  Landmark,
  Smartphone,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export default function FinanceInvoices() {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; plate_number: string | null }[]>([]);
  const [availableTrips, setAvailableTrips] = useState<any[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [selectedTripForInvoice, setSelectedTripForInvoice] = useState<string | null>(null);
  const [bankSettings, setBankSettings] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Invoice Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("none");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<
    { description: string; quantity: number; unit_price: number }[]
  >([{ description: "Freight Transport Services", quantity: 1, unit_price: 1500000 }]);

  // Record Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Print Invoice Preview
  const [printInvoice, setPrintInvoice] = useState<FinanceInvoice | null>(null);

  const loadData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const [invs, { data: machs }, { data: trps }] = await Promise.all([
        getFinanceInvoices(organisation.id),
        (supabase as any)
          .from("machines")
          .select("id, name, plate_number")
          .eq("organisation_id", organisation.id)
          .order("name"),
        (supabase as any)
          .from("trips")
          .select(`
            id,
            origin,
            destination,
            cargo_description,
            start_at,
            status,
            client_name,
            machine_id,
            cost,
            machines:machines(id, name, plate_number)
          `)
          .eq("organisation_id", organisation.id)
          .order("start_at", { ascending: false }),
      ]);
      setInvoices(invs);
      setMachines(machs || []);
      setAvailableTrips(trps || []);

      try {
        const saved = localStorage.getItem("fleet_corridor_bank_settings");
        if (saved) setBankSettings(JSON.parse(saved));
      } catch (e) {}
    } catch (err) {
      console.error("Failed to load invoices:", err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  // Totals calculations
  const invoiceSubtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
  }, [lineItems]);

  const invoiceTaxAmount = useMemo(() => {
    return Math.round((invoiceSubtotal * Number(taxRate || 0)) / 100);
  }, [invoiceSubtotal, taxRate]);

  const invoiceTotal = useMemo(() => {
    return Math.max(invoiceSubtotal + invoiceTaxAmount - Number(discount || 0), 0);
  }, [invoiceSubtotal, invoiceTaxAmount, discount]);

  // Overall KPI
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    const now = Date.now();

    invoices.forEach((inv) => {
      const tot = Number(inv.total_amount || 0);
      const paid = Number(inv.paid_amount || 0);
      const balance = Math.max(tot - paid, 0);

      totalInvoiced += tot;
      totalCollected += paid;
      totalOutstanding += balance;

      if (balance > 0 && new Date(inv.due_date).getTime() < now) {
        overdueCount++;
      }
    });

    return { totalInvoiced, totalCollected, totalOutstanding, overdueCount, count: invoices.length };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNum = inv.invoice_number.toLowerCase().includes(q);
        const matchClient = inv.client_name.toLowerCase().includes(q);
        const matchPlate = inv.machine?.plate_number?.toLowerCase().includes(q) || false;
        if (!matchNum && !matchClient && !matchPlate) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search]);

  // Matching trips for the entered client
  const matchingCustomerTrips = useMemo(() => {
    if (!clientName.trim()) return [];
    const q = clientName.trim().toLowerCase();
    return availableTrips.filter((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const cName = (meta?.client || t.client_name || "").toLowerCase();
      return cName.includes(q);
    });
  }, [availableTrips, clientName]);

  // Unique client names from available trips for quick selection
  const uniqueClientsFromTrips = useMemo(() => {
    const set = new Set<string>();
    availableTrips.forEach((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const c = (meta?.client || t.client_name || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [availableTrips]);

  // Trips not yet linked to an invoice
  const uninvoicedTrips = useMemo(() => {
    const invoicedTripSet = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.trip_id) invoicedTripSet.add(inv.trip_id);
    });
    return availableTrips.filter((t) => !invoicedTripSet.has(t.id));
  }, [availableTrips, invoices]);

  const uninvoicedSummary = useMemo(() => {
    let count = uninvoicedTrips.length;
    let estimatedValue = 0;
    uninvoicedTrips.forEach((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const rate = Number(meta?.exchange_rate) || 2600;
      const isUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";
      const rawAmt = Number(meta?.client_billing_amount) || Number(t.cost) * 1.35 || 1500000;
      const tzsAmt = isUsd ? Math.round(rawAmt * rate) : Math.round(rawAmt);
      estimatedValue += tzsAmt;
    });
    return { count, estimatedValue };
  }, [uninvoicedTrips]);

  const startInvoiceForTrip = (trip: any) => {
    const meta = parseCargoMeta(trip.cargo_description);
    const rate = Number(meta?.exchange_rate) || 2600;
    const isUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";
    const rawAmt = Number(meta?.client_billing_amount) || Number(trip.cost) * 1.35 || 1500000;
    const tzsAmt = isUsd ? Math.round(rawAmt * rate) : Math.round(rawAmt);
    const cargo = extractCleanCargo(trip.cargo_description, trip.purpose || meta?.purpose);
    const vehicleRef = trip.machines?.plate_number || trip.machines?.name || "Heavy Fleet Truck";
    const client = (meta?.client || trip.client_name || "").trim() || "Commercial Client";
    const orderRef = meta?.order_no ? ` · DO #${meta.order_no}` : "";

    setClientName(client);
    setSelectedMachine(trip.machine_id || "none");
    setSelectedTripForInvoice(trip.id);
    setSelectedTripIds([trip.id]);
    setLineItems([
      {
        description: `Commercial Freight Haulage: ${trip.origin || "Origin"} to ${trip.destination || "Destination"} [${vehicleRef}${orderRef}] - ${cargo || "General Freight"}`,
        quantity: 1,
        unit_price: tzsAmt > 0 ? tzsAmt : 1500000,
      },
    ]);
    setCreateModalOpen(true);
  };

  useEffect(() => {
    const targetTripId = searchParams.get("tripId");
    if (targetTripId && availableTrips.length > 0) {
      const match = availableTrips.find((t) => t.id === targetTripId);
      if (match) {
        startInvoiceForTrip(match);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("tripId");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [availableTrips, searchParams]);

  const toggleSelectTrip = (tripId: string) => {
    setSelectedTripIds((prev) =>
      prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
    );
  };

  const selectAllCustomerTrips = () => {
    if (selectedTripIds.length === matchingCustomerTrips.length) {
      setSelectedTripIds([]);
    } else {
      setSelectedTripIds(matchingCustomerTrips.map((t) => t.id));
    }
  };

  const handleApplyConsolidatedTrips = () => {
    if (selectedTripIds.length === 0) {
      toast.error("Please check at least one trip to consolidate");
      return;
    }

    const chosen = matchingCustomerTrips.filter((t) => selectedTripIds.includes(t.id));
    const newItems = chosen.map((t) => {
      const meta = parseCargoMeta(t.cargo_description);
      const rate = Number(meta?.exchange_rate) || 2600;
      const isUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";
      const rawAmt = Number(meta?.client_billing_amount) || Number(t.cost) * 1.35 || 1500000;
      const tzsAmt = isUsd ? Math.round(rawAmt * rate) : Math.round(rawAmt);
      const cargo = extractCleanCargo(t.cargo_description, t.purpose || meta?.purpose);
      const vehicleRef = t.machines?.plate_number || t.machines?.name || "Heavy Fleet Truck";
      const orderRef = meta?.order_no ? ` · DO #${meta.order_no}` : "";

      return {
        description: `Commercial Freight Haulage: ${t.origin || "Origin"} to ${t.destination || "Destination"} [${vehicleRef}${orderRef}] - ${cargo || "General Freight"}`,
        quantity: 1,
        unit_price: tzsAmt > 0 ? tzsAmt : 1500000,
      };
    });

    setLineItems(newItems);
    toast.success(`Consolidated ${newItems.length} trips into invoice line items!`);
  };

  const handleAddItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = val;
    setLineItems(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    if (!clientName.trim()) {
      toast.error("Please enter a customer/client name.");
      return;
    }

    setSubmittingInvoice(true);
    try {
      const tripIdToLink = selectedTripForInvoice || (selectedTripIds.length === 1 ? selectedTripIds[0] : undefined);
      const res = await createFinanceInvoice(organisation.id, {
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        trip_id: tripIdToLink,
        machine_id: selectedMachine !== "none" ? selectedMachine : undefined,
        due_date: dueDate,
        tax_rate_percent: Number(taxRate || 0),
        discount_amount: Number(discount || 0),
        notes,
        items: lineItems,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to create invoice");
      }

      toast.success("Invoice generated successfully!");
      setCreateModalOpen(false);
      setSelectedTripForInvoice(null);
      setSelectedTripIds([]);
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setSelectedMachine("none");
      setLineItems([{ description: "Freight Transport Services", quantity: 1, unit_price: 1500000 }]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await updateFinanceInvoicePayment(selectedInvoice.id, {
        paid_amount: Number(payAmount),
        payment_method: payMethod,
        payment_reference: payRef,
      });

      if (!res.success) {
        throw new Error(res.error || "Payment recording failed");
      }

      toast.success("Payment recorded successfully!");
      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPayAmount("");
      setPayRef("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openPaymentDialog = (inv: FinanceInvoice) => {
    setSelectedInvoice(inv);
    const balance = Math.max(Number(inv.total_amount) - Number(inv.paid_amount || 0), 0);
    setPayAmount(String(balance));
    setPaymentModalOpen(true);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <FinanceNavHeader
        title="Customers & Invoicing"
        subtitle="Freight billing, commercial client accounts, payment receipts, and Accounts Receivable."
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Customer Invoice
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Billed</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {formatMoney(metrics.totalInvoiced)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.count} commercial invoices issued
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Paid / Collected</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {formatMoney(metrics.totalCollected)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cash deposited & cleared
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Accounts Receivable</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
            {formatMoney(metrics.totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pending client balances
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Overdue Invoices</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {metrics.overdueCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Past agreed credit term
          </p>
        </div>
      </div>

      {/* Uninvoiced Fleet Trips Queue */}
      {uninvoicedTrips.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-sm">
                    Fleet Trips Pending Commercial Invoicing
                  </h3>
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs">
                    {uninvoicedSummary.count} Unbilled {uninvoicedSummary.count === 1 ? "Trip" : "Trips"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accrued freight value: <span className="font-semibold text-foreground">{formatMoney(uninvoicedSummary.estimatedValue)}</span>. Create commercial invoice with 1 click.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-amber-500/30 hover:bg-amber-500/10 text-foreground"
              onClick={() => {
                if (uninvoicedTrips.length > 0) {
                  startInvoiceForTrip(uninvoicedTrips[0]);
                }
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Bill Next Trip
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto pr-1">
            {uninvoicedTrips.slice(0, 6).map((trip) => {
              const meta = parseCargoMeta(trip.cargo_description);
              const rate = Number(meta?.exchange_rate) || 2600;
              const isUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";
              const rawAmt = Number(meta?.client_billing_amount) || Number(trip.cost) * 1.35 || 1500000;
              const tzsAmt = isUsd ? Math.round(rawAmt * rate) : Math.round(rawAmt);
              const client = meta?.client || trip.client_name || "Commercial Client";
              const plate = trip.machines?.plate_number || trip.machines?.name || "Truck";

              return (
                <div
                  key={trip.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-background/90 hover:bg-background transition-colors text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-foreground truncate">{client}</div>
                    <div className="text-muted-foreground truncate">
                      {trip.origin} → {trip.destination} · <span className="font-mono">{plate}</span>
                    </div>
                    <div className="font-medium text-emerald-600 mt-0.5">
                      {formatMoney(tzsAmt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 shrink-0"
                    onClick={() => startInvoiceForTrip(trip)}
                  >
                    Bill Trip
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice number, client name, vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Invoice Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="sent">Sent / Pending</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-medium text-muted-foreground">
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6 text-muted-foreground" />}
          title="No customer invoices found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your search criteria."
              : "Generate professional commercial freight invoices with automatic serial numbering, tax, and PDF print."
          }
          action={
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Invoice
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Invoice #</th>
                  <th className="py-3 px-4 font-semibold">Client / Customer</th>
                  <th className="py-3 px-4 font-semibold">Vehicle</th>
                  <th className="py-3 px-4 font-semibold">Issued Date</th>
                  <th className="py-3 px-4 font-semibold">Due Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => {
                  const balance = Math.max(Number(inv.total_amount) - Number(inv.paid_amount || 0), 0);
                  const isPaid = inv.status === "paid" || balance === 0;

                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{inv.client_name}</div>
                        {inv.client_phone && (
                          <div className="text-xs text-muted-foreground">{inv.client_phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                        {inv.machine ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            {inv.machine.plate_number || inv.machine.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(inv.issued_at)}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            !isPaid && new Date(inv.due_date).getTime() < Date.now()
                              ? "font-semibold text-rose-600"
                              : "text-muted-foreground"
                          }
                        >
                          {formatDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-foreground whitespace-nowrap">
                        {formatMoney(inv.total_amount, inv.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {balance > 0 ? (
                          <span className="font-semibold text-amber-600">
                            {formatMoney(balance, inv.currency)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">Paid in Full</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : inv.status === "partially_paid"
                              ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                              : new Date(inv.due_date).getTime() < Date.now()
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {inv.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Print Invoice"
                            onClick={() => setPrintInvoice(inv)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {!isPaid && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-medium"
                              onClick={() => openPaymentDialog(inv)}
                            >
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Create Commercial Customer Invoice
            </DialogTitle>
            <DialogDescription>
              Bill your client for freight transportation, logistics services, or specialized fleet contracts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="clientName" className="text-xs font-medium">Customer / Client Name *</Label>
                <Input
                  id="clientName"
                  required
                  placeholder="e.g. Dangote Cement, Bakhresa Group, Coca-Cola Bottlers"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                {uniqueClientsFromTrips.length > 0 && !clientName && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    <span className="text-[11px] text-muted-foreground">Recent Fleet Clients:</span>
                    {uniqueClientsFromTrips.slice(0, 5).map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 text-[11px] py-0 px-2 font-normal transition-colors"
                        onClick={() => setClientName(c)}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="selectedMachine" className="text-xs font-medium">Assigned Vehicle</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger id="selectedMachine">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / Unassigned</SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.plate_number || m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-Trip Consolidation Card */}
            {matchingCustomerTrips.length > 0 && (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-primary block">
                        Consolidate Multiple Trips for "{clientName}"
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Found {matchingCustomerTrips.length} commercial trip{matchingCustomerTrips.length > 1 ? "s" : ""} for this customer
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={selectAllCustomerTrips}
                    >
                      {selectedTripIds.length === matchingCustomerTrips.length ? "Deselect All" : "Select All"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleApplyConsolidatedTrips}
                      disabled={selectedTripIds.length === 0}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add {selectedTripIds.length} {selectedTripIds.length === 1 ? "Trip" : "Trips"} to Invoice
                    </Button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
                  {matchingCustomerTrips.map((t) => {
                    const meta = parseCargoMeta(t.cargo_description);
                    const cargo = extractCleanCargo(t.cargo_description, t.purpose || meta?.purpose);
                    const rate = Number(meta?.exchange_rate) || 2600;
                    const isUsd = (meta?.billing_currency || meta?.currency || "USD").toUpperCase() === "USD";
                    const rawAmt = Number(meta?.client_billing_amount) || Number(t.cost) * 1.35 || 1500000;
                    const tzsAmt = isUsd ? Math.round(rawAmt * rate) : Math.round(rawAmt);
                    const isChecked = selectedTripIds.includes(t.id);

                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleSelectTrip(t.id)}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                          isChecked ? "bg-primary/10 border-primary/40 font-medium" : "bg-card border-border hover:bg-accent/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-foreground">
                              {t.origin || "Origin"} to {t.destination || "Destination"}
                            </span>
                            <span className="text-muted-foreground ml-1.5 text-[11px]">
                              ({t.machines?.plate_number || "Truck"} · {cargo || "Cargo"})
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2 font-mono text-xs">
                          {formatMoney(tzsAmt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="clientPhone" className="text-xs font-medium">Client Phone</Label>
                <Input
                  id="clientPhone"
                  placeholder="+255 7..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="clientEmail" className="text-xs font-medium">Client Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="finance@client.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dueDate" className="text-xs font-medium">Payment Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Invoice Items / Services
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Service / cargo description"
                      className="flex-1 text-xs"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      className="w-20 text-xs text-center"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Unit Price (TZS)"
                      className="w-36 text-xs text-right"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, "unit_price", Number(e.target.value))}
                      required
                    />
                    <div className="w-28 text-right font-semibold text-xs text-foreground">
                      {formatMoney(item.quantity * item.unit_price)}
                    </div>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Taxes */}
            <div className="pt-3 border-t border-border space-y-2 text-right">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-semibold text-foreground">{formatMoney(invoiceSubtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5">
                  <span>VAT / Tax Rate (%):</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="h-6 w-16 text-center text-xs inline-block"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </span>
                <span className="font-semibold">{formatMoney(invoiceTaxAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5">
                  <span>Discount (TZS):</span>
                  <Input
                    type="number"
                    min="0"
                    className="h-6 w-24 text-right text-xs inline-block"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </span>
                <span className="font-semibold text-rose-600">- {formatMoney(Number(discount || 0))}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-primary pt-1 border-t border-border">
                <span>Total Due:</span>
                <span className="text-lg">{formatMoney(invoiceTotal)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-xs font-medium">Bank Details / Payment Instructions</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Include bank account details, SWIFT, M-Pesa Lipa Namba, or terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingInvoice}>
                {submittingInvoice ? "Generating..." : "Generate Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Record Customer Payment
            </DialogTitle>
            <DialogDescription>
              Apply customer payment against invoice{" "}
              <span className="font-mono font-semibold text-foreground">
                {selectedInvoice?.invoice_number}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            <div>
              <Label htmlFor="payAmount" className="text-xs font-medium">Payment Amount (TZS) *</Label>
              <Input
                id="payAmount"
                type="number"
                required
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="payMethod" className="text-xs font-medium">Payment Method *</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger id="payMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Wire / EFT / TISS</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money (M-Pesa / Tigo / Airtel)</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payRef" className="text-xs font-medium">Reference / Transaction Number</Label>
              <Input
                id="payRef"
                placeholder="e.g. FT234898394 or Cheque #0045"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingPayment}>
                {submittingPayment ? "Recording..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Invoice Modal */}
      {printInvoice && (
        <Dialog open={!!printInvoice} onOpenChange={() => setPrintInvoice(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <div id="printable-invoice" className="p-4 space-y-6 bg-white text-black rounded-lg">
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div className="flex items-center gap-3">
                  {organisation?.logo_url ? (
                    <img
                      src={organisation.logo_url}
                      alt={organisation?.name || "Company Logo"}
                      className="h-14 w-auto max-w-[170px] object-contain rounded"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                      {(organisation?.name || "MC").substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                      {organisation?.name || "MachineCare Fleet Hub"}
                    </h2>
                    <p className="text-xs text-gray-500">Commercial Freight & Heavy Haulage Fleet</p>
                    {organisation?.email && <p className="text-[11px] text-gray-400">{organisation.email}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-primary">
                    {printInvoice.invoice_number}
                  </span>
                  <p className="text-xs text-gray-500">Date: {formatDate(printInvoice.issued_at)}</p>
                  <p className="text-xs font-semibold text-rose-600">
                    Due: {formatDate(printInvoice.due_date)}
                  </p>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-400">Billed To:</span>
                  <p className="text-sm font-bold text-gray-900 mt-1">{printInvoice.client_name}</p>
                  {printInvoice.client_email && <p className="text-gray-600">{printInvoice.client_email}</p>}
                  {printInvoice.client_phone && <p className="text-gray-600">{printInvoice.client_phone}</p>}
                </div>
                <div className="text-right">
                  <span className="font-bold uppercase tracking-wider text-gray-400">Operational Reference:</span>
                  {printInvoice.machine && (
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      Vehicle: {printInvoice.machine.plate_number || printInvoice.machine.name}
                    </p>
                  )}
                  {printInvoice.trip && (
                    <p className="text-xs text-gray-600">
                      Route: {printInvoice.trip.origin || "Origin"} → {printInvoice.trip.destination || "Destination"}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border border-gray-200">
                <thead className="bg-gray-100 uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(printInvoice.items || []).map((it, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-medium">{it.description}</td>
                      <td className="p-2.5 text-center">{it.quantity}</td>
                      <td className="p-2.5 text-right">{formatMoney(it.unit_price, printInvoice.currency)}</td>
                      <td className="p-2.5 text-right font-semibold">
                        {formatMoney(it.total_amount, printInvoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1.5 text-right">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-semibold">{formatMoney(printInvoice.subtotal, printInvoice.currency)}</span>
                  </div>
                  {printInvoice.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">VAT ({printInvoice.tax_rate_percent}%):</span>
                      <span className="font-semibold">{formatMoney(printInvoice.tax_amount, printInvoice.currency)}</span>
                    </div>
                  )}
                  {printInvoice.discount_amount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span>-{formatMoney(printInvoice.discount_amount, printInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t pt-2 text-gray-900">
                    <span>Total Amount:</span>
                    <span>{formatMoney(printInvoice.total_amount, printInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid to Date:</span>
                    <span className="font-semibold">{formatMoney(printInvoice.paid_amount, printInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-600 border-t pt-1">
                    <span>Balance Due:</span>
                    <span>
                      {formatMoney(
                        Math.max(printInvoice.total_amount - (printInvoice.paid_amount || 0), 0),
                        printInvoice.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Settlement & Bank Wire Details */}
              <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Official Settlement & Commercial Wire Accounts
                  </span>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">Beneficiary:</span> {bankSettings?.accountName || organisation?.name || "MachineCare Hub Ltd"}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">Primary Bank:</span> {bankSettings?.bankName || "CRDB Bank / Standard Chartered"}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">Branch:</span> {bankSettings?.branch || "Corporate Branch"} {bankSettings?.swiftCode ? ` · SWIFT: ${bankSettings.swiftCode}` : ""}
                  </p>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Direct Account Numbers
                  </span>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">TZS Account:</span> <span className="font-mono">{bankSettings?.accountNumberTzs || "0150248839200"}</span>
                  </p>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">USD Account:</span> <span className="font-mono">{bankSettings?.accountNumberUsd || "0250248839201"}</span>
                  </p>
                  {bankSettings?.lipaNumber && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-900">Merchant / Lipa Namba:</span> <span className="font-mono">{bankSettings.lipaNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              {printInvoice.notes && (
                <div className="border-t pt-3 text-xs text-gray-500">
                  <span className="font-bold text-gray-700">Payment Instructions:</span>
                  <p className="mt-1 whitespace-pre-line">{printInvoice.notes}</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setPrintInvoice(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
