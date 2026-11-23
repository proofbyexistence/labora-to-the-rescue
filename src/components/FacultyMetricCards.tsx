/**
 * Faculty summary KPI cards and queue/department filter controls.
 */
import type { LabAnalyticsSummary } from '../js/analytics';
import type { Department, RequestStatus } from '../js/types';

export type QueueFilter = 'Pending' | '' | RequestStatus;

const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending Queue' },
  { value: '', label: 'All Requests' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under review', label: 'Under review' },
  { value: 'Changes requested', label: 'Changes requested' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

/**
 * Renders the 4 summary KPI tiles for pending reviews, weekly approvals, conflicts, and utilization.
 *
 * @param props - Aggregated dashboard summary counts and total campus lab count.
 * @returns Responsive 4-column metric card grid.
 */
export function SummaryMetricCards({
  summary,
  labCount,
}: {
  summary: LabAnalyticsSummary;
  labCount: number;
}) {
  return (
    <div aria-label="Faculty summary metrics" className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--status-limited-bg)] p-4">
        <div className="text-sm font-bold text-[var(--ink)]">Pending reviews</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
          {summary.pendingCount}
        </div>
        <div className="mt-1 text-xs text-[var(--ink)]">Submitted &amp; under review</div>
      </div>

      <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--status-available-bg)] p-4">
        <div className="text-sm font-bold text-[var(--ink)]">Approved this week</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
          {summary.approvedThisWeek}
        </div>
        <div className="mt-1 text-xs text-[var(--ink)]">Cleared in last 7 days</div>
      </div>

      <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-4">
        <div className="text-sm font-bold text-[var(--ink)]">Open conflicts</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
          {summary.openConflicts}
        </div>
        <div className="mt-1 text-xs text-[var(--ink)]">Overlapping bench windows</div>
      </div>

      <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
        <div className="text-sm font-bold text-[var(--ink)]">Overall utilization</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
          {summary.overallUtilizationPct}%
        </div>
        <div className="mt-1 text-xs text-[var(--ink)]">Across {labCount} campus labs</div>
      </div>
    </div>
  );
}

/**
 * Renders status toggle buttons and the department select dropdown for filtering the approval queue.
 *
 * @param props - Active queue/department filters, department list, and change callbacks.
 * @returns Filter toolbar row for the Approvals tab.
 */
export function ApprovalQueueFilterBar({
  queueFilter,
  departmentFilter,
  departments,
  onQueueFilterChange,
  onDepartmentFilterChange,
}: {
  queueFilter: QueueFilter;
  departmentFilter: string;
  departments: Department[];
  onQueueFilterChange: (filter: QueueFilter) => void;
  onDepartmentFilterChange: (deptId: string) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t-2 border-dashed border-[var(--border-subtle)] pt-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Approval status filter">
        {QUEUE_FILTERS.map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => onQueueFilterChange(opt.value)}
            aria-pressed={queueFilter === opt.value}
            className={`labora-btn text-sm ${queueFilter === opt.value ? '' : 'labora-btn-paper'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="w-full sm:w-64">
        <label htmlFor="approvals-dept" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          Department
        </label>
        <select
          id="approvals-dept"
          value={departmentFilter}
          onChange={(e) => onDepartmentFilterChange(e.target.value)}
          className="notebook-input"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
