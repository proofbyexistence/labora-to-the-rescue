/**
 * Schema and foreign-key validators for persisted notebook entities loaded from storage.
 */
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
  LEGACY_REQUEST_STATUS_MAP,
  LIMITS,
  REQUEST_STATUSES,
} from './constants';
import type {
  AccessRequest,
  Department,
  EquipmentItem,
  Lab,
  RequestStatus,
  TimeSlot,
} from './types';
import { hasControlChars, isSafeString, isValidIsoDate } from './validation';

const VALID_TYPES = new Set<string>(EQUIPMENT_TYPES);
const VALID_STATUSES = new Set<string>(AVAILABILITY_STATUSES);
const VALID_ACCESS = new Set<string>(ACCESS_LEVELS);
const VALID_REQ_STATUSES = new Set<RequestStatus>(REQUEST_STATUSES);

/**
 * Normalizes legacy request status strings and ensures `itemIds` is populated.
 *
 * @param req - Raw persisted access request record.
 * @returns Normalized `AccessRequest` compatible with current workflow statuses.
 */
export function normalizePersistedRequest(req: AccessRequest): AccessRequest {
  const rawStatus = req.status as string;
  let status: RequestStatus = req.status;
  if (rawStatus === 'Needs Info') status = 'Changes requested';
  else if (LEGACY_REQUEST_STATUS_MAP[rawStatus]) status = LEGACY_REQUEST_STATUS_MAP[rawStatus];
  return {
    ...req,
    status,
    itemIds: req.itemIds && req.itemIds.length > 0 ? req.itemIds : req.itemId ? [req.itemId] : [],
  };
}

/**
 * Validates a persisted department record.
 *
 * @param raw - Unknown parsed object.
 * @returns True if `raw` matches `Department` schema constraints.
 */
export function isValidPersistedDepartment(raw: unknown): raw is Department {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  return (
    isSafeString(d.id, 1, 60) &&
    isSafeString(d.name, 2, 50) &&
    isSafeString(d.code, 2, 10) &&
    isSafeString(d.building, 2, 60) &&
    isSafeString(d.leadFaculty, 2, 60) &&
    isSafeString(d.summary, 0, 200, true)
  );
}

/**
 * Validates a persisted lab record against known department IDs.
 *
 * @param raw - Unknown parsed object.
 * @param validDeptIds - Set of validated department IDs.
 * @returns True if `raw` matches `Lab` schema and foreign-key constraints.
 */
export function isValidPersistedLab(raw: unknown, validDeptIds: Set<string>): raw is Lab {
  if (!raw || typeof raw !== 'object') return false;
  const l = raw as Record<string, unknown>;
  return (
    isSafeString(l.id, 1, 60) &&
    typeof l.departmentId === 'string' &&
    validDeptIds.has(l.departmentId) &&
    isSafeString(l.name, 2, 60) &&
    isSafeString(l.room, 1, 24) &&
    isSafeString(l.supervisor, 2, 60) &&
    isSafeString(l.hours, 3, 40) &&
    isSafeString(l.description, 0, 200, true)
  );
}

/**
 * Validates a persisted equipment item against known department and lab IDs.
 *
 * @param raw - Unknown parsed object.
 * @param validDeptIds - Set of validated department IDs.
 * @param validLabIds - Set of validated lab IDs.
 * @returns True if `raw` matches `EquipmentItem` schema and enum constraints.
 */
export function isValidPersistedItem(
  raw: unknown,
  validDeptIds: Set<string>,
  validLabIds: Set<string>
): raw is EquipmentItem {
  if (!raw || typeof raw !== 'object') return false;
  const i = raw as Record<string, unknown>;
  return (
    isSafeString(i.id, 1, 60) &&
    isSafeString(i.name, 2, 80) &&
    typeof i.departmentId === 'string' &&
    validDeptIds.has(i.departmentId) &&
    typeof i.labId === 'string' &&
    validLabIds.has(i.labId) &&
    typeof i.type === 'string' &&
    VALID_TYPES.has(i.type) &&
    isSafeString(i.location, 2, 80) &&
    typeof i.status === 'string' &&
    VALID_STATUSES.has(i.status) &&
    typeof i.accessLevel === 'string' &&
    VALID_ACCESS.has(i.accessLevel) &&
    isSafeString(i.specs, 0, 200, true) &&
    isSafeString(i.nextFreeSlot, 1, 40) &&
    typeof i.image === 'string' &&
    !hasControlChars(i.image)
  );
}

/**
 * Validates a persisted booking slot against known equipment IDs.
 *
 * @param raw - Unknown parsed object.
 * @param validItemIds - Set of validated equipment IDs.
 * @returns True if `raw` matches `TimeSlot` schema and bounds.
 */
export function isValidPersistedSlot(raw: unknown, validItemIds: Set<string>): raw is TimeSlot {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;
  return (
    isSafeString(s.id, 1, 80) &&
    typeof s.itemId === 'string' &&
    validItemIds.has(s.itemId) &&
    typeof s.date === 'string' &&
    isValidIsoDate(s.date) &&
    isSafeString(s.window, 3, 40) &&
    typeof s.durationHours === 'number' &&
    Number.isFinite(s.durationHours) &&
    s.durationHours > 0 &&
    s.durationHours <= 8 &&
    typeof s.booked === 'boolean' &&
    (s.bookedBy === null || isSafeString(s.bookedBy, 1, 80)) &&
    typeof s.note === 'string' &&
    !hasControlChars(s.note) &&
    s.note.length <= LIMITS.PURPOSE_MAX
  );
}

function hasValidRequestRefs(
  r: Record<string, unknown>,
  norm: AccessRequest,
  validDeptIds: Set<string>,
  validItemIds: Set<string>
): boolean {
  const itemIdsOk =
    Array.isArray(norm.itemIds) &&
    norm.itemIds.every((id) => typeof id === 'string' && (id === '' || validItemIds.has(id)));
  return (
    typeof r.departmentId === 'string' &&
    (r.departmentId === '' || validDeptIds.has(r.departmentId)) &&
    typeof r.itemId === 'string' &&
    (r.itemId === '' || validItemIds.has(r.itemId)) &&
    itemIdsOk &&
    typeof norm.status === 'string' &&
    VALID_REQ_STATUSES.has(norm.status)
  );
}

/**
 * Validates a persisted access request against department/item references and field limits.
 *
 * @param raw - Unknown parsed object.
 * @param validDeptIds - Set of validated department IDs.
 * @param validItemIds - Set of validated equipment IDs.
 * @returns True if `raw` matches `AccessRequest` schema and bounds.
 */
export function isValidPersistedRequest(
  raw: unknown,
  validDeptIds: Set<string>,
  validItemIds: Set<string>
): raw is AccessRequest {
  if (!raw || typeof raw !== 'object') return false;
  const norm = normalizePersistedRequest(raw as AccessRequest);
  const r = norm as unknown as Record<string, unknown>;
  if (!hasValidRequestRefs(r, norm, validDeptIds, validItemIds)) return false;
  return (
    isSafeString(r.id, 1, 80) &&
    isSafeString(r.student, 1, 80) &&
    isSafeString(r.studentId, 1, 60) &&
    isSafeString(r.equipmentNeeded, 0, 400) &&
    isSafeString(r.project, 2, LIMITS.PROJECT_MAX) &&
    typeof r.deadline === 'string' &&
    isValidIsoDate(r.deadline) &&
    typeof r.teamSize === 'number' &&
    Number.isInteger(r.teamSize) &&
    r.teamSize >= LIMITS.TEAM_MIN &&
    r.teamSize <= LIMITS.TEAM_MAX &&
    typeof r.hoursNeeded === 'number' &&
    Number.isFinite(r.hoursNeeded) &&
    r.hoursNeeded >= LIMITS.HOURS_NEEDED_MIN &&
    r.hoursNeeded <= LIMITS.HOURS_NEEDED_MAX &&
    typeof r.submittedAt === 'string' &&
    isValidIsoDate(r.submittedAt) &&
    isSafeString(r.facultyNote, 0, LIMITS.REASON_MAX, true)
  );
}
