You are a senior product architect, UX designer, database architect, and full-stack engineer specializing in industrial CMMS, MRO inventory management, warehouse management, maintenance operations, and manufacturing software.

I am building MachineCare, an industrial operations management platform.

MachineCare manages:

- Machines and equipment
- Maintenance
- Work Orders
- Production
- Inventory
- Spare Parts
- Safety
- Employees/Technicians
- Documents
- Knowledge

I want you to design and implement a COMPLETE, PROFESSIONAL INDUSTRIAL INVENTORY MANAGEMENT MODULE.

IMPORTANT:

Do NOT build Inventory as a simple list of products or a basic stock CRUD system.

MachineCare Inventory must understand:

WHAT we have
WHERE it is
HOW MUCH we have
WHAT MACHINE it belongs to
WHAT COMPONENT uses it
WHO requested it
WHO approved it
WHO received it
WHO issued it
WHO used it
WHY it was used
WHEN it was used
WHEN it needs to be reordered
WHO supplies it
HOW MUCH it costs
WHETHER it is critical
WHETHER it requires Safety approval
WHETHER it is reserved
WHETHER it is available
AND how inventory affects maintenance and production.

The goal is:

"MachineCare should allow an industrial company to manage its complete maintenance and operational inventory inside the platform, while connecting every stock movement to machines, work orders, production, safety, employees, purchasing, and costs."

==================================================
1. CORE INVENTORY PHILOSOPHY
==================================================

Inventory is not just storage.

Inventory is part of the operational workflow.

The system should connect:

MACHINE
↓
COMPONENT
↓
SPARE PART
↓
INVENTORY
↓
REQUEST
↓
APPROVAL
↓
ISSUE
↓
MAINTENANCE
↓
CONSUMPTION
↓
MACHINE HISTORY
↓
COST

For production:

PRODUCTION PLAN
↓
MATERIAL REQUIREMENT
↓
INVENTORY CHECK
↓
SHORTAGE DETECTION
↓
PURCHASE
↓
RECEIVING
↓
PRODUCTION

For Safety:

CONTROLLED ITEM
↓
SAFETY REQUIREMENT
↓
SAFETY APPROVAL
↓
INVENTORY RELEASE
↓
ISSUE
↓
RETURN
↓
INSPECTION

==================================================
2. INVENTORY MAIN NAVIGATION
==================================================

Create a dedicated Inventory module.

Navigation:

Inventory
├── Dashboard
├── Items & Spare Parts
├── Stock
├── Locations
├── Requests
├── Issue & Return
├── Reservations
├── Purchase Requests
├── Purchase Orders
├── Suppliers
├── Receiving
├── Transfers
├── Tools & Equipment
├── PPE
├── Critical Spares
├── Maintenance Parts
├── Production Materials
├── Stock Counts
├── Reorder Management
├── Consumption
├── Inventory History
└── Reports

Use a clean industrial SaaS navigation.

==================================================
3. INVENTORY DASHBOARD
==================================================

Create a professional Inventory Dashboard.

Top KPI cards:

- Total Items
- Total Stock Value
- Available Stock
- Reserved Stock
- Low Stock
- Out of Stock
- Critical Spare Parts
- Pending Requests
- Pending Purchase Orders
- Items Awaiting Return

Example:

Total Items
2,438

Stock Value
TZS 184.6M

Low Stock
18

Out of Stock
6

Critical Spares
42

Pending Requests
12

Pending Purchase Orders
7

Items Awaiting Return
5

==================================================
4. INVENTORY HEALTH
==================================================

Show:

Stock Health

GREEN = Healthy
YELLOW = Low Stock
RED = Critical / Out of Stock
GRAY = Inactive

Example:

Healthy
2,210

Low Stock
18

Critical
6

Out of Stock
4

Make these clickable filters.

==================================================
5. ITEM MASTER
==================================================

Create a complete Item Master.

An item is NOT just a name.

Example:

SKF 6205 Bearing

Fields:

- Item ID
- SKU
- Part Number
- Manufacturer Part Number
- Description
- Category
- Subcategory
- Manufacturer
- Brand
- Unit of Measure
- Item Type
- Criticality
- Status
- Barcode
- QR Code
- Image
- Technical specifications
- Notes

Item Types:

- Spare Part
- Consumable
- Raw Material
- Production Material
- Tool
- PPE
- Safety Equipment
- Chemical
- Lubricant
- Electrical Component
- Mechanical Component
- Other

==================================================
6. ITEM CRITICALITY
==================================================

Allow:

LOW
MEDIUM
HIGH
CRITICAL

Criticality affects:

- Stock requirements
- Approval rules
- Reorder rules
- Notifications
- Maintenance planning

Example:

Critical spare:

PLC module

If stock reaches zero:

RED ALERT

Notify:

- Inventory Manager
- Maintenance Manager
- Operations Manager

==================================================
7. STOCK SETTINGS
==================================================

Every stock item should support:

- Minimum stock
- Maximum stock
- Reorder point
- Reorder quantity
- Safety stock
- Lead time
- Average monthly consumption
- Preferred supplier
- Backup supplier

Example:

SKF 6205

Minimum:
4

Reorder Point:
6

Maximum:
20

Reorder Quantity:
10

Lead Time:
14 days

Safety Stock:
4

Current Stock:
3

System status:

RED — Below Minimum

==================================================
8. MACHINE / PART RELATIONSHIP
==================================================

This is one of the most important MachineCare features.

Inventory must know which machines use each part.

Example:

SKF 6205

Used in:

- Filling Machine #1
- Filling Machine #2
- Conveyor #1
- Conveyor #2
- Labeling Machine

When viewing the part:

"Machines using this part: 5"

When viewing a machine:

"Required Spare Parts: 32"

==================================================
9. MACHINE COMPONENT HIERARCHY
==================================================

Support:

Machine
↓
System
↓
Component
↓
Part

Example:

3-in-1 Filler
↓
Conveyor System
↓
Drive Assembly
↓
Bearing
↓
SKF 6205

The system must maintain these relationships.

==================================================
10. STOCK LOCATIONS
==================================================

Support multiple warehouses and storage areas.

Examples:

- Main Store
- Maintenance Store
- Electrical Store
- Mechanical Store
- Production Store
- Tool Store
- Chemical Store
- PPE Store
- Quarantine Area

Each location should have:

- Location ID
- Name
- Site
- Building
- Area
- Manager
- Status

==================================================
11. BIN MANAGEMENT
==================================================

Support precise storage locations.

Example:

Main Store
→ Aisle 3
→ Rack B
→ Shelf 4
→ Bin 07

Item:

SKF 6205

Location:

A3-B-4-07

Allow QR/barcode scanning.

==================================================
12. STOCK QUANTITY MODEL
==================================================

Do NOT use only one quantity field.

Track:

Physical Stock
Reserved Stock
Available Stock
On Order
In Transit
Quarantine
Damaged
Minimum Stock
Safety Stock

Formula:

Available Stock =
Physical Stock - Reserved Stock - Quarantine/Damaged Stock

Example:

Physical:
10

Reserved:
4

Available:
6

On Order:
20

==================================================
13. MATERIAL REQUESTS
==================================================

Create a Material Request system.

A technician should be able to request materials from a Work Order.

Example:

Work Order:
WO-00241

Machine:
Filling Machine #1

Part:
SKF 6205

Quantity:
2

Reason:
Replace conveyor bearing

Requester:
John

Status:
Pending

==================================================
14. REQUEST APPROVAL
==================================================

Inventory Manager receives:

NEW MATERIAL REQUEST

Show:

- Requester
- Department
- Work Order
- Machine
- Part
- Quantity
- Available stock
- Reserved stock
- Remaining stock after issue
- Criticality

Actions:

Approve
Approve Partial
Reject
Request More Information
Purchase Required

Example warning:

"Approving this request will reduce stock below minimum level."

==================================================
15. SAFETY + INVENTORY INTEGRATION
==================================================

Some inventory items are controlled.

Examples:

- Welding machine
- Gas equipment
- Electrical tester
- Lifting equipment
- Chemicals
- Special PPE
- Confined-space equipment

Each item can have:

Safety Approval Required = YES/NO

If YES:

Employee requests item
↓
MachineCare checks work order
↓
Safety approval required
↓
Safety reviews
↓
Approved
↓
Inventory can issue item

Do NOT allow the storekeeper to issue a controlled item until required approvals are complete.

==================================================
16. ISSUE MATERIAL
==================================================

Create a proper Issue workflow.

Example:

Part:
SKF 6205

Quantity:
2

Issued To:
John

Department:
Maintenance

Machine:
Filling Machine #1

Work Order:
WO-00241

Issued By:
Storekeeper

Date/time:
14 Aug 2026 09:30

After issuing:

Stock:
3 → 1

Create permanent inventory transaction.

==================================================
17. RETURN MATERIAL
==================================================

Allow materials to be returned.

Example:

Issued:
5

Used:
3

Returned:
2

Return condition:

- Unused
- Used but serviceable
- Damaged
- Scrap

Stock must update automatically.

Record:

- Who returned
- When
- Condition
- Reason
- Work Order

==================================================
18. RESERVATIONS
==================================================

Allow parts to be reserved for future work.

Example:

Tomorrow:

Filler major maintenance

Required:

4 Bearings
2 Belts
1 Seal Kit
20L Gearbox Oil

MachineCare reserves them.

Example:

Physical Stock:
10

Reserved:
4

Available:
6

Other users cannot consume reserved stock without authorization.

==================================================
19. MAINTENANCE INTEGRATION
==================================================

This is critical.

When a Preventive Maintenance task is scheduled:

Example:

Compressor Service

Required parts:

- Oil Filter x1
- Air Filter x1
- Separator x1
- Oil x20L

MachineCare automatically checks Inventory.

Show:

Oil Filter
GREEN — Available

Air Filter
GREEN — Available

Oil
GREEN — Available

Separator
RED — Missing

Display:

"Maintenance cannot be fully prepared because Separator is unavailable."

Allow:

Reserve Available Parts
Create Purchase Request

==================================================
20. PRODUCTION MATERIAL INTEGRATION
==================================================

Inventory must connect with Production.

Example:

Production target:
100,000 bottles

Required materials:

PET bottles/preforms
100,000

Caps
100,000

Labels
100,000

Packaging film
Required quantity

MachineCare compares:

Required
vs
Available
vs
Reserved
vs
On Order

Example:

Bottle Caps:

Required:
100,000

Available:
75,000

Shortage:
25,000

Display:

RED:
"25,000 bottle caps short for planned production."

==================================================
21. AUTOMATIC REORDER
==================================================

When stock reaches reorder point:

Create:

REORDER REQUIRED

Example:

SKF 6205

Current:
3

Reorder Point:
6

Recommended Order:
10

Reason:
Below reorder point

Also show:

Average monthly usage:
8

Lead time:
14 days

Safety stock:
4

Allow:

Create Purchase Request

==================================================
22. DEMAND FORECASTING
==================================================

Track historical consumption.

Example:

January:
5

February:
7

March:
8

April:
9

May:
11

June:
10

Use historical consumption to estimate future demand.

Example:

Expected next month:
11–13 units

Recommended order:
15 units

Do NOT present this as guaranteed AI prediction.

Clearly label it as:

"Recommended forecast"

Allow manual override.

==================================================
23. PURCHASE REQUEST
==================================================

Create Purchase Requests.

Fields:

- PR number
- Requested by
- Department
- Item
- Quantity
- Reason
- Priority
- Required date
- Estimated price
- Supplier
- Work Order if applicable
- Production Order if applicable
- Status

Statuses:

Draft
Submitted
Pending Approval
Approved
Rejected
Converted to PO
Cancelled

==================================================
24. PURCHASE APPROVAL WORKFLOW
==================================================

Configurable approval workflow:

Storekeeper
↓
Inventory Manager
↓
Maintenance Manager / Production Manager
↓
Finance
↓
Procurement

Allow companies to configure approval thresholds.

Example:

Below TZS 500,000:
Inventory Manager

TZS 500,000–5M:
Department Manager

Above TZS 5M:
Finance/Management

Do not hardcode these amounts.

==================================================
25. PURCHASE ORDERS
==================================================

Create Purchase Orders.

Fields:

- PO number
- Supplier
- Items
- Quantities
- Unit price
- Tax
- Total
- Currency
- Delivery date
- Payment terms
- Status
- Purchase Request
- Approval history

Statuses:

Draft
Pending Approval
Approved
Sent
Partially Received
Received
Cancelled
Closed

==================================================
26. SUPPLIER MANAGEMENT
==================================================

Create Supplier profiles.

Fields:

- Supplier name
- Contact
- Phone
- Email
- Address
- Categories
- Payment terms
- Currency
- Lead time
- Rating
- Documents

Track supplier performance:

- On-time delivery %
- Average lead time
- Quality rejection %
- Total purchases
- Number of orders
- Average price

==================================================
27. GOODS RECEIVING
==================================================

Create receiving workflow.

Example:

PO:
PO-00182

Ordered:
15

Received:
15

Accepted:
14

Rejected:
1

Reason:
Damaged

Only accepted quantity becomes available stock.

Workflow:

Purchase Order
↓
Goods Received
↓
Inspection if required
↓
Accepted
↓
Inventory Updated

==================================================
28. QUARANTINE
==================================================

Some received items should not immediately become available.

Create:

QUARANTINE STOCK

Reasons:

- Quality inspection
- Damaged
- Wrong item
- Expired
- Documentation missing
- Awaiting approval

Statuses:

Quarantine
Approved
Rejected
Returned to Supplier

==================================================
29. QUALITY INSPECTION
==================================================

Certain inventory types can require inspection.

Examples:

- Critical spare parts
- Electrical components
- Safety equipment
- Lifting equipment
- Chemicals
- Calibration equipment

Allow configurable inspection checklists.

==================================================
30. TOOL MANAGEMENT
==================================================

Create a separate Tool Management system.

Tools:

- Torque wrench
- Multimeter
- Insulation tester
- Welding machine
- Hydraulic jack
- Bearing puller
- Impact wrench
- Pressure tester

Fields:

- Tool ID
- Serial number
- Manufacturer
- Model
- Location
- Condition
- Calibration status
- Calibration date
- Next calibration
- Assigned person
- Safety approval required
- Status

Statuses:

Available
Issued
Reserved
Under Maintenance
Under Calibration
Lost
Damaged
Retired

==================================================
31. TOOL CHECKOUT / RETURN
==================================================

Workflow:

Employee requests tool
↓
System checks authorization
↓
Safety approval if required
↓
Storekeeper issues
↓
Employee acknowledges
↓
Tool used
↓
Tool returned
↓
Condition inspected
↓
Available again

Record every transaction.

==================================================
32. CALIBRATION MANAGEMENT
==================================================

Track calibration for:

- Torque wrenches
- Pressure gauges
- Multimeters
- Weighing scales
- Temperature meters
- pH meters
- Flow meters
- Laboratory instruments

Alerts:

30 days
14 days
7 days
Expired

If calibration is expired:

Display:

RED:
"Tool cannot be issued because calibration has expired."

Allow company policy to determine whether checkout is blocked.

==================================================
33. PPE INVENTORY
==================================================

Integrate PPE with Safety.

Track:

- Helmet
- Gloves
- Safety shoes
- Goggles
- Face shield
- Respirator
- Ear protection
- Harness
- Reflective vest

Fields:

- Size
- Employee
- Issue date
- Expiry
- Condition
- Replacement date
- Stock quantity

Safety can define required PPE for activities.

==================================================
34. CONSUMABLES
==================================================

Inventory should support consumables.

Maintenance:

- Lubricants
- Grease
- Filters
- Welding rods
- Grinding discs
- Bolts
- Nuts
- Cleaning materials
- Electrical tape

Production:

- PET preforms
- Bottle caps
- Labels
- Packaging film
- Cartons
- Ink
- CO2
- Chemicals

==================================================
35. CRITICAL SPARES
==================================================

Create a dedicated Critical Spares view.

Examples:

- PLC
- VFD
- Motor
- Gearbox
- Pump
- Filler valve
- Critical bearing
- Pressure sensor
- Proximity sensor

Show:

Critical Parts:
42

Available:
37

Missing:
5

Coverage:
88%

Allow filtering by:

Machine
Production Line
Site
Criticality

==================================================
36. STOCK TRANSFERS
==================================================

Support movement between locations.

Example:

Main Store
↓
Maintenance Store

Transfer:

SKF 6205
Quantity:
5

Record:

- Source
- Destination
- User
- Date
- Reason
- Approval if required

Stock should update atomically.

==================================================
37. STOCK COUNT / STOCKTAKE
==================================================

Create stock counting functionality.

Types:

- Full stocktake
- Cycle count
- Category count
- Location count
- Critical spare count

Example:

Expected:
10

Physical:
9

Difference:
-1

Require reason.

Possible reasons:

- Damaged
- Lost
- Wrong entry
- Unrecorded issue
- Unrecorded receipt

Require approval for adjustments according to company policy.

==================================================
38. QR / BARCODE SCANNING
==================================================

Support QR and barcode workflows.

Scanning an item should show:

- Item
- Stock
- Location
- Reserved
- Available
- Supplier
- Machines using it
- Recent transactions

Scanning a tool:

- Tool
- Current user
- Status
- Calibration
- Safety requirements

Scanning a machine:

- Machine
- Required parts
- Open work orders
- Recent part consumption

==================================================
39. INVENTORY TRANSACTION HISTORY
==================================================

Every stock movement must create an immutable transaction record.

Types:

- Receipt
- Issue
- Return
- Transfer
- Reservation
- Release
- Adjustment
- Damage
- Scrap
- Consumption
- Purchase
- Stock count adjustment

Example:

01 Aug
+10 Received

04 Aug
-2 Issued

07 Aug
-1 Issued

10 Aug
+2 Returned

12 Aug
-3 Issued

Show:

- User
- Date/time
- Quantity
- From location
- To location
- Reason
- Work Order
- Machine
- Reference

==================================================
40. INVENTORY COST
==================================================

Track financial value.

Show:

- Total stock value
- Maintenance inventory cost
- Production material value
- PPE value
- Tool value
- Monthly consumption cost
- Emergency purchase cost
- Dead stock value
- Stock adjustment value

For parts consumed by maintenance:

Connect cost to:

Machine
Work Order
Maintenance activity

Example:

Filling Machine #1

Maintenance parts this month:
TZS 1,240,000

==================================================
41. DEAD STOCK
==================================================

Identify items with no movement.

Example:

Item:
Old Pump Seal

Quantity:
25

Last movement:
14 months ago

Value:
TZS 1.2M

Status:

Potential Dead Stock

Allow filtering:

3 months
6 months
12 months
24 months

==================================================
42. MAINTENANCE COST ANALYSIS
==================================================

Show which machines consume the most spare parts.

Example:

Top machines by spare parts cost:

1. Filling Line #1 — TZS 4.8M
2. Blower #1 — TZS 3.2M
3. Compressor #1 — TZS 2.9M
4. Labeler #1 — TZS 1.7M

This should link directly to Machine history.

==================================================
43. PRODUCTION MATERIAL ANALYSIS
==================================================

Show material consumption against production.

Example:

Production:
100,000 bottles

Expected caps:
100,000

Actual caps consumed:
101,800

Variance:
+1,800

This can indicate:

- Waste
- Production loss
- Inventory error
- Process issue

Do not assume the reason automatically.

Flag the variance for investigation.

==================================================
44. INVENTORY REPORTS
==================================================

Create reports:

- Stock valuation
- Stock movement
- Stock consumption
- Low stock
- Out of stock
- Critical spares
- Purchase report
- Supplier performance
- Dead stock
- Inventory variance
- Tool utilization
- PPE issue report
- Maintenance parts consumption
- Production material consumption
- Emergency purchases
- Stock adjustments

Allow filters:

- Date
- Site
- Location
- Department
- Category
- Item
- Supplier
- Machine
- Work Order

Allow export where appropriate.

==================================================
45. INVENTORY NOTIFICATIONS
==================================================

Notify:

- Low stock
- Out of stock
- Critical spare unavailable
- Purchase request pending
- Purchase order delayed
- Goods received
- Inspection required
- Tool calibration expiring
- Tool overdue for return
- PPE replacement due
- Reservation expiring
- Stock count due
- Supplier delivery overdue
- Production material shortage
- Maintenance part unavailable

Channels:

- In-app
- Email
- Push notification

Make notification preferences configurable.

==================================================
46. ROLE-BASED ACCESS CONTROL
==================================================

Create roles:

Inventory Manager
Storekeeper
Procurement Officer
Maintenance Manager
Maintenance Technician
Production Manager
Finance
Safety Officer
Employee
System Administrator

Example:

Storekeeper:
- View stock
- Issue parts
- Receive goods
- Transfer stock
- Manage returns
- Perform stock counts

Inventory Manager:
- Full inventory
- Approvals
- Reorder
- Stock adjustments
- Reports

Technician:
- View required parts
- Request parts
- Return parts
- Request tools

Safety:
- Approve controlled items
- View PPE
- View safety equipment
- Manage safety-related inventory requirements

Finance:
- View costs
- Approve purchases according to configured limits

==================================================
47. AUDIT TRAIL
==================================================

Record all important inventory actions.

Example:

14 Aug 2026 09:12
John requested 2 SKF 6205

14 Aug 2026 09:18
Inventory Manager approved

14 Aug 2026 09:22
Storekeeper issued 2 units

14 Aug 2026 09:23
Stock changed from 3 to 1

14 Aug 2026 11:40
Technician recorded usage

Every important inventory action must be traceable.

==================================================
48. INVENTORY RULE ENGINE
==================================================

Create configurable inventory rules.

Examples:

IF stock <= reorder point
THEN create reorder recommendation.

IF stock = 0 AND item = critical
THEN create critical inventory alert.

IF work order requires part
THEN check stock.

IF part available
THEN allow reservation.

IF part unavailable
THEN suggest purchase request.

IF tool calibration expired
THEN block checkout if configured.

IF controlled item
THEN require Safety approval.

IF production plan requires material
THEN calculate material shortage.

IF supplier delivery overdue
THEN notify Procurement.

IF stock count variance exceeds configured threshold
THEN require manager approval.

Rules must be configurable.

Do NOT hardcode company-specific thresholds.

==================================================
49. MACHINECARE AI / INTELLIGENCE
==================================================

Eventually create an Inventory Insights section.

Examples:

"SKF 6205 consumption has increased 28% over the last three months."

"Filling Machine #1 consumed 42% of all conveyor bearings this quarter."

"Five critical spare parts are below safety stock."

"Tomorrow's production plan has a potential shortage of 25,000 bottle caps."

"Three maintenance work orders scheduled this week require parts that are currently unavailable."

"Supplier ABC has delivered 6 of the last 8 orders late."

Do NOT present predictions as facts.

Clearly distinguish:

Actual data
Calculated metrics
Recommendations
Predictions

==================================================
50. INVENTORY MOBILE EXPERIENCE
==================================================

Design mobile-friendly workflows for factory users.

A storekeeper should be able to:

- Scan item
- Issue part
- Receive item
- Transfer stock
- Return item
- Perform stock count
- Scan QR
- Search item

A technician should be able to:

- Request part
- Request tool
- View reservation
- Return tool
- View machine parts

Make common actions possible in very few clicks.

==================================================
51. COMPLETE END-TO-END EXAMPLE
==================================================

Use this workflow as the reference implementation.

Scenario:

Maintenance needs to replace a bearing on the 3-in-1 Filler.

STEP 1
Maintenance creates Work Order.

STEP 2
MachineCare identifies required part:

SKF 6205 x2

STEP 3
Inventory checks stock.

Available:
3

STEP 4
Technician requests 2.

STEP 5
Inventory Manager sees:

Current stock:
3

After issue:
1

Minimum:
4

Warning:
"Stock will fall below minimum."

STEP 6
Manager approves.

STEP 7
MachineCare reserves 2.

STEP 8
Storekeeper issues 2.

STEP 9
Inventory becomes:

Physical:
1

Reserved:
0

Available:
1

STEP 10
Technician completes maintenance.

STEP 11
Technician records actual consumption.

STEP 12
MachineCare links the consumption to:

Machine:
3-in-1 Filler

Work Order:
WO-00241

Cost:
TZS XXX

STEP 13
MachineCare detects:

Stock below reorder point.

STEP 14
System recommends:

Purchase 10 units.

STEP 15
Inventory Manager creates Purchase Request.

STEP 16
Procurement converts it to Purchase Order.

STEP 17
Supplier delivers.

STEP 18
Goods Receiving records:

Ordered:
10

Received:
10

Accepted:
10

STEP 19
Inventory updates.

STEP 20
Complete transaction history is retained.

==================================================
52. SECOND END-TO-END EXAMPLE — PRODUCTION
==================================================

Production plans:

100,000 bottles.

MachineCare calculates required materials:

Caps:
100,000

Labels:
100,000

PET preforms:
100,000

Packaging film:
X quantity

Inventory:

Caps:
75,000

Labels:
120,000

PET preforms:
110,000

MachineCare displays:

Caps:
RED — shortage 25,000

Labels:
GREEN

PET preforms:
GREEN

Then allow:

Create Purchase Request

for the shortage.

==================================================
53. THIRD END-TO-END EXAMPLE — CONTROLLED TOOL
==================================================

Technician requests:

Welding Machine WM-002.

MachineCare checks:

Controlled tool:
YES

Safety approval:
Required

Valid competency:
YES

Permit:
Hot Work Permit required

Workflow:

Technician Request
↓
Safety Approval
↓
Permit Validation
↓
Inventory Issue
↓
Technician Acknowledgement
↓
Tool Used
↓
Tool Returned
↓
Condition Inspection
↓
Inventory Available

==================================================
54. DATABASE / ARCHITECTURE REQUIREMENTS
==================================================

Before coding:

FIRST inspect the existing MachineCare codebase.

Understand:

- Current database
- Existing models
- Authentication
- Users
- Roles
- Machines
- Work Orders
- Maintenance
- Production
- Safety
- Existing Inventory
- UI components
- Design system
- APIs

Do NOT duplicate existing entities.

Reuse existing:

- User
- Employee
- Machine
- Work Order
- Site
- Department
- Notification
- Document

where appropriate.

Create clean relationships.

Important entities may include:

InventoryItem
ItemCategory
ItemManufacturer
StockLocation
StockBalance
StockTransaction
StockReservation
MaterialRequest
MaterialRequestItem
PurchaseRequest
PurchaseRequestItem
PurchaseOrder
PurchaseOrderItem
Supplier
GoodsReceipt
GoodsReceiptItem
InventoryInspection
Tool
ToolCheckout
ToolReturn
Calibration
PPEItem
CriticalSpare
MachinePart
MachineComponentPart
StockCount
StockCountItem
InventoryAdjustment
InventoryNotification
InventoryRule

Adapt naming to the existing architecture rather than blindly creating these exact models.

==================================================
55. DATA INTEGRITY
==================================================

Inventory transactions must be reliable.

Important:

Do not allow negative stock unless the company explicitly enables it.

Stock issue, return, transfer, reservation, and receipt operations must be atomic.

Prevent double issuing.

Prevent race conditions where two users issue the last item simultaneously.

Maintain an immutable transaction history.

Never silently change historical transactions.

Corrections should create adjustment transactions.

==================================================
56. UX REQUIREMENTS
==================================================

The UI should feel like professional industrial SaaS.

Prioritize:

- Clear quantities
- Clear stock status
- Clear location
- Clear availability
- Fast search
- QR/barcode scanning
- Minimal clicks
- Mobile-friendly workflows
- Clear approval states
- Strong warnings
- Useful filters
- Good tables
- Simple forms

Do NOT create decorative dashboards.

Every KPI should lead to an actionable workflow.

Example:

Click:

"6 Out of Stock"

→ filtered list of out-of-stock items.

Click:

"18 Low Stock"

→ low-stock list.

Click:

"25,000 caps shortage"

→ material shortage details.

==================================================
57. IMPORTANT PRODUCT PRINCIPLE
==================================================

Do NOT create disconnected CRUD pages.

Create relationships.

Example:

Machine
↕
Component
↕
Part
↕
Inventory
↕
Material Request
↕
Approval
↕
Reservation
↕
Issue
↕
Work Order
↕
Consumption
↕
Machine History
↕
Cost

For purchasing:

Item
↕
Supplier
↕
Purchase Request
↕
Purchase Order
↕
Goods Receipt
↕
Inspection
↕
Stock

For tools:

Tool
↕
Employee
↕
Safety
↕
Checkout
↕
Work Order
↕
Return
↕
Inspection
↕
Calibration

==================================================
58. FINAL PRODUCT VISION
==================================================

MachineCare Inventory should allow an industrial company to move from:

PAPER STOCK CARDS
SPREADSHEETS
MANUAL STORE REQUESTS
WHATSAPP REQUESTS
UNTRACKED TOOL CHECKOUT
EMERGENCY PURCHASES
STOCKOUTS

to:

ONE CONNECTED DIGITAL INVENTORY SYSTEM.

The system should answer:

"What do we have?"

"Where is it?"

"Can I use it?"

"Who has it?"

"Who requested it?"

"Why was it issued?"

"What machine is using it?"

"How much did maintenance consume?"

"What do we need to buy?"

"When should we buy it?"

"Which supplier is performing best?"

"Which machines consume the most parts?"

"Do we have enough materials for tomorrow's production?"

"Which critical spare parts are missing?"

"Which tools are unavailable or overdue?"

"How much money is tied up in inventory?"

==================================================
59. IMPLEMENTATION ORDER
==================================================

Do not implement everything at once.

FIRST:

1. Inspect the existing MachineCare architecture.
2. Map existing entities.
3. Identify existing Inventory functionality.
4. Design the database relationships.
5. Design the permission model.
6. Design the workflows.
7. Show the proposed architecture before modifying code.

Then implement in phases:

PHASE 1
Inventory Dashboard
Item Master
Categories
Stock
Locations
Bin Management

PHASE 2
Material Requests
Approvals
Reservations
Issue
Return
Transfers

PHASE 3
Maintenance Integration
Machine-Part Relationships
Critical Spares
Consumption
Cost Tracking

PHASE 4
Purchasing
Purchase Requests
Purchase Orders
Suppliers
Goods Receiving
Quarantine

PHASE 5
Tools
Tool Checkout
Calibration
PPE
Controlled Inventory
Safety Integration

PHASE 6
Production Materials
Material Requirements
Shortage Detection
Production Consumption

PHASE 7
Stock Counts
Audits
Inventory History
Reports

PHASE 8
Automation
Reorder Rules
Notifications
Demand Forecasting
Inventory Intelligence

After each phase:

- Test the workflow
- Test permissions
- Test database integrity
- Test mobile experience
- Verify integration with existing modules

Do not move to the next phase until the current phase works correctly.

==================================================
60. SUCCESS CRITERIA
==================================================

The Inventory module is successful if:

A technician can request a part from a work order.

The inventory manager can approve it.

The storekeeper can issue it.

Stock updates automatically.

The part consumption is linked to the machine.

The maintenance cost is updated.

The system detects low stock.

The system recommends reordering.

Procurement can create a purchase request.

The supplier can be tracked.

Goods can be received.

Stock can be inspected.

The item can be placed into inventory.

The entire transaction history can be viewed.

The system can tell production whether enough materials exist.

The system can prevent unauthorized controlled-tool issuance.

The system can connect Inventory with Safety.

The system can tell management which machines consume the most inventory.

The system can tell management where money is being spent.

That is the standard I want.

Do not just build an Inventory page.

Build an actual industrial Inventory Department inside MachineCare.