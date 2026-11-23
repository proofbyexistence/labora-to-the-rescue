/**
 * Faculty Approvals & Manage page: approval queue, conflict/utilization analytics, and catalog tabs.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileSearch,
  HelpCircle,
  Home,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import type { PageId } from '../components/EquipmentCard';
import { HeroBenchDoodle } from '../components/LabDoodles';
import {
  getSummary,
  getUnderusedItems,
  getUtilizationByLab,
} from '../js/analytics';
import {
  getAllSlots,
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getStateVersion,
  reviewAccessRequest,
  transitionAccessRequest,
} from '../js/labData';
import { buildFacultySuggestion, isPendingStatus } from '../js/requests';
import { detectConflicts } from '../js/scheduler';
import { hasControlChars, normalizeText } from '../js/validation';
import type { AccessRequest, CampusUser, RequestStatus } from '../js/types';

const CatalogManagePanel = lazy(() =>
  import('../components/CatalogManagePanel').then((m) => ({ default: m.CatalogManagePanel }))
);

interface FacultyApprovalsPageProps {
  currentUser: CampusUser;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onDataMutated: () => void;
}

type QueueFilter = 'Pending' | '' | RequestStatus;

const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending Queue' },
  { value: '', label: 'All Requests' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under review', label: 'Under review' },
  { value: 'Changes requested', label: 'Changes requested' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

const STATUS_META: Record<
  RequestStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Submitted: { className: 'status-badge status-badge-limited', Icon: Clock },
  'Under review': {
    className: 'status-badge status-badge-limited',
    Icon: FileSearch,
  },
  'Changes requested': {
    className: 'status-badge status-badge-limited',
    Icon: AlertTriangle,
  },
  Approved: {
    className: 'status-badge status-badge-available',
    Icon: CheckCircle2,
  },
  Rejected: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

interface ReasonModalState {
  request: AccessRequest;
  decision: 'Rejected' | 'Changes requested';
}

type WorkspaceTabId = 'approvals' | 'subjects' | 'equipment' | 'slots';

const WORKSPACE_TABS: { id: WorkspaceTabId; label: string }[] = [
  { id: 'approvals', label: 'Approvals' },
  { id: 'subjects', label: 'Subjects & Labs' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'slots', label: 'Slots' },
];

export function FacultyApprovalsPage({
  currentUser,
  onNavigate,
  onDataMutated,
}: FacultyApprovalsPageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('approvals');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('Pending');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [liveNotice, setLiveNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [modalState, setModalState] = useState<ReasonModalState | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [reasonError, setReasonError] = useState('');

  const modalRef = useRef<HTMLDivElement | null>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const tabButtonRefs = useRef<Record<WorkspaceTabId, HTMLButtonElement | null>>({
    approvals: null,
    subjects: null,
    equipment: null,
    slots: null,
  });

  useEffect(() => {
    if (!modalState) return;
    window.requestAnimationFrame(() => {
      reasonInputRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModalState(null);
        setReasonError('');
        window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
        return;
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState]);

  const dataVersion = getStateVersion();
  const isFaculty = currentUser.role === 'faculty';

  const {
    departments,
    labs,
    allItems,
    allSlots,
    allRequests,
    deptMap,
    itemMap,
    summary,
    labUtilizations,
    underusedItems,
    openConflicts,
  } = useMemo(() => {
    if (!isFaculty) {
      return {
        departments: [],
        labs: [],
        allItems: [],
        allSlots: [],
        allRequests: [],
        deptMap: new Map<string, string>(),
        itemMap: new Map(),
        summary: {
          pendingCount: 0,
          approvedThisWeek: 0,
          openConflicts: 0,
          overallUtilizationPct: 0,
        },
        labUtilizations: [],
        underusedItems: [],
        openConflicts: [],
      };
    }
    const depts = getDepartments();
    const allLabs = getLabs();
    const items = getItems();
    const slots = getAllSlots();
    const requests = getRequests();
    return {
      departments: depts,
      labs: allLabs,
      allItems: items,
      allSlots: slots,
      allRequests: requests,
      deptMap: new Map(depts.map((d) => [d.id, d.name])),
      itemMap: new Map(items.map((i) => [i.id, i])),
      summary: getSummary(requests, slots, items),
      labUtilizations: getUtilizationByLab(slots, items, allLabs),
      underusedItems: getUnderusedItems(items, slots, 3),
      openConflicts: detectConflicts(requests, slots),
    };
  }, [isFaculty, dataVersion]);

  const filteredRequests = useMemo(
    () =>
      allRequests.filter((req) => {
        if (departmentFilter && req.departmentId !== departmentFilter) {
          return false;
        }
        if (queueFilter === 'Pending') {
          return isPendingStatus(req.status);
        }
        if (queueFilter && req.status !== queueFilter) {
          return false;
        }
        return true;
      }),
    [allRequests, departmentFilter, queueFilter]
  );

  // Student mode guard: hide all faculty-only controls and content.
  if (!isFaculty) {
    return (
      <section className="notebook-sheet p-8 text-center">
        <ShieldAlert
          className="mx-auto mb-3 h-12 w-12 text-[var(--ink)]"
          aria-hidden="true"
        />
        <h1 className="text-3xl font-bold text-[var(--ink)]">
          Faculty access only
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-base text-[var(--ink)]">
          The Faculty Approvals queue, utilization analytics, and sign-off controls are restricted to faculty reviewers. Use the demo role switch in the top bar if you want to preview the faculty workspace.
        </p>
        <div className="mt-5 flex justify-center">
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
            className="labora-btn"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Back to Home</span>
          </a>
        </div>
      </section>
    );
  }

  const handleStartReview = (req: AccessRequest) => {
    const result = transitionAccessRequest(req.id, 'Under review');
    if (result?.ok) {
      setLiveNotice({
        kind: 'success',
        text: `Started faculty review for "${req.project}" (${req.student}).`,
      });
      onDataMutated();
    }
  };

  const handleApprove = (req: AccessRequest) => {
    const note =
      req.facultyNote.trim() ||
      `Approved by ${currentUser.name}; booking unlocked for requested equipment.`;
    const updated = reviewAccessRequest(req.id, 'Approved', note);
    if (updated) {
      setLiveNotice({
        kind: 'success',
        text: `Approved "${updated.project}" for ${updated.student}. Booking is now unlocked.`,
      });
      onDataMutated();
    }
  };

  const openReasonModal = (
    req: AccessRequest,
    decision: 'Rejected' | 'Changes requested',
    trigger: HTMLButtonElement
  ) => {
    triggerBtnRef.current = trigger;
    setReasonDraft(req.facultyNote ?? '');
    setReasonError('');
    setModalState({ request: req, decision });
  };

  const closeReasonModal = () => {
    setModalState(null);
    setReasonError('');
    window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
  };

  const handleConfirmReason = (e: FormEvent) => {
    e.preventDefault();
    if (!modalState) return;

    if (hasControlChars(reasonDraft)) {
      setReasonError('Reason contains unsupported control characters.');
      reasonInputRef.current?.focus();
      return;
    }

    const trimmed = normalizeText(reasonDraft);
    if (trimmed.length < 3 || trimmed.length > 300) {
      setReasonError('Please enter a reason between 3 and 300 characters.');
      reasonInputRef.current?.focus();
      return;
    }

    const updated = reviewAccessRequest(
      modalState.request.id,
      modalState.decision,
      trimmed
    );
    if (updated) {
      setLiveNotice({
        kind: 'success',
        text: `Marked "${updated.project}" as ${updated.status} with reason recorded.`,
      });
      setModalState(null);
      setReasonError('');
      onDataMutated();
      window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
    }
  };

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex =
        (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = WORKSPACE_TABS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = WORKSPACE_TABS[nextIndex];
    setActiveTab(nextTab.id);
    window.requestAnimationFrame(() => {
      tabButtonRefs.current[nextTab.id]?.focus();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header, Workspace Tabs + 4 Summary Tiles */}
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

        {/* Accessible Faculty Workspace Tablist */}
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
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`labora-btn text-sm ${
                  isSelected ? '' : 'labora-btn-paper'
                }`}
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

        <div
          aria-label="Faculty summary metrics"
          className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--status-limited-bg)] p-4">
            <div className="text-sm font-bold text-[var(--ink)]">
              Pending reviews
            </div>
            <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
              {summary.pendingCount}
            </div>
            <div className="mt-1 text-xs text-[var(--ink)]">
              Submitted &amp; under review
            </div>
          </div>

          <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--status-available-bg)] p-4">
            <div className="text-sm font-bold text-[var(--ink)]">
              Approved this week
            </div>
            <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
              {summary.approvedThisWeek}
            </div>
            <div className="mt-1 text-xs text-[var(--ink)]">
              Cleared in last 7 days
            </div>
          </div>

          <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-4">
            <div className="text-sm font-bold text-[var(--ink)]">
              Open conflicts
            </div>
            <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
              {summary.openConflicts}
            </div>
            <div className="mt-1 text-xs text-[var(--ink)]">
              Overlapping bench windows
            </div>
          </div>

          <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
            <div className="text-sm font-bold text-[var(--ink)]">
              Overall utilization
            </div>
            <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)] leading-none">
              {summary.overallUtilizationPct}%
            </div>
            <div className="mt-1 text-xs text-[var(--ink)]">
              Across {labs.length} campus labs
            </div>
          </div>
        </div>

        {activeTab === 'approvals' && (
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t-2 border-dashed border-[var(--border-subtle)] pt-4">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Approval status filter"
            >
              {QUEUE_FILTERS.map((opt) => (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  onClick={() => setQueueFilter(opt.value)}
                  aria-pressed={queueFilter === opt.value}
                  className={`labora-btn text-sm ${
                    queueFilter === opt.value ? '' : 'labora-btn-paper'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <label
                htmlFor="approvals-dept"
                className="mb-1 block text-sm font-bold text-[var(--ink)]"
              >
                Department
              </label>
              <select
                id="approvals-dept"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
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
        )}
      </section>

      {activeTab === 'approvals' ? (
        <div
          id="faculty-panel-approvals"
          role="tabpanel"
          aria-labelledby="faculty-tab-approvals"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
        {/* Approval Queue */}
        <section aria-label="Approval queue" className="space-y-4 xl:col-span-7">
          {filteredRequests.length === 0 ? (
            <div className="notebook-sheet p-8 text-center">
              <HeroBenchDoodle className="mx-auto mb-3 h-32 w-auto" />
              <h2 className="text-2xl font-bold text-[var(--ink)]">
                No matching requests
              </h2>
              <p className="mt-1 text-base text-[var(--ink)]">
                Try switching back to All Requests or clearing the department filter.
              </p>
            </div>
          ) : (
            filteredRequests.map((req, index) => {
              const statusMeta = STATUS_META[req.status];
              const StatusIcon = statusMeta.Icon;
              const primaryItem = itemMap.get(req.itemId);
              const suggestion = buildFacultySuggestion(req, primaryItem, allSlots);
              const isActionable = isPendingStatus(req.status);

              return (
                <article
                  key={req.id}
                  className={`notebook-sheet perf-section ${
                    index % 2 === 1 ? 'notebook-sheet-alt-tape' : ''
                  } p-5`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
                        <span className="tabular-nums font-bold">{req.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{deptMap.get(req.departmentId)}</span>
                        {req.subjectCourse && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{req.subjectCourse}</span>
                          </>
                        )}
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-[var(--ink)]">
                        {req.project}
                      </h2>
                      <p className="mt-0.5 text-base font-bold text-[var(--ink)]">
                        {req.equipmentNeeded}
                      </p>
                    </div>

                    <span className={statusMeta.className}>
                      <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{req.status}</span>
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 border-y-2 border-dashed border-[var(--border-subtle)] py-3 text-base sm:grid-cols-4">
                    <div>
                      <dt className="text-sm text-[var(--ink)]">Student</dt>
                      <dd className="mt-0.5 font-bold text-[var(--ink)]">
                        {req.student} ({req.studentId})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[var(--ink)]">Deadline</dt>
                      <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">
                        {req.deadline}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[var(--ink)]">Team size</dt>
                      <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">
                        {req.teamSize} members
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[var(--ink)]">Hours needed</dt>
                      <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">
                        {req.hoursNeeded} hrs
                      </dd>
                    </div>
                  </dl>

                  {req.justification && (
                    <p className="mt-3 text-base text-[var(--ink)]">
                      <strong>Justification:</strong> {req.justification}
                    </p>
                  )}

                  {/* AI suggestion derived from scoreRequest */}
                  <div className="mt-3 flex items-start gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] px-3 py-2 text-sm text-[var(--ink)]">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong>AI suggestion:</strong> {suggestion.label}
                    </span>
                  </div>

                  {req.facultyNote && (
                    <p className="mt-2 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]">
                      <strong>Recorded note:</strong> {req.facultyNote}
                    </p>
                  )}

                  {isActionable && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {req.status === 'Submitted' && (
                        <button
                          type="button"
                          onClick={() => handleStartReview(req)}
                          className="labora-btn text-sm"
                        >
                          <FileSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
                          Start review
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleApprove(req)}
                        className="labora-btn !bg-[var(--status-available-bg)] text-sm"
                      >
                        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={(e) =>
                          openReasonModal(req, 'Changes requested', e.currentTarget)
                        }
                        className="labora-btn labora-btn-paper text-sm"
                      >
                        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Request changes
                      </button>

                      <button
                        type="button"
                        onClick={(e) =>
                          openReasonModal(req, 'Rejected', e.currentTarget)
                        }
                        className="labora-btn !bg-[var(--status-booked-bg)] text-sm"
                      >
                        <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        {/* Analytics & Conflict Sidebar */}
        <aside aria-label="Lab utilization and conflict analytics" className="space-y-5 xl:col-span-5">
          {/* Conflict Queue Card */}
          <section className="notebook-sheet p-5">
            <h2 className="text-2xl font-bold text-[var(--ink)]">
              Conflict queue
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ink)]">
              Competing requests awaiting Smart Booking fair allocation
            </p>

            {openConflicts.length === 0 ? (
              <p className="mt-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-available-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]">
                All competing windows are currently resolved.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {openConflicts.map((conflict) => {
                  const item = itemMap.get(conflict.itemId);
                  return (
                    <li
                      key={`${conflict.itemId}-${conflict.date}-${conflict.start}`}
                      className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3"
                    >
                      <div className="font-bold text-[var(--ink)]">
                        {item?.name ?? conflict.itemId}
                      </div>
                      <div className="mt-0.5 tabular-nums text-sm text-[var(--ink)]">
                        {conflict.date} · {conflict.start}–{conflict.end} ({conflict.requests.length} requests)
                      </div>
                      <div className="mt-1 text-sm text-[var(--ink)]">
                        {conflict.requests.map((r) => r.student).join(' vs. ')}
                      </div>
                      <a
                        href={`#booking&item=${encodeURIComponent(conflict.itemId)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('booking', { itemId: conflict.itemId });
                        }}
                        className="labora-btn mt-2.5 text-sm"
                      >
                        <span>Resolve in Smart Booking</span>
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Utilization by Lab Accessible SVG Bar Chart */}
          <section className="notebook-sheet notebook-sheet-alt-tape chart-panel-stable p-5">
            <h2 className="text-2xl font-bold text-[var(--ink)]">
              Utilization by lab
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ink)]">
              Booked hours vs. scheduled capacity across all {labs.length} campus labs
            </p>
            <p className="sr-only">
              Lab utilization summary: overall utilization {summary.overallUtilizationPct}% across {labs.length} laboratories.{' '}
              {labUtilizations
                .map(
                  (stat) =>
                    `${stat.labName} (${stat.room}): ${stat.utilizationPct}% (${stat.bookedHours} of ${stat.capacityHours} hours)`
                )
                .join('; ')}
              .
            </p>

            <ul className="mt-4 space-y-2.5">
              {labUtilizations.map((stat) => {
                const barWidth = Math.max(4, stat.utilizationPct * 2);
                return (
                  <li key={stat.labId} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--ink)]">
                      <span className="truncate font-bold">
                        {stat.labName} ({stat.room})
                      </span>
                      <span className="tabular-nums font-bold shrink-0">
                        {stat.bookedHours}h/{stat.capacityHours}h · {stat.utilizationPct}%
                      </span>
                    </div>
                    <svg
                      width={200}
                      height={14}
                      viewBox="0 0 200 14"
                      role="img"
                      focusable="false"
                      aria-label={`${stat.labName} utilization: ${stat.utilizationPct}% (${stat.bookedHours} of ${stat.capacityHours} hours)`}
                      className="block h-3.5 w-full overflow-visible"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="198"
                        height="12"
                        rx="5"
                        fill="var(--paper)"
                        stroke="var(--ink)"
                        strokeWidth="2"
                      />
                      {stat.utilizationPct > 0 && (
                        <rect
                          x="2"
                          y="2"
                          width={Math.min(196, barWidth)}
                          height="10"
                          rx="4"
                          fill="var(--lavender)"
                          stroke="var(--ink)"
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Underused Equipment Card */}
          <section className="notebook-sheet p-5">
            <h2 className="text-2xl font-bold text-[var(--ink)]">
              Underused equipment
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ink)]">
              Lowest-utilization instruments — consider highlighting these on Discover to balance campus demand.
            </p>

            <ul className="mt-3 space-y-2.5">
              {underusedItems.map((entry) => (
                <li
                  key={entry.item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-[var(--ink)]">
                      {entry.item.name}
                    </div>
                    <div className="text-xs text-[var(--ink)]">
                      {entry.item.location} ·{' '}
                      <span className="tabular-nums font-bold">
                        {entry.utilizationPct}% utilized ({entry.bookedHours}h /{' '}
                        {entry.capacityHours}h)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('discover', {
                        departmentId: entry.item.departmentId,
                        labId: entry.item.labId,
                      })
                    }
                    className="labora-btn labora-btn-paper text-xs"
                  >
                    <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    View on Discover
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
        </div>
      ) : (
        <div
          id={`faculty-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`faculty-tab-${activeTab}`}
        >
          <Suspense
            fallback={
              <section
                aria-label="Loading catalog management tools"
                className="notebook-sheet chart-panel-stable flex items-center justify-center p-8 text-base text-[var(--ink)]"
              >
                Loading management workspace...
              </section>
            }
          >
            <CatalogManagePanel
              activeTab={activeTab}
              onNotify={(kind, text) => setLiveNotice({ kind, text })}
              onDataMutated={onDataMutated}
            />
          </Suspense>
        </div>
      )}

      {/* Accessible Focus-Trapped Reason Dialog for Reject / Request Changes */}
      {modalState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReasonModal();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reason-dialog-title"
            className="notebook-sheet w-full max-w-lg p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="reason-dialog-title"
                  className="text-2xl font-bold text-[var(--ink)]"
                >
                  {modalState.decision === 'Rejected'
                    ? 'Reject access request'
                    : 'Request changes from student'}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink)]">
                  {modalState.request.project} · {modalState.request.student}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReasonModal}
                aria-label="Close reason dialog"
                className="labora-btn labora-btn-paper !px-2.5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmReason} noValidate className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="faculty-decision-reason"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Reason for {modalState.decision.toLowerCase()} (required, 3–300 characters)
                </label>
                <textarea
                  ref={reasonInputRef}
                  id="faculty-decision-reason"
                  rows={3}
                  value={reasonDraft}
                  onChange={(e) => {
                    setReasonDraft(e.target.value);
                    if (reasonError) setReasonError('');
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={reasonError ? 'err-decision-reason' : undefined}
                  placeholder={
                    modalState.decision === 'Rejected'
                      ? 'Explain why this request cannot be cleared...'
                      : 'Specify what documentation, safety check, or schedule change is needed...'
                  }
                  className="notebook-input mt-1"
                />
                {reasonError && (
                  <p
                    id="err-decision-reason"
                    role="alert"
                    className="mt-1 text-sm font-bold text-[var(--ink)]"
                  >
                    {reasonError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReasonModal}
                  className="labora-btn labora-btn-paper text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`labora-btn text-sm ${
                    modalState.decision === 'Rejected'
                      ? '!bg-[var(--status-booked-bg)]'
                      : ''
                  }`}
                >
                  Confirm {modalState.decision}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
