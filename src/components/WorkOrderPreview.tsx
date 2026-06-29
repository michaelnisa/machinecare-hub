import { formatDate } from "@/lib/format";

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWoNumber(year?: number | null, n?: number | null) {
  if (!n) return "WO-DRAFT";
  const y = year ?? new Date().getFullYear();
  return `WO-${y}-${String(n).padStart(4, "0")}`;
}

export interface PreviewData {
  wo_number?: number | null;
  wo_year?: number | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  work_type?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  is_outsourced?: boolean | null;
  sent_date?: string | null;
  promised_date?: string | null;
  vendor_cost?: number | string | null;
  vendor_currency?: string | null;
  warranty_days?: number | null;
  warranty_notes?: string | null;
  // GSM-style fields
  requested_by_name?: string | null;
  department?: string | null;
  plant_area?: string | null;
  nature_of_problem?: string | null;
  equipment_label?: string | null;
  model_no?: string | null;
  serial_no?: string | null;
  permit_cold_work?: boolean | null;
  permit_hot_work?: boolean | null;
  permit_jsea?: boolean | null;
  permit_isolation?: boolean | null;
  permit_confined_space?: boolean | null;
  time_received?: string | null;
  proposed_remedy?: string | null;
  actual_work_done?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  inspected_by_name?: string | null;
  inspected_at?: string | null;
  handed_over_by_name?: string | null;
  handed_over_at?: string | null;
  accepted_by_name?: string | null;
  accepted_at?: string | null;
  remarks?: string | null;
  technician_comment?: string | null;
  labor_cost?: number | string | null;
  cost_currency?: string | null;
  machine?: {
    name?: string;
    make?: string;
    model?: string;
    year?: number;
    serial_number?: string;
    registration_number?: string;
    current_hours?: number | string | null;
    category?: string;
  } | null;
  logo_url?: string | null;
  org?: { name?: string } | null;
  assignee?: { full_name?: string | null } | null;
  vendor?: {
    name?: string;
    phone?: string;
    email?: string;
    category?: string;
  } | null;
  createdBy?: { full_name?: string | null } | null;
  checklist?: { name?: string } | null;
}

export function WorkOrderPreview({
  data,
  compact = false,
}: {
  data: PreviewData;
  compact?: boolean;
}) {
  const {
    wo_number,
    wo_year,
    machine,
    org,
    assignee,
    vendor,
    createdBy,
    checklist,
  } = data;
  const priorityLabel = (data.priority ?? "normal").toUpperCase();
  return (
    <div
      className={
        compact
          ? "bg-white p-6 text-[10pt] text-slate-900 rounded-md border border-slate-200"
          : "mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[18mm] text-[11pt] text-slate-900 shadow-lg print:my-0 print:w-auto print:min-h-0 print:p-[14mm] print:shadow-none"
      }
    >
      <div className="flex items-start justify-between border-b-2 border-teal-600 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
            Work Order
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight">
            {formatWoNumber(wo_year, wo_number)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Issued{" "}
            {formatDate(data.created_at) === "—"
              ? "—"
              : formatDate(data.created_at)}
          </div>
        </div>
        <div className="text-right">
          {data.logo_url ? (
            <img
              src={data.logo_url}
              alt={org?.name ?? "Logo"}
              className="mb-1 ml-auto h-14 w-auto max-w-[160px] object-contain"
            />
          ) : null}
          <div className="text-lg font-semibold">{org?.name ?? "—"}</div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700">
            Priority:{" "}
            <span
              className={
                data.priority === "critical"
                  ? "text-red-600"
                  : data.priority === "high"
                    ? "text-amber-600"
                    : "text-slate-700"
              }
            >
              {priorityLabel}
            </span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
            Status: {(data.status ?? "open").replace("_", " ")}
          </div>
          {data.work_type && (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
              Type: {data.work_type}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Box title="Machine">
          <div className="font-semibold">{machine?.name ?? "—"}</div>
          <div className="text-xs text-slate-600">
            {[machine?.make, machine?.model, machine?.year]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {machine?.serial_number && (
            <Row label="Serial" value={machine.serial_number} />
          )}
          {machine?.registration_number && (
            <Row label="Reg" value={machine.registration_number} />
          )}
          {machine?.current_hours != null && (
            <Row label="Current hrs/km" value={String(machine.current_hours)} />
          )}
        </Box>
        <Box title={data.is_outsourced ? "Assigned vendor" : "Assigned to"}>
          {data.is_outsourced ? (
            <>
              <div className="font-semibold">{vendor?.name ?? "—"}</div>
              {vendor?.category && (
                <div className="text-xs text-slate-600">{vendor.category}</div>
              )}
              {vendor?.phone && <Row label="Phone" value={vendor.phone} />}
              {vendor?.email && <Row label="Email" value={vendor.email} />}
            </>
          ) : (
            <>
              <div className="font-semibold">
                {assignee?.full_name ?? "Unassigned"}
              </div>
              <div className="text-xs text-slate-600">Internal technician</div>
            </>
          )}
        </Box>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
        <Cell label="Issued" value={formatDate(data.created_at)} />
        <Cell label="Due" value={formatDate(data.due_date)} />
        {data.is_outsourced ? (
          <>
            <Cell label="Sent" value={formatDate(data.sent_date)} />
            <Cell label="Promised" value={formatDate(data.promised_date)} />
          </>
        ) : (
          <>
            <Cell label="Started" value={formatDateTime(data.started_at)} />
            <Cell
              label="Completed"
              value={formatDateTime(data.finished_at ?? data.completed_at)}
            />
          </>
        )}
      </div>

      {(data.requested_by_name ||
        data.department ||
        data.plant_area ||
        data.nature_of_problem ||
        data.equipment_label ||
        data.model_no ||
        data.serial_no ||
        data.time_received) && (
        <section className="mt-4">
          <SectionHeader>Request details</SectionHeader>
          <div className="mt-2 grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-xs">
            <Cell label="Requested by" value={data.requested_by_name ?? "—"} />
            <Cell label="Department" value={data.department ?? "—"} />
            <Cell label="Plant area" value={data.plant_area ?? "—"} />
            <Cell
              label="Time received"
              value={formatDateTime(data.time_received)}
            />
            {(data.equipment_label || data.model_no || data.serial_no) && (
              <>
                <Cell label="Equipment" value={data.equipment_label ?? "—"} />
                <Cell
                  label="Model / Serial"
                  value={
                    [data.model_no, data.serial_no]
                      .filter(Boolean)
                      .join(" / ") || "—"
                  }
                />
              </>
            )}
            {data.nature_of_problem && (
              <div className="col-span-2">
                <Cell
                  label="Nature of the problem"
                  value={data.nature_of_problem}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {(data.permit_cold_work ||
        data.permit_hot_work ||
        data.permit_jsea ||
        data.permit_isolation ||
        data.permit_confined_space) && (
        <section className="mt-4">
          <SectionHeader>Permits &amp; certificates</SectionHeader>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <PermitChip on={!!data.permit_cold_work} label="Cold Work Permit" />
            <PermitChip on={!!data.permit_hot_work} label="Hot Work Permit" />
            <PermitChip on={!!data.permit_jsea} label="JSEA" />
            <PermitChip
              on={!!data.permit_isolation}
              label="Isolation Certificate"
            />
            <PermitChip
              on={!!data.permit_confined_space}
              label="Confined Space"
            />
          </div>
        </section>
      )}

      <section className="mt-5">
        <SectionHeader>Job description</SectionHeader>
        <div className="mt-1 text-base font-semibold">{data.title || "—"}</div>
        {data.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {data.description}
          </p>
        )}
        {checklist?.name && (
          <div className="mt-2 text-xs text-slate-600">
            Checklist: <span className="font-medium">{checklist.name}</span>
          </div>
        )}
      </section>

      {data.proposed_remedy && (
        <section className="mt-5">
          <SectionHeader>Proposed remedy</SectionHeader>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {data.proposed_remedy}
          </p>
        </section>
      )}

      {!compact && (
        <>
          <section className="mt-5">
            <SectionHeader>Actual work done</SectionHeader>
            {data.actual_work_done ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {data.actual_work_done}
              </p>
            ) : (
              <div className="mt-2 min-h-[28mm] rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-400">
                Record diagnosis, work done, parts replaced, and measurements
                here.
              </div>
            )}
            {data.technician_comment && (
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                <div className="text-[9pt] uppercase tracking-wide text-slate-500">
                  Technician comment
                </div>
                <div className="mt-0.5 whitespace-pre-wrap text-slate-700">
                  {data.technician_comment}
                </div>
              </div>
            )}
            {data.remarks && (
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                <div className="text-[9pt] uppercase tracking-wide text-slate-500">
                  Manager remarks
                </div>
                <div className="mt-0.5 whitespace-pre-wrap text-slate-700">
                  {data.remarks}
                </div>
              </div>
            )}
          </section>

          <section className="mt-5">
            <SectionHeader>Parts &amp; materials</SectionHeader>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 px-2 py-1.5 font-medium w-16 text-right">
                    Qty
                  </th>
                  <th className="border border-slate-300 px-2 py-1.5 font-medium">
                    Part #
                  </th>
                  <th className="border border-slate-300 px-2 py-1.5 font-medium">
                    Part description
                  </th>
                  <th className="border border-slate-300 px-2 py-1.5 font-medium w-28 text-right">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-2"></td>
                    <td className="border border-slate-300 px-2 py-2"></td>
                    <td className="border border-slate-300 px-2 py-2">
                      &nbsp;
                    </td>
                    <td className="border border-slate-300 px-2 py-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.labor_cost != null && data.labor_cost !== "" && (
              <div className="mt-2 text-right text-xs">
                Labour / in-house cost:{" "}
                <span className="font-semibold">
                  {data.labor_cost} {data.cost_currency ?? "TZS"}
                </span>
              </div>
            )}
          </section>

          <section className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <Cell
              label="Time started"
              value={formatDateTime(data.started_at)}
            />
            <Cell
              label="Time completed"
              value={formatDateTime(data.finished_at)}
            />
            <Cell
              label="Date completed"
              value={formatDate(data.finished_at ?? data.completed_at)}
            />
          </section>
        </>
      )}

      {data.is_outsourced &&
        (data.vendor_cost || data.warranty_days || data.warranty_notes) && (
          <section className="mt-5">
            <SectionHeader>Vendor terms</SectionHeader>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              {data.vendor_cost != null && data.vendor_cost !== "" && (
                <Cell
                  label="Quoted cost"
                  value={`${data.vendor_cost} ${data.vendor_currency ?? "TZS"}`}
                />
              )}
              {data.warranty_days != null && (
                <Cell label="Warranty" value={`${data.warranty_days} days`} />
              )}
              {data.warranty_notes && (
                <div className="col-span-2">
                  <Cell label="Warranty notes" value={data.warranty_notes} />
                </div>
              )}
            </div>
          </section>
        )}

      {!compact && (
        <section className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6">
          <SignatureBlock
            label="Issued / Requested by"
            name={data.requested_by_name ?? createdBy?.full_name}
            when={data.created_at}
          />
          <SignatureBlock
            label="Work assigned to"
            name={data.is_outsourced ? vendor?.name : assignee?.full_name}
            when={data.time_received}
          />
          <SignatureBlock
            label="Job inspected by"
            name={data.inspected_by_name}
            when={data.inspected_at}
          />
          <SignatureBlock
            label="Job handed over by"
            name={data.handed_over_by_name}
            when={data.handed_over_at}
          />
          <SignatureBlock
            label="Job accepted by"
            name={data.accepted_by_name}
            when={data.accepted_at}
          />
          <SignatureBlock label="Elect / Auto / Mech. Engineer" name={null} />
        </section>
      )}

      <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[9pt] text-slate-400">
        {org?.name} · {formatWoNumber(wo_year, wo_number)} · Generated{" "}
        {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1.5 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="text-slate-500">{label}:</span>{" "}
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-slate-800">{value || "—"}</div>
    </div>
  );
}
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-300 pb-1 text-[10pt] font-semibold uppercase tracking-wider text-teal-700">
      {children}
    </div>
  );
}
function SignatureBlock({
  label,
  name,
  when,
}: {
  label: string;
  name?: string | null;
  when?: string | null;
}) {
  return (
    <div>
      <div className="h-[18mm] border-b border-slate-400"></div>
      <div className="mt-1 text-[9pt] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {name && <div className="text-sm text-slate-700">{name}</div>}
      {when ? (
        <div className="text-[9pt] text-slate-500">{formatDateTime(when)}</div>
      ) : (
        <div className="text-[9pt] text-slate-400">Name · Signature · Date</div>
      )}
    </div>
  );
}

function PermitChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
        on
          ? "border-teal-600 bg-teal-50 text-teal-800"
          : "border-slate-300 bg-white text-slate-500",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3 w-3 rounded-sm border",
          on ? "border-teal-700 bg-teal-600" : "border-slate-400 bg-white",
        ].join(" ")}
      >
        {on ? (
          <span className="block text-white text-[9px] leading-3 text-center">
            ✓
          </span>
        ) : null}
      </span>
      {label}
    </span>
  );
}
