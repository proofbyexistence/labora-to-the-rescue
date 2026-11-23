/**
 * Pure access request validation, status-transition state machine, and review suggestions.
 */
import { DEFAULT_REFERENCE_DATE, scoreRequest } from './scheduler';
import type {
  AccessRequest,
  Department,
  EquipmentItem,
  NewRequestInput,
  RequestStatus,
  TimeSlot,
  UserRole,
} from './types';
import { hasControlChars, normalizeText, parseIsoDateUtc } from './validation';

export type RequestFieldKey =
  | 'project'
  | 'subjectCourse'
  | 'departmentId'
  | 'teamSize'
  | 'deadline'
  | 'itemIds'
  | 'hoursNeeded'
  | 'justification'
  | 'trainingConfirmed';

export interface RequestFieldError {
  field: RequestFieldKey;
  message: string;
}

export interface RequestValidationResult {
  ok: boolean;
  errors: RequestFieldError[];
  fieldErrors: Partial<Record<RequestFieldKey, string>>;
}

export interface TransitionResult {
  ok: boolean;
  error: string | null;
  request: AccessRequest;
}

export const ALLOWED_REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Submitted: ['Under review'],
  'Under review': ['Approved', 'Rejected', 'Changes requested'],
  'Changes requested': ['Submitted'],
  Approved: [],
  Rejected: [],
};

export function isPendingStatus(status: RequestStatus): boolean {
  return status === 'Submitted' || status === 'Under review';
}

/**
 * Normalize selected equipment IDs from either multi-select `itemIds` or legacy `itemId`.
 */
export function normalizeSelectedItemIds(input: Pick<NewRequestInput, 'itemId' | 'itemIds'>): string[] {
  const raw = Array.isArray(input.itemIds)
    ? input.itemIds
    : input.itemId
      ? [input.itemId]
      : [];
  const unique = new Set<string>();
  for (const id of raw) {
    const trimmed = id.trim();
    if (trimmed) unique.add(trimmed);
  }
  return [...unique];
}

/**
 * Validate a lab access request form submission. Pure and DOM-free for unit testing.
 */
export function validateRequest(
  request: NewRequestInput,
  context: {
    departments: Department[];
    items: EquipmentItem[];
    referenceDate?: string;
  }
): RequestValidationResult {
  const referenceDate = context.referenceDate ?? DEFAULT_REFERENCE_DATE;
  const fieldErrors: Partial<Record<RequestFieldKey, string>> = {};
  const errors: RequestFieldError[] = [];

  const pushError = (field: RequestFieldKey, message: string) => {
    if (!fieldErrors[field]) {
      fieldErrors[field] = message;
      errors.push({ field, message });
    }
  };

  const rawProject = request.project ?? '';
  const project = normalizeText(rawProject);
  if (hasControlChars(rawProject)) {
    pushError('project', 'Project title cannot contain control characters.');
  } else if (project.length < 3 || project.length > 80) {
    pushError('project', 'Project title must be between 3 and 80 characters.');
  }

  const rawSubject = request.subjectCourse ?? '';
  const subjectCourse = normalizeText(rawSubject);
  if (hasControlChars(rawSubject)) {
    pushError('subjectCourse', 'Subject/course cannot contain control characters.');
  } else if (subjectCourse.length < 2 || subjectCourse.length > 80) {
    pushError('subjectCourse', 'Enter a subject or course code (e.g., PHYS 310).');
  }

  const departmentExists = context.departments.some(
    (dept) => dept.id === request.departmentId
  );
  if (!request.departmentId || !departmentExists) {
    pushError('departmentId', 'Select a valid academic department.');
  }

  const teamSize = Number(request.teamSize);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10) {
    pushError('teamSize', 'Team members must be a whole number between 1 and 10.');
  }

  const parsedDeadline = parseIsoDateUtc(request.deadline ?? '');
  if (!parsedDeadline) {
    pushError('deadline', 'Choose a valid project deadline date.');
  } else if (request.deadline <= referenceDate) {
    pushError('deadline', `Deadline must be a future date after ${referenceDate}.`);
  }

  const selectedIds = normalizeSelectedItemIds(request);
  const itemMap = new Map(context.items.map((item) => [item.id, item]));
  const selectedItems: EquipmentItem[] = [];
  if (selectedIds.length === 0) {
    pushError('itemIds', 'Select at least one equipment item from the catalog.');
  } else {
    const unknownId = selectedIds.find((id) => !itemMap.has(id));
    if (unknownId) {
      pushError('itemIds', `Selected equipment item "${unknownId}" is not in the catalog.`);
    } else {
      for (const id of selectedIds) {
        selectedItems.push(itemMap.get(id)!);
      }
    }
  }

  const hoursNeeded = Number(request.hoursNeeded);
  if (!Number.isFinite(hoursNeeded) || hoursNeeded < 1 || hoursNeeded > 100) {
    pushError('hoursNeeded', 'Hours needed must be between 1 and 100.');
  }

  const rawJustification = request.justification ?? '';
  const justification = normalizeText(rawJustification);
  if (hasControlChars(rawJustification, true)) {
    pushError('justification', 'Justification cannot contain control characters.');
  } else if (justification.length < 10 || justification.length > 500) {
    pushError('justification', 'Justification must be between 10 and 500 characters.');
  }

  const needsTraining = selectedItems.some(
    (item) => item.accessLevel === 'Training required'
  );
  if (needsTraining && !request.trainingConfirmed) {
    pushError(
      'trainingConfirmed',
      'Confirm lab safety training completion because at least one selected item requires training.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    fieldErrors,
  };
}

/**
 * Pure state-machine transition for access requests.
 * Enforces faculty role for review/decision transitions and returns an unchanged request on error.
 */
export function transitionRequest(
  request: AccessRequest,
  nextStatus: RequestStatus,
  reason = '',
  referenceDate = DEFAULT_REFERENCE_DATE,
  actorRole: UserRole = 'faculty'
): TransitionResult {
  const isFacultyOnlyMove =
    nextStatus === 'Under review' ||
    nextStatus === 'Approved' ||
    nextStatus === 'Rejected' ||
    nextStatus === 'Changes requested';
  if (isFacultyOnlyMove && actorRole !== 'faculty') {
    return {
      ok: false,
      error: 'Faculty role is required to review or decide access requests.',
      request,
    };
  }

  const allowed = ALLOWED_REQUEST_TRANSITIONS[request.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot move request from "${request.status}" to "${nextStatus}".`,
      request,
    };
  }

  if (hasControlChars(reason, true)) {
    return {
      ok: false,
      error: 'Reason cannot contain control characters.',
      request,
    };
  }

  const trimmedReason = normalizeText(reason);
  if (nextStatus === 'Rejected' || nextStatus === 'Changes requested') {
    if (trimmedReason.length < 3 || trimmedReason.length > 300) {
      return {
        ok: false,
        error: `A reason (3 to 300 characters) is required when setting status to "${nextStatus}".`,
        request,
      };
    }
  } else if (trimmedReason.length > 300) {
    return {
      ok: false,
      error: 'Faculty note must be 300 characters or fewer.',
      request,
    };
  }

  return {
    ok: true,
    error: null,
    request: {
      ...request,
      status: nextStatus,
      facultyNote: trimmedReason || request.facultyNote,
      reviewedAt:
        nextStatus === 'Submitted' ? request.reviewedAt : referenceDate,
    },
  };
}

/**
 * Generate a plain-language faculty review suggestion backed by scoreRequest.
 */
export function buildFacultySuggestion(
  request: AccessRequest,
  item: EquipmentItem | undefined,
  slots: TimeSlot[],
  referenceDate = DEFAULT_REFERENCE_DATE
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
    ? Math.max(0, Math.round((dlMs - refMs) / 86_400_000))
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
