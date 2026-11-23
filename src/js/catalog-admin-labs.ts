/**
 * Pure faculty-guarded CRUD operations for campus laboratories.
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
  LabInput,
} from './catalog-admin-types';
import { validateLabFields } from './catalog-admin-validators';
import { LAB_SCHEDULE } from './constants';
import type { Lab, UserRole } from './types';

/**
 * Adds a new laboratory room under an existing department.
 *
 * @param role - Active user role.
 * @param input - Candidate laboratory fields.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result with created laboratory and updated snapshot.
 */
export function addLab(
  role: UserRole,
  input: LabInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateLabFields(input, snapshot.departments, snapshot.labs);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
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

/**
 * Updates a laboratory record and realigns child items if reassigned to a different department.
 *
 * @param role - Active user role.
 * @param labId - Laboratory ID to edit.
 * @param input - Updated laboratory fields.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result with updated laboratory and updated snapshot.
 */
export function editLab(
  role: UserRole,
  labId: string,
  input: LabInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.labs.findIndex((l) => l.id === labId);
  if (targetIdx === -1) return { ok: false, error: 'Laboratory not found.' };

  const validation = validateLabFields(input, snapshot.departments, snapshot.labs, labId);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const updated: Lab = { id: labId, ...validation.cleaned };
  nextState.labs[targetIdx] = updated;
  nextState.items = nextState.items.map((item) =>
    item.labId === labId ? { ...item, departmentId: updated.departmentId } : item
  );
  return { ok: true, data: updated, nextState };
}

/**
 * Deletes a laboratory after resolving dependent equipment items, bookings, and requests.
 *
 * @param role - Active user role.
 * @param labId - Target laboratory ID.
 * @param snapshot - Current catalog snapshot.
 * @param option - Cascade confirmation mode (`'cancelAffected'` or `'cancel'`).
 * @param referenceDate - Reference ISO date recorded on sanitized requests.
 * @returns Mutation result with deleted lab and updated catalog state.
 */
export function deleteLab(
  role: UserRole,
  labId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): CatalogMutationResult<Lab> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.labs.find((l) => l.id === labId);
  if (!target) return { ok: false, error: 'Laboratory not found.' };

  const dependents = getDependents({ type: 'lab', id: labId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    const cancelMsg = 'Deletion canceled; existing equipment and bookings were kept.';
    const blockMsg = `Cannot delete "${target.name}" without resolving ${dependents.totalCount} dependent record(s).`;
    return { ok: false, error: option === 'cancel' ? cancelMsg : blockMsg, dependents };
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
