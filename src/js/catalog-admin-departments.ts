/**
 * Pure faculty-guarded CRUD operations for academic departments.
 */
import { getDependents } from './catalog-admin-dependents';
import {
  assertFaculty,
  cloneSnapshot,
  generateUniqueId,
  sanitizeAffectedRequests,
} from './catalog-admin-helpers';
import type {
  CatalogMutationResult,
  CatalogSnapshot,
  DeleteOption,
  DepartmentInput,
} from './catalog-admin-types';
import { validateDepartmentFields } from './catalog-admin-validators';
import { LAB_SCHEDULE } from './constants';
import type { Department, UserRole } from './types';

/**
 * Adds a new academic department to the catalog when invoked by faculty.
 *
 * @param role - Active user role.
 * @param input - New department fields.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result containing created department and updated snapshot.
 */
export function addDepartment(
  role: UserRole,
  input: DepartmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateDepartmentFields(input, snapshot.departments);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
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

/**
 * Updates an existing academic department in the catalog.
 *
 * @param role - Active user role.
 * @param departmentId - Target department ID.
 * @param input - Updated department fields.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result with updated department and next catalog state.
 */
export function editDepartment(
  role: UserRole,
  departmentId: string,
  input: DepartmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.departments.findIndex((d) => d.id === departmentId);
  if (targetIdx === -1) return { ok: false, error: 'Subject/department not found.' };

  const validation = validateDepartmentFields(input, snapshot.departments, departmentId);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const updated: Department = { id: departmentId, ...validation.cleaned };
  nextState.departments[targetIdx] = updated;
  return { ok: true, data: updated, nextState };
}

/**
 * Deletes a department after checking or resolving cascade-dependent records.
 *
 * @param role - Active user role.
 * @param departmentId - Department ID to delete.
 * @param snapshot - Current catalog snapshot.
 * @param option - Cascade confirmation mode (`'cancelAffected'` or `'cancel'`).
 * @param referenceDate - Reference ISO date recorded on sanitized requests.
 * @returns Mutation result containing dependent counts and next catalog state.
 */
export function deleteDepartment(
  role: UserRole,
  departmentId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): CatalogMutationResult<Department> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.departments.find((d) => d.id === departmentId);
  if (!target) return { ok: false, error: 'Subject/department not found.' };

  const dependents = getDependents({ type: 'department', id: departmentId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    const cancelMsg = 'Deletion canceled; existing labs, equipment, or requests were kept.';
    const blockMsg = `Cannot delete "${target.name}" without resolving ${dependents.totalCount} dependent record(s).`;
    return { ok: false, error: option === 'cancel' ? cancelMsg : blockMsg, dependents };
  }

  const nextState = cloneSnapshot(snapshot);
  const removedLabIds = new Set(dependents.childLabs.map((l) => l.id));
  const removedItemIds = new Set(dependents.childItems.map((i) => i.id));
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
    new Set([departmentId]),
    removedItemIds,
    `Automatic update: "${target.name}" was removed from the campus catalog. Please select active lab equipment.`,
    referenceDate
  );
  return { ok: true, data: target, dependents, nextState };
}
