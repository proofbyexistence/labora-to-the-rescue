/**
 * Pure cascade-dependency scanner for departments, laboratories, equipment items, and slots.
 */
import { isBlockingRequestStatus } from './catalog-admin-helpers';
import type { CatalogSnapshot, DependentReport } from './catalog-admin-types';

function getDepartmentDependents(deptId: string, snapshot: CatalogSnapshot): DependentReport {
  const dept = snapshot.departments.find((d) => d.id === deptId);
  const childLabs = snapshot.labs.filter((l) => l.departmentId === deptId);
  const labIds = new Set(childLabs.map((l) => l.id));
  const childItems = snapshot.items.filter(
    (i) => i.departmentId === deptId || labIds.has(i.labId)
  );
  const itemIds = new Set(childItems.map((i) => i.id));
  const activeBookings = snapshot.slots.filter((s) => s.booked && itemIds.has(s.itemId));
  const affectedRequests = snapshot.requests.filter(
    (req) =>
      isBlockingRequestStatus(req.status) &&
      (req.departmentId === deptId ||
        itemIds.has(req.itemId) ||
        Boolean(req.itemIds?.some((id) => itemIds.has(id))))
  );
  return {
    entityType: 'department',
    entityId: deptId,
    entityLabel: dept?.name ?? deptId,
    childLabs,
    childItems,
    activeBookings,
    affectedRequests,
    totalCount:
      childLabs.length + childItems.length + activeBookings.length + affectedRequests.length,
  };
}

function getLabDependents(labId: string, snapshot: CatalogSnapshot): DependentReport {
  const lab = snapshot.labs.find((l) => l.id === labId);
  const childItems = snapshot.items.filter((i) => i.labId === labId);
  const itemIds = new Set(childItems.map((i) => i.id));
  const activeBookings = snapshot.slots.filter((s) => s.booked && itemIds.has(s.itemId));
  const affectedRequests = snapshot.requests.filter(
    (req) =>
      isBlockingRequestStatus(req.status) &&
      (itemIds.has(req.itemId) || Boolean(req.itemIds?.some((id) => itemIds.has(id))))
  );
  return {
    entityType: 'lab',
    entityId: labId,
    entityLabel: lab?.name ?? labId,
    childLabs: [],
    childItems,
    activeBookings,
    affectedRequests,
    totalCount: childItems.length + activeBookings.length + affectedRequests.length,
  };
}

function getItemDependents(itemId: string, snapshot: CatalogSnapshot): DependentReport {
  const item = snapshot.items.find((i) => i.id === itemId);
  const activeBookings = snapshot.slots.filter((s) => s.booked && s.itemId === itemId);
  const affectedRequests = snapshot.requests.filter(
    (req) =>
      isBlockingRequestStatus(req.status) &&
      (req.itemId === itemId || Boolean(req.itemIds?.includes(itemId)))
  );
  return {
    entityType: 'item',
    entityId: itemId,
    entityLabel: item?.name ?? itemId,
    childLabs: [],
    childItems: [],
    activeBookings,
    affectedRequests,
    totalCount: activeBookings.length + affectedRequests.length,
  };
}

function getSlotDependents(slotId: string, snapshot: CatalogSnapshot): DependentReport {
  const slot = snapshot.slots.find((s) => s.id === slotId);
  const activeBookings = slot && slot.booked ? [slot] : [];
  const affectedRequests =
    slot && slot.booked && slot.requestId
      ? snapshot.requests.filter(
          (req) => req.id === slot.requestId && isBlockingRequestStatus(req.status)
        )
      : [];
  return {
    entityType: 'slot',
    entityId: slotId,
    entityLabel: slot ? `${slot.date} ${slot.window}` : slotId,
    childLabs: [],
    childItems: [],
    activeBookings,
    affectedRequests,
    totalCount: activeBookings.length + affectedRequests.length,
  };
}

/**
 * Collects child labs/items, active bookings, and pending/approved requests referencing an entity.
 *
 * @param entity - Entity type and identifier to inspect.
 * @param snapshot - Current catalog snapshot.
 * @returns Full dependent count and entity lists for cascade delete prompts.
 */
export function getDependents(
  entity: { type: 'department' | 'lab' | 'item' | 'slot'; id: string },
  snapshot: CatalogSnapshot
): DependentReport {
  if (entity.type === 'department') return getDepartmentDependents(entity.id, snapshot);
  if (entity.type === 'lab') return getLabDependents(entity.id, snapshot);
  if (entity.type === 'item') return getItemDependents(entity.id, snapshot);
  return getSlotDependents(entity.id, snapshot);
}
