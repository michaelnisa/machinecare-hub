You are a senior SaaS product architect, UX designer, database architect, and full-stack engineer.

You are working on an existing product called MACHINECARE.

MachineCare is an operations management platform, but we are now expanding it into multiple business branches.

IMPORTANT PRODUCT DECISION:

GARAGE / SMALL WORKSHOP MUST NOT BE A MODULE INSIDE THE INDUSTRIAL PRODUCT.

It must be an independent PRODUCT BRANCH / BUSINESS EXPERIENCE inside the MachineCare platform.

The user should choose their business type during organization/account onboarding.

Based on that selection, MachineCare should configure the entire experience for that business.

========================================================
1. PRODUCT ARCHITECTURE
========================================================

MachineCare should become a multi-business-type platform.

At the highest level:

MACHINECARE
│
├── Industrial
│   ├── Machines
│   ├── Maintenance
│   ├── Production
│   ├── Safety
│   ├── Inventory
│   ├── Work Orders
│   ├── Employees
│   ├── Documents
│   └── Operations
│
└── Workshop
    ├── Customers
    ├── Vehicles / Assets
    ├── Jobs
    ├── Diagnosis
    ├── Estimates
    ├── Mechanics
    ├── Inventory
    ├── Suppliers
    ├── Invoices
    ├── Payments
    ├── Appointments
    ├── Service History
    └── Reports

The Workshop experience must feel like its own product.

Do NOT create:

Industrial
  > Inventory
      > Workshop

Instead create:

MachineCare Industrial

and

MachineCare Workshop

as two first-class branches.

========================================================
2. ONBOARDING
========================================================

When a new organization creates a MachineCare account, the first important question should be:

"What type of business do you run?"

Show large visual choices.

Example:

----------------------------------------

Welcome to MachineCare

Let's set up MachineCare for your business.

What type of business do you run?

[ 🏭 Industrial / Manufacturing ]

Manage machines, maintenance, production, safety and operations.

[ 🔧 Garage / Auto Workshop ]

Manage customers, vehicles, jobs, mechanics, parts and payments.

[ 🛠 Repair / Service Workshop ]

Manage customers, equipment, jobs, technicians, inventory and billing.

----------------------------------------

For the first release, implement at minimum:

1. Industrial
2. Garage / Auto Workshop

The architecture must allow future branches to be added without rewriting the platform.

Potential future branches:

- Heavy Equipment Workshop
- Motorcycle Workshop
- Electrical Workshop
- Welding / Fabrication Workshop
- Generator Service
- HVAC / AC Service
- Construction Equipment
- Field Service
- Marine / Boat Service

Do NOT implement all future branches now.

Design the architecture so they can be added later.

========================================================
3. ORGANIZATION PROFILE
========================================================

The organization should have a business_type.

Example:

organization.business_type

Possible values:

INDUSTRIAL
WORKSHOP

Do NOT hardcode business_type checks throughout the entire frontend.

Use a centralized configuration / feature system.

Example conceptual structure:

BusinessType
BusinessConfiguration
FeatureConfiguration
NavigationConfiguration
TerminologyConfiguration
PermissionConfiguration

The selected business type should determine:

- Dashboard
- Navigation
- Modules
- Terminology
- Default workflows
- Permissions
- Reports
- Onboarding
- Notifications
- Settings

========================================================
4. VERY IMPORTANT — SHARED PLATFORM
========================================================

Although Industrial and Workshop are independent experiences, they should share the underlying MachineCare platform where appropriate.

Shared infrastructure may include:

- Authentication
- Organizations
- Users
- Employees
- Roles
- Permissions
- Notifications
- Files
- Documents
- Audit logs
- Billing
- Subscription
- Settings
- Search
- Communication
- Inventory foundation where appropriate

However:

DO NOT force Workshop users to see Industrial concepts.

For example:

A workshop owner should NOT see:

Production Lines
Production OEE
Permit to Work
LOTO
Factory Safety
Production Orders
Industrial Maintenance KPIs

unless those features are specifically relevant to their selected branch.

========================================================
5. WORKSHOP MUST HAVE ITS OWN EXPERIENCE
========================================================

When a Workshop organization logs in, the entire application should change.

Workshop navigation:

Dashboard

Customers

Vehicles

Jobs

Calendar

Inventory

Estimates

Invoices

Payments

Mechanics

Suppliers

Reports

Settings

Do not show Industrial navigation.

Do not call jobs "industrial work orders" in the UI.

Use terminology appropriate for a garage.

========================================================
6. WORKSHOP BRAND / PRODUCT IDENTITY
========================================================

The product should still be called:

MachineCare Workshop

The user should clearly understand that they are using the Workshop version.

Example header:

MachineCare
Workshop

or

MachineCare Workshop

The Industrial branch should show:

MachineCare
Industrial

Do not create a completely separate codebase.

Use a shared platform with distinct product experiences.

========================================================
7. WORKSHOP DASHBOARD
========================================================

The dashboard must answer:

"What is happening in my workshop today?"

Show:

Today's Jobs
In Progress
Waiting for Customer
Ready for Pickup
Unpaid
Today's Revenue
Low Stock

Example:

Today's Jobs
12

In Progress
5

Waiting for Customer
2

Ready for Pickup
3

Outstanding
TZS 1.8M

Today's Revenue
TZS 850K

Below the KPIs:

TODAY'S WORK

Vehicle
Customer
Job
Mechanic
Status

Example:

Toyota Hilux
John
Engine repair
David
In Progress

Toyota Noah
Sarah
Service
Peter
Waiting for Customer

Nissan X-Trail
James
Brake repair
David
Ready

Every KPI must be clickable.

========================================================
8. CUSTOMERS
========================================================

Workshop customers are a core entity.

Customer profile:

Name
Phone
Email
Address
Notes
Vehicles
Job History
Invoices
Payments
Outstanding Balance

Example:

Michael Nisa

Vehicles:
2

Jobs:
14

Total Spent:
TZS 4.8M

Outstanding:
TZS 250K

Last Visit:
12 Aug 2026

========================================================
9. VEHICLES
========================================================

Vehicle is a core Workshop entity.

Vehicle fields:

- Vehicle ID
- Registration Number
- VIN / Chassis Number
- Make
- Model
- Year
- Engine
- Fuel Type
- Transmission
- Mileage
- Customer
- Photos
- Notes

Example:

Toyota Hilux

Registration:
T 123 ABC

Year:
2018

Mileage:
148,200 km

Customer:
John

========================================================
10. VEHICLE PROFILE
========================================================

Vehicle profile should contain:

Overview

Current mileage

Customer

Vehicle information

Service status

Job history

Maintenance history

Parts replaced

Invoices

Payments

Documents

Photos

Notes

Upcoming service

Example:

Toyota Hilux

T 123 ABC

148,200 km

--------------------------------

SERVICE HISTORY

12 Aug 2026
Brake service

03 Jul 2026
Oil change

15 May 2026
Suspension repair

20 Feb 2026
Full service

--------------------------------

UPCOMING

Oil service
Due in 2,000 km

Brake inspection
Due in 5,000 km

========================================================
11. JOB MANAGEMENT
========================================================

Jobs are the central operational object in Workshop.

A job represents work being performed for a customer.

Job lifecycle:

RECEIVED
↓
DIAGNOSING
↓
ESTIMATE
↓
AWAITING CUSTOMER APPROVAL
↓
APPROVED
↓
IN PROGRESS
↓
QUALITY CHECK
↓
READY
↓
DELIVERED
↓
CLOSED

Allow configuration where appropriate.

========================================================
12. CREATE JOB
========================================================

Create Job:

Customer
Vehicle
Reported Problem
Mileage
Assigned Mechanic
Priority
Expected Completion
Notes
Photos

Example:

Customer:
John

Vehicle:
Toyota Hilux

Problem:

"Engine overheating"

Mileage:
148,200 km

Priority:
Normal

Mechanic:
David

========================================================
13. DIAGNOSIS
========================================================

Mechanic should be able to record:

Customer complaint

Diagnosis

Findings

Recommended repair

Photos

Videos if supported

Example:

Complaint:
Engine overheating

Diagnosis:
Cooling system problem

Findings:

- Coolant leak
- Damaged thermostat
- Fan functioning normally

Recommendation:

Replace thermostat and radiator hose.

========================================================
14. ESTIMATES / QUOTATIONS
========================================================

Before major work, create an estimate.

Example:

Toyota Hilux
Engine Cooling Repair

Parts:

Thermostat
1 × TZS 80,000

Radiator Hose
1 × TZS 60,000

Coolant
5L × TZS 40,000

Labour
TZS 150,000

TOTAL:

TZS 330,000

Customer actions:

APPROVE

DECLINE

REQUEST CHANGES

========================================================
15. CUSTOMER APPROVAL
========================================================

Customer approval must be recorded.

Workflow:

Mechanic identifies additional repair
↓
Estimate updated
↓
Customer notified
↓
Customer approves/rejects
↓
Workshop continues

Store:

Approved by
Date
Time
Approval method
Approved amount

This is important for customer trust and dispute prevention.

========================================================
16. WORKSHOP INVENTORY
========================================================

Workshop Inventory is an independent Workshop feature.

It should NOT expose the full enterprise inventory experience.

Workshop inventory focuses on:

Parts
Consumables
Tools
Stock
Suppliers
Purchases
Low Stock
Stock History

========================================================
17. PARTS
========================================================

Part fields:

Part Name
SKU
Part Number
Category
Brand
Supplier
Cost Price
Selling Price
Quantity
Minimum Stock
Location
Barcode
Photo
Notes

Example:

Toyota Oil Filter

SKU:
OF-001

Cost:
TZS 15,000

Selling:
TZS 25,000

Stock:
8

Minimum:
3

========================================================
18. INVENTORY CATEGORIES
========================================================

Examples:

Engine

- Oil Filters
- Air Filters
- Fuel Filters
- Spark Plugs
- Belts
- Gaskets
- Thermostats

Brakes

- Brake Pads
- Brake Discs
- Brake Fluid

Suspension

- Bushes
- Shock Absorbers
- Ball Joints
- Tie Rods

Electrical

- Fuses
- Relays
- Bulbs
- Batteries
- Sensors

Fluids

- Engine Oil
- Gear Oil
- Coolant
- Brake Fluid

Consumables

- Grease
- Cleaning Materials
- Tape
- Bolts
- Nuts

========================================================
19. AUTOMATIC INVENTORY CONSUMPTION
========================================================

When a mechanic adds a part to a job:

Example:

Brake Pad ×2

MachineCare should automatically:

1. Reduce inventory
2. Add part cost to job
3. Add selling price to estimate/invoice
4. Record inventory transaction
5. Record vehicle service history
6. Track profitability

Do not require the mechanic to manually update inventory separately.

========================================================
20. JOB COSTING
========================================================

Every job should have:

Parts Cost

Labour Cost

Other Cost

Customer Price

Estimated Profit

Example:

Customer Price:
TZS 450,000

Parts Cost:
TZS 220,000

Labour:
TZS 80,000

Other:
TZS 20,000

Estimated Gross Profit:
TZS 130,000

Make the calculation transparent.

========================================================
21. MECHANICS
========================================================

Mechanics are Workshop employees.

Mechanic profile:

Name
Phone
Specialization
Jobs
Completed Jobs
Active Jobs
Performance
Notes

Specializations:

Engine
Electrical
Brakes
Suspension
AC
Transmission
General

Do not force specialization.

========================================================
22. MECHANIC WORKSPACE
========================================================

Mechanics should have a simple mobile-first workspace.

"My Jobs"

Show:

Toyota Hilux
Engine repair
In Progress

Actions:

Start Job
Pause
Add Finding
Add Part
Add Photo
Add Note
Complete

Keep the workflow extremely simple.

========================================================
23. TOOLS
========================================================

Workshop tool management should be lightweight.

Tools:

Scanner
Torque Wrench
Multimeter
Jack
Compressor
Welding Machine
Impact Wrench

Statuses:

Available
In Use
Under Repair
Missing

For important tools track:

Current User
Issue Date
Expected Return
Condition

========================================================
24. SUPPLIERS
========================================================

Supplier profile:

Name
Phone
Email
Location
Products
Purchase History
Total Purchases

Show:

Last Purchase
Average Cost
Items Purchased

========================================================
25. PURCHASING
========================================================

Keep purchasing simple.

New Purchase:

Supplier

Items

Quantity

Cost

Total

Received

When received:

Automatically increase stock.

========================================================
26. LOW STOCK
========================================================

Show:

Low Stock

Example:

Oil Filter

Current:
2

Minimum:
5

Recommended:
10

Action:

Create Purchase

========================================================
27. INVOICING
========================================================

When a job is ready:

Generate invoice.

Example:

Toyota Hilux

Parts:
TZS 280,000

Labour:
TZS 150,000

Discount:
TZS 20,000

TOTAL:
TZS 410,000

Payment status:

PAID
PARTIALLY PAID
UNPAID

========================================================
28. PAYMENTS
========================================================

Support:

Cash
Mobile Money
Bank
Other

Record:

Amount
Method
Date
Reference
Received By

Allow partial payments.

Example:

Invoice:
TZS 500,000

Paid:
TZS 300,000

Outstanding:
TZS 200,000

========================================================
29. WHATSAPP / CUSTOMER COMMUNICATION
========================================================

Design the architecture so WhatsApp integration can be added.

Use cases:

Job received

Estimate ready

Approval request

Repair update

Vehicle ready

Invoice

Payment confirmation

Service reminder

Example:

"Hello John 👋

Your Toyota Hilux is ready for pickup.

Total:
TZS 410,000

Status:
READY

Thank you for choosing our workshop."

========================================================
30. SERVICE REMINDERS
========================================================

After a service, allow:

Next Service Date

Next Service Mileage

Reminder

Example:

Next oil service:

153,000 km

MachineCare can notify the customer.

Example:

"Hello John 👋

Your Toyota Hilux is due for its next service soon.

Current mileage:
152,700 km

Recommended service:
153,000 km

Book Service"

========================================================
31. APPOINTMENTS
========================================================

Create a simple workshop calendar.

Example:

09:00
Toyota Hilux
Service

10:30
Nissan X-Trail
Brake Repair

14:00
Toyota Noah
Diagnosis

Allow:

Create appointment
Reschedule
Cancel
Convert appointment to job

========================================================
32. BUSINESS REPORTS
========================================================

Workshop reports:

Today's Revenue

Monthly Revenue

Jobs Completed

Jobs In Progress

Outstanding Payments

Average Job Value

Parts Revenue

Labour Revenue

Estimated Gross Profit

Top Services

Top Customers

Top Vehicles

Parts Consumption

Low Stock

Mechanic Workload

Supplier Spending

========================================================
33. PROFITABILITY
========================================================

Show profitability at job level.

Example:

Job Revenue
TZS 450K

Parts Cost
TZS 220K

Labour Cost
TZS 80K

Other Cost
TZS 20K

Gross Profit
TZS 130K

Also provide monthly summary.

Do not claim net profit unless all required business expenses are actually recorded.

Call it:

Estimated Gross Profit

when appropriate.

========================================================
34. VEHICLE SERVICE HISTORY
========================================================

This should become one of the most valuable Workshop features.

Every job contributes to vehicle history.

Example:

Toyota Hilux

Service History:

12 Aug
Brake Repair

03 Jul
Oil Service

15 May
Suspension

20 Feb
Full Service

Each record should show:

Work performed
Parts used
Mileage
Mechanic
Cost
Invoice
Photos
Notes

========================================================
35. CUSTOMER RETENTION
========================================================

The Workshop branch should help workshops retain customers.

Features:

Service reminders
Customer history
Vehicle history
Birthday/optional customer campaigns
Follow-up reminders
Inactive customer list

Example:

"Customers who have not returned for 6 months."

Do not spam customers.

Make communication configurable.

========================================================
36. WORKSHOP BUSINESS SETTINGS
========================================================

Settings should include:

Workshop name

Logo

Phone

Address

Business hours

Currency

Tax settings

Invoice settings

Payment methods

Notification settings

Job statuses

Service categories

Labour rates

Inventory settings

Customer communication settings

========================================================
37. WORKSHOP PERMISSIONS
========================================================

Roles:

OWNER
MANAGER
RECEPTIONIST
MECHANIC
STOREKEEPER
CASHIER

Example:

Owner:
Everything

Manager:
Operations, jobs, customers, inventory, reports

Receptionist:
Customers, appointments, jobs, estimates

Mechanic:
Assigned jobs, diagnosis, parts, notes

Storekeeper:
Inventory, purchases, stock

Cashier:
Invoices, payments

Permissions should be configurable.

========================================================
38. WORKSHOP MOBILE-FIRST DESIGN
========================================================

This is extremely important.

Small workshops may use phones rather than computers.

Design mobile-first workflows.

Mechanic should be able to:

Open job
See vehicle
See problem
Add diagnosis
Add photo
Add part
Complete job

Storekeeper:

Scan part
Issue
Receive
Count stock

Owner:

View dashboard
Approve estimate
View revenue
View jobs
View payments

========================================================
39. WORKSHOP ONBOARDING
========================================================

After selecting:

GARAGE / AUTO WORKSHOP

Ask:

Workshop Name

Owner Name

Phone

Location

Workshop Type

Examples:

General Garage
Auto Electrical
Engine Specialist
Body Repair
Tyre & Wheel
AC Service
Transmission
Motorcycle
Heavy Vehicle

Allow multiple selections if appropriate.

Then:

How many mechanics?

1–5
6–10
11–20
20+

Do you currently track inventory?

Yes / No

Do you issue invoices?

Yes / No

Do you want customer reminders?

Yes / No

Then create a simple workspace.

========================================================
40. SAMPLE WORKSHOP DATA
========================================================

For development/demo mode, create realistic sample data:

Customers:
10

Vehicles:
15

Jobs:
20

Parts:
50

Suppliers:
5

Mechanics:
4

Invoices:
20

Payments:
15

This allows the dashboard to immediately demonstrate the product.

Do not use fake data in production organizations.

========================================================
41. WORKSHOP EMPTY STATES
========================================================

Do not show empty tables with no guidance.

Example:

No vehicles yet.

"Add your first customer vehicle to start tracking service history."

Button:

+ Add Vehicle

For inventory:

"No parts added yet."

"Add your commonly used parts so MachineCare can track stock and job costs."

========================================================
42. CRITICAL PRODUCT DIFFERENCE
========================================================

The Workshop branch must NOT look like Industrial MachineCare with different labels.

It should have:

Different navigation
Different dashboard
Different terminology
Different onboarding
Different workflows
Different reports
Different default permissions
Different priorities

Workshop priorities:

CUSTOMERS
VEHICLES
JOBS
MECHANICS
PARTS
PAYMENTS

Industrial priorities:

MACHINES
MAINTENANCE
PRODUCTION
SAFETY
INVENTORY
OPERATIONS

========================================================
43. SHARED DATA MODEL VS PRODUCT EXPERIENCE
========================================================

Use a shared platform where technically appropriate.

However, product experience must remain separated.

For example:

Shared:
User
Organization
Employee
File
Notification
AuditLog

Workshop:
Customer
Vehicle
Job
Estimate
Invoice
Payment
ServiceHistory

Industrial:
Machine
ProductionLine
MaintenancePlan
WorkOrder
ProductionOrder
SafetyPermit
Inspection

Inventory can have shared foundations but different interfaces and workflows.

========================================================
44. BUSINESS TYPE ARCHITECTURE
========================================================

Create a clean business-type abstraction.

Conceptually:

Organization

business_type:
INDUSTRIAL
WORKSHOP

Then:

BusinessConfiguration

business_type

features

navigation

terminology

permissions

dashboard

workflows

Do not scatter conditions everywhere such as:

if garage then ...

if industrial then ...

Centralize this logic.

========================================================
45. ACCOUNT SWITCHING
========================================================

If a user belongs to multiple organizations:

Example:

Michael belongs to:

MachineCare Industrial
MachineCare Workshop

Allow switching organization.

But switching organizations should also switch the entire product experience.

Example:

MachineCare Industrial

switch →

MachineCare Workshop

The user should immediately see the Workshop dashboard and navigation.

========================================================
46. FUTURE MULTI-BRANCH ARCHITECTURE
========================================================

Design so we can eventually support:

INDUSTRIAL
WORKSHOP
FIELD_SERVICE
HEAVY_EQUIPMENT
CONSTRUCTION
FACILITY_MANAGEMENT

But only implement:

INDUSTRIAL
WORKSHOP

now.

Never build architecture that requires rewriting the application to add the third branch.

========================================================
47. DATABASE DESIGN
========================================================

Before changing the database:

Inspect the current MachineCare database.

Identify:

Existing organization model
Existing user model
Existing employee model
Existing machine model
Existing work order model
Existing inventory model
Existing notification system
Existing permissions

Reuse existing models where appropriate.

Potential Workshop entities:

WorkshopCustomer
Vehicle
VehicleDocument
WorkshopJob
JobDiagnosis
JobFinding
JobPart
JobLabour
Estimate
EstimateItem
CustomerApproval
Invoice
InvoiceItem
Payment
Appointment
ServiceHistory
WorkshopService
MechanicAssignment
WorkshopTool

Use existing inventory entities where they can safely be reused.

Do not duplicate entities unnecessarily.

========================================================
48. DATA RELATIONSHIP
========================================================

The ideal Workshop relationship is:

CUSTOMER
↓
VEHICLE
↓
JOB
↓
DIAGNOSIS
↓
ESTIMATE
↓
CUSTOMER APPROVAL
↓
WORK
↓
PARTS + LABOUR
↓
QUALITY CHECK
↓
INVOICE
↓
PAYMENT
↓
SERVICE HISTORY
↓
REMINDER

This is the core Workshop lifecycle.

========================================================
49. EXAMPLE END-TO-END WORKFLOW
========================================================

Customer:

John

Vehicle:

Toyota Hilux
T 123 ABC

Customer arrives.

Receptionist creates Job:

"Engine overheating."

Mechanic diagnoses:

Damaged thermostat.

Mechanic adds:

Thermostat
TZS 80,000

Coolant
TZS 40,000

Labour
TZS 150,000

Estimate:

TZS 270,000

Customer receives approval request.

Customer approves.

Job becomes:

APPROVED

Mechanic starts.

Parts are consumed automatically.

Mechanic completes.

Quality check.

Vehicle becomes:

READY

Invoice:

TZS 270,000

Customer pays:

TZS 270,000

Payment recorded.

Job becomes:

CLOSED

Vehicle service history updated.

MachineCare calculates:

Next service:
153,000 km

Customer reminder scheduled.

This entire process should happen inside Workshop.

========================================================
50. PRODUCT PRINCIPLE
========================================================

DO NOT build features simply because they exist in Industrial MachineCare.

Ask:

"Does this solve a real problem for a small workshop?"

Every screen must have a purpose.

Workshop should be:

Simple
Fast
Affordable
Mobile-first
Easy to learn
Professional
Practical

========================================================
51. IMPLEMENTATION STRATEGY
========================================================

Do NOT start coding immediately.

FIRST inspect the existing MachineCare application.

Return:

1. Current architecture
2. Current authentication
3. Organization model
4. Current business/product structure
5. Current MachineCare navigation
6. Current database models
7. Existing inventory
8. Existing maintenance
9. Existing user/role system
10. Existing UI system

Then propose:

1. Multi-business architecture
2. Organization business_type
3. Feature configuration
4. Navigation configuration
5. Workshop data model
6. Workshop workflows
7. Permission model
8. Migration strategy
9. UI architecture
10. Implementation phases

WAIT FOR APPROVAL BEFORE MAJOR IMPLEMENTATION.

========================================================
52. IMPLEMENTATION PHASES
========================================================

PHASE 1

Multi-business foundation

- Organization business type
- Business configuration
- Feature flags
- Navigation configuration
- Industrial branch preserved
- Workshop branch created

PHASE 2

Workshop onboarding

- Business selection
- Workshop profile
- Initial setup
- Roles
- Sample/empty states

PHASE 3

Workshop core

- Dashboard
- Customers
- Vehicles
- Jobs
- Mechanics

PHASE 4

Workshop operations

- Diagnosis
- Estimates
- Customer approval
- Job workflow
- Service history

PHASE 5

Commercial

- Invoices
- Payments
- Job costing
- Profitability

PHASE 6

Workshop inventory

- Parts
- Stock
- Suppliers
- Purchases
- Low stock
- Automatic consumption

PHASE 7

Customer relationship

- Appointments
- Service reminders
- Communication
- WhatsApp-ready architecture

PHASE 8

Reports

- Revenue
- Jobs
- Parts
- Mechanics
- Customers
- Profitability

========================================================
53. NON-NEGOTIABLE RULES
========================================================

1. Do not break existing Industrial functionality.

2. Do not make Workshop a submodule of Industrial.

3. Do not duplicate the entire codebase.

4. Do not create two separate authentication systems.

5. Do not hardcode business-type logic throughout the application.

6. Centralize business configuration.

7. Keep Workshop simple.

8. Keep Workshop mobile-first.

9. Reuse shared infrastructure.

10. Keep Workshop data logically separated.

11. Use proper permissions.

12. Maintain auditability.

13. Never silently alter historical financial records.

14. Inventory changes must be transactional.

15. Customer approvals must be traceable.

16. Do not overwhelm Workshop users with Industrial features.

========================================================
54. FINAL VISION
========================================================

MachineCare should become a platform that adapts itself to the business.

A factory owner sees:

Machines
Maintenance
Production
Safety
Inventory
Operations

A garage owner sees:

Customers
Vehicles
Jobs
Mechanics
Parts
Estimates
Invoices
Payments
Service History

The platform underneath is MachineCare.

But the experience is completely different.

The user should feel:

"This software was built specifically for my business."

NOT:

"This is an industrial system that happens to have a garage module."

That distinction is extremely important.

Build MachineCare Workshop as a first-class product branch.You are a senior SaaS product architect, UX designer, database architect, and full-stack engineer.

You are working on an existing product called MACHINECARE.

MachineCare is an operations management platform, but we are now expanding it into multiple business branches.

IMPORTANT PRODUCT DECISION:

GARAGE / SMALL WORKSHOP MUST NOT BE A MODULE INSIDE THE INDUSTRIAL PRODUCT.

It must be an independent PRODUCT BRANCH / BUSINESS EXPERIENCE inside the MachineCare platform.

The user should choose their business type during organization/account onboarding.

Based on that selection, MachineCare should configure the entire experience for that business.

========================================================
1. PRODUCT ARCHITECTURE
========================================================

MachineCare should become a multi-business-type platform.

At the highest level:

MACHINECARE
│
├── Industrial
│   ├── Machines
│   ├── Maintenance
│   ├── Production
│   ├── Safety
│   ├── Inventory
│   ├── Work Orders
│   ├── Employees
│   ├── Documents
│   └── Operations
│
└── Workshop
    ├── Customers
    ├── Vehicles / Assets
    ├── Jobs
    ├── Diagnosis
    ├── Estimates
    ├── Mechanics
    ├── Inventory
    ├── Suppliers
    ├── Invoices
    ├── Payments
    ├── Appointments
    ├── Service History
    └── Reports

The Workshop experience must feel like its own product.

Do NOT create:

Industrial
  > Inventory
      > Workshop

Instead create:

MachineCare Industrial

and

MachineCare Workshop

as two first-class branches.

========================================================
2. ONBOARDING
========================================================

When a new organization creates a MachineCare account, the first important question should be:

"What type of business do you run?"

Show large visual choices.

Example:

----------------------------------------

Welcome to MachineCare

Let's set up MachineCare for your business.

What type of business do you run?

[ 🏭 Industrial / Manufacturing ]

Manage machines, maintenance, production, safety and operations.

[ 🔧 Garage / Auto Workshop ]

Manage customers, vehicles, jobs, mechanics, parts and payments.

[ 🛠 Repair / Service Workshop ]

Manage customers, equipment, jobs, technicians, inventory and billing.

----------------------------------------

For the first release, implement at minimum:

1. Industrial
2. Garage / Auto Workshop

The architecture must allow future branches to be added without rewriting the platform.

Potential future branches:

- Heavy Equipment Workshop
- Motorcycle Workshop
- Electrical Workshop
- Welding / Fabrication Workshop
- Generator Service
- HVAC / AC Service
- Construction Equipment
- Field Service
- Marine / Boat Service

Do NOT implement all future branches now.

Design the architecture so they can be added later.

========================================================
3. ORGANIZATION PROFILE
========================================================

The organization should have a business_type.

Example:

organization.business_type

Possible values:

INDUSTRIAL
WORKSHOP

Do NOT hardcode business_type checks throughout the entire frontend.

Use a centralized configuration / feature system.

Example conceptual structure:

BusinessType
BusinessConfiguration
FeatureConfiguration
NavigationConfiguration
TerminologyConfiguration
PermissionConfiguration

The selected business type should determine:

- Dashboard
- Navigation
- Modules
- Terminology
- Default workflows
- Permissions
- Reports
- Onboarding
- Notifications
- Settings

========================================================
4. VERY IMPORTANT — SHARED PLATFORM
========================================================

Although Industrial and Workshop are independent experiences, they should share the underlying MachineCare platform where appropriate.

Shared infrastructure may include:

- Authentication
- Organizations
- Users
- Employees
- Roles
- Permissions
- Notifications
- Files
- Documents
- Audit logs
- Billing
- Subscription
- Settings
- Search
- Communication
- Inventory foundation where appropriate

However:

DO NOT force Workshop users to see Industrial concepts.

For example:

A workshop owner should NOT see:

Production Lines
Production OEE
Permit to Work
LOTO
Factory Safety
Production Orders
Industrial Maintenance KPIs

unless those features are specifically relevant to their selected branch.

========================================================
5. WORKSHOP MUST HAVE ITS OWN EXPERIENCE
========================================================

When a Workshop organization logs in, the entire application should change.

Workshop navigation:

Dashboard

Customers

Vehicles

Jobs

Calendar

Inventory

Estimates

Invoices

Payments

Mechanics

Suppliers

Reports

Settings

Do not show Industrial navigation.

Do not call jobs "industrial work orders" in the UI.

Use terminology appropriate for a garage.

========================================================
6. WORKSHOP BRAND / PRODUCT IDENTITY
========================================================

The product should still be called:

MachineCare Workshop

The user should clearly understand that they are using the Workshop version.

Example header:

MachineCare
Workshop

or

MachineCare Workshop

The Industrial branch should show:

MachineCare
Industrial

Do not create a completely separate codebase.

Use a shared platform with distinct product experiences.

========================================================
7. WORKSHOP DASHBOARD
========================================================

The dashboard must answer:

"What is happening in my workshop today?"

Show:

Today's Jobs
In Progress
Waiting for Customer
Ready for Pickup
Unpaid
Today's Revenue
Low Stock

Example:

Today's Jobs
12

In Progress
5

Waiting for Customer
2

Ready for Pickup
3

Outstanding
TZS 1.8M

Today's Revenue
TZS 850K

Below the KPIs:

TODAY'S WORK

Vehicle
Customer
Job
Mechanic
Status

Example:

Toyota Hilux
John
Engine repair
David
In Progress

Toyota Noah
Sarah
Service
Peter
Waiting for Customer

Nissan X-Trail
James
Brake repair
David
Ready

Every KPI must be clickable.

========================================================
8. CUSTOMERS
========================================================

Workshop customers are a core entity.

Customer profile:

Name
Phone
Email
Address
Notes
Vehicles
Job History
Invoices
Payments
Outstanding Balance

Example:

Michael Nisa

Vehicles:
2

Jobs:
14

Total Spent:
TZS 4.8M

Outstanding:
TZS 250K

Last Visit:
12 Aug 2026

========================================================
9. VEHICLES
========================================================

Vehicle is a core Workshop entity.

Vehicle fields:

- Vehicle ID
- Registration Number
- VIN / Chassis Number
- Make
- Model
- Year
- Engine
- Fuel Type
- Transmission
- Mileage
- Customer
- Photos
- Notes

Example:

Toyota Hilux

Registration:
T 123 ABC

Year:
2018

Mileage:
148,200 km

Customer:
John

========================================================
10. VEHICLE PROFILE
========================================================

Vehicle profile should contain:

Overview

Current mileage

Customer

Vehicle information

Service status

Job history

Maintenance history

Parts replaced

Invoices

Payments

Documents

Photos

Notes

Upcoming service

Example:

Toyota Hilux

T 123 ABC

148,200 km

--------------------------------

SERVICE HISTORY

12 Aug 2026
Brake service

03 Jul 2026
Oil change

15 May 2026
Suspension repair

20 Feb 2026
Full service

--------------------------------

UPCOMING

Oil service
Due in 2,000 km

Brake inspection
Due in 5,000 km

========================================================
11. JOB MANAGEMENT
========================================================

Jobs are the central operational object in Workshop.

A job represents work being performed for a customer.

Job lifecycle:

RECEIVED
↓
DIAGNOSING
↓
ESTIMATE
↓
AWAITING CUSTOMER APPROVAL
↓
APPROVED
↓
IN PROGRESS
↓
QUALITY CHECK
↓
READY
↓
DELIVERED
↓
CLOSED

Allow configuration where appropriate.

========================================================
12. CREATE JOB
========================================================

Create Job:

Customer
Vehicle
Reported Problem
Mileage
Assigned Mechanic
Priority
Expected Completion
Notes
Photos

Example:

Customer:
John

Vehicle:
Toyota Hilux

Problem:

"Engine overheating"

Mileage:
148,200 km

Priority:
Normal

Mechanic:
David

========================================================
13. DIAGNOSIS
========================================================

Mechanic should be able to record:

Customer complaint

Diagnosis

Findings

Recommended repair

Photos

Videos if supported

Example:

Complaint:
Engine overheating

Diagnosis:
Cooling system problem

Findings:

- Coolant leak
- Damaged thermostat
- Fan functioning normally

Recommendation:

Replace thermostat and radiator hose.

========================================================
14. ESTIMATES / QUOTATIONS
========================================================

Before major work, create an estimate.

Example:

Toyota Hilux
Engine Cooling Repair

Parts:

Thermostat
1 × TZS 80,000

Radiator Hose
1 × TZS 60,000

Coolant
5L × TZS 40,000

Labour
TZS 150,000

TOTAL:

TZS 330,000

Customer actions:

APPROVE

DECLINE

REQUEST CHANGES

========================================================
15. CUSTOMER APPROVAL
========================================================

Customer approval must be recorded.

Workflow:

Mechanic identifies additional repair
↓
Estimate updated
↓
Customer notified
↓
Customer approves/rejects
↓
Workshop continues

Store:

Approved by
Date
Time
Approval method
Approved amount

This is important for customer trust and dispute prevention.

========================================================
16. WORKSHOP INVENTORY
========================================================

Workshop Inventory is an independent Workshop feature.

It should NOT expose the full enterprise inventory experience.

Workshop inventory focuses on:

Parts
Consumables
Tools
Stock
Suppliers
Purchases
Low Stock
Stock History

========================================================
17. PARTS
========================================================

Part fields:

Part Name
SKU
Part Number
Category
Brand
Supplier
Cost Price
Selling Price
Quantity
Minimum Stock
Location
Barcode
Photo
Notes

Example:

Toyota Oil Filter

SKU:
OF-001

Cost:
TZS 15,000

Selling:
TZS 25,000

Stock:
8

Minimum:
3

========================================================
18. INVENTORY CATEGORIES
========================================================

Examples:

Engine

- Oil Filters
- Air Filters
- Fuel Filters
- Spark Plugs
- Belts
- Gaskets
- Thermostats

Brakes

- Brake Pads
- Brake Discs
- Brake Fluid

Suspension

- Bushes
- Shock Absorbers
- Ball Joints
- Tie Rods

Electrical

- Fuses
- Relays
- Bulbs
- Batteries
- Sensors

Fluids

- Engine Oil
- Gear Oil
- Coolant
- Brake Fluid

Consumables

- Grease
- Cleaning Materials
- Tape
- Bolts
- Nuts

========================================================
19. AUTOMATIC INVENTORY CONSUMPTION
========================================================

When a mechanic adds a part to a job:

Example:

Brake Pad ×2

MachineCare should automatically:

1. Reduce inventory
2. Add part cost to job
3. Add selling price to estimate/invoice
4. Record inventory transaction
5. Record vehicle service history
6. Track profitability

Do not require the mechanic to manually update inventory separately.

========================================================
20. JOB COSTING
========================================================

Every job should have:

Parts Cost

Labour Cost

Other Cost

Customer Price

Estimated Profit

Example:

Customer Price:
TZS 450,000

Parts Cost:
TZS 220,000

Labour:
TZS 80,000

Other:
TZS 20,000

Estimated Gross Profit:
TZS 130,000

Make the calculation transparent.

========================================================
21. MECHANICS
========================================================

Mechanics are Workshop employees.

Mechanic profile:

Name
Phone
Specialization
Jobs
Completed Jobs
Active Jobs
Performance
Notes

Specializations:

Engine
Electrical
Brakes
Suspension
AC
Transmission
General

Do not force specialization.

========================================================
22. MECHANIC WORKSPACE
========================================================

Mechanics should have a simple mobile-first workspace.

"My Jobs"

Show:

Toyota Hilux
Engine repair
In Progress

Actions:

Start Job
Pause
Add Finding
Add Part
Add Photo
Add Note
Complete

Keep the workflow extremely simple.

========================================================
23. TOOLS
========================================================

Workshop tool management should be lightweight.

Tools:

Scanner
Torque Wrench
Multimeter
Jack
Compressor
Welding Machine
Impact Wrench

Statuses:

Available
In Use
Under Repair
Missing

For important tools track:

Current User
Issue Date
Expected Return
Condition

========================================================
24. SUPPLIERS
========================================================

Supplier profile:

Name
Phone
Email
Location
Products
Purchase History
Total Purchases

Show:

Last Purchase
Average Cost
Items Purchased

========================================================
25. PURCHASING
========================================================

Keep purchasing simple.

New Purchase:

Supplier

Items

Quantity

Cost

Total

Received

When received:

Automatically increase stock.

========================================================
26. LOW STOCK
========================================================

Show:

Low Stock

Example:

Oil Filter

Current:
2

Minimum:
5

Recommended:
10

Action:

Create Purchase

========================================================
27. INVOICING
========================================================

When a job is ready:

Generate invoice.

Example:

Toyota Hilux

Parts:
TZS 280,000

Labour:
TZS 150,000

Discount:
TZS 20,000

TOTAL:
TZS 410,000

Payment status:

PAID
PARTIALLY PAID
UNPAID

========================================================
28. PAYMENTS
========================================================

Support:

Cash
Mobile Money
Bank
Other

Record:

Amount
Method
Date
Reference
Received By

Allow partial payments.

Example:

Invoice:
TZS 500,000

Paid:
TZS 300,000

Outstanding:
TZS 200,000

========================================================
29. WHATSAPP / CUSTOMER COMMUNICATION
========================================================

Design the architecture so WhatsApp integration can be added.

Use cases:

Job received

Estimate ready

Approval request

Repair update

Vehicle ready

Invoice

Payment confirmation

Service reminder

Example:

"Hello John 👋

Your Toyota Hilux is ready for pickup.

Total:
TZS 410,000

Status:
READY

Thank you for choosing our workshop."

========================================================
30. SERVICE REMINDERS
========================================================

After a service, allow:

Next Service Date

Next Service Mileage

Reminder

Example:

Next oil service:

153,000 km

MachineCare can notify the customer.

Example:

"Hello John 👋

Your Toyota Hilux is due for its next service soon.

Current mileage:
152,700 km

Recommended service:
153,000 km

Book Service"

========================================================
31. APPOINTMENTS
========================================================

Create a simple workshop calendar.

Example:

09:00
Toyota Hilux
Service

10:30
Nissan X-Trail
Brake Repair

14:00
Toyota Noah
Diagnosis

Allow:

Create appointment
Reschedule
Cancel
Convert appointment to job

========================================================
32. BUSINESS REPORTS
========================================================

Workshop reports:

Today's Revenue

Monthly Revenue

Jobs Completed

Jobs In Progress

Outstanding Payments

Average Job Value

Parts Revenue

Labour Revenue

Estimated Gross Profit

Top Services

Top Customers

Top Vehicles

Parts Consumption

Low Stock

Mechanic Workload

Supplier Spending

========================================================
33. PROFITABILITY
========================================================

Show profitability at job level.

Example:

Job Revenue
TZS 450K

Parts Cost
TZS 220K

Labour Cost
TZS 80K

Other Cost
TZS 20K

Gross Profit
TZS 130K

Also provide monthly summary.

Do not claim net profit unless all required business expenses are actually recorded.

Call it:

Estimated Gross Profit

when appropriate.

========================================================
34. VEHICLE SERVICE HISTORY
========================================================

This should become one of the most valuable Workshop features.

Every job contributes to vehicle history.

Example:

Toyota Hilux

Service History:

12 Aug
Brake Repair

03 Jul
Oil Service

15 May
Suspension

20 Feb
Full Service

Each record should show:

Work performed
Parts used
Mileage
Mechanic
Cost
Invoice
Photos
Notes

========================================================
35. CUSTOMER RETENTION
========================================================

The Workshop branch should help workshops retain customers.

Features:

Service reminders
Customer history
Vehicle history
Birthday/optional customer campaigns
Follow-up reminders
Inactive customer list

Example:

"Customers who have not returned for 6 months."

Do not spam customers.

Make communication configurable.

========================================================
36. WORKSHOP BUSINESS SETTINGS
========================================================

Settings should include:

Workshop name

Logo

Phone

Address

Business hours

Currency

Tax settings

Invoice settings

Payment methods

Notification settings

Job statuses

Service categories

Labour rates

Inventory settings

Customer communication settings

========================================================
37. WORKSHOP PERMISSIONS
========================================================

Roles:

OWNER
MANAGER
RECEPTIONIST
MECHANIC
STOREKEEPER
CASHIER

Example:

Owner:
Everything

Manager:
Operations, jobs, customers, inventory, reports

Receptionist:
Customers, appointments, jobs, estimates

Mechanic:
Assigned jobs, diagnosis, parts, notes

Storekeeper:
Inventory, purchases, stock

Cashier:
Invoices, payments

Permissions should be configurable.

========================================================
38. WORKSHOP MOBILE-FIRST DESIGN
========================================================

This is extremely important.

Small workshops may use phones rather than computers.

Design mobile-first workflows.

Mechanic should be able to:

Open job
See vehicle
See problem
Add diagnosis
Add photo
Add part
Complete job

Storekeeper:

Scan part
Issue
Receive
Count stock

Owner:

View dashboard
Approve estimate
View revenue
View jobs
View payments

========================================================
39. WORKSHOP ONBOARDING
========================================================

After selecting:

GARAGE / AUTO WORKSHOP

Ask:

Workshop Name

Owner Name

Phone

Location

Workshop Type

Examples:

General Garage
Auto Electrical
Engine Specialist
Body Repair
Tyre & Wheel
AC Service
Transmission
Motorcycle
Heavy Vehicle

Allow multiple selections if appropriate.

Then:

How many mechanics?

1–5
6–10
11–20
20+

Do you currently track inventory?

Yes / No

Do you issue invoices?

Yes / No

Do you want customer reminders?

Yes / No

Then create a simple workspace.

========================================================
40. SAMPLE WORKSHOP DATA
========================================================

For development/demo mode, create realistic sample data:

Customers:
10

Vehicles:
15

Jobs:
20

Parts:
50

Suppliers:
5

Mechanics:
4

Invoices:
20

Payments:
15

This allows the dashboard to immediately demonstrate the product.

Do not use fake data in production organizations.

========================================================
41. WORKSHOP EMPTY STATES
========================================================

Do not show empty tables with no guidance.

Example:

No vehicles yet.

"Add your first customer vehicle to start tracking service history."

Button:

+ Add Vehicle

For inventory:

"No parts added yet."

"Add your commonly used parts so MachineCare can track stock and job costs."

========================================================
42. CRITICAL PRODUCT DIFFERENCE
========================================================

The Workshop branch must NOT look like Industrial MachineCare with different labels.

It should have:

Different navigation
Different dashboard
Different terminology
Different onboarding
Different workflows
Different reports
Different default permissions
Different priorities

Workshop priorities:

CUSTOMERS
VEHICLES
JOBS
MECHANICS
PARTS
PAYMENTS

Industrial priorities:

MACHINES
MAINTENANCE
PRODUCTION
SAFETY
INVENTORY
OPERATIONS

========================================================
43. SHARED DATA MODEL VS PRODUCT EXPERIENCE
========================================================

Use a shared platform where technically appropriate.

However, product experience must remain separated.

For example:

Shared:
User
Organization
Employee
File
Notification
AuditLog

Workshop:
Customer
Vehicle
Job
Estimate
Invoice
Payment
ServiceHistory

Industrial:
Machine
ProductionLine
MaintenancePlan
WorkOrder
ProductionOrder
SafetyPermit
Inspection

Inventory can have shared foundations but different interfaces and workflows.

========================================================
44. BUSINESS TYPE ARCHITECTURE
========================================================

Create a clean business-type abstraction.

Conceptually:

Organization

business_type:
INDUSTRIAL
WORKSHOP

Then:

BusinessConfiguration

business_type

features

navigation

terminology

permissions

dashboard

workflows

Do not scatter conditions everywhere such as:

if garage then ...

if industrial then ...

Centralize this logic.

========================================================
45. ACCOUNT SWITCHING
========================================================

If a user belongs to multiple organizations:

Example:

Michael belongs to:

MachineCare Industrial
MachineCare Workshop

Allow switching organization.

But switching organizations should also switch the entire product experience.

Example:

MachineCare Industrial

switch →

MachineCare Workshop

The user should immediately see the Workshop dashboard and navigation.

========================================================
46. FUTURE MULTI-BRANCH ARCHITECTURE
========================================================

Design so we can eventually support:

INDUSTRIAL
WORKSHOP
FIELD_SERVICE
HEAVY_EQUIPMENT
CONSTRUCTION
FACILITY_MANAGEMENT

But only implement:

INDUSTRIAL
WORKSHOP

now.

Never build architecture that requires rewriting the application to add the third branch.

========================================================
47. DATABASE DESIGN
========================================================

Before changing the database:

Inspect the current MachineCare database.

Identify:

Existing organization model
Existing user model
Existing employee model
Existing machine model
Existing work order model
Existing inventory model
Existing notification system
Existing permissions

Reuse existing models where appropriate.

Potential Workshop entities:

WorkshopCustomer
Vehicle
VehicleDocument
WorkshopJob
JobDiagnosis
JobFinding
JobPart
JobLabour
Estimate
EstimateItem
CustomerApproval
Invoice
InvoiceItem
Payment
Appointment
ServiceHistory
WorkshopService
MechanicAssignment
WorkshopTool

Use existing inventory entities where they can safely be reused.

Do not duplicate entities unnecessarily.

========================================================
48. DATA RELATIONSHIP
========================================================

The ideal Workshop relationship is:

CUSTOMER
↓
VEHICLE
↓
JOB
↓
DIAGNOSIS
↓
ESTIMATE
↓
CUSTOMER APPROVAL
↓
WORK
↓
PARTS + LABOUR
↓
QUALITY CHECK
↓
INVOICE
↓
PAYMENT
↓
SERVICE HISTORY
↓
REMINDER

This is the core Workshop lifecycle.

========================================================
49. EXAMPLE END-TO-END WORKFLOW
========================================================

Customer:

John

Vehicle:

Toyota Hilux
T 123 ABC

Customer arrives.

Receptionist creates Job:

"Engine overheating."

Mechanic diagnoses:

Damaged thermostat.

Mechanic adds:

Thermostat
TZS 80,000

Coolant
TZS 40,000

Labour
TZS 150,000

Estimate:

TZS 270,000

Customer receives approval request.

Customer approves.

Job becomes:

APPROVED

Mechanic starts.

Parts are consumed automatically.

Mechanic completes.

Quality check.

Vehicle becomes:

READY

Invoice:

TZS 270,000

Customer pays:

TZS 270,000

Payment recorded.

Job becomes:

CLOSED

Vehicle service history updated.

MachineCare calculates:

Next service:
153,000 km

Customer reminder scheduled.

This entire process should happen inside Workshop.

========================================================
50. PRODUCT PRINCIPLE
========================================================

DO NOT build features simply because they exist in Industrial MachineCare.

Ask:

"Does this solve a real problem for a small workshop?"

Every screen must have a purpose.

Workshop should be:

Simple
Fast
Affordable
Mobile-first
Easy to learn
Professional
Practical

========================================================
51. IMPLEMENTATION STRATEGY
========================================================

Do NOT start coding immediately.

FIRST inspect the existing MachineCare application.

Return:

1. Current architecture
2. Current authentication
3. Organization model
4. Current business/product structure
5. Current MachineCare navigation
6. Current database models
7. Existing inventory
8. Existing maintenance
9. Existing user/role system
10. Existing UI system

Then propose:

1. Multi-business architecture
2. Organization business_type
3. Feature configuration
4. Navigation configuration
5. Workshop data model
6. Workshop workflows
7. Permission model
8. Migration strategy
9. UI architecture
10. Implementation phases

WAIT FOR APPROVAL BEFORE MAJOR IMPLEMENTATION.

========================================================
52. IMPLEMENTATION PHASES
========================================================

PHASE 1

Multi-business foundation

- Organization business type
- Business configuration
- Feature flags
- Navigation configuration
- Industrial branch preserved
- Workshop branch created

PHASE 2

Workshop onboarding

- Business selection
- Workshop profile
- Initial setup
- Roles
- Sample/empty states

PHASE 3

Workshop core

- Dashboard
- Customers
- Vehicles
- Jobs
- Mechanics

PHASE 4

Workshop operations

- Diagnosis
- Estimates
- Customer approval
- Job workflow
- Service history

PHASE 5

Commercial

- Invoices
- Payments
- Job costing
- Profitability

PHASE 6

Workshop inventory

- Parts
- Stock
- Suppliers
- Purchases
- Low stock
- Automatic consumption

PHASE 7

Customer relationship

- Appointments
- Service reminders
- Communication
- WhatsApp-ready architecture

PHASE 8

Reports

- Revenue
- Jobs
- Parts
- Mechanics
- Customers
- Profitability

========================================================
53. NON-NEGOTIABLE RULES
========================================================

1. Do not break existing Industrial functionality.

2. Do not make Workshop a submodule of Industrial.

3. Do not duplicate the entire codebase.

4. Do not create two separate authentication systems.

5. Do not hardcode business-type logic throughout the application.

6. Centralize business configuration.

7. Keep Workshop simple.

8. Keep Workshop mobile-first.

9. Reuse shared infrastructure.

10. Keep Workshop data logically separated.

11. Use proper permissions.

12. Maintain auditability.

13. Never silently alter historical financial records.

14. Inventory changes must be transactional.

15. Customer approvals must be traceable.

16. Do not overwhelm Workshop users with Industrial features.

========================================================
54. FINAL VISION
========================================================

MachineCare should become a platform that adapts itself to the business.

A factory owner sees:

Machines
Maintenance
Production
Safety
Inventory
Operations

A garage owner sees:

Customers
Vehicles
Jobs
Mechanics
Parts
Estimates
Invoices
Payments
Service History

The platform underneath is MachineCare.

But the experience is completely different.

The user should feel:

"This software was built specifically for my business."

NOT:

"This is an industrial system that happens to have a garage module."

That distinction is extremely important.

Build MachineCare Workshop as a first-class product branch.


