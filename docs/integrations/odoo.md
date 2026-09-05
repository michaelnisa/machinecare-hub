# Odoo Connector Specification

## 1. Architecture Overview

The MachineCare Odoo Connector is built against the **Odoo 19+ JSON-2 API architecture**, superseding legacy XML-RPC endpoints.

Endpoints are accessed via:
```text
POST {base_url}/json/2/{model}/{method}
```

Authentication is handled via Bearer API Key headers:
```text
Authorization: Bearer <odoo_api_key>
X-Odoo-Database: <database_name>
Content-Type: application/json
```

---

## 2. Inbound Data Flows (Odoo -> MachineCare)

* **Assets / Maintenance Equipment**: Odoo model `maintenance.equipment` is queried for serial numbers, models, and locations, and mapped to MachineCare `Asset`.
* **Spare Parts**: Odoo model `product.product` provides master part numbers (`default_code`), UOMs, and standard unit costs.
* **Inventory Balances**: Odoo model `stock.quant` provides available and reserved quantities across warehouse locations.
* **Customers & Vendors**: Odoo model `res.partner` provides business partner contact info and tax IDs.
* **Production Orders**: Odoo model `mrp.production` provides planned production batches.

---

## 3. Outbound Data Flows (MachineCare -> Odoo)

* **Purchase Requests**: When inventory levels breach reorder thresholds or a work order requires unstocked parts, MachineCare pushes a requisition to Odoo `purchase.requisition` / `purchase.order`.
* **Maintenance Costs**: Completed work orders dispatch analytical accounting journal lines to Odoo `account.analytic.line`.
* **Production Attainment**: MachineCare pushes actual quantities, scrap counts, and downtime hours back to Odoo `mrp.production`.

---

## 4. Connection Configuration

```json
{
  "base_url": "https://mycompany.odoo.com",
  "company_identifier": "my_production_db",
  "credentials": {
    "api_key": "••••••••••••••••",
    "username": "machinecare_sync@mycompany.com"
  }
}
```
