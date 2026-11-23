/**
 * Pure helper utilities shared across catalog administration modules.
 */
import type { CatalogSnapshot } from './catalog-admin-types';
import { FACULTY_GUARD_ERROR, ROLES } from './constants';
import { parseHour } from './scheduler';
import type {
  AccessRequest,
  AvailabilityStatus,
  EquipmentItem,
  TimeSlot,
  UserRole,
} from './types';

/**
 * Checks whether the active demo role is faculty before allowing catalog mutations.
 *
 * @param role - Current active user role.
 * @returns Error message string if unauthorized, or null when permitted.
 */
export function assertFaculty(role: UserRole): string | null {
  return role === ROLES.FACULTY ? null : FACULTY_GUARD_ERROR;
}

/**
 * Deep-clones a catalog snapshot so pure CRUD functions never mutate caller state.
 *
 * @param snapshot - Source catalog snapshot.
 * @returns Independent shallow-cloned collections snapshot.
 */
export function cloneSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
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

/**
 * Generates a unique kebab-case identifier with numeric collision suffixing.
 *
 * @param prefix - Domain prefix (`dept`, `lab`, `eq`, `sl`).
 * @param seedText - Human label or slug seed.
 * @param existingIds - Set of existing IDs to avoid colliding with.
 * @returns Unique identifier string.
 */
export function generateUniqueId(
  prefix: string,
  seedText: string,
  existingIds: Set<string>
): string {
  const base = `${prefix}-${slugify(seedText)}`;
  if (!existingIds.has(base)) return base;
  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

/**
 * Parses explicit `start`/`end` fields or a formatted `HH:MM – HH:MM` slot window.
 *
 * @param slot - Time slot record.
 * @returns Integer hour bounds, or null when malformed.
 */
export function parseTimeRangeForSlot(slot: TimeSlot): { startHour: number; endHour: number } | null {
  if (slot.start && slot.end) {
    const startHour = parseHour(slot.start);
    const endHour = parseHour(slot.end);
    if (Number.isFinite(startHour) && Number.isFinite(endHour)) return { startHour, endHour };
  }
  const match = slot.window.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const startHour = parseHour(match[1]);
  const endHour = parseHour(match[2]);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  return { startHour, endHour };
}

/**
 * Derives a compact display string for the earliest open slot on an item.
 *
 * @param itemId - Target equipment ID.
 * @param slots - Current schedule slots.
 * @returns Display label (`MM-DD · HH:00`, `Waitlist open`, or `Unscheduled`).
 */
export function deriveNextFreeSlot(itemId: string, slots: TimeSlot[]): string {
  const itemSlots = slots.filter((s) => s.itemId === itemId);
  if (itemSlots.length === 0) return 'Unscheduled';

  const openSlots = itemSlots
    .filter((s) => !s.booked)
    .sort((a, b) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : (a.start ?? a.window).localeCompare(b.start ?? b.window)
    );
  if (openSlots.length === 0) return 'Waitlist open';

  const first = openSlots[0];
  const timePart = first.start ?? first.window.split(' ')[0] ?? '09:00';
  return `${first.date.slice(5)} · ${timePart}`;
}

/**
 * Recomputes an equipment item's status and next free slot label from its slot records.
 *
 * @param item - Target equipment record.
 * @param slots - Updated schedule slots.
 * @returns Updated equipment record copy.
 */
export function deriveItemStatusFromSlots(item: EquipmentItem, slots: TimeSlot[]): EquipmentItem {
  const itemSlots = slots.filter((s) => s.itemId === item.id);
  if (itemSlots.length === 0) return { ...item, nextFreeSlot: 'Unscheduled' };
  const openCount = itemSlots.filter((s) => !s.booked).length;
  const status: AvailabilityStatus =
    openCount === 0 ? 'Booked' : openCount === 1 ? 'Limited' : 'Available';
  return { ...item, status, nextFreeSlot: deriveNextFreeSlot(item.id, slots) };
}

/**
 * Checks whether an access request is still active/blocking with respect to catalog deletion.
 *
 * @param status - Request workflow status.
 * @returns True for Submitted, Under review, or Approved requests.
 */
export function isBlockingRequestStatus(status: AccessRequest['status']): boolean {
  return status === 'Submitted' || status === 'Under review' || status === 'Approved';
}

/**
 * Updates active requests that referenced deleted departments or equipment to `Changes requested`.
 *
 * @param requests - Existing requests collection.
 * @param removedDeptIds - Deleted department IDs.
 * @param removedItemIds - Deleted equipment item IDs.
 * @param automaticReason - Explanatory note recorded on flagged requests.
 * @param referenceDate - Reference ISO date for `reviewedAt`.
 * @returns Sanitized requests array.
 */
export function sanitizeAffectedRequests(
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
    if (!referencesRemovedDept && !referencesRemovedItem) return req;

    const remainingIds = (req.itemIds ?? (req.itemId ? [req.itemId] : [])).filter(
      (id) => !removedItemIds.has(id)
    );
    const shouldFlag = isBlockingRequestStatus(req.status);
    return {
      ...req,
      departmentId: referencesRemovedDept ? '' : req.departmentId,
      itemId: remainingIds[0] ?? '',
      itemIds: remainingIds,
      status: shouldFlag ? 'Changes requested' : req.status,
      facultyNote: shouldFlag ? automaticReason : req.facultyNote,
      reviewedAt: shouldFlag ? referenceDate : req.reviewedAt,
    };
  });
}
