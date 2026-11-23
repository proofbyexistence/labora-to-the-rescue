/**
 * Read-only query selectors against the active catalog store state.
 */
import { getStoreState } from './lab-store';
import type {
  AccessRequest,
  CampusUser,
  Department,
  EquipmentItem,
  ItemFilters,
  Lab,
  RequestFilters,
  TimeSlot,
} from './types';

/**
 * Returns shallow clones of all departments in the store.
 *
 * @returns Array of department records.
 */
export function getDepartments(): Department[] {
  return getStoreState().dataset.departments.map((dept) => ({ ...dept }));
}

/**
 * Returns shallow clones of labs optionally scoped to a department.
 *
 * @param departmentId - Optional department ID filter.
 * @returns Matching lab records.
 */
export function getLabs(departmentId?: string): Lab[] {
  const { labs } = getStoreState().dataset;
  const scoped = departmentId ? labs.filter((lab) => lab.departmentId === departmentId) : labs;
  return scoped.map((lab) => ({ ...lab }));
}

/**
 * Returns shallow clones of equipment items matching optional facet/query filters.
 *
 * @param filters - Optional department, lab, type, status, access level, or search query.
 * @returns Matching equipment records.
 */
export function getItems(filters: ItemFilters = {}): EquipmentItem[] {
  const query = (filters.query ?? '').trim().toLowerCase();
  return getStoreState()
    .dataset.items.filter((item) => {
      if (filters.departmentId && item.departmentId !== filters.departmentId) return false;
      if (filters.labId && item.labId !== filters.labId) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.accessLevel && item.accessLevel !== filters.accessLevel) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.specs} ${item.location} ${item.type}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((item) => ({ ...item }));
}

/**
 * Looks up a single equipment item by ID.
 *
 * @param itemId - Equipment item ID.
 * @returns Shallow copy of the item, or undefined if missing.
 */
export function getItemById(itemId: string): EquipmentItem | undefined {
  const found = getStoreState().dataset.items.find((item) => item.id === itemId);
  return found ? { ...found } : undefined;
}

/**
 * Returns all schedule slots assigned to a specific equipment item.
 *
 * @param itemId - Equipment item ID.
 * @returns Array of shallow-cloned time slots for `itemId`.
 */
export function getSlots(itemId: string): TimeSlot[] {
  return getStoreState()
    .dataset.slots.filter((s) => s.itemId === itemId)
    .map((s) => ({ ...s }));
}

/**
 * Returns shallow clones of every slot in the store.
 *
 * @returns All time slots across equipment items.
 */
export function getAllSlots(): TimeSlot[] {
  return getStoreState().dataset.slots.map((slot) => ({ ...slot }));
}

/**
 * Returns access requests filtered by status, department, or student.
 *
 * @param filters - Optional status, department ID, or student name filter.
 * @returns Matching access request copies.
 */
export function getRequests(filters: RequestFilters = {}): AccessRequest[] {
  return getStoreState()
    .dataset.requests.filter((req) => {
      if (filters.status && req.status !== filters.status) return false;
      if (filters.departmentId && req.departmentId !== filters.departmentId) return false;
      if (filters.student && req.student !== filters.student) return false;
      return true;
    })
    .map((req) => ({ ...req }));
}

/**
 * Returns the active demo user profile (`student` or `faculty`).
 *
 * @returns Copy of the current `CampusUser` profile.
 */
export function getCurrentUser(): CampusUser {
  const { dataset, activeRole } = getStoreState();
  return { ...dataset.users[activeRole] };
}
