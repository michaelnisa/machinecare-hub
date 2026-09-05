# Microsoft Dynamics 365 Business Central Connector Specification

## 1. Architecture Overview

The Dynamics 365 Connector integrates with Microsoft Business Central cloud via standard **API v2.0 REST endpoints** and **Azure Active Directory OAuth 2.0 Client Credentials Grant**.

Authentication Endpoint:
```text
POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
grant_type: client_credentials
client_id: {client_id}
client_secret: {client_secret}
scope: https://api.businesscentral.dynamics.com/.default
```

API Root:
```text
GET https://api.businesscentral.dynamics.com/v2.0/{environment}/api/v2.0/companies({company_id})/{entity_set}
```

---

## 2. Supported Entities

* `items` -> MachineCare `Part`
* `locations` -> MachineCare `Warehouse`
* `customers` -> MachineCare `Customer`
* `vendors` -> MachineCare `Supplier`
* `purchaseOrders` -> MachineCare `PurchaseOrder`
* Outbound: `journalLines` -> MachineCare `MaintenanceCost`
* Outbound: `purchaseOrders` -> MachineCare `PurchaseRequest`
