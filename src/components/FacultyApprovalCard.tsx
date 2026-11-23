/**
 * Single faculty approval queue card displaying request details, AI recommendation, and actions.
 */
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  FileSearch,
  HelpCircle,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { buildFacultySuggestion, isPendingStatus } from '../js/requests';
import type { AccessRequest, EquipmentItem, RequestStatus, TimeSlot } from '../js/types';

interface FacultyApprovalCardProps {
  request: AccessRequest;
  index: number;
  departmentName?: string;
  primaryItem?: EquipmentItem;
  allSlots: TimeSlot[];
  onStartReview: (req: AccessRequest) => void;
  onApprove: (req: AccessRequest) => void;
  onOpenReasonModal: (
    req: AccessRequest,
    decision: 'Rejected' | 'Changes requested',
    trigger: HTMLButtonElement
  ) => void;
}

const STATUS_META: Record<
  RequestStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Submitted: { className: 'status-badge status-badge-limited', Icon: Clock },
  'Under review': { className: 'status-badge status-badge-limited', Icon: FileSearch },
  'Changes requested': { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Approved: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Rejected: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

function ApprovalActionRow({
  request,
  onStartReview,
  onApprove,
  onOpenReasonModal,
}: {
  request: AccessRequest;
  onStartReview: (req: AccessRequest) => void;
  onApprove: (req: AccessRequest) => void;
  onOpenReasonModal: FacultyApprovalCardProps['onOpenReasonModal'];
}) {
  if (!isPendingStatus(request.status)) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {request.status === 'Submitted' && (
        <button type="button" onClick={() => onStartReview(request)} className="labora-btn text-sm">
          <FileSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
          Start review
        </button>
      )}
      <button
        type="button"
        onClick={() => onApprove(request)}
        className="labora-btn !bg-[var(--status-available-bg)] text-sm"
      >
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        Approve
      </button>
      <button
        type="button"
        onClick={(e) => onOpenReasonModal(request, 'Changes requested', e.currentTarget)}
        className="labora-btn labora-btn-paper text-sm"
      >
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Request changes
      </button>
      <button
        type="button"
        onClick={(e) => onOpenReasonModal(request, 'Rejected', e.currentTarget)}
        className="labora-btn !bg-[var(--status-booked-bg)] text-sm"
      >
        <X className="h-4 w-4 shrink-0" aria-hidden="true" />
        Reject
      </button>
    </div>
  );
}

/**
 * Renders one access request review card inside the faculty approval queue.
 *
 * @param props - Request data, item/slot context for priority advice, and decision handlers.
 * @returns Notebook article element for the access request.
 */
export function FacultyApprovalCard({
  request,
  index,
  departmentName,
  primaryItem,
  allSlots,
  onStartReview,
  onApprove,
  onOpenReasonModal,
}: FacultyApprovalCardProps) {
  const statusMeta = STATUS_META[request.status];
  const StatusIcon = statusMeta.Icon;
  const suggestion = buildFacultySuggestion(request, primaryItem, allSlots);

  return (
    <article
      className={`notebook-sheet perf-section ${
        index % 2 === 1 ? 'notebook-sheet-alt-tape' : ''
      } p-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
            <span className="tabular-nums font-bold">{request.id}</span>
            <span aria-hidden="true">·</span>
            <span>{departmentName ?? request.departmentId}</span>
            {request.subjectCourse && (
              <>
                <span aria-hidden="true">·</span>
                <span>{request.subjectCourse}</span>
              </>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-bold text-[var(--ink)]">{request.project}</h2>
          <p className="mt-0.5 text-base font-bold text-[var(--ink)]">{request.equipmentNeeded}</p>
        </div>

        <span className={statusMeta.className}>
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{request.status}</span>
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-y-2 border-dashed border-[var(--border-subtle)] py-3 text-base sm:grid-cols-4">
        <div>
          <dt className="text-sm text-[var(--ink)]">Student</dt>
          <dd className="mt-0.5 font-bold text-[var(--ink)]">
            {request.student} ({request.studentId})
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink)]">Deadline</dt>
          <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">{request.deadline}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink)]">Team size</dt>
          <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">
            {request.teamSize} members
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink)]">Hours needed</dt>
          <dd className="mt-0.5 tabular-nums font-bold text-[var(--ink)]">
            {request.hoursNeeded} hrs
          </dd>
        </div>
      </dl>

      {request.justification && (
        <p className="mt-3 text-base text-[var(--ink)]">
          <strong>Justification:</strong> {request.justification}
        </p>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] px-3 py-2 text-sm text-[var(--ink)]">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>AI suggestion:</strong> {suggestion.label}
        </span>
      </div>

      {request.facultyNote && (
        <p className="mt-2 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]">
          <strong>Recorded note:</strong> {request.facultyNote}
        </p>
      )}

      <ApprovalActionRow
        request={request}
        onStartReview={onStartReview}
        onApprove={onApprove}
        onOpenReasonModal={onOpenReasonModal}
      />
    </article>
  );
}
