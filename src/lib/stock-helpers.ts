import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a valid stock location for an organisation:
 * 1. Default stock location (is_default = true)
 * 2. Any active stock location for the org
 * 3. Auto-creates a "Main Store" default location if none exists
 */
export async function getOrCreateDefaultStockLocation(orgId: string): Promise<string | null> {
  if (!orgId) return null;

  try {
    // 1. Check for is_default location
    const { data: defaultLoc } = await (supabase as any)
      .from("stock_locations")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultLoc?.id) return defaultLoc.id;

    // 2. Check for any existing location for this org
    const { data: anyLoc } = await (supabase as any)
      .from("stock_locations")
      .select("id")
      .eq("organisation_id", orgId)
      .limit(1)
      .maybeSingle();

    if (anyLoc?.id) return anyLoc.id;

    // 3. Auto-create "Main Store" as default location
    const { data: created, error } = await (supabase as any)
      .from("stock_locations")
      .insert({
        organisation_id: orgId,
        name: "Main Store",
        is_default: true,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("Could not auto-create default stock location:", error);
      return null;
    }

    return created?.id ?? null;
  } catch (err) {
    console.error("Error resolving stock location:", err);
    return null;
  }
}

/**
 * Sets or adjusts the stock count for an inventory item.
 * Ensures stock_balances and inventory_items.quantity are synchronized.
 */
export async function setItemStockCount({
  itemId,
  orgId,
  targetStock,
  currentStock,
  reason = "Stock update",
}: {
  itemId: string;
  orgId: string;
  targetStock: number;
  currentStock?: number;
  reason?: string;
}): Promise<{ success: boolean; error?: any }> {
  if (!itemId || !orgId) return { success: false, error: new Error("Missing itemId or orgId") };

  const target = Math.max(0, targetStock);
  const locId = await getOrCreateDefaultStockLocation(orgId);

  // If currentStock is not provided, fetch it
  let cur = currentStock;
  if (cur === undefined) {
    if (locId) {
      const { data: bal } = await (supabase as any)
        .from("stock_balances")
        .select("physical_stock")
        .eq("item_id", itemId)
        .eq("location_id", locId)
        .maybeSingle();
      if (bal) {
        cur = Number(bal.physical_stock);
      }
    }
    if (cur === undefined) {
      const { data: itm } = await (supabase as any)
        .from("inventory_items")
        .select("quantity")
        .eq("id", itemId)
        .maybeSingle();
      cur = Number(itm?.quantity ?? 0);
    }
  }

  const delta = target - (cur ?? 0);

  if (delta === 0) {
    // Count is already matching, ensure balance row exists
    if (locId) {
      try {
        await (supabase as any).from("stock_balances").upsert({
          organisation_id: orgId,
          item_id: itemId,
          location_id: locId,
          physical_stock: target,
        }, { onConflict: "item_id,location_id" });
      } catch (err) {
        console.warn("Direct balance upsert note:", err);
      }
    }
    await (supabase as any).from("inventory_items").update({ quantity: target }).eq("id", itemId);
    return { success: true };
  }

  // Record stock transaction via RPC if possible
  let rpcSuccess = false;
  if (locId) {
    const txnType = delta > 0 ? "receipt" : "adjustment";
    const { error: rpcErr } = await (supabase as any).rpc("record_stock_transaction", {
      _item_id: itemId,
      _location_id: locId,
      _transaction_type: txnType,
      _quantity: delta,
      _reason: reason || (delta > 0 ? "Stock added" : "Stock count adjusted"),
    });

    if (!rpcErr) {
      rpcSuccess = true;
    } else {
      console.warn("record_stock_transaction error, falling back to direct upsert:", rpcErr);
    }
  }

  // Safety fallback: ensure stock_balances has the correct physical stock
  if (!rpcSuccess && locId) {
    try {
      await (supabase as any).from("stock_balances").upsert({
        organisation_id: orgId,
        item_id: itemId,
        location_id: locId,
        physical_stock: target,
      }, { onConflict: "item_id,location_id" });
    } catch (err) {
      console.warn("Direct stock_balances upsert error:", err);
    }
  }

  // Also ensure inventory_items.quantity is updated
  await (supabase as any).from("inventory_items").update({ quantity: target }).eq("id", itemId);

  return { success: true };
}
