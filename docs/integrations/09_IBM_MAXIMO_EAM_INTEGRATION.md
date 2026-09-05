# IBM Maximo Enterprise Asset Management (EAM) Integration Guide

## 1. Strategic Architecture & Positioning

MachineCare treats **IBM Maximo** as an **Enterprise Asset Management (EAM) system of record**, distinct from traditional ERP financial engines. 

```
                               IBM MAXIMO
                       (Enterprise System of Record)
                       - Asset Hierarchies & Sites
                       - Enterprise Work Orders & Job Plans
                       - PM Schedules & Calendars
                       - MRO Item Master & Storerooms
                                    │
                            (OSLC REST APIs)
                                    │
    ┌───────────────────────────────▼───────────────────────────────┐
    │              MachineCare Integration Platform                 │
    │  - Universal Canonical Domain Models (Asset, WO, Meter, Part) │
    │  - OSLC REST Connector Adapter (MaximoConnector)              │
    │  - High-Frequency Telemetry Pipeline (Meter Readings)         │
    │  - Conflict Resolution, Dead-Letter Queue & Audit Logs        │
    └───────────────────────────────▲───────────────────────────────┘
                                    │
                   MachineCare Operational Intelligence
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
Connected Data / IoT          Shopfloor Production         Workshop & Field
(CAN-bus, Hours, Temps)     (Downtime, Scrap, OEE)       (Mobile Checklists)
```

### Strategic Division of Responsibilities

| Domain Responsibility | IBM Maximo (EAM) | MachineCare Operational Intelligence |
|---|---|---|
| **Authoritative Asset Registry** | **Master** (Hierarchies, Parents, Locations, Sites) | Replica with live sensor enrichment |
| **Telemetry & Condition Monitoring** | Continuous & Gauge Meter Target | **Collector & Stream Processor** (CAN, IoT, PLC) |
| **Preventive Maintenance (PM)** | **Master** (Job plans, meter-based PM triggers) | Trigger engine via automated meter updates |
| **Real-time Breakdown Alerts** | Target for Auto-Generated Service Requests (`MXSR`) | **Detector** (Anomaly & Threshold breaches) |
| **Work Order Execution** | **Master** (Assignment, Planning, Enterprise Status) | **Field Execution Tool** (Mobile actuals, photos) |
| **MRO Spare Parts Catalog** | **Master** (Item master, storerooms, standard cost) | Local stock reservation & issue logging |

---

## 2. Maximo Integration Framework (MIF) & OSLC Endpoints

The integration communicates via **NextGen Maximo REST/JSON OSLC APIs** (Maximo 7.6.1+ / Maximo Application Suite MAS 8.11+ / Manage).

### Supported Object Structures

| Object Structure | MIF Resource Name | Sync Direction | Description |
|---|---|---|---|
| `MXASSET` | `/maximo/oslc/os/mxasset` | Maximo -> MachineCare | Asset equipment records, serial numbers, hierarchies, vendor, install date |
| `MXLOCATION` | `/maximo/oslc/os/mxlocation` | Maximo -> MachineCare | Operational locations, mine pits, production lines, plants |
| `MXWO` | `/maximo/oslc/os/mxwo` | Bi-directional | Enterprise work orders, job plans, scheduled dates, technician actual costs |
| `MXMETERDATA` | `/maximo/oslc/os/mxmeterdata` | MachineCare -> Maximo | High-frequency IoT meter readings (running hours, vibration, temp, fuel) |
| `MXITEM` | `/maximo/oslc/os/mxitem` | Maximo -> MachineCare | Master catalog of maintenance spare parts |
| `MXINVENTORY` | `/maximo/oslc/os/mxinventory` | Maximo -> MachineCare | Storeroom balances, bin locations, average costs |
| `MXSR` | `/maximo/oslc/os/mxsr` | MachineCare -> Maximo | Emergency service requests generated from sensor anomalies |

---

## 3. IoT Meter Reading Synchronization Workflow

One of the highest-value capabilities of MachineCare is feeding high-frequency telematics and IoT sensor data directly into Maximo's continuous meters to trigger meter-based Preventive Maintenance (PM).

### Telemetry Payload Structure (`POST /maximo/oslc/os/mxmeterdata`)

```json
{
  "assetnum": "CAT-793D-01",
  "metername": "RUNHOURS",
  "newreading": 5240.5,
  "newreadingdate": "2026-09-05T11:30:00Z",
  "siteid": "PIT_NORTH",
  "orgid": "EAGLE_MINING",
  "inspector": "MACHINECARE_IOT_GATEWAY_4",
  "doroll": true
}
```

### Meter Types Supported

1. **Continuous Meters (`RUNHOURS`, `ODOMETER`)**: Cumulative counters with rollover support (`doroll: true`).
2. **Gauge Meters (`ENGINE_TEMP`, `OIL_PRESSURE`, `VIBRATION_PEAK`)**: Discrete snapshot values representing current physical condition.
3. **Characteristic Meters (`OIL_QUALITY`, `VISUAL_INSPECTION`)**: Descriptive condition codes.

---

## 4. Bi-directional Work Order Lifecycle

```
IBM Maximo                                                    MachineCare
    │                                                              │
    │ 1. Scheduled PM / CM WO Created (APPR)                       │
    ├─────────────────────────────────────────────────────────────►│
    │                                                              │ 2. Assigned to Field Technician
    │                                                              │ 3. Mobile Execution & Checklist
    │                                                              │ 4. Actual Parts & Labor Logged
    │ 5. WO Actuals & Completion (`POST /os/mxwo`)                 │
    │◄─────────────────────────────────────────────────────────────┤
    │                                                              │
    │ 6. WO Status -> COMP / CLOSE                                 │
    └──────────────────────────────────────────────────────────────┘
```

---

## 5. Security & Authentication Configuration

MachineCare supports two standard Maximo authentication modes:

### Mode A: Maximo API Key (Recommended)
- **Header**: `apikey: <user_api_key>`
- Generated in Maximo: **Security > API Keys > Add API Key** for service user `MACHINECARE_SYNC`.

### Mode B: MaxAuth / Basic Authentication
- **Header**: `maxauth: <base64(username:password)>` or `Authorization: Basic <base64>`

---

## 6. Verification & Troubleshooting

1. **Test Connection in Marketplace**:
   Navigate to **Settings > ERP & Systems Integrations > Marketplace > IBM Maximo**, enter your Maximo Base URL and API Key, and click **Test Connection**.
2. **Review Dead-Letter Queue (DLQ)**:
   Any schema violations or rejected OSLC payloads will automatically land in **Integration Errors** with raw JSON payloads and retry counters.
