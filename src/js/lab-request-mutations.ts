/**
 * Store mutation handlers for access requests, faculty reviews, and catalog admin wrappers.
 */
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
  type DeleteOption,
  type DepartmentInput,
  type DependentReport,
  type EquipmentInput,
  type LabInput,
} from './catalog-admin';
import { ROLES } from './constants';
import { getCurrentUser, getItemById } from './lab-queries';
import {
  commitCatalogResult,
  getCatalogSnapshot,
  getStoreState,
  persistState,
} from './lab-store';
import {
  normalizeSelectedItemIds,
  transitionRequest,
  validateRequest,
  type TransitionResult,
} from './requests';
import { DEFAULT_REFERENCE_DATE } from './scheduler';
import type {
  AccessRequest,
  Department,
  EquipmentItem,
  Lab,
  NewRequestInput,
  RequestStatus,
  TimeSlot,
} from './types';

function resolveSelectedItems(itemIds: string[]): EquipmentItem[] | null {
  const selected = itemIds
    .map((id) => getItemById(id))
    .filter((item): item is EquipmentItem => Boolean(item));
  return selected.length > 0 && selected.length === itemIds.length ? selected : null;
}

/**
 * Validates and submits a new multi-item project access request into persisted store state.
 *
 * @param input - Student access request form payload.
 * @returns Newly created `AccessRequest`, or null if validation fails.
 */
export function submitAccessRequest(input: NewRequestInput): AccessRequest | null {
  const itemIds = normalizeSelectedItemIds(input);
  const selectedItems = resolveSelectedItems(itemIds);
  if (!selectedItems) return null;

  const { dataset } = getStoreState();
  const primaryItem = selectedItems[0];
  const departmentId = input.departmentId || primaryItem.departmentId;
  const subjectCourse = (input.subjectCourse ?? 'LAB 400 · Independent Research').trim();
  const justification = (input.justification ?? 'Requesting scheduled bench access for course research project.').trim();
  const check = validateRequest(
    { ...input, itemIds, departmentId, subjectCourse, justification, trainingConfirmed: input.trainingConfirmed ?? true },
    { departments: dataset.departments, items: dataset.items, referenceDate: DEFAULT_REFERENCE_DATE }
  );
  if (!check.ok) return null;

  const user = getCurrentUser();
  const created: AccessRequest = {
    id: `req-${dataset.requests.length + 101}-${Date.now().toString(36)}`,
    student: user.name,
    studentId: user.id,
    departmentId,
    itemId: primaryItem.id,
    itemIds,
    equipmentNeeded: selectedItems.map((item) => item.name).join(', '),
    project: input.project.trim(),
    subjectCourse,
    deadline: input.deadline,
    status: 'Submitted',
    teamSize: Math.max(1, Number(input.teamSize) || 1),
    hoursNeeded: Math.max(1, Number(input.hoursNeeded) || 1),
    submittedAt: DEFAULT_REFERENCE_DATE,
    justification: (input.justification ?? '').trim(),
    trainingConfirmed: Boolean(input.trainingConfirmed),
    facultyNote: '',
  };
  dataset.requests.unshift(created);
  persistState();
  return { ...created };
}

/**
 * Transitions a single access request using the workflow state machine and active user role.
 *
 * @param requestId - Request ID to transition.
 * @param nextStatus - Target workflow status.
 * @param reason - Review reason or faculty note.
 * @returns Transition outcome, or null if the request ID does not exist.
 */
export function transitionAccessRequest(
  requestId: string,
  nextStatus: RequestStatus,
  reason = ''
): TransitionResult | null {
  const store = getStoreState();
  const idx = store.dataset.requests.findIndex((req) => req.id === requestId);
  if (idx === -1) return null;
  const result = transitionRequest(
    store.dataset.requests[idx],
    nextStatus,
    reason,
    DEFAULT_REFERENCE_DATE,
    store.activeRole
  );
  if (result.ok) {
    store.dataset.requests[idx] = result.request;
    persistState();
  }
  return result;
}

/**
 * Records a faculty approval, rejection, or changes-requested decision on an access request.
 *
 * @param requestId - Target request ID.
 * @param decision - Terminal or revision status decision.
 * @param facultyNote - Decision rationale (required for rejections and change requests).
 * @returns Updated access request, or null when unauthorized or invalid.
 */
export function reviewAccessRequest(
  requestId: string,
  decision: RequestStatus,
  facultyNote: string
): AccessRequest | null {
  const store = getStoreState();
  if (store.activeRole !== ROLES.FACULTY) return null;
  const idx = store.dataset.requests.findIndex((req) => req.id === requestId);
  if (idx === -1) return null;

  let target = store.dataset.requests[idx];
  const needsStep =
    target.status === 'Submitted' &&
    (decision === 'Approved' || decision === 'Rejected' || decision === 'Changes requested');
  if (needsStep) {
    const step = transitionRequest(target, 'Under review', '', DEFAULT_REFERENCE_DATE, store.activeRole);
    if (!step.ok) return null;
    target = step.request;
  }
  const result = transitionRequest(target, decision, facultyNote, DEFAULT_REFERENCE_DATE, store.activeRole);
  if (!result.ok) return null;
  store.dataset.requests[idx] = result.request;
  persistState();
  return { ...result.request };
}

/** Inspects child/dependent records prior to deleting a catalog entity. */
export function getEntityDependents(entity: {
  type: 'department' | 'lab' | 'item' | 'slot';
  id: string;
}): DependentReport {
  return pureGetDependents(entity, getCatalogSnapshot());
}

/** Faculty-guarded store mutation wrapper for adding a department. */
export function adminAddDepartment(input: DepartmentInput): CatalogMutationResult<Department> {
  return commitCatalogResult(pureAddDepartment(getStoreState().activeRole, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for editing a department. */
export function adminEditDepartment(departmentId: string, input: DepartmentInput): CatalogMutationResult<Department> {
  return commitCatalogResult(pureEditDepartment(getStoreState().activeRole, departmentId, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for deleting a department. */
export function adminDeleteDepartment(departmentId: string, option?: DeleteOption): CatalogMutationResult<Department> {
  return commitCatalogResult(pureDeleteDepartment(getStoreState().activeRole, departmentId, getCatalogSnapshot(), option, DEFAULT_REFERENCE_DATE));
}

/** Faculty-guarded store mutation wrapper for adding a lab. */
export function adminAddLab(input: LabInput): CatalogMutationResult<Lab> {
  return commitCatalogResult(pureAddLab(getStoreState().activeRole, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for editing a lab. */
export function adminEditLab(labId: string, input: LabInput): CatalogMutationResult<Lab> {
  return commitCatalogResult(pureEditLab(getStoreState().activeRole, labId, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for deleting a lab. */
export function adminDeleteLab(labId: string, option?: DeleteOption): CatalogMutationResult<Lab> {
  return commitCatalogResult(pureDeleteLab(getStoreState().activeRole, labId, getCatalogSnapshot(), option, DEFAULT_REFERENCE_DATE));
}

/** Faculty-guarded store mutation wrapper for adding an equipment item. */
export function adminAddItem(input: EquipmentInput): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(pureAddItem(getStoreState().activeRole, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for editing an equipment item. */
export function adminEditItem(itemId: string, input: EquipmentInput): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(pureEditItem(getStoreState().activeRole, itemId, input, getCatalogSnapshot()));
}

/** Faculty-guarded store mutation wrapper for deleting an equipment item. */
export function adminDeleteItem(itemId: string, option?: DeleteOption): CatalogMutationResult<EquipmentItem> {
  return commitCatalogResult(pureDeleteItem(getStoreState().activeRole, itemId, getCatalogSnapshot(), option, DEFAULT_REFERENCE_DATE));
}

/** Faculty-guarded store mutation wrapper for creating hourly slots. */
export function adminAddSlots(input: AddSlotsInput): CatalogMutationResult<TimeSlot[]> {
  return commitCatalogResult(pureAddSlots(getStoreState().activeRole, input, getCatalogSnapshot(), DEFAULT_REFERENCE_DATE));
}

/** Faculty-guarded store mutation wrapper for removing a slot. */
export function adminDeleteSlot(slotId: string, option?: DeleteOption): CatalogMutationResult<TimeSlot> {
  return commitCatalogResult(pureDeleteSlot(getStoreState().activeRole, slotId, getCatalogSnapshot(), option, DEFAULT_REFERENCE_DATE));
}
