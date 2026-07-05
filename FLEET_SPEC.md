Read this full spec carefully. Before writing any code, give me a short plan for Phase 1 only, and wait for my go-ahead before implementing. Work phase by phase, confirming with me before moving to the next phase.

We are adding a Fleet & Logistics industry profile to MachineCare Hub so the app reshapes itself based on the organisation's industry, while reusing the existing maintenance engine (work orders, PM schedules, inventory, vendors, fault reports, checklists, notifications).

GOAL
When a user signs up (or an owner switches in Settings) and selects Fleet & Logistics as their industry, the app must reshape into a fleet-focused experience: its own dashboard, its own sidebar, its own vocabulary, its own feature set, its own TV/availability view, and a fleet analytics layer. Manufacturing/Production/OEE/Quality/Utilities screens must be hidden (not deleted) for fleet orgs — other industries still use them.

DATA MODEL DECISIONS (apply these before building)
- industry_profile (new enum) and plan (existing lite/standard) are orthogonal — do not merge them. A fleet org can be on any plan tier.
- Keep the existing organisations.industry text column as-is for historical/display detail. Add organisations.industry_profile enum (manufacturing | fleet_logistics | garage | mixed), default manufacturing for existing rows, backfilled from industry via a one-time mapping migration. All new conditional logic reads industry_profile only, never the old industry text column.

1. INDUSTRY PROFILE FOUNDATION
- Add industry_profile enum on organisations as described above.
- Signup form: replace free-text industry with a 4-card picker (icon + 1-line description).
- Settings → Organisation: owner/manager can change profile later, with confirm dialog ("this changes your sidebar and dashboard").
- Expose organisation.industry_profile through AuthContext so every page can read it synchronously.
- Create a helper useIndustry() returning { profile, isFleet, isManufacturing, isGarage }.

2. CONDITIONAL NAVIGATION
- Refactor Sidebar.tsx so each NavGroup declares visibleFor: IndustryProfile[].
- Fleet & Logistics sidebar:
  - Overview: Fleet Dashboard, Live TV (fleet mode), Notifications
  - Fleet: Vehicles, Drivers, Trips, Documents (expiry), Tyres, Fuel, Inspections
  - Maintenance: Work Orders, PM Schedules, Fault Reports, Checklist Templates, Inventory, Vendors
  - Insights: Fleet KPIs & Analytics, Reports
  - People: Team, Induction
  - System: Settings
- Hide: Production, OEE, Quality, Utilities, Manufacturing KPIs for fleet orgs.

3. FLEET DASHBOARD (/dashboard re-routes by profile)
- Create src/pages/fleet/FleetDashboard.tsx. Render it from /dashboard when isFleet.
- Top KPI strip (4 cards): Vehicles on road today (active/total, % availability); Trips in progress + completed today; Fuel cost this week (WoW delta); Documents expiring in 30 days (red badge if any <7 days).
- Main grid: Fleet status board (plate, driver, status, location, odometer, next service due); Expiring documents widget (traffic-light chips); Open work orders by vehicle (grouped bar); Fuel efficiency leaderboard (top 5 best/worst km/L); Tyre alerts (past rotation/replacement km); Recent fault reports (last 5); Pre-start inspection completion rate today.

4. LIVE TV — FLEET MODE
- Audit the existing Live TV component. Add a fleet-mode variant (or conditional rendering) showing real-time vehicle availability: on road / idle / workshop / off-road counts, plus a live status board suited for a wall-mounted screen (large text, auto-refresh, no scrolling required for key numbers).

5. NEW DOMAIN TABLES (all org-scoped RLS, full GRANTs for authenticated + service_role, created_at/updated_at with touch_updated_at trigger)
- drivers (id, org_id, full_name, phone, licence_number, licence_class, licence_expiry, medical_expiry, photo_url, status, notes)
- vehicle_documents (id, org_id, machine_id, doc_type [insurance|road_licence|inspection|fitness|permit|other], number, issued_on, expires_on, file_url, reminder_days, notes)
- trips (id, org_id, machine_id, driver_id, purpose, origin, destination, start_odo, end_odo, start_at, end_at, fuel_used_l, cost, cargo_description, status [planned|in_progress|completed|cancelled])
- tyres (id, org_id, machine_id, position [FL|FR|RL|RR|spare|...], brand, size, serial, fitted_at, fitted_odo, removed_at, removed_reason, current_tread_mm, target_replace_km)
- driver_assignments (id, org_id, machine_id, driver_id, from, to, primary bool)
- inspection_templates (id, org_id, name, is_fleet_default bool) and inspection_items (id, template_id, label, sort_order) — audit existing checklist_templates first; if the existing checklist engine can support a tri-state response type (OK / Not OK / Not Relevant) via a config flag, extend it instead of duplicating tables.
- inspections (id, org_id, machine_id, driver_id, template_id, submitted_at, overall_result, notes) and inspection_responses (id, inspection_id, item_id, result [ok|not_ok|not_relevant], comment) — if an item is marked not_ok, auto-create a linked fault_report referencing the inspection.
- Extend machines with optional fleet fields (audit existing schema first, reuse what's there): plate_number, vin, fuel_type, tank_capacity_l, current_odometer_km, home_depot.

6. NEW PAGES
- /fleet/vehicles — reuse the /machines table component, filtered, with plate/driver/odo columns
- /fleet/vehicles/:id — tabs: Overview, Trips, Documents, Tyres, Fuel, Maintenance (reuse existing WO/PM components), Drivers history, Inspections
- /fleet/drivers — list + detail (assignments, trips, infractions, doc expiry)
- /fleet/trips — list with status tabs; "Start trip"/"Close trip" flow; closing a trip auto-creates a fuel log if fuel_used_l > 0
- /fleet/documents — global expiry inbox across vehicles and drivers, sortable by days-to-expire
- /fleet/tyres — per-vehicle tyre map (4–10 wheel diagram) + replacement history
- /fleet/inspections — list of submitted inspections, filterable by result, vehicle, driver, date

7. QR-DRIVEN PRE-START INSPECTION FLOW
- QR landing (/m/:id) becomes vehicle-aware: shows plate, driver, last service, and action buttons: "Pre-Start Inspection", "Report fault", "Log fuel", "Start trip".
- Pre-Start Inspection flow (mobile-first, no login required beyond the QR token): render the org's inspection template as a checklist; each item shows three tap targets — OK / Not OK / Not Relevant — plus an optional comment field per item. On submit: save to inspections + inspection_responses; any Not OK item auto-creates a fault_report linked to the inspection and the vehicle; confirm screen shows a summary before final submit.

8. REUSED ENGINE — NO DUPLICATION
- Work Orders, PM schedules, Inventory, Vendors, Checklist templates, Fault Reports, Notifications, Print/PDF: same code, just relabel copy ("Machine" → "Vehicle") via i18n keys when isFleet.
- PM schedules already support interval_km — surface that UI prominently for fleet.

9. FLEET ANALYTICS & KPI MODULE (/fleet/insights)
Build this as computed views/aggregations over existing + new tables — no new raw input tables beyond what's above. Include:
- Fleet downtime — total and by vehicle, derived from work order open-to-close duration and off-road status periods
- Vehicle reliability — breakdowns (unplanned fault reports) per vehicle per period; simple MTBF-style metric (average time between breakdowns)
- Maintenance cost per kilometer — total WO cost (parts + labour) ÷ km travelled (from odometer deltas/trips) per vehicle and fleet-wide
- Spare part consumption — trend graph of inventory issues over time, filterable by part and vehicle
- Repeated repairs — flag vehicles/components with the same fault category recurring within a configurable window (e.g. 3+ times in 90 days)
- Pre-start inspection completion rate — % of scheduled/expected inspections actually submitted, daily/weekly
- Breakdown rate — unplanned fault reports per vehicle per period, fleet-wide trend
- Average downtime duration — mean time vehicles spend in workshop/off-road status
- Average service/repair time — mean work order open-to-close duration
- Parts availability — % of work orders where required parts were in stock at time of request vs had to be ordered
- Labour cost — aggregated from work order labour entries, by vehicle and fleet-wide
- Oil consumption rate — from inventory issues tagged as oil/lubricant, per vehicle per period (requires a way to tag inventory items by category if not already present — audit first)
- Present these as a mix of KPI cards, trend line charts, and a leaderboard table; make the page filterable by date range and vehicle.

10. AUTOMATIONS & NOTIFICATIONS
Extend the existing daily-maintenance-emails cron:
- Document expiring in N days → email manager + driver
- Driver licence/medical expiring → email manager
- Tyre past target replace km → email manager
- Trip overdue (planned end < now, still in_progress) → email manager
- Pre-start inspection not submitted by cutoff time → email manager
Reuse send-transactional-email and the React Email template registry. Add the needed new templates.

ACCEPTANCE CRITERIA
- Creating a new org with "Fleet & Logistics" lands the user on Fleet Dashboard, not Manufacturing.
- Sidebar shows only fleet-relevant groups.
- Existing manufacturing orgs see no change.
- Owner can switch profile in Settings; UI reshapes on next route change, no reload required.
- All new tables enforce RLS by organisation_id and pass the linter.
- A vehicle's PM schedule by km generates a Work Order via the existing engine.
- Document expiry within 30 days appears on dashboard AND triggers daily email.
- A driver can scan a vehicle QR, complete a pre-start inspection with OK/Not OK/Not Relevant per item, and a Not OK item auto-creates a fault report.
- Fleet Insights page renders real computed values (not placeholders) for at least downtime, cost per km, and breakdown rate by end of Phase 6.

ROLLOUT ORDER (implement one phase at a time, confirm with me before moving to the next)
1. industry_profile column + migration from industry text + signup picker + Settings switch + useIndustry() + conditional sidebar + Fleet Dashboard shell (empty widgets)
2. Drivers + Vehicle Documents + expiry widget + email alerts
3. Trips + fuel integration
4. Tyres module
5. QR pre-start inspection flow (templates, tri-state responses, auto fault report creation) + Live TV fleet mode
6. Fleet Analytics & KPI module (all metrics listed in section 9)
7. Polish — leaderboards, QR vehicle landing refinement, bilingual sweep

Start with Phase 1 only. Audit the existing machines table, Sidebar.tsx, and checklist_templates/fault_reports schema first, then show me your plan before writing any code.