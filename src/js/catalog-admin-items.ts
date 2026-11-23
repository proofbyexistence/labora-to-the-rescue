/**
 * Pure faculty-guarded CRUD operations for equipment catalog items.
 */
import { getDependents } from './catalog-admin-dependents';
import {
  assertFaculty,
  cloneSnapshot,
  deriveNextFreeSlot,
  generateUniqueId,
  sanitizeAffectedRequests,
} from './catalog-admin-helpers';
import type {
  CatalogMutationResult,
  CatalogSnapshot,
  DeleteOption,
  EquipmentInput,
} from './catalog-admin-types';
import { validateEquipmentFields } from './catalog-admin-validators';
import { LAB_SCHEDULE } from './constants';
import type { EquipmentItem, UserRole } from './types';

/**
 * Adds a new equipment item to a verified laboratory and department.
 *
 * @param role - Active user role.
 * @param input - Candidate equipment attributes.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result containing created item and updated snapshot.
 */
export function addItem(
  role: UserRole,
  input: EquipmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const validation = validateEquipmentFields(input, snapshot);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
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

/**
 * Edits an existing equipment item while keeping its derived next-slot display consistent.
 *
 * @param role - Active user role.
 * @param itemId - Equipment item ID to update.
 * @param input - Updated equipment fields.
 * @param snapshot - Current catalog snapshot.
 * @returns Mutation result containing updated item and snapshot.
 */
export function editItem(
  role: UserRole,
  itemId: string,
  input: EquipmentInput,
  snapshot: CatalogSnapshot
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const targetIdx = snapshot.items.findIndex((i) => i.id === itemId);
  if (targetIdx === -1) return { ok: false, error: 'Equipment item not found.' };

  const validation = validateEquipmentFields(input, snapshot, itemId);
  if (!validation.ok) {
    return {
      ok: false,
      error: Object.values(validation.fieldErrors)[0],
      fieldErrors: validation.fieldErrors,
    };
  }

  const nextState = cloneSnapshot(snapshot);
  const hasSlots = nextState.slots.some((s) => s.itemId === itemId);
  const updated: EquipmentItem = {
    ...nextState.items[targetIdx],
    ...validation.cleaned,
    nextFreeSlot: hasSlots ? deriveNextFreeSlot(itemId, nextState.slots) : 'Unscheduled',
  };
  nextState.items[targetIdx] = updated;
  return { ok: true, data: updated, nextState };
}

/**
 * Deletes an equipment item after checking or clearing dependent bookings and requests.
 *
 * @param role - Active user role.
 * @param itemId - Target equipment item ID.
 * @param snapshot - Current catalog snapshot.
 * @param option - Cascade confirmation mode (`'cancelAffected'` or `'cancel'`).
 * @param referenceDate - Reference ISO date recorded on sanitized requests.
 * @returns Mutation result containing deleted item, dependent summary, and updated snapshot.
 */
export function deleteItem(
  role: UserRole,
  itemId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): CatalogMutationResult<EquipmentItem> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.items.find((i) => i.id === itemId);
  if (!target) return { ok: false, error: 'Equipment item not found.' };

  const dependents = getDependents({ type: 'item', id: itemId }, snapshot);
  if (dependents.totalCount > 0 && option !== 'cancelAffected') {
    const cancelMsg = 'Deletion canceled; equipment item, bookings, and requests were kept.';
    const blockMsg = `Cannot delete "${target.name}" without resolving ${dependents.totalCount} active booking(s) or request(s).`;
    return { ok: false, error: option === 'cancel' ? cancelMsg : blockMsg, dependents };
  }

  const nextState = cloneSnapshot(snapshot);
  nextState.items = nextState.items.filter((i) => i.id !== itemId);
  nextState.slots = nextState.slots.filter((s) => s.itemId !== itemId);
  nextState.requests = sanitizeAffectedRequests(
    nextState.requests,
    new Set(),
    new Set([itemId]),
    `Automatic update: "${target.name}" was removed from the catalog. Please pick an alternative instrument.`,
    referenceDate
  );
  return { ok: true, data: target, dependents, nextState };
}
