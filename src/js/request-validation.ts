/**
 * Pure form validation rules for campus laboratory access requests.
 */
import { LAB_SCHEDULE, LIMITS } from './constants';
import type { Department, EquipmentItem, NewRequestInput } from './types';
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

/**
 * Normalizes selected equipment IDs from multi-select `itemIds` or legacy `itemId`.
 *
 * @param input - Request input carrying `itemIds` and/or `itemId`.
 * @returns Deduplicated non-empty equipment ID array.
 */
export function normalizeSelectedItemIds(
  input: Pick<NewRequestInput, 'itemId' | 'itemIds'>
): string[] {
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

function validateTextFields(
  request: NewRequestInput,
  pushError: (field: RequestFieldKey, message: string) => void
): void {
  const rawProject = request.project ?? '';
  const project = normalizeText(rawProject);
  if (hasControlChars(rawProject)) {
    pushError('project', 'Project title cannot contain control characters.');
  } else if (project.length < LIMITS.PROJECT_MIN || project.length > LIMITS.PROJECT_MAX) {
    pushError('project', 'Project title must be between 3 and 80 characters.');
  }

  const rawSubject = request.subjectCourse ?? '';
  const subjectCourse = normalizeText(rawSubject);
  if (hasControlChars(rawSubject)) {
    pushError('subjectCourse', 'Subject/course cannot contain control characters.');
  } else if (subjectCourse.length < LIMITS.SUBJECT_MIN || subjectCourse.length > LIMITS.SUBJECT_MAX) {
    pushError('subjectCourse', 'Enter a subject or course code (e.g., PHYS 310).');
  }

  const rawJustification = request.justification ?? '';
  const justification = normalizeText(rawJustification);
  if (hasControlChars(rawJustification, true)) {
    pushError('justification', 'Justification cannot contain control characters.');
  } else if (
    justification.length < LIMITS.JUSTIFICATION_MIN ||
    justification.length > LIMITS.JUSTIFICATION_MAX
  ) {
    pushError('justification', 'Justification must be between 10 and 500 characters.');
  }
}

function validateScheduleAndTeamFields(
  request: NewRequestInput,
  departments: Department[],
  referenceDate: string,
  pushError: (field: RequestFieldKey, message: string) => void
): void {
  if (!request.departmentId || !departments.some((dept) => dept.id === request.departmentId)) {
    pushError('departmentId', 'Select a valid academic department.');
  }

  const teamSize = Number(request.teamSize);
  if (!Number.isInteger(teamSize) || teamSize < LIMITS.TEAM_MIN || teamSize > LIMITS.TEAM_MAX) {
    pushError('teamSize', 'Team members must be a whole number between 1 and 10.');
  }

  const parsedDeadline = parseIsoDateUtc(request.deadline ?? '');
  if (!parsedDeadline) {
    pushError('deadline', 'Choose a valid project deadline date.');
  } else if (request.deadline <= referenceDate) {
    pushError('deadline', `Deadline must be a future date after ${referenceDate}.`);
  }

  const hoursNeeded = Number(request.hoursNeeded);
  if (
    !Number.isFinite(hoursNeeded) ||
    hoursNeeded < LIMITS.HOURS_NEEDED_MIN ||
    hoursNeeded > LIMITS.HOURS_NEEDED_MAX
  ) {
    pushError('hoursNeeded', 'Hours needed must be between 1 and 100.');
  }
}

function validateSelectedEquipment(
  request: NewRequestInput,
  items: EquipmentItem[],
  pushError: (field: RequestFieldKey, message: string) => void
): void {
  const selectedIds = normalizeSelectedItemIds(request);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  if (selectedIds.length === 0) {
    pushError('itemIds', 'Select at least one equipment item from the catalog.');
    return;
  }

  const unknownId = selectedIds.find((id) => !itemMap.has(id));
  if (unknownId) {
    pushError('itemIds', `Selected equipment item "${unknownId}" is not in the catalog.`);
    return;
  }

  const needsTraining = selectedIds.some(
    (id) => itemMap.get(id)?.accessLevel === 'Training required'
  );
  if (needsTraining && !request.trainingConfirmed) {
    pushError(
      'trainingConfirmed',
      'Confirm lab safety training completion because at least one selected item requires training.'
    );
  }
}

/**
 * Validates a lab access request form submission without DOM access.
 *
 * @param request - Candidate access request form values.
 * @param context - Catalog departments, equipment items, and optional reference date.
 * @returns Validation summary containing `ok`, ordered `errors`, and `fieldErrors`.
 */
export function validateRequest(
  request: NewRequestInput,
  context: {
    departments: Department[];
    items: EquipmentItem[];
    referenceDate?: string;
  }
): RequestValidationResult {
  const referenceDate = context.referenceDate ?? LAB_SCHEDULE.DEFAULT_REFERENCE_DATE;
  const fieldErrors: Partial<Record<RequestFieldKey, string>> = {};
  const errors: RequestFieldError[] = [];

  const pushError = (field: RequestFieldKey, message: string) => {
    if (!fieldErrors[field]) {
      fieldErrors[field] = message;
      errors.push({ field, message });
    }
  };

  validateTextFields(request, pushError);
  validateScheduleAndTeamFields(request, context.departments, referenceDate, pushError);
  validateSelectedEquipment(request, context.items, pushError);

  return { ok: errors.length === 0, errors, fieldErrors };
}
