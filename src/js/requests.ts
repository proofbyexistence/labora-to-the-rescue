/**
 * Access request state-machine transitions, faculty review suggestions, and validation re-exports.
 */
import {
  ALLOWED_REQUEST_TRANSITIONS as CANONICAL_REQUEST_TRANSITIONS,
  LAB_SCHEDULE,
  LIMITS,
  ROLES,
} from './constants';
import { scoreRequest } from './scheduler';
import type {
  AccessRequest,
  EquipmentItem,
  RequestStatus,
  TimeSlot,
  UserRole,
} from './types';
import { hasControlChars, normalizeText } from './validation';

export { normalizeSelectedItemIds, validateRequest } from './request-validation';
export type {
  RequestFieldError,
  RequestFieldKey,
  RequestValidationResult,
} from './request-validation';

export interface TransitionResult {
  ok: boolean;
  error: string | null;
  request: AccessRequest;
}

/** Allowed one-step state transitions for access requests. */
export const ALLOWED_REQUEST_TRANSITIONS = CANONICAL_REQUEST_TRANSITIONS;

/**
 * Checks whether an access request status is awaiting faculty completion.
 *
 * @param status - Request workflow status.
 * @returns True for `Submitted` or `Under review`.
 */
export function isPendingStatus(status: RequestStatus): boolean {
  return status === 'Submitted' || status === 'Under review';
}

function validateTransitionReason(
  nextStatus: RequestStatus,
  reason: string
): { ok: true; cleanReason: string } | { ok: false; error: string } {
  if (hasControlChars(reason, true)) {
    return { ok: false, error: 'Reason cannot contain control characters.' };
  }
  const cleanReason = normalizeText(reason);
  if (nextStatus === 'Rejected' || nextStatus === 'Changes requested') {
    if (cleanReason.length < LIMITS.REASON_MIN || cleanReason.length > LIMITS.REASON_MAX) {
      return {
        ok: false,
        error: `A reason (3 to 300 characters) is required when setting status to "${nextStatus}".`,
      };
    }
  } else if (cleanReason.length > LIMITS.REASON_MAX) {
    return { ok: false, error: 'Faculty note must be 300 characters or fewer.' };
  }
  return { ok: true, cleanReason };
}

/**
 * Transitions an access request through the faculty/student workflow state machine.
 *
 * @param request - Current access request record.
 * @param nextStatus - Target workflow status.
 * @param reason - Faculty note or required rejection/changes reason.
 * @param referenceDate - Current ISO reference date for `reviewedAt`.
 * @param actorRole - Role attempting the transition (`faculty` required for reviews/decisions).
 * @returns Transition result with `ok`, `error`, and updated or unchanged `request`.
 */
export function transitionRequest(
  request: AccessRequest,
  nextStatus: RequestStatus,
  reason = '',
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE,
  actorRole: UserRole = ROLES.FACULTY
): TransitionResult {
  if (nextStatus !== 'Submitted' && actorRole !== ROLES.FACULTY) {
    return {
      ok: false,
      error: 'Faculty role is required to review or decide access requests.',
      request,
    };
  }

  const allowed = CANONICAL_REQUEST_TRANSITIONS[request.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot move request from "${request.status}" to "${nextStatus}".`,
      request,
    };
  }

  const reasonCheck = validateTransitionReason(nextStatus, reason);
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error, request };

  return {
    ok: true,
    error: null,
    request: {
      ...request,
      status: nextStatus,
      facultyNote: reasonCheck.cleanReason || request.facultyNote,
      reviewedAt: nextStatus === 'Submitted' ? request.reviewedAt : referenceDate,
    },
  };
}

/**
 * Generates a plain-language faculty review recommendation backed by `scoreRequest`.
 *
 * @param request - Pending access request.
 * @param item - Primary requested equipment item, if found.
 * @param slots - Existing slot records used to measure availability.
 * @param referenceDate - ISO reference date for deadline calculation.
 * @returns Advisory recommendation label and priority score.
 */
export function buildFacultySuggestion(
  request: AccessRequest,
  item: EquipmentItem | undefined,
  slots: TimeSlot[],
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): { label: string; score: number } {
  if (!item) {
    return {
      label: 'Manual check needed — primary equipment record not found.',
      score: 0,
    };
  }

  const scored = scoreRequest(request, { item, slots, referenceDate });
  const refMs = Date.parse(`${referenceDate}T00:00:00Z`);
  const dlMs = Date.parse(`${request.deadline}T00:00:00Z`);
  const daysLeft = Number.isFinite(dlMs)
    ? Math.max(0, Math.round((dlMs - refMs) / LIMITS.MS_PER_DAY))
    : 0;
  const openHours = slots
    .filter((s) => s.itemId === item.id && !s.booked)
    .reduce((sum, s) => sum + Math.max(0, s.durationHours), 0);

  if (scored.score >= 70 && openHours >= Math.min(request.hoursNeeded, 2)) {
    return {
      label: `Recommended: approve (${scored.score}/100) — deadline in ${daysLeft} days, ${openHours}h equipment slots free.`,
      score: scored.score,
    };
  }
  if (scored.score >= 55) {
    return {
      label: `Conditional review (${scored.score}/100) — deadline in ${daysLeft} days; ${openHours}h open currently.`,
      score: scored.score,
    };
  }
  return {
    label: `Request schedule details (${scored.score}/100) — ${openHours}h currently free vs ${request.hoursNeeded}h needed.`,
    score: scored.score,
  };
}
