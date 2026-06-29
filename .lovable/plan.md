## Work Order rebuild — plan

### 1. Database changes (one migration)

**Add columns to `work_orders`:**
- `work_type text not null default 'repair'` — `breakdown | preventive | inspection | repair | modification`
- `checklist_template_id uuid references checklist_templates(id)` (nullable)
- `wo_year int` — for `WO-YYYY-NNNN` formatting (stored at insert via trigger)

**New table `wo_status_history`:**
- `work_order_id`, `from_status`, `to_status`, `note`, `changed_by`, `changed_at`
- RLS: org members read, technicians+ write. GRANTs included.

**New table `wo_status_pipeline` (enum-like via text):**
- Use text statuses: `open | assigned | in_progress | waiting_parts | done | closed`. Extend the existing `status` column (currently `open|in_progress|completed|cancelled`). Migrate old values: `completed → done`, `cancelled → closed`.

**WO numbering:**
- Change `assign_wo_number` trigger to also stamp `wo_year = extract(year from now())`.
- Counter resets per year per org via composite key — update `org_wo_counters` to `(organisation_id, year, next_number)`.
- Display format: `WO-{wo_year}-{wo_number:0000}`.

**Trigger for status history:**
- `BEFORE UPDATE` on `work_orders` when `status` changes → insert into `wo_status_history` with `auth.uid()`.
- Same trigger sets `completed_at` when moving to `done`.

**Vendor-job linkage:**
- When `is_outsourced=true` and new row, set `sent_date = now()` if null (already in form).

### 2. Frontend — files

**New pages:**
- `src/pages/WorkOrderNew.tsx` — two-column full page (`/work-orders/new`). Left: form. Right: live print preview (reuse `WorkOrderPrint` styles via a shared `WorkOrderPreview` component).
- `src/pages/WorkOrderDetail.tsx` — pipeline bar + tabs (Details, Checklist, History, Outsourcing). Route `/work-orders/:id`.

**New components:**
- `src/components/WorkOrderPreview.tsx` — printable WO render driven by props (used in `WorkOrderNew` preview pane and as base of `WorkOrderPrint`).
- `src/components/MachineSearchSelect.tsx` — searchable combobox with context card (status, current_hours, last service, open WO count + link).
- `src/components/AssigneeSelect.tsx` — shows `"Name (N open)"` based on a query of open WOs per profile.
- `src/components/StatusPipelineBar.tsx` — segmented bar with clickable transitions; opens a small dialog for `waiting_parts` (require part note) and re-open (require reason).

**Modified:**
- `src/pages/WorkOrders.tsx` — list with status tabs, priority colour strip on left of row, overdue red flag, filter by machine/assignee/type, search by WO# / title. Remove the modal; "New" routes to `/work-orders/new`. Edit also routes to detail.
- `src/pages/WorkOrderPrint.tsx` — switch to use `WorkOrderPreview`.
- `src/App.tsx` — add `/work-orders/new` and `/work-orders/:id` routes.
- `src/lib/format.ts` — add `formatWoNumber(year, num)`.

### 3. Form behaviour

- **WO number**: pre-fetched preview `WO-{year}-{next:0000}` from `org_wo_counters` (display only; actual number assigned by trigger on insert).
- **Machine select**: queries `machines`, last `service_logs.performed_at`, count of open WOs (`status in (open,assigned,in_progress,waiting_parts)`). Open-WO chip links to filtered list.
- **Work type**: when `preventive`/`inspection`, show "Attach checklist" listing templates where `status='approved'` and `(machine_category = machine.category OR machine_id = selected_machine)`.
- **Priority → due date**: on change, auto-set due_date if user hasn't manually edited. `critical=today, high=+1d, normal=+7d, low=+14d`.
- **Assignee**: list profiles in org with role `technician` (and managers/engineers). Suffix open count. On insert, write a row to `maintenance_notifications` for the assignee.
- **Outsourced**: vendor + promised_return_date + estimated_cost (TZS). Saves to existing vendor fields (`vendor_id`, `promised_date`, `vendor_cost`, `vendor_currency='TZS'`, `sent_date=now()`).
- **No status field**: hard-coded `'open'` on insert.

### 4. Detail page

- **Pipeline bar**: 6 segments. Clicking a forward step transitions if allowed. `waiting_parts` → dialog with required `note` (which part). Re-opening from `done` → dialog with required `reason`. All transitions write to `wo_status_history` (via trigger) with optional note (passed through an RPC `transition_wo(_id, _to, _note)`).
- **Timeline**: list of `wo_status_history` entries with relative time + user name.
- **KPI helpers**: store `in_progress_started_at`, `waiting_parts_total_minutes` derived from history when rendering MTTR. Computation client-side from history; no schema change needed beyond history table.

### 5. KPI wiring

- Update `src/pages/MaintenanceKPIs.tsx` (and analytics if present):
  - Planned = WOs where `work_type in ('preventive','inspection')`.
  - Unplanned = `work_type in ('breakdown','repair')`.
  - `modification` excluded from ratio.
  - MTTR: for each `done` WO, sum durations between consecutive history rows where `to_status='in_progress'` until `to_status='done'`, subtracting any `waiting_parts` intervals. Average over period.

### 6. List view

- Tabs: `All | Open | Assigned | In progress | Waiting parts | Done | Closed`.
- 4px left border colour per priority (`normal=blue, high=amber, critical=red, low=muted`).
- Red flag when `due_date < today` and status not in (`done`,`closed`).
- Filters: machine, assignee, work_type (selects in header).
- Search: matches `wo_number` (numeric or formatted) and `title`.

### Scope notes / out of scope

- I will not change other modules' status-string assumptions (Dashboard cards already read `status='open'` etc.). I'll keep `done`/`closed` migrations backward-safe by also accepting `completed` in queries that read counts — added in a small grep pass.
- Photo upload from the original spec is intentionally not included (current form has no attachment field and you didn't restate it). Tell me if you want it added.

### Technical detail (for reviewers)

- `org_wo_counters` schema change requires backfill: `INSERT ... ON CONFLICT` with `(org, year)`. Existing rows get `year = extract(year from now())`.
- `transition_wo` RPC validates allowed transitions to prevent skipping or invalid jumps; managers can override (force) via a second arg.
- `MachineSearchSelect` uses `cmdk` already shipped via shadcn.

Reply **proceed** to build, or tell me what to change.