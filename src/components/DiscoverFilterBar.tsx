/**
 * Discover catalog filter header: scope description, result count, facet selects, and access toggles.
 */
import { RotateCcw, Search } from 'lucide-react';
import { ACCESS_LEVELS, AVAILABILITY_STATUSES, EQUIPMENT_TYPES } from '../js/constants';
import type { DiscoverFilterCriteria } from '../js/filter';
import type { AvailabilityStatus, Department, EquipmentType, Lab } from '../js/types';

interface DiscoverFilterBarProps {
  filters: Required<DiscoverFilterCriteria>;
  searchDraft: string;
  activeDepartment?: Department;
  activeLab?: Lab;
  departments: Department[];
  scopedLabs: Lab[];
  labMap: Map<string, Lab>;
  totalItems: number;
  page: number;
  totalPages: number;
  hasFilters: boolean;
  onSearchDraftChange: (value: string) => void;
  onUpdateFilters: (next: Partial<DiscoverFilterCriteria>) => void;
  onResetAll: () => void;
}

/**
 * Renders the Discover catalog header summary and multi-faceted filter controls.
 *
 * @param props - Active filters, available options, and change handlers.
 * @returns Filter bar section element.
 */
export function DiscoverFilterBar({
  filters,
  searchDraft,
  activeDepartment,
  activeLab,
  departments,
  scopedLabs,
  labMap,
  totalItems,
  page,
  totalPages,
  hasFilters,
  onSearchDraftChange,
  onUpdateFilters,
  onResetAll,
}: DiscoverFilterBarProps) {
  const countLabel = totalItems === 1 ? '1 item found' : `${totalItems} items found`;

  return (
    <section className="notebook-sheet p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">
            {activeLab ? activeLab.name : activeDepartment ? `${activeDepartment.name} Laboratories` : 'Discover Campus Equipment'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-base text-[var(--ink)]">
            {activeLab
              ? `${activeLab.description} Room ${activeLab.room} · Supervised by ${activeLab.supervisor} · Hours ${activeLab.hours}.`
              : activeDepartment
                ? `${activeDepartment.summary} Located in ${activeDepartment.building}, lead faculty ${activeDepartment.leadFaculty}.`
                : 'Filter instruments, development kits, workstations, and safety gear across all seven departments.'}
          </p>
        </div>

        <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-4 py-2 text-center text-[var(--on-lavender)]">
          <p aria-live="polite" aria-atomic="true" className="font-heading text-2xl font-bold tabular-nums !text-[var(--on-lavender)] leading-tight">
            {countLabel}
          </p>
          {totalPages > 1 && (
            <p className="text-sm tabular-nums text-[var(--on-lavender)]">
              Page {page} of {totalPages}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t-2 border-dashed border-[var(--border-subtle)] pt-5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="sm:col-span-2 xl:col-span-1">
          <label htmlFor="discover-search" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink)]" aria-hidden="true" />
            <input
              id="discover-search"
              type="search"
              value={searchDraft}
              onChange={(e) => onSearchDraftChange(e.target.value)}
              placeholder="Name, lab, dept, specs..."
              className="notebook-input !pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="discover-dept" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Department
          </label>
          <select
            id="discover-dept"
            value={filters.departmentId}
            onChange={(e) => onUpdateFilters({ departmentId: e.target.value, labId: '' })}
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

        <div>
          <label htmlFor="discover-lab" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Laboratory
          </label>
          <select
            id="discover-lab"
            value={filters.labId}
            onChange={(e) => {
              const selectedLab = labMap.get(e.target.value);
              onUpdateFilters({
                departmentId: selectedLab ? selectedLab.departmentId : filters.departmentId,
                labId: e.target.value,
              });
            }}
            className="notebook-input"
          >
            <option value="">All Laboratories</option>
            {scopedLabs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name} ({lab.room})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="discover-type" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Equipment type
          </label>
          <select
            id="discover-type"
            value={filters.type}
            onChange={(e) => onUpdateFilters({ type: e.target.value as EquipmentType | '' })}
            className="notebook-input"
          >
            <option value="">All Types</option>
            {EQUIPMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="discover-status" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Availability
          </label>
          <select
            id="discover-status"
            value={filters.status}
            onChange={(e) => onUpdateFilters({ status: e.target.value as AvailabilityStatus | '' })}
            className="notebook-input"
          >
            <option value="">All Statuses</option>
            {AVAILABILITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span id="discover-access-label" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Access level
          </span>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="discover-access-label">
            <button
              type="button"
              onClick={() => onUpdateFilters({ accessLevel: '' })}
              aria-pressed={filters.accessLevel === ''}
              className={`labora-btn text-sm ${filters.accessLevel === '' ? '' : 'labora-btn-paper'}`}
            >
              Any Access
            </button>
            {ACCESS_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onUpdateFilters({ accessLevel: level })}
                aria-pressed={filters.accessLevel === level}
                className={`labora-btn text-sm ${filters.accessLevel === level ? '' : 'labora-btn-paper'}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={onResetAll} disabled={!hasFilters} className="labora-btn labora-btn-paper text-sm">
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          Clear filters
        </button>
      </div>
    </section>
  );
}
