import {
  DEFAULT_REFERENCE_DATE,
  formatHour,
  LAB_END_HOUR,
  LAB_START_HOUR,
  parseHour,
} from './scheduler';
import type {
  AccessLevel,
  AccessRequest,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
  TimeSlot,
  UserRole,
} from './types';
import { hasControlChars, normalizeText } from './validation';

export interface CatalogSnapshot {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  slots: TimeSlot[];
  requests: AccessRequest[];
}

export type DeleteOption = 'cancelAffected' | 'cancel';

export interface DependentReport {
  entityType: 'department' | 'lab' | 'item' | 'slot';
  entityId: string;
  entityLabel: string;
  childLabs: Lab[];
  childItems: EquipmentItem[];
  activeBookings: TimeSlot[];
  affectedRequests: AccessRequest[];
  totalCount: number;
}

export interface CatalogMutationResult<T = unknown> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  dependents?: DependentReport;
  nextState?: CatalogSnapshot;
}

export interface DepartmentInput {
  name: string;
  code?: string;
  building?: string;
  leadFaculty?: string;
  summary?: string;
}

export interface LabInput {
  departmentId: string;
  name: string;
  room?: string;
  supervisor?: string;
  hours?: string;
  description?: string;
}

export interface EquipmentInput {
  name: string;
  departmentId: string;
  labId: string;
  type: EquipmentType;
  location: string;
  status: AvailabilityStatus;
  accessLevel: AccessLevel;
  specs: string;
}

export interface AddSlotsInput {
  itemId: string;
  date: string;
  startTime: string;
  endTime: string;
}

const VALID_EQUIPMENT_TYPES: EquipmentType[] = [
  'Instruments',
  'Development kits',
  'Workstations',
  'Safety gear',
];

const VALID_STATUSES: AvailabilityStatus[] = ['Available', 'Limited', 'Booked'];

const VALID_ACCESS_LEVELS: AccessLevel[] = [
  'Open',
  'Needs faculty approval',
  'Training required',
];

const FACULTY_GUARD_ERROR =
  'Faculty role is required to modify catalog records.';

function assertFaculty(role: UserRole): string | null {
  // Server-equivalent check on pure catalog operations (demo role switch only, not real auth).
  return role === 'faculty' ? null : FACULTY_GUARD_ERROR;
}

function cloneSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return {
    departments: snapshot.departments.map((d) => ({ ...d })),
    labs: snapshot.labs.map((l) => ({ ...l })),
    items: snapshot.items.map((i) => ({ ...i })),
    slots: snapshot.slots.map((s) => ({ ...s })),
    requests: snapshot.requests.map((r) => ({
      ...r,
      itemIds: r.itemIds ? [...r.itemIds] : undefined,
    })),
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || 'entry';
}

function generateUniqueId(
  prefix: string,
  seedText: string,
  existingIds: Set<string>
): string {
  const base = `${prefix}-${slugify(seedText)}`;
  if (!existingIds.has(base)) {
    return base;
  }
  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

function parseIsoDateUtc(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function parseTimeRangeForSlot(slot: TimeSlot): { startHour: number; endHour: number } | null {
  if (slot.start && slot.end) {
    const startHour = parseHour(slot.start);
    const endHour = parseHour(slot.end);
    if (Number.isFinite(startHour) && Number.isFinite(endHour)) {
      return { startHour, endHour };
    }
  }
  const match = slot.window.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const startHour = parseHour(match[1]);
  const endHour = parseHour(match[2]);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  return { startHour, endHour };
}

export function deriveNextFreeSlot(itemId: string, slots: TimeSlot[]): string {
  const itemSlots = slots.filter((s) => s.itemId === itemId);
  if (itemSlots.length === 0) {
    return 'Unscheduled';
  }
  const openSlots = itemSlots
    .filter((s) => !s.booked)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start ?? a.window).localeCompare(b.start ?? b.window);
    });

  if (openSlots.length === 0) {
    return 'Waitlist open';
  }
  const first = openSlots[0];
  const timePart = first.start ?? first.window.split(' ')[0] ?? '09:00';
  return `${first.date.slice(5)} · ${timePart}`;
}

function deriveItemStatusFromSlots(
  item: EquipmentItem,
  slots: TimeSlot[]
): EquipmentItem {
  const itemSlots = slots.filter((s) => s.itemId === item.id);
  if (itemSlots.length === 0) {
    return {
      ...item,
      nextFreeSlot: 'Unscheduled',
    };
  }
  const openCount = itemSlots.filter((s) => !s.booked).length;
  const status: AvailabilityStatus =
    openCount === 0 ? 'Booked' : openCount === 1 ? 'Limited' : 'Available';
  return {
    ...item,
    status,
    nextFreeSlot: deriveNextFreeSlot(item.id, slots),
  };
}

function isBlockingRequestStatus(status: AccessRequest['status']): boolean {
  return (
    status === 'Submitted' ||
    status === 'Under review' ||
    status === 'Approved'
  );
}

/**
 * Collect all child labs/items, active bookings, and pending/approved requests referencing an entity.
 */
export function getDependents(
  entity: { type: 'department' | 'lab' | 'item' | 'slot'; id: string },
  snapshot: CatalogSnapshot
): DependentReport {
  if (entity.type === 'department') {
    const dept = snapshot.departments.find((d) => d.id === entity.id);
    const childLabs = snapshot.labs.filter((l) => l.departmentId === entity.id);
    const labIds = new Set(childLabs.map((l) => l.id));
    const childItems = snapshot.items.filter(
      (i) => i.departmentId === entity.id || labIds.has(i.labId)
    );
    const itemIds = new Set(childItems.map((i) => i.id));
    const activeBookings = snapshot.slots.filter(
      (s) => s.booked && itemIds.has(s.itemId)
    );
    const affectedRequests = snapshot.requests.filter(
      (req) =>
        isBlockingRequestStatus(req.status) &&
        (req.departmentId === entity.id ||
          itemIds.has(req.itemId) ||
          Boolean(req.itemIds?.some((id) => itemIds.has(id))))
    );
    return {
      entityType: 'department',
      entityId: entity.id,
      entityLabel: dept?.name ?? entity.id,
      childLabs,
      childItems,
      activeBookings,
      affectedRequests,
      totalCount:
        childLabs.length +
        childItems.length +
        activeBookings.length +
        affectedRequests.length,
    };
  }

  if (entity.type === 'lab') {
    const lab = snapshot.labs.find((l) => l.id === entity.id);
    const childItems = snapshot.items.filter((i) => i.labId === entity.id);
    const itemIds = new Set(childItems.map((i) => i.id));
    const activeBookings = snapshot.slots.filter(
      (s) => s.booked && itemIds.has(s.itemId)
    );
    const affectedRequests = snapshot.requests.filter(
      (req) =>
        isBlockingRequestStatus(req.status) &&
        (itemIds.has(req.itemId) ||
          Boolean(req.itemIds?.some((id) => itemIds.has(id))))
    );
    return {
      entityType: 'lab',
      entityId: entity.id,
      entityLabel: lab?.name ?? entity.id,
      childLabs: [],
      childItems,
      activeBookings,
      affectedRequests,
      totalCount:
        childItems.length + activeBookings.length + affectedRequests.length,
    };
  }

  if (entity.type === 'item') {
    const item = snapshot.items.find((i) => i.id === entity.id);
    const activeBookings = snapshot.slots.filter(
      (s) => s.booked && s.itemId === entity.id
    );
    const affectedRequests = snapshot.requests.filter(
      (req) =>
        isBlockingRequestStatus(req.status) &&
        (req.itemId === entity.id || Boolean(req.itemIds?.includes(entity.id)))
    );
    return {
      entityType: 'item',
      entityId: entity.id,
      entityLabel: item?.name ?? entity.id,
      childLabs: [],
      childItems: [],
      activeBookings,
      affectedRequests,
      totalCount: activeBookings.length + affectedRequests.length,
    };
  }

  const slot = snapshot.slots.find((s) => s.id === entity.id);
  const activeBookings = slot && slot.booked ? [slot] : [];
  const affectedRequests =
    slot && slot.booked && slot.requestId
      ? snapshot.requests.filter(
          (req) => req.id === slot.requestId && isBlockingRequestStatus(req.status)
        )
      : [];
  return {
    entityType: 'slot',
    entityId: entity.id,
    entityLabel: slot ? `${slot.date} ${slot.window}` : entity.id,
    childLabs: [],
    childItems: [],
    activeBookings,
    affectedRequests,
    totalCount: activeBookings.length + affectedRequests.length,
  };
}

function sanitizeAffectedRequests(
  requests: AccessRequest[],
  removedDeptIds: Set<string>,
  removedItemIds: Set<string>,
  automaticReason: string,
  referenceDate: string
): AccessRequest[] {
  return requests.map((req) => {
    const referencesRemovedDept = removedDeptIds.has(req.departmentId);
    const referencesRemovedItem =
      removedItemIds.has(req.itemId) ||
      Boolean(req.itemIds?.some((id) => removedItemIds.has(id)));

    if (!referencesRemovedDept && !referencesRemovedItem) {
      return req;
    }

    const remainingIds = (req.itemIds ?? (req.itemId ? [req.itemId] : [])).filter(
      (id) => !removedItemIds.has(id)
    );
    const nextPrimaryItemId = remainingIds[0] ?? '';
    const nextDeptId = referencesRemovedDept ? '' : req.departmentId;
    const shouldFlag = isBlockingRequestStatus(req.status);

    return {
      ...req,
      departmentId: nextDeptId,
      itemId: nextPrimaryItemId,
      itemIds: remainingIds,
      status: shouldFlag ? 'Changes requested' : req.status,
      facultyNote: shouldFlag ? automaticReason : req.facultyNote,
      reviewedAt: shouldFlag ? referenceDate : req.reviewedAt,
    };
  });
}

function buildDeptCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (letters.slice(0, 4) || 'LAB').padEnd(2, 'X');
}

function validateDepartmentFields(
  input: DepartmentInput,
  existingDepartments: Department[],
  excludeDeptId?: string
): {
  ok: boolean;
  fieldErrors: Record<string, string>;
  cleaned: Omit<Department, 'id'>;
} {
  const fieldErrors: Record<string, string> = {};
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const rawCode = input.code ?? buildDeptCode(name);
  const code = normalizeText(rawCode).toUpperCase();
  const rawBuilding = input.building ?? 'Main Science Wing';
  const building = normalizeText(rawBuilding);
  const rawLead = input.leadFaculty ?? 'Faculty Coordinator';
  const leadFaculty = normalizeText(rawLead);
  const rawSummary =
    input.summary ?? `Shared ${name || 'academic'} teaching and research laboratories.`;
  const summary = normalizeText(rawSummary);

  if (hasControlChars(rawName)) {
    fieldErrors.name = 'Subject name cannot contain control characters.';
  } else if (name.length < 2 || name.length > 50) {
    fieldErrors.name = 'Subject name must be between 2 and 50 characters.';
  } else {
    const duplicate = existingDepartments.some(
      (d) => d.id !== excludeDeptId && d.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      fieldErrors.name = `A subject named "${name}" already exists.`;
    }
  }

  if (hasControlChars(rawCode)) {
    fieldErrors.code = 'Department code cannot contain control characters.';
  } else if (code.length < 2 || code.length > 10) {
    fieldErrors.code = 'Department code must be between 2 and 10 characters.';
  }
  if (hasControlChars(rawBuilding)) {
    fieldErrors.building = 'Building name cannot contain control characters.';
  } else if (building.length < 2 || building.length > 60) {
    fieldErrors.building = 'Building name must be between 2 and 60 characters.';
  }
  if (hasControlChars(rawLead)) {
    fieldErrors.leadFaculty = 'Lead faculty cannot contain control characters.';
  } else if (leadFaculty.length < 2 || leadFaculty.length > 60) {
    fieldErrors.leadFaculty = 'Lead faculty must be between 2 and 60 characters.';
  }
  if (hasControlChars(rawSummary, true)) {
    fieldErrors.summary = 'Summary cannot contain control characters.';
  } else if (summary.length > 200) {
    fieldErrors.summary = 'Summary must be 200 characters or fewer.';
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    cleaned: { name, code, building, leadFaculty, summary },
  };
}

export function addDepartment(
  role: UserRole,
  input: DepartmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateDepartmentFields(input, snapshot.departments);
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingIds = new Set(nextState.departments.map((d) => d.id));
  const created: Department = {
    id: generateUniqueId('dept', validation.cleaned.name, existingIds),
    ...validation.cleaned,
  };
  nextState.departments.push(created);

  return { ok: true, data: created, nextState };
}

export function editDepartment(
  role: UserRole,
  departmentId: string,
  input: DepartmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.departments.findIndex((d) => d.id === departmentId);
  if (targetIdx === -1) {
    return { ok: false, error: 'Subject/department not found.' };
  }

  const validation = validateDepartmentFields(
    input,
    snapshot.departments,
    departmentId
  );
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const updated: Department = {
    id: departmentId,
    ...validation.cleaned,
  };
  nextState.departments[targetIdx] = updated;

  return { ok: true, data: updated, nextState };
}

export function deleteDepartment(
  role: UserRole,
  departmentId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = DEFAULT_REFERENCE_DATE
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.departments.find((d) => d.id === departmentId);
  if (!target) {
    return { ok: false, error: 'Subject/department not found.' };
  }

  const dependents = getDependents({ type: 'department', id: departmentId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    return {
      ok: false,
      error:
        option === 'cancel'
          ? 'Deletion canceled; existing labs, equipment, or requests were kept.'
          : `Cannot delete "${target.name}" without resolving ${dependents.totalCount} dependent record(s).`,
      dependents,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const removedLabIds = new Set(dependents.childLabs.map((l) => l.id));
  const removedItemIds = new Set(dependents.childItems.map((i) => i.id));
  const removedDeptIds = new Set([departmentId]);

  nextState.departments = nextState.departments.filter((d) => d.id !== departmentId);
  nextState.labs = nextState.labs.filter(
    (l) => l.departmentId !== departmentId && !removedLabIds.has(l.id)
  );
  nextState.items = nextState.items.filter(
    (i) => i.departmentId !== departmentId && !removedItemIds.has(i.id)
  );
  nextState.slots = nextState.slots.filter((s) => !removedItemIds.has(s.itemId));
  nextState.requests = sanitizeAffectedRequests(
    nextState.requests,
    removedDeptIds,
    removedItemIds,
    `Automatic update: "${target.name}" was removed from the campus catalog. Please select active lab equipment.`,
    referenceDate
  );

  return { ok: true, data: target, dependents, nextState };
}

function validateLabFields(
  input: LabInput,
  departments: Department[],
  existingLabs: Lab[],
  excludeLabId?: string
): {
  ok: boolean;
  fieldErrors: Record<string, string>;
  cleaned: Omit<Lab, 'id'>;
} {
  const fieldErrors: Record<string, string> = {};
  const departmentId = (input.departmentId ?? '').trim();
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const rawRoom = input.room ?? 'LAB-101';
  const room = normalizeText(rawRoom);
  const rawSupervisor = input.supervisor ?? 'Lab Supervisor';
  const supervisor = normalizeText(rawSupervisor);
  const rawHours = input.hours ?? '09:00 – 17:00';
  const hours = normalizeText(rawHours);
  const rawDescription =
    input.description ?? `Shared bench facilities in ${name || 'this laboratory'}.`;
  const description = normalizeText(rawDescription);

  if (!departments.some((d) => d.id === departmentId)) {
    fieldErrors.departmentId = 'Select an existing subject/department for this lab.';
  }

  if (hasControlChars(rawName)) {
    fieldErrors.name = 'Lab name cannot contain control characters.';
  } else if (name.length < 2 || name.length > 60) {
    fieldErrors.name = 'Lab name must be between 2 and 60 characters.';
  } else if (
    existingLabs.some(
      (l) =>
        l.id !== excludeLabId &&
        l.departmentId === departmentId &&
        l.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    fieldErrors.name = `A lab named "${name}" already exists in this subject.`;
  }

  if (hasControlChars(rawRoom)) {
    fieldErrors.room = 'Room code cannot contain control characters.';
  } else if (room.length < 1 || room.length > 24) {
    fieldErrors.room = 'Room code must be between 1 and 24 characters.';
  }
  if (hasControlChars(rawSupervisor)) {
    fieldErrors.supervisor = 'Supervisor cannot contain control characters.';
  } else if (supervisor.length < 2 || supervisor.length > 60) {
    fieldErrors.supervisor = 'Supervisor must be between 2 and 60 characters.';
  }
  if (hasControlChars(rawHours)) {
    fieldErrors.hours = 'Hours cannot contain control characters.';
  } else if (hours.length < 3 || hours.length > 40) {
    fieldErrors.hours = 'Hours must be between 3 and 40 characters.';
  }
  if (hasControlChars(rawDescription, true)) {
    fieldErrors.description = 'Description cannot contain control characters.';
  } else if (description.length > 200) {
    fieldErrors.description = 'Description must be 200 characters or fewer.';
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    cleaned: { departmentId, name, room, supervisor, hours, description },
  };
}

export function addLab(
  role: UserRole,
  input: LabInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateLabFields(
    input,
    snapshot.departments,
    snapshot.labs
  );
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingIds = new Set(nextState.labs.map((l) => l.id));
  const created: Lab = {
    id: generateUniqueId('lab', validation.cleaned.name, existingIds),
    ...validation.cleaned,
  };
  nextState.labs.push(created);

  return { ok: true, data: created, nextState };
}

export function editLab(
  role: UserRole,
  labId: string,
  input: LabInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.labs.findIndex((l) => l.id === labId);
  if (targetIdx === -1) {
    return { ok: false, error: 'Laboratory not found.' };
  }

  const validation = validateLabFields(
    input,
    snapshot.departments,
    snapshot.labs,
    labId
  );
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const updated: Lab = {
    id: labId,
    ...validation.cleaned,
  };
  nextState.labs[targetIdx] = updated;

  // Keep child items aligned if the lab was moved to another department.
  nextState.items = nextState.items.map((item) =>
    item.labId === labId ? { ...item, departmentId: updated.departmentId } : item
  );

  return { ok: true, data: updated, nextState };
}

export function deleteLab(
  role: UserRole,
  labId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = DEFAULT_REFERENCE_DATE
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.labs.find((l) => l.id === labId);
  if (!target) {
    return { ok: false, error: 'Laboratory not found.' };
  }

  const dependents = getDependents({ type: 'lab', id: labId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    return {
      ok: false,
      error:
        option === 'cancel'
          ? 'Deletion canceled; existing equipment and bookings were kept.'
          : `Cannot delete "${target.name}" without resolving ${dependents.totalCount} dependent record(s).`,
      dependents,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const removedItemIds = new Set(dependents.childItems.map((i) => i.id));
  nextState.labs = nextState.labs.filter((l) => l.id !== labId);
  nextState.items = nextState.items.filter(
    (i) => i.labId !== labId && !removedItemIds.has(i.id)
  );
  nextState.slots = nextState.slots.filter((s) => !removedItemIds.has(s.itemId));
  nextState.requests = sanitizeAffectedRequests(
    nextState.requests,
    new Set(),
    removedItemIds,
    `Automatic update: "${target.name}" was removed from the campus catalog. Please choose alternative equipment.`,
    referenceDate
  );

  return { ok: true, data: target, dependents, nextState };
}

function validateEquipmentFields(
  input: EquipmentInput,
  snapshot: CatalogSnapshot,
  excludeItemId?: string
): {
  ok: boolean;
  fieldErrors: Record<string, string>;
  cleaned: Omit<EquipmentItem, 'id' | 'nextFreeSlot' | 'image'>;
} {
  const fieldErrors: Record<string, string> = {};
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const departmentId = (input.departmentId ?? '').trim();
  const labId = (input.labId ?? '').trim();
  const rawLocation = input.location ?? '';
  const location = normalizeText(rawLocation);
  const rawSpecs = input.specs ?? '';
  const specs = normalizeText(rawSpecs);

  if (hasControlChars(rawName)) {
    fieldErrors.name = 'Equipment name cannot contain control characters.';
  } else if (name.length < 2 || name.length > 80) {
    fieldErrors.name = 'Equipment name must be between 2 and 80 characters.';
  } else if (
    snapshot.items.some(
      (i) =>
        i.id !== excludeItemId &&
        i.labId === labId &&
        i.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    fieldErrors.name = `"${name}" already exists in the selected lab.`;
  }

  const deptExists = snapshot.departments.some((d) => d.id === departmentId);
  if (!deptExists) {
    fieldErrors.departmentId = 'Select an existing subject/department.';
  }

  const lab = snapshot.labs.find((l) => l.id === labId);
  if (!lab) {
    fieldErrors.labId = 'Select an existing laboratory.';
  } else if (deptExists && lab.departmentId !== departmentId) {
    fieldErrors.labId = 'Selected laboratory does not belong to the chosen subject.';
  }

  if (!VALID_EQUIPMENT_TYPES.includes(input.type)) {
    fieldErrors.type = 'Choose a valid equipment type.';
  }

  if (hasControlChars(rawLocation)) {
    fieldErrors.location = 'Location cannot contain control characters.';
  } else if (location.length < 2 || location.length > 80) {
    fieldErrors.location = 'Location must be between 2 and 80 characters.';
  }

  if (!VALID_STATUSES.includes(input.status)) {
    fieldErrors.status = 'Choose a valid availability status.';
  }

  if (!VALID_ACCESS_LEVELS.includes(input.accessLevel)) {
    fieldErrors.accessLevel = 'Choose a valid access level.';
  }

  if (hasControlChars(rawSpecs, true)) {
    fieldErrors.specs = 'Specifications cannot contain control characters.';
  } else if (specs.length > 200) {
    fieldErrors.specs = 'Specifications must be 200 characters or fewer.';
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    cleaned: {
      name,
      departmentId,
      labId,
      type: input.type,
      location,
      status: input.status,
      accessLevel: input.accessLevel,
      specs,
    },
  };
}

export function addItem(
  role: UserRole,
  input: EquipmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateEquipmentFields(input, snapshot);
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingIds = new Set(nextState.items.map((i) => i.id));
  const id = generateUniqueId('eq', validation.cleaned.name, existingIds);
  const created: EquipmentItem = {
    id,
    ...validation.cleaned,
    nextFreeSlot: deriveNextFreeSlot(id, nextState.slots),
    image: '',
  };
  nextState.items.push(created);

  return { ok: true, data: created, nextState };
}

export function editItem(
  role: UserRole,
  itemId: string,
  input: EquipmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.items.findIndex((i) => i.id === itemId);
  if (targetIdx === -1) {
    return { ok: false, error: 'Equipment item not found.' };
  }

  const validation = validateEquipmentFields(input, snapshot, itemId);
  if (!validation.ok) {
    const firstMsg = Object.values(validation.fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors: validation.fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingSlotsForItem = nextState.slots.filter((s) => s.itemId === itemId);
  const derivedNext =
    existingSlotsForItem.length > 0
      ? deriveNextFreeSlot(itemId, nextState.slots)
      : 'Unscheduled';

  const updated: EquipmentItem = {
    ...nextState.items[targetIdx],
    ...validation.cleaned,
    nextFreeSlot: derivedNext,
  };
  nextState.items[targetIdx] = updated;

  return { ok: true, data: updated, nextState };
}

export function deleteItem(
  role: UserRole,
  itemId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = DEFAULT_REFERENCE_DATE
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.items.find((i) => i.id === itemId);
  if (!target) {
    return { ok: false, error: 'Equipment item not found.' };
  }

  const dependents = getDependents({ type: 'item', id: itemId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    return {
      ok: false,
      error:
        option === 'cancel'
          ? 'Deletion canceled; equipment item, bookings, and requests were kept.'
          : `Cannot delete "${target.name}" without resolving ${dependents.totalCount} active booking(s) or request(s).`,
      dependents,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const removedItemIds = new Set([itemId]);
  nextState.items = nextState.items.filter((i) => i.id !== itemId);
  nextState.slots = nextState.slots.filter((s) => s.itemId !== itemId);
  nextState.requests = sanitizeAffectedRequests(
    nextState.requests,
    new Set(),
    removedItemIds,
    `Automatic update: "${target.name}" was removed from the catalog. Please pick an alternative instrument.`,
    referenceDate
  );

  return { ok: true, data: target, dependents, nextState };
}

/**
 * Create one-hour slots between startTime and endTime inside Mon–Sat 09:00–17:00 lab hours.
 */
export function addSlots(
  role: UserRole,
  input: AddSlotsInput,
  snapshot: CatalogSnapshot,
  referenceDate = DEFAULT_REFERENCE_DATE
): CatalogMutationResult<TimeSlot[]> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const fieldErrors: Record<string, string> = {};
  const itemIdx = snapshot.items.findIndex((i) => i.id === input.itemId);
  if (itemIdx === -1) {
    fieldErrors.itemId = 'Select an existing equipment item.';
  }

  const parsedDate = parseIsoDateUtc((input.date ?? '').trim());
  if (!parsedDate) {
    fieldErrors.date = 'Choose a valid date (YYYY-MM-DD).';
  } else {
    if (input.date < referenceDate) {
      fieldErrors.date = `Past dates before ${referenceDate} cannot be scheduled.`;
    } else if (parsedDate.getUTCDay() === 0) {
      fieldErrors.date = 'Campus labs are closed on Sunday (hours are Mon–Sat).';
    }
  }

  const startHour = parseHour((input.startTime ?? '').trim());
  const endHour = parseHour((input.endTime ?? '').trim());
  if (!Number.isFinite(startHour) || !Number.isInteger(startHour)) {
    fieldErrors.startTime = 'Choose a valid whole-hour start time (e.g., 09:00).';
  }
  if (!Number.isFinite(endHour) || !Number.isInteger(endHour)) {
    fieldErrors.endTime = 'Choose a valid whole-hour end time (e.g., 12:00).';
  }

  if (
    Number.isFinite(startHour) &&
    Number.isFinite(endHour) &&
    Number.isInteger(startHour) &&
    Number.isInteger(endHour)
  ) {
    if (startHour < LAB_START_HOUR || endHour > LAB_END_HOUR) {
      fieldErrors.startTime = 'Slots must fall within Mon–Sat lab hours (09:00 to 17:00).';
    } else if (endHour <= startHour) {
      fieldErrors.endTime = 'End time must be at least 1 hour after start time.';
    }
  }

  if (Object.keys(fieldErrors).length === 0) {
    // Reject overlaps against any existing slot (free or booked) on the same item and date.
    const occupiedHours = new Set<number>();
    for (const slot of snapshot.slots) {
      if (slot.itemId !== input.itemId || slot.date !== input.date) continue;
      const range = parseTimeRangeForSlot(slot);
      if (range) {
        for (let h = range.startHour; h < range.endHour; h += 1) {
          occupiedHours.add(h);
        }
      }
    }

    for (let h = startHour; h < endHour; h += 1) {
      if (occupiedHours.has(h)) {
        fieldErrors.startTime = `Hour ${formatHour(h)} already has a slot on ${input.date}.`;
        break;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstMsg = Object.values(fieldErrors)[0];
    return { ok: false, error: firstMsg, fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingSlotIds = new Set(nextState.slots.map((s) => s.id));
  const created: TimeSlot[] = [];

  for (let h = startHour; h < endHour; h += 1) {
    const start = formatHour(h);
    const end = formatHour(h + 1);
    const id = generateUniqueId(
      'sl',
      `${input.itemId}-${input.date}-${h}`,
      existingSlotIds
    );
    existingSlotIds.add(id);
    const slot: TimeSlot = {
      id,
      itemId: input.itemId,
      date: input.date,
      window: `${start} – ${end}`,
      durationHours: 1,
      booked: false,
      bookedBy: null,
      note: '',
      start,
      end,
      status: 'free',
      requestId: null,
    };
    nextState.slots.push(slot);
    created.push(slot);
  }

  nextState.items[itemIdx] = deriveItemStatusFromSlots(
    nextState.items[itemIdx],
    nextState.slots
  );

  return { ok: true, data: created, nextState };
}

/**
 * Delete a free slot directly; booked slots are refused unless option === 'cancelAffected'.
 */
export function deleteSlot(
  role: UserRole,
  slotId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = DEFAULT_REFERENCE_DATE
): CatalogMutationResult<TimeSlot> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.slots.find((s) => s.id === slotId);
  if (!target) {
    return { ok: false, error: 'Time slot not found.' };
  }

  if (target.booked && option !== 'cancelAffected') {
    const dependents = getDependents({ type: 'slot', id: slotId }, snapshot);
    return {
      ok: false,
      error:
        option === 'cancel'
          ? 'Slot removal canceled; existing booking was kept.'
          : `Only free slots can be deleted directly (${target.date} ${target.window} is booked by ${target.bookedBy ?? 'a student'}).`,
      dependents,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  nextState.slots = nextState.slots.filter((s) => s.id !== slotId);

  if (target.booked && target.requestId) {
    nextState.requests = nextState.requests.map((req) =>
      req.id === target.requestId && isBlockingRequestStatus(req.status)
        ? {
            ...req,
            status: 'Changes requested',
            facultyNote: `Automatic update: booked slot ${target.date} (${target.window}) was removed by faculty admin.`,
            reviewedAt: referenceDate,
          }
        : req
    );
  }

  nextState.items = nextState.items.map((item) =>
    item.id === target.itemId
      ? deriveItemStatusFromSlots(item, nextState.slots)
      : item
  );

  return { ok: true, data: target, nextState };
}
