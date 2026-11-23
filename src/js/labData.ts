/**
 * Browser state store hydrating seed catalog data with validated localStorage persistence.
 */
import seedData from '../data/labs.json';
import {
  addDepartment as pureAddDepartment,
  addItem as pureAddItem,
  addLab as pureAddLab,
  addSlots as pureAddSlots,
  deleteDepartment as pureDeleteDepartment,
  deleteItem as pureDeleteItem,
  deleteLab as pureDeleteLab,
  deleteSlot as pureDeleteSlot,
  editDepartment as pureEditDepartment,
  editItem as pureEditItem,
  editLab as pureEditLab,
  getDependents as pureGetDependents,
  type AddSlotsInput,
  type CatalogMutationResult,
  type CatalogSnapshot,
  type DeleteOption,
  type DepartmentInput,
  type DependentReport,
  type EquipmentInput,
  type LabInput,
} from './catalog-admin';
import {
  normalizeSelectedItemIds,
  transitionRequest,
  validateRequest,
  type TransitionResult,
} from './requests';
import type { AllocationResult } from './scheduler';
import {
  DEFAULT_REFERENCE_DATE,
  formatHour,
  parseHour,
  validateBooking,
} from './scheduler';
import {
  hasControlChars,
  isSafeString,
  isValidIsoDate,
  normalizeText,
} from './validation';
import type {
  AccessRequest,
  CampusUser,
  Department,
  EquipmentItem,
  ItemFilters,
  Lab,
  LabDataset,
  NewRequestInput,
  RequestFilters,
  RequestStatus,
  TimeSlot,
  UserRole,
} from './types';

const STORAGE_KEY = 'labora_notebook_state_v1';

interface PersistedState {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  slots: TimeSlot[];
  requests: AccessRequest[];
  activeRole: UserRole;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DEFAULT_SLOT_WINDOWS = [
  { dayOffset: 0, window: '14:00 – 16:00', durationHours: 2 },
  { dayOffset: 0, window: '16:30 – 18:30', durationHours: 2 },
  { dayOffset: 1, window: '09:30 – 11:30', durationHours: 2 },
  { dayOffset: 1, window: '13:30 – 15:30', durationHours: 2 },
];

function cloneDataset(): LabDataset {
  return JSON.parse(JSON.stringify(seedData)) as LabDataset;
}

function buildDateString(dayOffset: number): string {
  const base = new Date('2026-11-23T00:00:00');
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().slice(0, 10);
}

// Generate deterministic fallback slots for items without explicit seed slots
// so every item in the 43-item catalog can be scheduled on Smart Booking.
function ensureSlotsForAllItems(items: EquipmentItem[], seedSlots: TimeSlot[]): TimeSlot[] {
  const slotsByItem = new Map<string, TimeSlot[]>();
  for (const slot of seedSlots) {
    const existing = slotsByItem.get(slot.itemId) ?? [];
    existing.push(slot);
    slotsByItem.set(slot.itemId, existing);
  }

  const combined: TimeSlot[] = [...seedSlots];
  for (const item of items) {
    if (slotsByItem.has(item.id)) {
      continue;
    }
    DEFAULT_SLOT_WINDOWS.forEach((tpl, idx) => {
      const isBooked =
        item.status === 'Booked' || (item.status === 'Limited' && idx < 2);
      combined.push({
        id: `sl-auto-${item.id}-${idx + 1}`,
        itemId: item.id,
        date: buildDateString(tpl.dayOffset),
        window: tpl.window,
        durationHours: tpl.durationHours,
        booked: isBooked,
        bookedBy: isBooked ? 'Assigned Lab Cohort' : null,
        note: isBooked ? 'Reserved coursework session' : '',
      });
    });
  }
  return combined;
}

const VALID_EQUIPMENT_TYPES = new Set([
  'Instruments',
  'Development kits',
  'Workstations',
  'Safety gear',
]);
const VALID_STATUSES = new Set(['Available', 'Limited', 'Booked']);
const VALID_ACCESS_LEVELS = new Set([
  'Open',
  'Needs faculty approval',
  'Training required',
]);
const VALID_REQUEST_STATUSES = new Set<RequestStatus>([
  'Submitted',
  'Under review',
  'Approved',
  'Rejected',
  'Changes requested',
]);

// Migrate any legacy status strings stored in browser localStorage from earlier builds.
function normalizePersistedRequest(req: AccessRequest): AccessRequest {
  const rawStatus = req.status as string;
  let status: RequestStatus = req.status;
  if (rawStatus === 'Pending') status = 'Submitted';
  else if (rawStatus === 'Needs Info') status = 'Changes requested';
  else if (rawStatus === 'Denied') status = 'Rejected';
  return {
    ...req,
    status,
    itemIds: req.itemIds && req.itemIds.length > 0 ? req.itemIds : req.itemId ? [req.itemId] : [],
  };
}

function isValidPersistedDepartment(raw: unknown): raw is Department {
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

function isValidPersistedLab(raw: unknown, validDeptIds: Set<string>): raw is Lab {
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

function isValidPersistedItem(
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
    VALID_EQUIPMENT_TYPES.has(i.type) &&
    isSafeString(i.location, 2, 80) &&
    typeof i.status === 'string' &&
    VALID_STATUSES.has(i.status) &&
    typeof i.accessLevel === 'string' &&
    VALID_ACCESS_LEVELS.has(i.accessLevel) &&
    isSafeString(i.specs, 0, 200, true) &&
    isSafeString(i.nextFreeSlot, 1, 40) &&
    typeof i.image === 'string' &&
    !hasControlChars(i.image)
  );
}

function isValidPersistedSlot(raw: unknown, validItemIds: Set<string>): raw is TimeSlot {
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
    s.note.length <= 200
  );
}

function isValidPersistedRequest(
  raw: unknown,
  validDeptIds: Set<string>,
  validItemIds: Set<string>
): raw is AccessRequest {
  if (!raw || typeof raw !== 'object') return false;
  const normalized = normalizePersistedRequest(raw as AccessRequest);
  const r = normalized as unknown as Record<string, unknown>;
  const itemIdsOk =
    Array.isArray(normalized.itemIds) &&
    normalized.itemIds.every(
      (id) => typeof id === 'string' && (id === '' || validItemIds.has(id))
    );

  return (
    isSafeString(r.id, 1, 80) &&
    isSafeString(r.student, 1, 80) &&
    isSafeString(r.studentId, 1, 60) &&
    typeof r.departmentId === 'string' &&
    (r.departmentId === '' || validDeptIds.has(r.departmentId)) &&
    typeof r.itemId === 'string' &&
    (r.itemId === '' || validItemIds.has(r.itemId)) &&
    itemIdsOk &&
    isSafeString(r.equipmentNeeded, 0, 400) &&
    isSafeString(r.project, 2, 80) &&
    typeof r.deadline === 'string' &&
    isValidIsoDate(r.deadline) &&
    typeof normalized.status === 'string' &&
    VALID_REQUEST_STATUSES.has(normalized.status) &&
    typeof r.teamSize === 'number' &&
    Number.isInteger(r.teamSize) &&
    r.teamSize >= 1 &&
    r.teamSize <= 10 &&
    typeof r.hoursNeeded === 'number' &&
    Number.isFinite(r.hoursNeeded) &&
    r.hoursNeeded >= 1 &&
    r.hoursNeeded <= 100 &&
    typeof r.submittedAt === 'string' &&
    isValidIsoDate(r.submittedAt) &&
    isSafeString(r.facultyNote, 0, 300, true)
  );
}

function resolveStorage(storageOverride?: StorageLike | null): StorageLike | null {
  if (storageOverride !== undefined) {
    return storageOverride;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function clearCorruptStorage(storageOverride?: StorageLike | null): void {
  try {
    const storage = resolveStorage(storageOverride);
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage removal errors in restricted environments.
  }
}

export function validatePersistedState(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<PersistedState>;

  if (
    !Array.isArray(parsed.departments) ||
    !Array.isArray(parsed.labs) ||
    !Array.isArray(parsed.items) ||
    !Array.isArray(parsed.slots) ||
    !Array.isArray(parsed.requests)
  ) {
    return null;
  }

  if (!parsed.departments.every(isValidPersistedDepartment)) return null;
  const deptIds = new Set(parsed.departments.map((d) => d.id));

  if (!parsed.labs.every((l) => isValidPersistedLab(l, deptIds))) return null;
  const labIds = new Set(parsed.labs.map((l) => l.id));

  if (!parsed.items.every((i) => isValidPersistedItem(i, deptIds, labIds))) {
    return null;
  }
  const itemIds = new Set(parsed.items.map((i) => i.id));

  if (!parsed.slots.every((s) => isValidPersistedSlot(s, itemIds))) return null;
  if (!parsed.requests.every((r) => isValidPersistedRequest(r, deptIds, itemIds))) {
    return null;
  }

  const activeRole: UserRole =
    parsed.activeRole === 'faculty'
      ? 'faculty'
      : parsed.activeRole === 'student'
        ? 'student'
        : (null as never);
  if (!activeRole) return null;

  return {
    departments: parsed.departments,
    labs: parsed.labs,
    items: parsed.items,
    slots: parsed.slots,
    requests: parsed.requests.map(normalizePersistedRequest),
    activeRole,
  };
}

function loadInitialState(storageOverride?: StorageLike | null): {
  dataset: LabDataset;
  activeRole: UserRole;
  loadedFromStorage: boolean;
} {
  const base = cloneDataset();
  base.slots = ensureSlotsForAllItems(base.items, base.slots);

  // Guard localStorage access and validate the full persisted schema before hydrating.
  try {
    const storage = resolveStorage(storageOverride);
    if (storage) {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        if (raw.length > 500_000) {
          clearCorruptStorage(storage);
          return { dataset: base, activeRole: 'student', loadedFromStorage: false };
        }
        const parsed = JSON.parse(raw) as unknown;
        const validated = validatePersistedState(parsed);
        if (!validated) {
          clearCorruptStorage(storage);
          return { dataset: base, activeRole: 'student', loadedFromStorage: false };
        }
        base.departments = validated.departments;
        base.labs = validated.labs;
        base.items = validated.items;
        base.slots = validated.slots;
        base.requests = validated.requests;
        return { dataset: base, activeRole: validated.activeRole, loadedFromStorage: true };
      }
    }
  } catch {
    clearCorruptStorage(storageOverride);
  }

  return { dataset: base, activeRole: 'student', loadedFromStorage: false };
}

const initialLoaded = loadInitialState();
let state: {
  dataset: LabDataset;
  activeRole: UserRole;
} = {
  dataset: initialLoaded.dataset,
  activeRole: initialLoaded.activeRole,
};
let stateVersion = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistListenersRegistered = false;

export function getStateVersion(): number {
  return stateVersion;
}

export function reloadLabStore(storageOverride?: StorageLike | null): {
  activeRole: UserRole;
  loadedFromStorage: boolean;
} {
  stateVersion += 1;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const loaded = loadInitialState(storageOverride);
  state = {
    dataset: loaded.dataset,
    activeRole: loaded.activeRole,
  };
  return {
    activeRole: loaded.activeRole,
    loadedFromStorage: loaded.loadedFromStorage,
  };
}

export function flushPersistedState(storageOverride?: StorageLike | null): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const storage = resolveStorage(storageOverride);
    if (storage) {
      const payload: PersistedState = {
        departments: state.dataset.departments,
        labs: state.dataset.labs,
        items: state.dataset.items,
        slots: state.dataset.slots,
        requests: state.dataset.requests,
        activeRole: state.activeRole,
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore storage quota or security errors; state remains active in memory.
  }
}

function registerFlushListeners(): void {
  if (persistListenersRegistered || typeof window === 'undefined') return;
  persistListenersRegistered = true;
  window.addEventListener('pagehide', () => {
    flushPersistedState();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && persistTimer !== null) {
        flushPersistedState();
      }
    });
  }
}

// Batch and debounce localStorage serialization so burst updates serialize once without blocking interactions.
function persistState(): void {
  stateVersion += 1;
  if (typeof window === 'undefined') return;
  registerFlushListeners();
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistedState();
  }, 150);
}

export function getDepartments(): Department[] {
  return state.dataset.departments.map((dept) => ({ ...dept }));
}

export function getLabs(departmentId?: string): Lab[] {
  const labs = departmentId
    ? state.dataset.labs.filter((lab) => lab.departmentId === departmentId)
    : state.dataset.labs;
  return labs.map((lab) => ({ ...lab }));
}

export function getItems(filters: ItemFilters = {}): EquipmentItem[] {
  const query = (filters.query ?? '').trim().toLowerCase();
  return state.dataset.items
    .filter((item) => {
      if (filters.departmentId && item.departmentId !== filters.departmentId) {
        return false;
      }
      if (filters.labId && item.labId !== filters.labId) {
        return false;
      }
      if (filters.type && item.type !== filters.type) {
        return false;
      }
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      if (filters.accessLevel && item.accessLevel !== filters.accessLevel) {
        return false;
      }
      if (query) {
        const haystack = `${item.name} ${item.specs} ${item.location} ${item.type}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    })
    .map((item) => ({ ...item }));
}

export function getItemById(itemId: string): EquipmentItem | undefined {
  const found = state.dataset.items.find((item) => item.id === itemId);
  return found ? { ...found } : undefined;
}

export function getSlots(itemId: string): TimeSlot[] {
  return state.dataset.slots
    .filter((slot) => slot.itemId === itemId)
    .map((slot) => ({ ...slot }));
}

export function getAllSlots(): TimeSlot[] {
  return state.dataset.slots.map((slot) => ({ ...slot }));
}

export function getRequests(filters: RequestFilters = {}): AccessRequest[] {
  return state.dataset.requests
    .filter((req) => {
      if (filters.status && req.status !== filters.status) {
        return false;
      }
      if (filters.departmentId && req.departmentId !== filters.departmentId) {
        return false;
      }
      if (filters.student && req.student !== filters.student) {
        return false;
      }
      return true;
    })
    .map((req) => ({ ...req }));
}

export function getCurrentUser(): CampusUser {
  return { ...state.dataset.users[state.activeRole] };
}

export function switchUserRole(role: UserRole): CampusUser {
  state.activeRole = role === 'faculty' ? 'faculty' : 'student';
  persistState();
  return getCurrentUser();
}

function syncItemAvailabilityFromSlots(itemId: string): void {
  const item = state.dataset.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const itemSlots = state.dataset.slots.filter((s) => s.itemId === itemId);
  const openSlots = itemSlots.filter((s) => !s.booked);

  if (openSlots.length === 0) {
    item.status = 'Booked';
    item.nextFreeSlot = 'Waitlist open';
  } else if (openSlots.length <= 1) {
    item.status = 'Limited';
    const next = openSlots[0];
    item.nextFreeSlot = `${next.date.slice(5)} · ${next.window.split(' ')[0]}`;
  } else {
    item.status = 'Available';
    const next = openSlots[0];
    item.nextFreeSlot = `${next.date.slice(5)} · ${next.window.split(' ')[0]}`;
  }
}

export function cancelSlotBooking(slotId: string, itemId: string): TimeSlot | null {
  const slot = state.dataset.slots.find(
    (entry) => entry.id === slotId && entry.itemId === itemId
  );
  if (!slot || !slot.booked) {
    return null;
  }

  slot.booked = false;
  slot.bookedBy = null;
  slot.note = '';
  slot.status = 'free';
  slot.requestId = null;
  syncItemAvailabilityFromSlots(itemId);
  persistState();
  return { ...slot };
}

export function createCustomBooking(input: {
  itemId: string;
  date: string;
  start: string;
  durationHours: number;
  purpose: string;
  bookedBy?: string;
  requestId?: string | null;
}): TimeSlot | null {
  if (!getItemById(input.itemId)) {
    return null;
  }

  const cleanPurpose = normalizeText(input.purpose ?? '');
  const itemSlots = state.dataset.slots.filter((s) => s.itemId === input.itemId);
  const check = validateBooking(
    {
      itemId: input.itemId,
      date: input.date,
      start: input.start,
      durationHours: input.durationHours,
      purpose: cleanPurpose,
    },
    itemSlots
  );
  if (!check.ok) {
    return null;
  }

  const startHour = parseHour(input.start);
  const end = formatHour(startHour + input.durationHours);
  const user = getCurrentUser();
  const created: TimeSlot = {
    id: `sl-custom-${input.itemId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: input.itemId,
    date: input.date,
    window: `${input.start} – ${end}`,
    durationHours: input.durationHours,
    booked: true,
    bookedBy: input.bookedBy ?? user.name,
    note: cleanPurpose,
    start: input.start,
    end,
    status: 'booked',
    requestId: input.requestId ?? null,
  };

  state.dataset.slots.push(created);
  syncItemAvailabilityFromSlots(input.itemId);
  persistState();
  return { ...created };
}

export function applyAllocationSuggestion(result: AllocationResult): void {
  for (const assignment of result.assignments) {
    createCustomBooking({
      itemId: assignment.itemId,
      date: assignment.date,
      start: assignment.start,
      durationHours: assignment.durationHours,
      purpose: `AI Fair Allocation (${assignment.score}/100)`,
      bookedBy: assignment.student,
      requestId: assignment.requestId,
    });

    const req = state.dataset.requests.find((r) => r.id === assignment.requestId);
    if (req) {
      req.status = 'Approved';
      req.facultyNote = `Allocated ${assignment.date} ${assignment.start}–${assignment.end} via fair-allocation engine.`;
    }
  }

  for (const alt of result.alternatives) {
    const req = state.dataset.requests.find((r) => r.id === alt.requestId);
    if (req) {
      req.status = 'Changes requested';
      req.facultyNote = alt.reason;
      req.reviewedAt = DEFAULT_REFERENCE_DATE;
    }
  }

  persistState();
}

export function submitAccessRequest(input: NewRequestInput): AccessRequest | null {
  const itemIds = normalizeSelectedItemIds(input);
  const selectedItems = itemIds
    .map((id) => getItemById(id))
    .filter((item): item is EquipmentItem => Boolean(item));
  if (selectedItems.length === 0 || selectedItems.length !== itemIds.length) {
    return null;
  }

  const primaryItem = selectedItems[0];
  const resolvedDepartmentId = input.departmentId || primaryItem.departmentId;
  const validation = validateRequest(
    {
      ...input,
      itemIds,
      departmentId: resolvedDepartmentId,
      subjectCourse: input.subjectCourse ?? 'LAB 400 · Independent Research',
      justification:
        input.justification ??
        'Requesting scheduled bench access for course research project.',
      trainingConfirmed: input.trainingConfirmed ?? true,
    },
    {
      departments: state.dataset.departments,
      items: state.dataset.items,
      referenceDate: DEFAULT_REFERENCE_DATE,
    }
  );
  if (!validation.ok) {
    return null;
  }

  const user = getCurrentUser();
  const nextNumber = state.dataset.requests.length + 101;
  const created: AccessRequest = {
    id: `req-${nextNumber}-${Date.now().toString(36)}`,
    student: user.name,
    studentId: user.id,
    departmentId: resolvedDepartmentId,
    itemId: primaryItem.id,
    itemIds,
    equipmentNeeded: selectedItems.map((item) => item.name).join(', '),
    project: input.project.trim(),
    subjectCourse: (input.subjectCourse ?? 'LAB 400 · Independent Research').trim(),
    deadline: input.deadline,
    status: 'Submitted',
    teamSize: Math.max(1, Number(input.teamSize) || 1),
    hoursNeeded: Math.max(1, Number(input.hoursNeeded) || 1),
    submittedAt: DEFAULT_REFERENCE_DATE,
    justification: (input.justification ?? '').trim(),
    trainingConfirmed: Boolean(input.trainingConfirmed),
    facultyNote: '',
  };

  state.dataset.requests.unshift(created);
  persistState();
  return { ...created };
}

export function transitionAccessRequest(
  requestId: string,
  nextStatus: RequestStatus,
  reason = ''
): TransitionResult | null {
  const idx = state.dataset.requests.findIndex((req) => req.id === requestId);
  if (idx === -1) {
    return null;
  }

  const current = state.dataset.requests[idx];
  const result = transitionRequest(
    current,
    nextStatus,
    reason,
    DEFAULT_REFERENCE_DATE,
    state.activeRole
  );
  if (result.ok) {
    state.dataset.requests[idx] = result.request;
    persistState();
  }
  return result;
}

export function reviewAccessRequest(
  requestId: string,
  decision: RequestStatus,
  facultyNote: string
): AccessRequest | null {
  if (state.activeRole !== 'faculty') {
    return null;
  }
  const idx = state.dataset.requests.findIndex((req) => req.id === requestId);
  if (idx === -1) {
    return null;
  }

  let target = state.dataset.requests[idx];
  // If a faculty reviewer decides directly on a newly Submitted request, step cleanly through Under review.
  if (
    target.status === 'Submitted' &&
    (decision === 'Approved' || decision === 'Rejected' || decision === 'Changes requested')
  ) {
    const startReview = transitionRequest(
      target,
      'Under review',
      '',
      DEFAULT_REFERENCE_DATE,
      state.activeRole
    );
    if (!startReview.ok) {
      return null;
    }
    target = startReview.request;
  }

  const result = transitionRequest(
    target,
    decision,
    facultyNote,
    DEFAULT_REFERENCE_DATE,
    state.activeRole
  );
  if (!result.ok) {
    return null;
  }

  state.dataset.requests[idx] = result.request;
  persistState();
  return { ...result.request };
}

function getCatalogSnapshot(): CatalogSnapshot {
  return {
    departments: state.dataset.departments,
    labs: state.dataset.labs,
    items: state.dataset.items,
    slots: state.dataset.slots,
    requests: state.dataset.requests,
  };
}

function commitCatalogResult<T>(
  result: CatalogMutationResult<T>
): CatalogMutationResult<T> {
  if (result.ok && result.nextState) {
    state.dataset.departments = result.nextState.departments;
    state.dataset.labs = result.nextState.labs;
    state.dataset.items = result.nextState.items;
    state.dataset.slots = result.nextState.slots;
    state.dataset.requests = result.nextState.requests;
    persistState();
  }
  return result;
}

export function getEntityDependents(entity: {
  type: 'department' | 'lab' | 'item' | 'slot';
  id: string;
}): DependentReport {
  return pureGetDependents(entity, getCatalogSnapshot());
}

export function adminAddDepartment(
  input: DepartmentInput
): CatalogMutationResult<Department> {
  return commitCatalogResult(
    pureAddDepartment(state.activeRole, input, getCatalogSnapshot())
  );
}

export function adminEditDepartment(
  departmentId: string,
  input: DepartmentInput
): CatalogMutationResult<Department> {
  return commitCatalogResult(
    pureEditDepartment(state.activeRole, departmentId, input, getCatalogSnapshot())
  );
}

export function adminDeleteDepartment(
  departmentId: string,
  option?: DeleteOption
): CatalogMutationResult<Department> {
  return commitCatalogResult(
    pureDeleteDepartment(
      state.activeRole,
      departmentId,
      getCatalogSnapshot(),
      option,
      DEFAULT_REFERENCE_DATE
    )
  );
}

export function adminAddLab(input: LabInput): CatalogMutationResult<Lab> {
  return commitCatalogResult(
    pureAddLab(state.activeRole, input, getCatalogSnapshot())
  );
}

export function adminEditLab(
  labId: string,
  input: LabInput
): CatalogMutationResult<Lab> {
  return commitCatalogResult(
    pureEditLab(state.activeRole, labId, input, getCatalogSnapshot())
  );
}

export function adminDeleteLab(
  labId: string,
  option?: DeleteOption
): CatalogMutationResult<Lab> {
  return commitCatalogResult(
    pureDeleteLab(
      state.activeRole,
      labId,
      getCatalogSnapshot(),
      option,
      DEFAULT_REFERENCE_DATE
    )
  );
}

export function adminAddItem(
  input: EquipmentInput
): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(
    pureAddItem(state.activeRole, input, getCatalogSnapshot())
  );
}

export function adminEditItem(
  itemId: string,
  input: EquipmentInput
): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(
    pureEditItem(state.activeRole, itemId, input, getCatalogSnapshot())
  );
}

export function adminDeleteItem(
  itemId: string,
  option?: DeleteOption
): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(
    pureDeleteItem(
      state.activeRole,
      itemId,
      getCatalogSnapshot(),
      option,
      DEFAULT_REFERENCE_DATE
    )
  );
}

export function adminAddSlots(
  input: AddSlotsInput
): CatalogMutationResult<TimeSlot[]> {
  return commitCatalogResult(
    pureAddSlots(state.activeRole, input, getCatalogSnapshot(), DEFAULT_REFERENCE_DATE)
  );
}

export function adminDeleteSlot(
  slotId: string,
  option?: DeleteOption
): CatalogMutationResult<TimeSlot> {
  return commitCatalogResult(
    pureDeleteSlot(
      state.activeRole,
      slotId,
      getCatalogSnapshot(),
      option,
      DEFAULT_REFERENCE_DATE
    )
  );
}

export function resetLabStore(): void {
  stateVersion += 1;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const base = cloneDataset();
  base.slots = ensureSlotsForAllItems(base.items, base.slots);
  state = {
    dataset: base,
    activeRole: 'student',
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors in restricted environments.
  }
}
