import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { scheduleStatus } from "@/lib/machine-constants";
import { toast } from "sonner";

export interface ServiceNotification {
  id: string;
  schedule_name: string;
  machine_id: string;
  machine_name: string;
  next_due_date: string | null;
  status: "due_soon" | "overdue";
}

const SEEN_KEY = "machinecare:notifications:seen";

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function writeSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function useServiceNotifications(pollMs = 60_000) {
  const { profile } = useAuth();
  const [items, setItems] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const announcedRef = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("service_schedules")
      .select("id, name, next_due_date, machine_id, machines(name)")
      .order("next_due_date", { ascending: true, nullsFirst: false });
    if (error) {
      setLoading(false);
      return;
    }
    const enriched: ServiceNotification[] = (data ?? [])
      .map((s: any) => {
        const status = scheduleStatus(s.next_due_date);
        if (status === "ok") return null;
        return {
          id: s.id,
          schedule_name: s.name,
          machine_id: s.machine_id,
          machine_name: s.machines?.name ?? "Machine",
          next_due_date: s.next_due_date,
          status,
        };
      })
      .filter((x): x is ServiceNotification => x !== null);
    setItems(enriched);
    setLoading(false);

    // First-load announcement (per session) of unseen items
    if (!announcedRef.current && enriched.length > 0) {
      announcedRef.current = true;
      const seen = readSeen();
      const unseen = enriched.filter((e) => !seen.has(e.id));
      if (unseen.length > 0) {
        const overdue = unseen.filter((e) => e.status === "overdue").length;
        const due = unseen.filter((e) => e.status === "due_soon").length;
        const parts: string[] = [];
        if (overdue) parts.push(`${overdue} overdue`);
        if (due) parts.push(`${due} due soon`);
        toast.warning(`Service alert: ${parts.join(" · ")}`, {
          description:
            unseen.length === 1
              ? `${unseen[0].machine_name} — ${unseen[0].schedule_name}`
              : `${unseen.length} machines need attention.`,
          duration: 6000,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [profile, load, pollMs]);

  const markAllSeen = useCallback(() => {
    const seen = readSeen();
    items.forEach((i) => seen.add(i.id));
    writeSeen(seen);
    // force re-render of unread count
    setItems((prev) => [...prev]);
  }, [items]);

  const unreadCount = (() => {
    const seen = readSeen();
    return items.filter((i) => !seen.has(i.id)).length;
  })();

  return { items, loading, unreadCount, markAllSeen, refresh: load };
}
