/**
 * State hook managing faculty workspace data, request filtering, and decision handlers.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { LiveNotice, QueueFilter, WorkspaceTabId } from '../components/FacultySummaryStrip';
import type { ReasonModalState } from '../components/DecisionReasonModal';
import { getSummary, getUnderusedItems, getUtilizationByLab } from './analytics';
import { LIMITS, ROLES } from './constants';
import {
  getAllSlots,
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getStateVersion,
  reviewAccessRequest,
  transitionAccessRequest,
} from './lab-data';
import { isPendingStatus } from './requests';
import { detectConflicts } from './scheduler';
import type { AccessRequest, CampusUser, EquipmentItem } from './types';
import { hasControlChars, normalizeText } from './validation';

function buildEmptyWorkspace() {
  return {
    departments: [],
    labs: [],
    allSlots: [],
    allRequests: [],
    deptMap: new Map<string, string>(),
    itemMap: new Map<string, EquipmentItem>(),
    summary: { pendingCount: 0, approvedThisWeek: 0, openConflicts: 0, overallUtilizationPct: 0 },
    labUtilizations: [],
    underusedItems: [],
    openConflicts: [],
  };
}

/**
 * Encapsulates faculty approvals state, computed analytics, and review modal actions.
 *
 * @param currentUser - Active campus user record.
 * @param onDataMutated - Callback invoked after any request transition mutates store state.
 * @returns Workspace data, filter state, modal controls, and action handlers.
 */
export function useFacultyApprovals(currentUser: CampusUser, onDataMutated: () => void) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('approvals');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('Pending');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [liveNotice, setLiveNotice] = useState<LiveNotice | null>(null);
  const [modalState, setModalState] = useState<ReasonModalState | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [reasonError, setReasonError] = useState('');

  const reasonInputRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const isFaculty = currentUser.role === ROLES.FACULTY;
  const dataVersion = getStateVersion();

  const workspace = useMemo(() => {
    if (!isFaculty) return buildEmptyWorkspace();
    const departments = getDepartments();
    const labs = getLabs();
    const items = getItems();
    const allSlots = getAllSlots();
    const allRequests = getRequests();
    return {
      departments,
      labs,
      allSlots,
      allRequests,
      deptMap: new Map(departments.map((d) => [d.id, d.name])),
      itemMap: new Map(items.map((i) => [i.id, i])),
      summary: getSummary(allRequests, allSlots, items),
      labUtilizations: getUtilizationByLab(allSlots, items, labs),
      underusedItems: getUnderusedItems(items, allSlots, 3),
      openConflicts: detectConflicts(allRequests, allSlots),
    };
  }, [isFaculty, dataVersion]);

  const filteredRequests = useMemo(
    () =>
      workspace.allRequests.filter((req) => {
        if (departmentFilter && req.departmentId !== departmentFilter) return false;
        if (queueFilter === 'Pending') return isPendingStatus(req.status);
        return !queueFilter || req.status === queueFilter;
      }),
    [workspace.allRequests, departmentFilter, queueFilter]
  );

  const handleStartReview = (req: AccessRequest) => {
    const result = transitionAccessRequest(req.id, 'Under review');
    if (!result?.ok) return;
    setLiveNotice({ kind: 'success', text: `Started faculty review for "${req.project}" (${req.student}).` });
    onDataMutated();
  };

  const handleApprove = (req: AccessRequest) => {
    const note =
      req.facultyNote.trim() ||
      `Approved by ${currentUser.name}; booking unlocked for requested equipment.`;
    const updated = reviewAccessRequest(req.id, 'Approved', note);
    if (!updated) return;
    setLiveNotice({ kind: 'success', text: `Approved "${updated.project}" for ${updated.student}. Booking is now unlocked.` });
    onDataMutated();
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
    if (trimmed.length < LIMITS.REASON_MIN || trimmed.length > LIMITS.REASON_MAX) {
      setReasonError(`Please enter a reason between ${LIMITS.REASON_MIN} and ${LIMITS.REASON_MAX} characters.`);
      reasonInputRef.current?.focus();
      return;
    }
    const updated = reviewAccessRequest(modalState.request.id, modalState.decision, trimmed);
    if (!updated) return;
    setLiveNotice({ kind: 'success', text: `Marked "${updated.project}" as ${updated.status} with reason recorded.` });
    closeReasonModal();
    onDataMutated();
  };

  return {
    isFaculty,
    workspace,
    filteredRequests,
    activeTab,
    queueFilter,
    departmentFilter,
    liveNotice,
    modalState,
    reasonDraft,
    reasonError,
    reasonInputRef,
    setActiveTab,
    setQueueFilter,
    setDepartmentFilter,
    setLiveNotice,
    setReasonDraft,
    setReasonError,
    handleStartReview,
    handleApprove,
    openReasonModal,
    closeReasonModal,
    handleConfirmReason,
  };
}
