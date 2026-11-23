/**
 * Faculty workspace header, accessible tablist, live status banner, summary KPIs, and queue filters.
 */
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LabAnalyticsSummary } from '../js/analytics';
import type { CampusUser, Department } from '../js/types';
import {
  ApprovalQueueFilterBar,
  SummaryMetricCards,
  type QueueFilter,
} from './FacultyMetricCards';

export type WorkspaceTabId = 'approvals' | 'subjects' | 'equipment' | 'slots';
export type { QueueFilter };

export interface LiveNotice {
  kind: 'success' | 'error';
  text: string;
}

const WORKSPACE_TABS: { id: WorkspaceTabId; label: string }[] = [
  { id: 'approvals', label: 'Approvals' },
  { id: 'subjects', label: 'Subjects & Labs' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'slots', label: 'Slots' },
];

interface FacultySummaryStripProps {
  currentUser: CampusUser;
  activeTab: WorkspaceTabId;
  queueFilter: QueueFilter;
  departmentFilter: string;
  departments: Department[];
  labCount: number;
  summary: LabAnalyticsSummary;
  liveNotice: LiveNotice | null;
  onTabChange: (tab: WorkspaceTabId) => void;
  onQueueFilterChange: (filter: QueueFilter) => void;
  onDepartmentFilterChange: (deptId: string) => void;
}

/**
 * Renders the faculty workspace header strip, tab navigation, KPI cards, and queue filters.
 *
 * @param props - Reviewer identity, active tab, filters, metrics, and event callbacks.
 * @returns Top notebook sheet section for the Faculty Approvals & Manage page.
 */
export function FacultySummaryStrip({
  currentUser,
  activeTab,
  queueFilter,
  departmentFilter,
  departments,
  labCount,
  summary,
  liveNotice,
  onTabChange,
  onQueueFilterChange,
  onDepartmentFilterChange,
}: FacultySummaryStripProps) {
  const tabButtonRefs = useRef<Record<WorkspaceTabId, HTMLButtonElement | null>>({
    approvals: null,
    subjects: null,
    equipment: null,
    slots: null,
  });

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
    else if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = WORKSPACE_TABS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = WORKSPACE_TABS[nextIndex];
    onTabChange(nextTab.id);
    window.requestAnimationFrame(() => tabButtonRefs.current[nextTab.id]?.focus());
  };

  return (
    <section className="notebook-sheet p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">
            Faculty Approvals &amp; Manage
          </h1>
          <p className="mt-1 text-base text-[var(--ink)]">
            Review pending student requests, resolve equipment conflicts, and manage campus subjects, labs, equipment, and slots.
          </p>
        </div>
        <span className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-3 py-1.5 text-sm font-bold text-[var(--on-lavender)]">
          Reviewer: {currentUser.name}
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Faculty workspace sections"
        className="mt-4 flex flex-wrap gap-2 border-t-2 border-dashed border-[var(--border-subtle)] pt-4"
      >
        {WORKSPACE_TABS.map((tab, idx) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[tab.id] = el;
              }}
              id={`faculty-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`faculty-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`labora-btn text-sm ${isSelected ? '' : 'labora-btn-paper'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
        {liveNotice && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-[10px] border-2 border-[var(--ink)] px-3 py-2 text-base font-bold text-[var(--ink)] ${
              liveNotice.kind === 'error'
                ? 'bg-[var(--status-booked-bg)]'
                : 'bg-[var(--status-available-bg)]'
            }`}
          >
            {liveNotice.kind === 'error' ? (
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>{liveNotice.text}</span>
          </div>
        )}
      </div>

      <SummaryMetricCards summary={summary} labCount={labCount} />

      {activeTab === 'approvals' && (
        <ApprovalQueueFilterBar
          queueFilter={queueFilter}
          departmentFilter={departmentFilter}
          departments={departments}
          onQueueFilterChange={onQueueFilterChange}
          onDepartmentFilterChange={onDepartmentFilterChange}
        />
      )}
    </section>
  );
}
