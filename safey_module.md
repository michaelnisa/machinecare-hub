You are a senior product architect, UX designer, and full-stack engineer specializing in industrial CMMS, EHS (Environment, Health & Safety), maintenance management, and manufacturing operations software.

I am building MachineCare, an industrial operations and maintenance management platform.

MachineCare already manages:
- Machines and equipment
- Maintenance
- Work orders
- Production
- Inventory
- Spare parts
- Documents
- Knowledge
- Employees/technicians

I now want you to design and implement a COMPLETE, PROFESSIONAL SAFETY MANAGEMENT MODULE.

IMPORTANT:

Do NOT build Safety as a simple page containing safety records.

Safety must be a fully integrated operational system that controls, approves, documents, monitors, and verifies safety-related activities across Maintenance, Inventory, Production, Machines, Employees, Contractors, and Work Orders.

The goal is:

"MachineCare should allow an industrial company's Safety Department to conduct most of its daily safety processes inside the platform instead of relying on paper forms, WhatsApp, spreadsheets, and disconnected emails."

The module must feel like enterprise industrial software, but remain simple enough for factory workers and supervisors to use.

==================================================
1. CORE SAFETY PHILOSOPHY
==================================================

The core principle is:

NO HIGH-RISK WORK SHOULD START WITHOUT THE REQUIRED SAFETY CONTROLS.

Safety must be connected to operational workflows.

Example:

Maintenance creates:
"Replace motor on Filling Machine #1"

MachineCare should automatically determine:

- Is this activity safety-sensitive?
- What hazards exist?
- Is a risk assessment required?
- Is a permit required?
- Is LOTO required?
- What PPE is required?
- Does the technician have the required competency?
- Does Safety need to approve the work?
- Are controlled tools required?
- Are there safety conditions that must be satisfied before work starts?

The system should prevent or warn users from starting work when mandatory safety requirements have not been completed.

==================================================
2. SAFETY MAIN NAVIGATION
==================================================

Create a dedicated Safety module with:

Safety
├── Dashboard
├── Work Safety / Approvals
├── Permits to Work
├── Risk Assessments
├── LOTO
├── Safety Inspections
├── Incidents
├── Near Misses
├── Investigations
├── Corrective Actions
├── Safety Induction
├── Training & Competency
├── PPE
├── Safety Equipment
├── Controlled Tools
├── Contractors
├── Certificates
├── Safety Documents
├── Safety Knowledge
└── Safety Reports

Use a clean sidebar/navigation structure.

==================================================
3. SAFETY DASHBOARD
==================================================

Create a professional Safety Dashboard.

At the top show:

- Open Incidents
- Near Misses
- Pending Safety Approvals
- Active Permits
- High-Risk Jobs Today
- Overdue Corrective Actions
- Expiring Certifications
- Induction Compliance
- Inspection Compliance
- PPE Compliance

Use status indicators:

GREEN = healthy/compliant
YELLOW = attention required
RED = critical/overdue
GRAY = inactive/not applicable

Include:

"Safety Overview"

"Today's High-Risk Activities"

"Pending Approvals"

"Open Corrective Actions"

"Upcoming Inspections"

"Expiring Certificates"

"Recent Incidents"

"Safety Trends"

Charts should be simple and useful, not decorative.

==================================================
4. WORK ORDER SAFETY INTEGRATION
==================================================

This is one of the most important features.

Maintenance Work Orders must integrate directly with Safety.

Example:

Work Order:
"Replace Filler Motor"

Machine:
3-in-1 Rinser/Filler/Capper

Risk:
High

Hazards:
- Electrical
- Mechanical
- Stored energy
- Unexpected startup

MachineCare automatically determines required controls.

Possible requirements:

- Risk Assessment
- JSA
- Permit to Work
- LOTO
- PPE
- Competent/authorized technician
- Safety approval

Work order status should follow:

Draft
→ Safety Review Required
→ Safety Approved
→ Ready for Work
→ Work Started
→ Work Completed
→ Safety Verification
→ Closed

Do not allow "Work Started" if mandatory safety requirements are incomplete.

==================================================
5. SAFETY APPROVAL WORKFLOW
==================================================

Create a Safety Approval workflow.

Safety Officer receives:

"Safety Approval Required"

Display:

- Work Order
- Machine
- Activity
- Requester
- Technician
- Date/time
- Risk level
- Hazards
- Required controls
- Required permits
- Required PPE
- Required competency

Safety Officer can:

- Approve
- Approve with Conditions
- Reject
- Request Changes

Every decision must record:

- User
- Role
- Timestamp
- Decision
- Comments
- Conditions
- Digital acknowledgement/signature if supported

Send notifications when:

- Approval requested
- Approved
- Rejected
- Changes requested
- Approval overdue

==================================================
6. PERMIT TO WORK SYSTEM
==================================================

Create a complete Permit-to-Work system.

Permit types:

1. Hot Work Permit
2. Electrical Work Permit
3. Lockout/Tagout Permit
4. Work at Height Permit
5. Confined Space Permit
6. Lifting Operation Permit
7. Excavation Permit
8. Chemical Handling Permit
9. General Maintenance Permit
10. Emergency Work Permit

Each permit should contain:

- Permit number
- Work order
- Machine/equipment
- Work location
- Description of work
- Workers
- Supervisor
- Hazards
- Controls
- PPE
- Isolation requirements
- Emergency requirements
- Start date/time
- Expiry date/time
- Safety officer
- Approval status

Permit states:

Draft
Pending Approval
Approved
Active
Suspended
Expired
Closed
Cancelled

Important:

Permits must have expiry times.

The system should notify users before expiry.

Example:

"Hot Work Permit HW-102 expires in 30 minutes."

==================================================
7. JOB SAFETY ANALYSIS / RISK ASSESSMENT
==================================================

Create a configurable JSA / Risk Assessment system.

Fields:

- Activity
- Step
- Hazard
- Consequence
- Likelihood
- Severity
- Initial risk score
- Control measure
- Responsible person
- Residual likelihood
- Residual severity
- Residual risk score

Risk levels:

LOW
MEDIUM
HIGH
CRITICAL

Allow organizations to configure scoring matrices.

Example:

Activity:
Replace conveyor motor

Hazard:
Electrical shock

Initial Risk:
HIGH

Control:
Isolate power + LOTO + verify zero energy

Residual Risk:
LOW

Safety Officer approves the assessment.

Allow:

- Save templates
- Duplicate assessments
- Attach photos
- Attach documents
- Link assessment to work orders
- Link assessment to machines

==================================================
8. LOCKOUT / TAGOUT (LOTO)
==================================================

Create a complete LOTO workflow.

A machine should have known energy sources.

Example:

3-in-1 Filler:

- Electrical
- Pneumatic
- Mechanical
- Hydraulic if applicable
- Thermal if applicable

LOTO procedure:

1. Notify affected workers
2. Shut down machine
3. Isolate energy
4. Apply lock
5. Apply tag
6. Release stored energy
7. Verify zero energy
8. Authorized person confirms isolation

Each step should be digitally checked.

Do not allow maintenance work to start until required LOTO steps are completed.

Record:

- Person
- Lock ID
- Tag ID
- Time
- Energy source
- Verification
- Removal

At completion:

- Restore energy
- Verify machine safe
- Remove locks/tags
- Authorize restart

==================================================
9. SAFETY INSPECTIONS
==================================================

Create configurable inspection templates.

Examples:

Factory Safety Inspection
Machine Safety Inspection
Electrical Safety Inspection
Fire Safety Inspection
Warehouse Safety Inspection
Workshop Safety Inspection
PPE Inspection
Emergency Equipment Inspection
Forklift Safety Inspection
Lifting Equipment Inspection

Inspection checklist items should support:

- Pass
- Fail
- Observation
- Not Applicable

Allow:

- Comments
- Photos
- Attachments
- Corrective actions

Example:

☐ Emergency exits clear
☐ Machine guards installed
☐ Emergency stop functional
☐ Electrical panels closed
☐ Fire extinguisher accessible
☐ PPE compliance
☐ No oil leakage

If a checklist item fails:

Automatically create a Corrective Action.

==================================================
10. INCIDENT MANAGEMENT
==================================================

Create an Incident Management system.

Incident types:

- Injury
- Property damage
- Equipment damage
- Fire
- Chemical spill
- Environmental incident
- Vehicle incident
- Electrical incident
- Other

Capture:

- Incident number
- Date/time
- Location
- Machine
- Department
- People involved
- Description
- Immediate action
- Photos
- Witnesses
- Severity
- Classification

Incident status:

Reported
Under Investigation
Corrective Action
Awaiting Verification
Closed

==================================================
11. NEAR MISS MANAGEMENT
==================================================

Create a very simple workflow for workers to report near misses.

Example:

"Worker almost slipped near Filling Line #1."

Allow:

- Anonymous reporting if company policy permits
- Photo
- Location
- Machine
- Description
- Immediate action

Then Safety reviews it.

A near miss should be converted into:

- Corrective Action
- Preventive Action
- Investigation

when appropriate.

==================================================
12. INCIDENT INVESTIGATION
==================================================

Create an investigation system.

Include:

- Timeline
- Witness statements
- Evidence
- Photos
- Root cause
- Contributing factors
- Immediate cause
- Underlying cause
- Corrective actions
- Preventive actions

Support common root cause methods:

- 5 Whys
- Fishbone/Ishikawa
- Root Cause Analysis

==================================================
13. CORRECTIVE ACTION MANAGEMENT
==================================================

Create a central Corrective Action system.

A corrective action can originate from:

- Inspection
- Incident
- Near Miss
- Audit
- Risk Assessment
- Maintenance
- Safety Observation
- Employee Report

Each action has:

- Action ID
- Source
- Description
- Responsible person
- Department
- Priority
- Due date
- Status
- Evidence
- Verification
- Closure date

Statuses:

Open
Assigned
In Progress
Pending Verification
Closed
Overdue

Important:

Safety should verify completion before final closure.

==================================================
14. SAFETY INDUCTION
==================================================

Create a digital employee/contractor induction system.

Induction should include:

1. Welcome
2. Company Safety Rules
3. Site Hazards
4. PPE Requirements
5. Emergency Procedures
6. Evacuation
7. Fire Safety
8. Chemical Safety
9. Machine Safety
10. Reporting Incidents
11. Restricted Areas
12. Contractor Rules

End with a quiz.

Allow configurable passing score.

After successful completion:

"Safety Induction Completed"

Record:

- Person
- Date
- Site
- Version of induction
- Score
- Trainer if applicable
- Expiry/renewal date

==================================================
15. TRAINING & COMPETENCY
==================================================

Create a competency management system.

Track:

Employee
Competency
Training
Certificate
Issue date
Expiry date
Status

Examples:

- Electrical Safety
- Welding
- Forklift
- First Aid
- Working at Height
- Confined Space
- LOTO
- Fire Safety
- Chemical Handling

When assigning a work order:

MachineCare should check whether the technician has the required competency.

If certification is expired:

Display:

"Technician not authorized for this activity."

==================================================
16. PPE MANAGEMENT
==================================================

Integrate PPE with Inventory.

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

Track:

- Size
- Employee
- Issue date
- Condition
- Expiry
- Replacement date

Allow Safety to define PPE requirements by activity.

Example:

Hot Work:

Required:
- Helmet
- Welding shield
- Gloves
- Fire-resistant clothing
- Safety shoes

==================================================
17. SAFETY EQUIPMENT
==================================================

Track safety equipment separately.

Examples:

- Fire extinguishers
- Fire alarms
- Emergency showers
- Eye wash stations
- First aid kits
- Emergency lights
- Gas detectors
- Safety barriers

Each item has:

- Asset ID
- Location
- Type
- Inspection frequency
- Last inspection
- Next inspection
- Condition
- Certificate
- Expiry

==================================================
18. CONTROLLED TOOLS
==================================================

Integrate Safety + Inventory.

Examples:

- Welding machine
- Electrical tester
- Gas equipment
- Torque wrench
- Lifting equipment
- Confined-space equipment

A controlled tool can require:

- Safety approval
- Authorized user
- Valid certification
- Calibration

Workflow:

Employee requests tool
→ Safety requirements checked
→ Safety approval
→ Inventory issues tool
→ User acknowledges
→ Tool returned
→ Condition checked

==================================================
19. CONTRACTOR SAFETY
==================================================

Create Contractor Management.

Track:

- Company
- Worker
- ID
- Contact
- Induction
- Training
- Certificates
- Insurance
- PPE
- Permit history
- Safety performance

Before a contractor starts work:

MachineCare checks:

- Induction completed?
- Certification valid?
- Required documents valid?
- Permit approved?
- Safety requirements satisfied?

==================================================
20. CERTIFICATE MANAGEMENT
==================================================

Create centralized certificate tracking.

Examples:

- Employee certifications
- Equipment certificates
- Lifting certificates
- Calibration certificates
- Fire equipment certificates
- Contractor documents
- Insurance documents

Alerts:

30 days before expiry
14 days before expiry
7 days before expiry
Expired

==================================================
21. SAFETY DOCUMENT MANAGEMENT
==================================================

Create a Safety document library.

Examples:

- Safety policies
- Procedures
- SOPs
- Emergency plans
- Risk assessments
- JSA templates
- Permit templates
- Safety manuals
- Certificates
- Inspection reports

Every document should support:

- Version
- Owner
- Upload date
- Review date
- Expiry date
- Status

==================================================
22. SAFETY KNOWLEDGE BASE
==================================================

Create a practical knowledge system.

Example article:

"How to respond to low filling pressure"

Sections:

Symptom
Possible causes
Immediate safety precautions
Steps
Required PPE
Escalation
Related machine
Related documents

Another:

"How to perform LOTO on the filler"

Knowledge should link to:

- Machines
- Work Orders
- Permits
- SOPs
- Training

==================================================
23. NOTIFICATIONS
==================================================

Create a notification engine.

Notify users for:

- Safety approval requested
- Approval rejected
- Permit expiring
- Permit expired
- Certification expiring
- Inspection due
- Corrective action overdue
- Incident reported
- Near miss reported
- Induction incomplete
- PPE replacement due
- Controlled tool request
- High-risk job scheduled

Channels:

- In-app
- Email
- Push notification

Make notification preferences configurable.

==================================================
24. ROLE-BASED ACCESS CONTROL
==================================================

Create appropriate permissions.

Roles may include:

Safety Manager
Safety Officer
Maintenance Manager
Maintenance Supervisor
Technician
Inventory Manager
Storekeeper
Production Manager
HR/Training
Contractor
Employee
System Administrator

Example:

Technician:
- Report incident
- View assigned permits
- Complete checklists
- Request approval

Safety Officer:
- Review risks
- Approve permits
- Conduct inspections
- Manage incidents
- Verify corrective actions

Safety Manager:
- Full Safety access
- Reports
- Configuration
- Approval authority

Storekeeper:
- Issue PPE/tools
- Cannot approve safety permits

==================================================
25. AUDIT TRAIL
==================================================

Every important safety action must be recorded.

Example:

14 Aug 2026 09:12
John submitted Permit HW-102

14 Aug 2026 09:18
Safety Officer reviewed

14 Aug 2026 09:22
Safety Officer approved

14 Aug 2026 09:30
LOTO completed

14 Aug 2026 09:35
Maintenance started

14 Aug 2026 11:40
Maintenance completed

14 Aug 2026 11:50
Safety verification completed

Nothing important should disappear without history.

==================================================
26. REPORTING
==================================================

Create Safety reports.

Examples:

- Incident report
- Near miss report
- Safety inspection report
- Permit report
- Corrective action report
- Training compliance
- Certification expiry
- PPE compliance
- Contractor safety report
- LOTO report
- Safety KPI report

KPIs:

- Total incidents
- Lost-time incidents
- Near misses
- Open corrective actions
- Overdue actions
- Inspection compliance
- Permit compliance
- Training compliance
- Induction compliance
- PPE compliance
- Safety observations
- Incident frequency
- Severity trends

Allow filtering by:

- Date
- Site
- Department
- Machine
- Contractor
- Severity

==================================================
27. AUTOMATION / SAFETY RULE ENGINE
==================================================

This is critical.

Create configurable safety rules.

Examples:

IF work order = electrical
THEN require Electrical Permit + LOTO + authorized technician.

IF work order = hot work
THEN require Hot Work Permit + Fire Watch + required PPE.

IF work at height
THEN require Work-at-Height Permit + harness + trained worker.

IF confined space
THEN require Confined Space Permit + gas test + rescue plan.

IF controlled tool requested
THEN require Safety approval.

IF certification expired
THEN prevent assignment to restricted work.

IF inspection fails
THEN automatically create Corrective Action.

IF corrective action overdue
THEN notify responsible person + Safety Manager.

IF permit expires
THEN notify permit holder + supervisor + Safety.

The rules must be configurable rather than hardcoded.

==================================================
28. MACHINE SAFETY PROFILE
==================================================

Every machine in MachineCare should have a Safety Profile.

Example:

3-in-1 Rinser/Filler/Capper

Hazards:
- Electrical
- Mechanical
- Pneumatic
- Chemical
- Rotating equipment

Energy sources:
- Electrical
- Pneumatic
- Mechanical

Required PPE:
- Safety shoes
- Gloves
- Eye protection

Required competencies:
- Machine-specific training
- LOTO

Required permits:
- Electrical work
- Hot work where applicable

LOTO procedure:
Linked document/SOP

Emergency stop:
Installed

Safety guards:
Installed

This profile should automatically inform maintenance work orders.

==================================================
29. UX REQUIREMENTS
==================================================

The interface must be professional and industrial.

Prioritize:

- Clear status
- Clear actions
- Minimal clicks
- Mobile-friendly inspections
- Large buttons for factory-floor workers
- Fast data entry
- Photo capture
- QR/barcode scanning
- Clear approval states
- Strong warning indicators

Do not overload workers with unnecessary information.

Safety Officers and Managers can have more detailed views.

Use consistent status colors:

GREEN = Safe / Approved / Complete
YELLOW = Warning / Pending
RED = Unsafe / Rejected / Overdue
GRAY = Inactive

==================================================
30. SAFETY MOBILE EXPERIENCE
==================================================

Design mobile workflows for:

- Inspections
- Incident reporting
- Near miss reporting
- Permit approval
- LOTO
- Toolbox talks
- Safety observations
- PPE requests
- QR scanning

A technician should be able to report:

"Oil leak found on compressor"

in less than 30 seconds:

Photo
→ Location
→ Description
→ Submit

==================================================
31. IMPORTANT INTEGRATIONS
==================================================

Safety must integrate with:

MAINTENANCE
- Work Orders
- Machines
- Preventive Maintenance
- Breakdowns

INVENTORY
- PPE
- Controlled Tools
- Safety Equipment

PRODUCTION
- Production Lines
- Production schedules
- Downtime

EMPLOYEES
- Training
- Competencies
- Certifications

CONTRACTORS
- Induction
- Permits
- Documents

DOCUMENTS
- SOPs
- Manuals
- Certificates

KNOWLEDGE
- Safety procedures
- Troubleshooting
- Training

==================================================
32. EXAMPLE END-TO-END WORKFLOW
==================================================

Use this as the reference implementation.

Scenario:

Maintenance needs to replace a motor on the 3-in-1 Filler.

STEP 1:
Maintenance creates Work Order.

STEP 2:
MachineCare identifies:
Electrical + Mechanical hazards.

STEP 3:
System requires:
- Risk Assessment
- JSA
- LOTO
- Electrical permit
- PPE
- Authorized technician

STEP 4:
Technician competency is checked.

STEP 5:
Required parts are checked in Inventory.

STEP 6:
Required tools are requested.

STEP 7:
Safety reviews the job.

STEP 8:
Safety approves with conditions.

STEP 9:
Permit becomes active.

STEP 10:
Technician performs LOTO.

STEP 11:
MachineCare verifies LOTO completion.

STEP 12:
Maintenance starts.

STEP 13:
Technician completes work.

STEP 14:
Technician records:
- Work performed
- Parts used
- Photos
- Findings

STEP 15:
Safety verifies the work.

STEP 16:
Permit closes.

STEP 17:
Inventory updates automatically.

STEP 18:
Work order closes.

STEP 19:
Machine history updates.

STEP 20:
MachineCare stores the complete audit trail.

==================================================
33. IMPORTANT PRODUCT REQUIREMENT
==================================================

Do not create disconnected CRUD pages.

Build relationships between the data.

For example:

Machine
↕
Work Order
↕
Risk Assessment
↕
Permit
↕
LOTO
↕
Technician
↕
Competency
↕
Inventory
↕
Tool
↕
Inspection
↕
Corrective Action
↕
Documents
↕
Knowledge

Every record should be linkable to related records.

==================================================
34. IMPLEMENTATION APPROACH
==================================================

Before coding:

1. Inspect the existing MachineCare codebase.
2. Understand the current architecture.
3. Identify existing:
   - Authentication
   - Users
   - Roles
   - Machines
   - Work Orders
   - Inventory
   - Documents
   - Notifications
4. Reuse existing components and design system.
5. Do not unnecessarily rewrite existing functionality.
6. Extend the existing architecture cleanly.

First provide:

A. Architecture plan
B. Database/entity model
C. Relationships
D. User roles/permissions
E. Main workflows
F. API requirements
G. UI page structure
H. Notification architecture
I. Automation/rule architecture

Then implement the module.

==================================================
35. QUALITY STANDARD
==================================================

The result should feel like a serious industrial SaaS product.

Do NOT create:

- Generic dashboard templates
- Fake statistics without data structure
- Decorative charts
- Disconnected forms
- Toy CRUD interfaces
- Hardcoded approval logic
- Pages with no workflow

Instead build:

- Real workflows
- Real relationships
- Real statuses
- Real permissions
- Auditability
- Configurable rules
- Mobile-first field operations
- Clear operational actions

The most important outcome is:

MachineCare Safety should help a Safety Department move from:

PAPER
WHATSAPP
SPREADSHEETS
EMAIL
MANUAL APPROVALS

to:

ONE CONNECTED DIGITAL SAFETY WORKFLOW.

==================================================
36. FINAL PRODUCT VISION
==================================================

The final system should allow an industrial company to manage:

PLAN
→ ASSESS
→ APPROVE
→ CONTROL
→ EXECUTE
→ INSPECT
→ VERIFY
→ CLOSE
→ LEARN

inside MachineCare.

The system should not simply "record safety."

It should actively help the company perform work SAFELY.

Before implementing, show me the proposed architecture and screens. Then proceed module by module, starting with:

1. Safety Dashboard
2. Safety Approval Workflow
3. Permit to Work
4. Risk Assessment / JSA
5. LOTO
6. Safety Inspections
7. Incidents & Near Misses
8. Corrective Actions
9. Induction
10. Training & Competency
11. PPE
12. Contractor Management
13. Safety Equipment
14. Certificates
15. Safety Knowledge
16. Reports
17. Automation / Rule Engine
18. Integration with Maintenance and Inventory

Do not stop at the dashboard. The goal is a complete functional Safety Department inside MachineCare.
