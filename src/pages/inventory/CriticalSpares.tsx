import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

export default function CriticalSpares() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [machinesByItem, setMachinesByItem] = useState<Record<string, string[]>>({});
  const [machineIdsByItem, setMachineIdsByItem] = useState<Record<string, string[]>>({});
  const [machineFilter, setMachineFilter] = useState("all");
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: i, error: e1 }, { data: b, error: e2 }, { data: mp, error: e3 }, { data: m }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, part_number, unit, unit_cost").eq("criticality", "critical").eq("status", "active").order("name"),
        (supabase as any).from("stock_balances").select("item_id, available_stock"),
        (supabase as any).from("machine_parts").select("item_id, machine_id, machines(id, name)"),
        supabase.from("machines").select("id, name").order("name"),
      ]);
      const err = e1 || e2 || e3;
      if (err) toast.error(err.message);
      setItems(i ?? []);
      setMachines(m ?? []);
      const balMap: Record<string, number> = {};
      (b ?? []).forEach((row: any) => { balMap[row.item_id] = (balMap[row.item_id] ?? 0) + Number(row.available_stock); });
      setAvailable(balMap);
      const machMap: Record<string, string[]> = {};
      const machIdMap: Record<string, string[]> = {};
      (mp ?? []).forEach((row: any) => {
        (machMap[row.item_id] ??= []).push(row.machines?.name ?? "—");
        (machIdMap[row.item_id] ??= []).push(row.machine_id);
      });
      setMachinesByItem(machMap);
      setMachineIdsByItem(machIdMap);
      setLoading(false);
    })();
  }, [profile]);

  const filtered = useMemo(() => {
    if (machineFilter === "all") return items;
    return items.filter((i) => (machineIdsByItem[i.id] ?? []).includes(machineFilter));
  }, [items, machineFilter, machineIdsByItem]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avail = filtered.filter((i) => (available[i.id] ?? 0) > 0).length;
    const missing = total - avail;
    const coverage = total > 0 ? Math.round((avail / total) * 100) : 100;
    return { total, avail, missing, coverage };
  }, [filtered, available]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Critical spares</h1>
        <p className="text-sm text-muted-foreground">Parts marked critical — losing these blocks maintenance outright.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All machines</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Critical parts", value: stats.total },
          { label: "Available", value: stats.avail, tone: "text-emerald-600" },
          { label: "Missing", value: stats.missing, tone: stats.missing > 0 ? "text-red-600" : "" },
          { label: "Coverage", value: `${stats.coverage}%`, tone: stats.coverage < 100 ? "text-amber-600" : "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="No critical spares" description="Mark items as criticality = critical in Items & spare parts." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Part</th>
                <th className="px-5 py-3 font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Machines</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const avail = available[i.id] ?? 0;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium">{i.name}</div>
                      {i.part_number && <div className="text-xs text-muted-foreground">{i.part_number}</div>}
                    </td>
                    <td className="px-5 py-3">{formatNumber(avail)} {i.unit}</td>
                    <td className="px-5 py-3 text-muted-foreground">{(machinesByItem[i.id] ?? []).join(", ") || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${avail > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {avail > 0 ? "Available" : "Missing"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
