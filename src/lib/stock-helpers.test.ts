import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateDefaultStockLocation, setItemStockCount, exportInventoryToExcel } from "./stock-helpers";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

describe("stock-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateDefaultStockLocation", () => {
    it("returns null if orgId is empty", async () => {
      const loc = await getOrCreateDefaultStockLocation("");
      expect(loc).toBeNull();
    });

    it("returns default stock location if one exists", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: "loc-default" }, error: null });
      const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
      const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "stock_locations") {
          return { select: selectMock };
        }
        return {};
      });

      const loc = await getOrCreateDefaultStockLocation("org-123");
      expect(loc).toBe("loc-default");
    });
  });

  describe("setItemStockCount", () => {
    it("returns error if itemId or orgId is missing", async () => {
      const res = await setItemStockCount({ itemId: "", orgId: "", targetStock: 5 });
      expect(res.success).toBe(false);
    });

    it("records stock receipt when targetStock > currentStock", async () => {
      // Mock location lookup returning loc-1
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: "loc-1" }, error: null });
      const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
      const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });

      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "stock_locations") {
          return { select: selectMock };
        }
        if (table === "inventory_items") {
          return { update: updateMock };
        }
        return {};
      });

      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      const res = await setItemStockCount({
        itemId: "item-1",
        orgId: "org-1",
        targetStock: 5,
        currentStock: 1,
        reason: "Added 4 pcs",
      });

      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith("record_stock_transaction", {
        _item_id: "item-1",
        _location_id: "loc-1",
        _transaction_type: "receipt",
        _quantity: 4,
        _reason: "Added 4 pcs",
      });
      expect(updateMock).toHaveBeenCalledWith({ quantity: 5 });
    });

    it("records stock adjustment when targetStock < currentStock", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: "loc-1" }, error: null });
      const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
      const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });

      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "stock_locations") {
          return { select: selectMock };
        }
        if (table === "inventory_items") {
          return { update: updateMock };
        }
        return {};
      });

      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      const res = await setItemStockCount({
        itemId: "item-1",
        orgId: "org-1",
        targetStock: 2,
        currentStock: 5,
        reason: "Adjusted count",
      });

      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith("record_stock_transaction", {
        _item_id: "item-1",
        _location_id: "loc-1",
        _transaction_type: "adjustment",
        _quantity: -3,
        _reason: "Adjusted count",
      });
      expect(updateMock).toHaveBeenCalledWith({ quantity: 2 });
    });
  });

  describe("exportInventoryToExcel", () => {
    it("generates an Excel download with items and available stock", () => {
      // Mock createObjectURL & revokeObjectURL
      const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const appendChildMock = vi.spyOn(document.body, "appendChild");
      const removeChildMock = vi.spyOn(document.body, "removeChild");

      const items = [
        {
          id: "item-1",
          name: "Brakepad Front",
          part_number: "BP-001",
          vehicle_model: "Hilux",
          brand: "Toyota",
          category: "spare_part",
          quantity: 2,
          unit: "pcs",
          unit_cost: 25000,
          selling_price: 40000,
          reorder_level: 2,
          notes: "Shelf A1",
          status: "active",
        },
      ];

      const available = { "item-1": 5 };

      exportInventoryToExcel(items, available, "test_export.xlsx");

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(appendChildMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });
  });
});
