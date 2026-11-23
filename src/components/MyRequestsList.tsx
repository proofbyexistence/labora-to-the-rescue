/**
 * Student access request tracker list with workflow stepper, faculty notes, and quick actions.
 */
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSearch,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { AppPageId } from '../js/filter';
import type { AccessRequest, CampusUser, Department, RequestStatus } from '../js/types';
import { HeroBenchDoodle } from './LabDoodles';

interface MyRequestsListProps {
  currentUser: CampusUser;
  requests: AccessRequest[];
  deptMap: Map<string, Department>;
  onResubmit: (requestId: string, projectTitle: string) => void;
  onNavigate: (
    page: AppPageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
}

const REQUEST_STATUS_META: Record<
  RequestStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Submitted: { className: 'status-badge status-badge-limited', Icon: Clock },
  'Under review': { className: 'status-badge status-badge-limited', Icon: FileSearch },
  'Changes requested': { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Approved: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Rejected: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

const STEPPER_STAGES: RequestStatus[] = ['Submitted', 'Under review', 'Approved'];

function getStageIndex(status: RequestStatus): number {
  if (status === 'Submitted') return 0;
  if (status === 'Under review' || status === 'Changes requested') return 1;
  return 2;
}

function RequestStatusStepper({ request }: { request: AccessRequest }) {
  const activeStage = getStageIndex(request.status);
  return (
    <ol
      aria-label={`Request status progress for ${request.project}`}
      className="mt-3 grid grid-cols-3 gap-2"
    >
      {STEPPER_STAGES.map((stage, idx) => {
        const isFinalBranch =
          idx === 2 &&
          (request.status === 'Rejected' || request.status === 'Changes requested');
        const displayLabel =
          idx === 2 && request.status === 'Rejected'
            ? 'Rejected'
            : idx === 2 && request.status === 'Changes requested'
              ? 'Changes needed'
              : stage;
        const reached = idx <= activeStage;

        return (
          <li
            key={stage}
            className={`rounded-[8px] border-2 border-[var(--ink)] px-2.5 py-1.5 text-center text-xs font-bold ${
              isFinalBranch
                ? 'bg-[var(--status-booked-bg)] text-[var(--ink)]'
                : reached
                  ? 'bg-[var(--lavender)] text-[var(--on-lavender)]'
                  : 'bg-[var(--white)] text-[var(--ink)]'
            }`}
          >
            {idx + 1}. {displayLabel}
          </li>
        );
      })}
    </ol>
  );
}

function StudentRequestCard({
  req,
  departmentName,
  onResubmit,
  onNavigate,
}: {
  req: AccessRequest;
  departmentName: string;
  onResubmit: (requestId: string, projectTitle: string) => void;
  onNavigate: MyRequestsListProps['onNavigate'];
}) {
  const statusMeta = REQUEST_STATUS_META[req.status];
  const StatusIcon = statusMeta.Icon;

  return (
    <li className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="tabular-nums text-xs font-bold text-[var(--ink)]">
            {req.id} · {req.subjectCourse ?? 'Course project'}
          </span>
          <h3 className="text-xl font-bold text-[var(--ink)]">{req.project}</h3>
        </div>
        <span className={statusMeta.className}>
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{req.status}</span>
        </span>
      </div>

      <p className="mt-1 text-base font-bold text-[var(--ink)]">{req.equipmentNeeded}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink)]">
        <span>{departmentName}</span>
        <span className="tabular-nums">Team: {req.teamSize}</span>
        <span className="tabular-nums">Hours: {req.hoursNeeded}h</span>
        <span className="tabular-nums">Deadline: {req.deadline}</span>
      </div>

      <RequestStatusStepper request={req} />

      {(req.status === 'Rejected' || req.status === 'Changes requested' || req.facultyNote) && (
        <div className="mt-3 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--ink)]">
          <strong>Faculty note:</strong> {req.facultyNote || 'Pending supervisor comment.'}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {req.status === 'Changes requested' && (
          <button
            type="button"
            onClick={() => onResubmit(req.id, req.project)}
            className="labora-btn text-sm"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            Resubmit request
          </button>
        )}
        {req.status === 'Approved' && (
          <button
            type="button"
            onClick={() => onNavigate('booking', { itemId: req.itemId })}
            className="labora-btn text-sm"
          >
            <span>Book in Smart Booking</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Renders the current student's submitted access requests and status tracker.
 *
 * @param props - Current user, requests list, department lookup, and action callbacks.
 * @returns Notebook sheet section listing submitted access requests or empty state.
 */
export function MyRequestsList({
  currentUser,
  requests,
  deptMap,
  onResubmit,
  onNavigate,
}: MyRequestsListProps) {
  return (
    <section className="notebook-sheet notebook-sheet-alt-tape p-6 xl:col-span-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">Your requests</h2>
          <p className="text-sm text-[var(--ink)]">
            Tracking submissions for {currentUser.name} ({currentUser.id})
          </p>
        </div>
        <span className="tabular-nums text-base font-bold text-[var(--ink)]">
          {requests.length} request{requests.length === 1 ? '' : 's'}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="py-10 text-center">
          <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
          <h3 className="text-2xl font-bold text-[var(--ink)]">No access requests yet</h3>
          <p className="mx-auto mt-1 max-w-md text-base text-[var(--ink)]">
            Submit a request using the notebook form to track faculty clearance and unlock restricted instruments.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {requests.map((req) => (
            <StudentRequestCard
              key={req.id}
              req={req}
              departmentName={deptMap.get(req.departmentId)?.name ?? req.departmentId}
              onResubmit={onResubmit}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
