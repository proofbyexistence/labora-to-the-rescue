/**
 * Collapsible Lab Index notebook-tab sidebar browsing departments, labs, and pending counts.
 */
import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { getLabs } from '../js/lab-data';
import type { Department } from '../js/types';
import type { PageId } from './EquipmentCard';
import { DepartmentDoodle } from './LabDoodles';

interface LabIndexSidebarProps {
  sidebarOpen: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  currentPage: PageId;
  selectedDepartmentId: string;
  selectedLabId: string;
  expandedDeptIds: Record<string, boolean>;
  departments: Department[];
  labCount: number;
  itemCount: number;
  pendingCount: number;
  onSelectDepartment: (departmentId: string) => void;
  onSelectLab: (departmentId: string, labId: string) => void;
  onCloseMobileSidebar: () => void;
}

/**
 * Renders the Lab Index tree sidebar for filtering equipment by department or laboratory.
 *
 * @param props - Selection state, catalog counts, and click handlers.
 * @returns Aside navigation landmark.
 */
export function LabIndexSidebar({
  sidebarOpen,
  sidebarRef,
  currentPage,
  selectedDepartmentId,
  selectedLabId,
  expandedDeptIds,
  departments,
  labCount,
  itemCount,
  pendingCount,
  onSelectDepartment,
  onSelectLab,
  onCloseMobileSidebar,
}: LabIndexSidebarProps) {
  return (
    <aside
      id="lab-index-sidebar"
      ref={sidebarRef}
      aria-label="Lab Index"
      className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-full lg:w-76 shrink-0`}
    >
      <div className="notebook-sheet notebook-sheet-alt-tape sticky top-24 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--ink)]">Lab Index</h2>
            <p className="text-sm text-[var(--ink)]">
              {departments.length} departments · {labCount} labs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectDepartment('')}
              aria-current={
                currentPage === 'discover' && !selectedDepartmentId && !selectedLabId ? 'true' : undefined
              }
              className="labora-btn !px-3 !py-1 text-sm"
            >
              All Labs
            </button>
            <button
              type="button"
              onClick={onCloseMobileSidebar}
              aria-label="Close Lab Index"
              className="labora-btn labora-btn-paper !px-2.5 lg:hidden"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ul className="mt-4 space-y-3" aria-label="Departments and laboratories">
          {departments.map((dept) => {
            const deptLabs = getLabs(dept.id);
            const isDeptActive =
              currentPage === 'discover' && selectedDepartmentId === dept.id && !selectedLabId;
            const isExpanded = Boolean(expandedDeptIds[dept.id]) || selectedDepartmentId === dept.id;

            return (
              <li key={dept.id} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onSelectDepartment(dept.id)}
                  aria-expanded={isExpanded}
                  aria-current={isDeptActive ? 'true' : undefined}
                  className={`lab-index-tab font-bold ${isDeptActive ? 'lab-index-tab-active' : ''}`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <DepartmentDoodle departmentId={dept.id} className="h-6 w-6 shrink-0" />
                    <span className="truncate">{dept.name}</span>
                  </span>
                  <span className="tabular-nums text-sm shrink-0">{dept.code}</span>
                </button>

                {isExpanded && (
                  <ul className="space-y-1.5 pl-3">
                    {deptLabs.map((lab) => {
                      const isLabActive = currentPage === 'discover' && selectedLabId === lab.id;
                      return (
                        <li key={lab.id}>
                          <button
                            type="button"
                            onClick={() => onSelectLab(dept.id, lab.id)}
                            aria-current={isLabActive ? 'true' : undefined}
                            className={`lab-index-tab !py-1.5 text-sm ${
                              isLabActive ? 'lab-index-tab-active font-bold' : ''
                            }`}
                          >
                            <span className="truncate">{lab.name}</span>
                            <span className="tabular-nums text-xs shrink-0">{lab.room}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 border-t-2 border-dashed border-[var(--border-subtle)] pt-3 text-base text-[var(--ink)]">
          <div className="flex items-center justify-between">
            <span>Catalog Items</span>
            <span className="tabular-nums font-bold">{itemCount}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Pending Reviews</span>
            <span className="tabular-nums font-bold">{pendingCount}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
