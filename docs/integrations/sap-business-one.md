# SAP Business One Connector Specification

## 1. Architecture Overview

The MachineCare SAP Business One Connector utilizes the **SAP Business One Service Layer**, exposing standard OData RESTful HTTP services.

Endpoints follow the convention:
```text
https://{sap_server}:{port}/b1s/v1/{EntitySet}
```

Authentication is managed via `/b1s/v1/Login` returning `B1SESSION` and `ROUTEID` cookies:
```json
{
  "CompanyDB": "SBODEMOUS",
  "UserName": "manager",
  "Password": "••••••••"
}
```

---

## 2. Business Objects Mapping

* **Items (`/b1s/v1/Items`)**: `ItemCode`, `ItemName`, `QuantityOnStock`, `AvgStdPrice` map to MachineCare `Part`.
* **Business Partners (`/b1s/v1/BusinessPartners`)**: `CardType eq 'cCustomer'` or `cSupplier` map to MachineCare `Customer` / `Supplier`.
* **Warehouses (`/b1s/v1/Warehouses`)**: Storage facilities map to MachineCare `Warehouse`.
* **Production Orders (`/b1s/v1/ProductionOrders`)**: Production schedules map to MachineCare `ProductionOrder`.
* **Outbound Purchase Requests (`/b1s/v1/PurchaseRequests`)**: Created automatically when maintenance spares require procurement.
* **Outbound Journal Entries (`/b1s/v1/JournalEntries`)**: Financial maintenance costs recorded into the general ledger.
