import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

export interface MachineOption {
  id: string;
  name: string;
  status?: string | null;
  current_hours?: number | null;
  category?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  registration_number?: string | null;
  serial_number?: string | null;
}

export function MachineSearchSelect({
  machines,
  value,
  onChange,
}: {
  machines: MachineOption[];
  value: string;
  onChange: (id: string, m: MachineOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [lastService, setLastService] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);

  const selected = machines.find((m) => m.id === value) ?? null;

  useEffect(() => {
    if (!value) { setLastService(null); setOpenCount(0); return; }
    (async () => {
      const [{ data: sl }, { count }] = await Promise.all([
        supabase.from("service_logs").select("performed_at").eq("machine_id", value).order("performed_at", { ascending: false }).limit(1),
        supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("machine_id", value).in("status", ["open", "assigned", "in_progress", "waiting_parts"]),
      ]);
      setLastService(sl?.[0]?.performed_at ?? null);
      setOpenCount(count ?? 0);
    })();
  }, [value]);

  const filtered = query
    ? machines.filter((m) =>
        [m.name, m.registration_number, m.serial_number, m.make, m.model].filter(Boolean).some((s) => s!.toLowerCase().includes(query.toLowerCase()))
      )
    : machines;

  return (
    <div className="space-y-2">
      <Label>Machine *</Label>
      <div className="relative">
        <Input
          value={selected && !open ? `${selected.name}${selected.registration_number ? ` · ${selected.registration_number}` : ""}` : query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search machines…"
        />
        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>}
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(m.id, m); setOpen(false); setQuery(""); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[m.make, m.model, m.registration_number ?? m.serial_number].filter(Boolean).join(" · ") || m.category}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Status:</span> {selected.status ?? "—"}</div>
            <div><span className="text-muted-foreground">Hrs/km:</span> {selected.current_hours ?? "—"}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Last service:</span> {formatDate(lastService)}</div>
          </div>
          {openCount > 0 && (
            <Link
              to={`/work-orders?machine=${selected.id}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {openCount} open work order{openCount > 1 ? "s" : ""} — view
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
