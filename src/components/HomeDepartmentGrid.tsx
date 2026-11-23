/**
 * Home KPI summary strip and Browse by Subject interactive department card grid.
 */
import type { MouseEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DepartmentCounts } from '../js/home-stats';
import type { Department } from '../js/types';
import type { PageId } from './EquipmentCard';
import { DepartmentDoodle } from './LabDoodles';

interface HomeKpiStripProps {
  deptCount: number;
  labCount: number;
  availableCount: number;
  totalItems: number;
  pendingCount: number;
}

/**
 * Renders the 4-column campus inventory summary cards on the Home page.
 *
 * @param props - Department, lab, available item, total item, and pending approval counts.
 * @returns KPI summary section element.
 */
export function HomeKpiStrip({
  deptCount,
  labCount,
  availableCount,
  totalItems,
  pendingCount,
}: HomeKpiStripProps) {
  return (
    <section aria-label="Campus inventory summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="notebook-sheet notebook-sheet-alt-tape p-4">
        <div className="text-base text-[var(--ink)]">Departments</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">{deptCount}</div>
        <div className="mt-1 text-sm text-[var(--ink)]">Science & engineering</div>
      </div>
      <div className="notebook-sheet p-4">
        <div className="text-base text-[var(--ink)]">Shared Labs</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">{labCount}</div>
        <div className="mt-1 text-sm text-[var(--ink)]">Across 7 buildings</div>
      </div>
      <div className="notebook-sheet notebook-sheet-alt-tape p-4">
        <div className="text-base text-[var(--ink)]">Available Now</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">
          {availableCount}
          <span className="ml-1.5 text-lg font-normal">/ {totalItems}</span>
        </div>
        <div className="mt-1 text-sm text-[var(--ink)]">Ready for slot booking</div>
      </div>
      <div className="notebook-sheet p-4">
        <div className="text-base text-[var(--ink)]">Pending Approvals</div>
        <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">{pendingCount}</div>
        <div className="mt-1 text-sm text-[var(--ink)]">Active faculty queue</div>
      </div>
    </section>
  );
}

interface HomeDepartmentGridProps {
  departments: Department[];
  totalItems: number;
  deptStatsMap: Map<string, DepartmentCounts>;
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string }) => void;
}

/**
 * Renders the "Browse by subject" department cards with live lab/item counts.
 *
 * @param props - Departments array, aggregated counts map, and navigation handler.
 * @returns Department directory section.
 */
export function HomeDepartmentGrid({
  departments,
  totalItems,
  deptStatsMap,
  onNavigate,
}: HomeDepartmentGridProps) {
  const handleGridClick = (event: MouseEvent<HTMLDivElement>) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-dept-id]');
    const deptId = btn?.dataset.deptId ?? '';
    if (deptId) onNavigate('discover', { departmentId: deptId, labId: '' });
  };

  return (
    <section aria-labelledby="browse-subject-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="browse-subject-heading" className="text-3xl font-bold text-[var(--ink)]">
            Browse by subject
          </h2>
          <p className="mt-1 text-base text-[var(--ink)]">
            Select an academic department to inspect its laboratories, equipment inventory, and safety requirements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('discover', { departmentId: '', labId: '' })}
          className="labora-btn labora-btn-paper"
        >
          View all {totalItems} items
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" onClick={handleGridClick}>
        {departments.map((dept, index) => {
          const counts = deptStatsMap.get(dept.id) ?? { labs: 0, items: 0, available: 0 };
          return (
            <button
              key={dept.id}
              type="button"
              data-dept-id={dept.id}
              className={`notebook-sheet ${
                index % 2 === 1 ? 'notebook-sheet-alt-tape' : ''
              } flex flex-col justify-between p-5 text-left transition-transform duration-150 hover:-translate-y-1 cursor-pointer`}
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
                    {dept.code} · {dept.building}
                  </span>
                  <DepartmentDoodle departmentId={dept.id} className="h-10 w-10 shrink-0" />
                </div>
                <h3 className="mt-3 text-2xl font-bold text-[var(--ink)]">{dept.name}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-[var(--ink)]">{dept.summary}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-[var(--border-subtle)] pt-3 text-base">
                <span className="tabular-nums text-[var(--ink)]">
                  {counts.labs} labs · {counts.items} items
                </span>
                <span className="status-badge status-badge-available">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{counts.available} available</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
