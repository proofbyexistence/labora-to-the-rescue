/**
 * Pure lab utilization percentages, underused-item ranking, and summary KPI calculations.
 */
import { LAB_SCHEDULE } from './constants';
import { isPendingStatus } from './requests';
import { detectConflicts } from './scheduler';
import type { AccessRequest, EquipmentItem, Lab, TimeSlot } from './types';
import { addDaysIso } from './validation';

export interface LabUtilizationStat {
  labId: string;
  labName: string;
  room: string;
  departmentId: string;
  bookedHours: number;
  capacityHours: number;
  utilizationPct: number;
}

export interface UnderusedItemStat {
  item: EquipmentItem;
  bookedHours: number;
  capacityHours: number;
  utilizationPct: number;
}

export interface LabAnalyticsSummary {
  pendingCount: number;
  approvedThisWeek: number;
  openConflicts: number;
  overallUtilizationPct: number;
}

function calcUtilizationPct(bookedHours: number, capacityHours: number): number {
  return capacityHours > 0
    ? Math.min(100, Math.round((bookedHours / capacityHours) * 100))
    : 0;
}

function initializeLabTotals(
  labs: Lab[],
  items: EquipmentItem[]
): Map<string, { bookedHours: number; capacityHours: number; departmentId: string }> {
  const totals = new Map<
    string,
    { bookedHours: number; capacityHours: number; departmentId: string }
  >();
  // Preserve lab metadata order first before adding any orphaned item lab IDs.
  for (const lab of labs) {
    totals.set(lab.id, { bookedHours: 0, capacityHours: 0, departmentId: lab.departmentId });
  }
  for (const item of items) {
    if (!totals.has(item.labId)) {
      totals.set(item.labId, {
        bookedHours: 0,
        capacityHours: 0,
        departmentId: item.departmentId,
      });
    }
  }
  return totals;
}

/**
 * Computes booked hours vs scheduled capacity percentage per laboratory.
 *
 * @param slots - All time slot records.
 * @param items - Equipment catalog items.
 * @param labs - Optional lab metadata records for names, rooms, and display order.
 * @returns Per-lab utilization statistics.
 */
export function getUtilizationByLab(
  slots: TimeSlot[],
  items: EquipmentItem[],
  labs: Lab[] = []
): LabUtilizationStat[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const labMeta = new Map(labs.map((lab) => [lab.id, lab]));
  const totals = initializeLabTotals(labs, items);

  for (const slot of slots) {
    const item = itemById.get(slot.itemId);
    const entry = item ? totals.get(item.labId) : undefined;
    if (!entry) continue;

    const hours = Math.max(0, Number(slot.durationHours) || 0);
    entry.capacityHours += hours;
    if (slot.booked) entry.bookedHours += hours;
  }

  return Array.from(totals.entries()).map(([labId, stat]) => {
    const meta = labMeta.get(labId);
    return {
      labId,
      labName: meta?.name ?? labId,
      room: meta?.room ?? '',
      departmentId: meta?.departmentId ?? stat.departmentId,
      bookedHours: Number(stat.bookedHours.toFixed(1)),
      capacityHours: Number(stat.capacityHours.toFixed(1)),
      utilizationPct: calcUtilizationPct(stat.bookedHours, stat.capacityHours),
    };
  });
}

/**
 * Ranks equipment items by lowest utilization percentage for resource balancing.
 *
 * @param items - Equipment catalog items.
 * @param slots - All scheduled time slots.
 * @param limit - Maximum number of underused items to return.
 * @returns Deterministically sorted array of lowest-utilization items.
 */
export function getUnderusedItems(
  items: EquipmentItem[],
  slots: TimeSlot[],
  limit = 3
): UnderusedItemStat[] {
  const statsByItem = new Map<string, { bookedHours: number; capacityHours: number }>();
  for (const item of items) statsByItem.set(item.id, { bookedHours: 0, capacityHours: 0 });

  for (const slot of slots) {
    const entry = statsByItem.get(slot.itemId);
    if (!entry) continue;
    const hours = Math.max(0, Number(slot.durationHours) || 0);
    entry.capacityHours += hours;
    if (slot.booked) entry.bookedHours += hours;
  }

  return items
    .map((item) => {
      const entry = statsByItem.get(item.id) ?? { bookedHours: 0, capacityHours: 0 };
      return {
        item,
        bookedHours: Number(entry.bookedHours.toFixed(1)),
        capacityHours: Number(entry.capacityHours.toFixed(1)),
        utilizationPct: calcUtilizationPct(entry.bookedHours, entry.capacityHours),
      };
    })
    .sort((a, b) => {
      if (a.utilizationPct !== b.utilizationPct) return a.utilizationPct - b.utilizationPct;
      if (a.bookedHours !== b.bookedHours) return a.bookedHours - b.bookedHours;
      return a.item.id.localeCompare(b.item.id);
    })
    .slice(0, Math.max(0, limit));
}

/**
 * Computes high-level faculty dashboard KPIs from requests, slots, and catalog items.
 *
 * @param requests - Access requests in store.
 * @param slots - All time slot records.
 * @param items - Optional equipment items to scope utilization metrics.
 * @param referenceDate - Reference ISO date for "approved this week" window.
 * @returns Summary KPI counts and overall utilization percentage.
 */
export function getSummary(
  requests: AccessRequest[],
  slots: TimeSlot[],
  items: EquipmentItem[] = [],
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): LabAnalyticsSummary {
  const pendingCount = requests.filter((req) => isPendingStatus(req.status)).length;
  const weekAgoIso = addDaysIso(referenceDate, -7);
  const approvedThisWeek = requests.filter((req) => {
    if (req.status !== 'Approved') return false;
    return (req.reviewedAt ?? req.submittedAt) >= weekAgoIso;
  }).length;

  const allowedIds = items.length > 0 ? new Set(items.map((i) => i.id)) : null;
  let bookedHours = 0;
  let capacityHours = 0;
  for (const slot of slots) {
    if (allowedIds && !allowedIds.has(slot.itemId)) continue;
    const hrs = Math.max(0, Number(slot.durationHours) || 0);
    capacityHours += hrs;
    if (slot.booked) bookedHours += hrs;
  }

  return {
    pendingCount,
    approvedThisWeek,
    openConflicts: detectConflicts(requests, slots).length,
    overallUtilizationPct: calcUtilizationPct(bookedHours, capacityHours),
  };
}
