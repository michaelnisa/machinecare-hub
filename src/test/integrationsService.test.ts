import { describe, it, expect } from "vitest";
import { integrationsService, CONNECTOR_CATALOG } from "@/services/integrationsService";
import type { FieldMappingRule } from "@/types/integrations";

describe("integrationsService", () => {
  it("should provide marketplace catalog with Odoo, SAP B1, and Dynamics 365", () => {
    const catalog = integrationsService.getMarketplaceCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(3);

    const slugs = catalog.map((c) => c.slug);
    expect(slugs).toContain("odoo");
    expect(slugs).toContain("sap_business_one");
    expect(slugs).toContain("dynamics_365");
    expect(slugs).toContain("maximo");

    const maximo = catalog.find((c) => c.slug === "maximo");
    expect(maximo?.category).toBe("EAM");
    expect(maximo?.version).toContain("OSLC");
    expect(maximo?.capabilities.read).toContain("work_orders");
    expect(maximo?.capabilities.write).toContain("meter_readings");

    const odoo = catalog.find((c) => c.slug === "odoo");
    expect(odoo?.version).toContain("JSON-2");
    expect(odoo?.capabilities.read).toContain("parts");
  });

  it("should list connected systems with health indicators", () => {
    const systems = integrationsService.getConnectedSystems();
    expect(systems.length).toBeGreaterThanOrEqual(2);

    const odooSystem = systems.find((s) => s.connector_type === "odoo");
    expect(odooSystem).toBeDefined();
    expect(odooSystem?.status).toBe("healthy");
    expect(odooSystem?.health_details?.synced_records_count?.parts).toBeGreaterThan(0);
  });

  it("should test ERP connection", async () => {
    const res = await integrationsService.testConnection({
      connector_type: "odoo",
      base_url: "https://test.odoo.com",
      company_identifier: "prod_db",
      credentials: { api_key: "test_key", username: "bot" },
    });

    expect(res.success).toBe(true);
    expect(res.latency_ms).toBeGreaterThan(0);
    expect(res.message).toContain("Odoo");

    const maximoRes = await integrationsService.testConnection({
      connector_type: "maximo",
      base_url: "https://maximo.corp.local",
      company_identifier: "PIT_NORTH",
      credentials: { api_key: "test_maximo_key" },
    });

    expect(maximoRes.success).toBe(true);
    expect(maximoRes.latency_ms).toBeGreaterThan(0);
    expect(maximoRes.message).toContain("IBM Maximo");
  });

  it("should transform data correctly using testMappingPreview", () => {
    const sourceData = {
      default_code: "P-001",
      name: "Cat Air Filter",
      qty_available: 50,
      status_text: "available",
    };

    const rules: FieldMappingRule[] = [
      { source_field: "default_code", target_field: "part_number", transform_type: "direct" },
      { source_field: "name", target_field: "name", transform_type: "direct" },
      { source_field: "qty_available", target_field: "available_quantity", transform_type: "direct" },
      {
        source_field: "status_text",
        target_field: "status",
        transform_type: "enum_map",
        transform_config: { mapping: { available: "active" } },
      },
    ];

    const mapped = integrationsService.testMappingPreview(sourceData, rules);
    expect(mapped.part_number).toBe("P-001");
    expect(mapped.name).toBe("Cat Air Filter");
    expect(mapped.available_quantity).toBe(50);
    expect(mapped.status).toBe("active");
  });

  it("should trigger manual sync and generate sync job records", async () => {
    const job = await integrationsService.triggerSyncNow("int_odoo_prod", "parts");
    expect(job.status).toBe("completed");
    expect(job.records_processed).toBeGreaterThan(0);

    const jobs = integrationsService.getSyncJobs();
    expect(jobs[0].id).toBe(job.id);
  });

  it("should handle error retry and dead-letter transitions", async () => {
    const errors = integrationsService.getErrors();
    const errorId = errors[0].id;
    const initialRetry = errors[0].retry_count;

    const updated = await integrationsService.retryError(errorId);
    expect(updated?.retry_count).toBe(initialRetry + 1);
  });
});
