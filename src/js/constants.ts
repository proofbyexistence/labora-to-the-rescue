/**
 * Central domain, scheduling, validation, allocation, and persistence constants.
 */
import type {
  AccessLevel,
  AvailabilityStatus,
  EquipmentType,
  RequestStatus,
  UserRole,
} from './types';

/** Canonical equipment category labels used across catalog filters and forms. */
export const EQUIPMENT_TYPES: readonly EquipmentType[] = [
  'Instruments',
  'Development kits',
  'Workstations',
  'Safety gear',
] as const;

/** Canonical equipment availability statuses. */
export const AVAILABILITY_STATUSES: readonly AvailabilityStatus[] = [
  'Available',
  'Limited',
  'Booked',
] as const;

/** Canonical access-control levels for equipment items. */
export const ACCESS_LEVELS: readonly AccessLevel[] = [
  'Open',
  'Needs faculty approval',
  'Training required',
] as const;

/** Canonical workflow statuses for project-based access requests. */
export const REQUEST_STATUSES: readonly RequestStatus[] = [
  'Submitted',
  'Under review',
  'Approved',
  'Rejected',
  'Changes requested',
] as const;

/** Statuses representing requests still awaiting faculty completion. */
export const PENDING_REQUEST_STATUSES: readonly RequestStatus[] = [
  'Submitted',
  'Under review',
] as const;

/** Legacy status string migration map for previously saved browser payloads. */
export const LEGACY_REQUEST_STATUS_MAP: Record<string, RequestStatus> = {
  Pending: 'Submitted',
  Approved: 'Approved',
  Denied: 'Rejected',
};

/** Valid demo user roles. */
export const USER_ROLES: readonly UserRole[] = ['student', 'faculty'] as const;

/** Demo role identifiers. */
export const ROLES = {
  STUDENT: 'student' as UserRole,
  FACULTY: 'faculty' as UserRole,
} as const;

/** Allowed one-step transitions in the access request state machine. */
export const ALLOWED_REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Submitted: ['Under review'],
  'Under review': ['Approved', 'Rejected', 'Changes requested'],
  'Changes requested': ['Submitted'],
  Approved: [],
  Rejected: [],
};

/** Operating hours and deterministic baseline date for Mon–Sat scheduling. */
export const LAB_SCHEDULE = {
  START_HOUR: 9,
  END_HOUR: 17,
  SLOT_STEP_HOURS: 1,
  MIN_BOOKING_HOURS: 1,
  MAX_BOOKING_HOURS: 4,
  CLOSED_WEEKDAY_SUNDAY: 0,
  OPEN_DAYS_PER_WEEK: 6,
  WEEK_SLOT_COUNT: 48,
  DEFAULT_REFERENCE_DATE: '2026-11-23',
  SEED_BASE_DATE: '2026-11-23',
} as const;

/** Deterministic priority-scoring factor weights summing to 100. */
export const ALLOCATION_WEIGHTS = {
  deadlineUrgency: 35,
  feasibility: 25,
  studentRequirements: 20,
  fairness: 20,
} as const;

/** Shared field length, range, and rate-limit bounds across client and server. */
export const LIMITS = {
  CATALOG_PAGE_SIZE: 9,
  PURPOSE_MIN: 3,
  PURPOSE_MAX: 200,
  PROJECT_MIN: 3,
  PROJECT_MAX: 80,
  SUBJECT_MIN: 2,
  SUBJECT_MAX: 80,
  JUSTIFICATION_MIN: 10,
  JUSTIFICATION_MAX: 500,
  REASON_MIN: 3,
  REASON_MAX: 300,
  TEAM_MIN: 1,
  TEAM_MAX: 10,
  HOURS_NEEDED_MIN: 1,
  HOURS_NEEDED_MAX: 100,
  AI_PROJECT_MIN: 10,
  AI_PROJECT_MAX: 500,
  AI_REASON_MAX: 119,
  AI_SUMMARY_MAX: 500,
  AI_MAX_SUGGESTIONS: 5,
  AI_MAX_LIST_ENTRIES: 20,
  AI_BODY_LIMIT: '5kb',
  RATE_LIMIT_MAX_REQUESTS: 10,
  RATE_LIMIT_WINDOW_MS: 60_000,
  STORAGE_MAX_BYTES: 512_000,
  DEFAULT_SAVE_DEBOUNCE_MS: 80,
  MS_PER_DAY: 86_400_000,
} as const;

/** Catalog administration field bounds. */
export const CATALOG_LIMITS = {
  DEPT_NAME_MIN: 2,
  DEPT_NAME_MAX: 50,
  DEPT_CODE_MIN: 2,
  DEPT_CODE_MAX: 10,
  DEPT_BUILDING_MAX: 60,
  DEPT_LEAD_MAX: 60,
  DEPT_SUMMARY_MAX: 200,
  LAB_NAME_MIN: 2,
  LAB_NAME_MAX: 60,
  LAB_ROOM_MIN: 1,
  LAB_ROOM_MAX: 24,
  LAB_SUPERVISOR_MAX: 60,
  LAB_HOURS_MIN: 3,
  LAB_HOURS_MAX: 40,
  LAB_DESC_MAX: 200,
  ITEM_NAME_MIN: 2,
  ITEM_NAME_MAX: 80,
  ITEM_LOCATION_MIN: 2,
  ITEM_LOCATION_MAX: 80,
  ITEM_SPECS_MAX: 200,
} as const;

/** LocalStorage key names for persisted notebook state and theme mode. */
export const STORAGE_KEYS = {
  NOTEBOOK_STATE: 'labora_notebook_state_v1',
  THEME: 'labora_theme_v1',
} as const;

/** Faculty-only guard error shared across admin mutations. */
export const FACULTY_GUARD_ERROR =
  'Faculty role is required to modify catalog records.';
