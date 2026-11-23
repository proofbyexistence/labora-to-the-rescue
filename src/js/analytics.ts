import { isPendingStatus } from './requests';
import { DEFAULT_REFERENCE_DATE, detectConflicts } from './scheduler';
import type { AccessRequest, EquipmentItem, Lab, TimeSlot } from './types';

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

function addDaysIso(isoDate: string, offsetDays: number): string {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Compute booked hours vs scheduled capacity percentage per lab.
 * Works with or without an explicit `labs` metadata array.
 */
export function getUtilizationByLab(
  slots: TimeSlot[],
  items: EquipmentItem[],
  labs: Lab[] = []
): LabUtilizationStat[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const labMeta = new Map(labs.map((lab) => [lab.id, lab]));

  const totals = new Map<
    string,
    { bookedHours: number; capacityHours: number; departmentId: string }
  >();

  // Preserve lab order from metadata first, then any additional labs present on items.
  for (const lab of labs) {
    totals.set(lab.id, {
      bookedHours: 0,
      capacityHours: 0,
      departmentId: lab.departmentId,
    });
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

  for (const slot of slots) {
    const item = itemById.get(slot.itemId);
    if (!item) continue;
    const entry = totals.get(item.labId);
    if (!entry) continue;

    const hours = Math.max(0, Number(slot.durationHours) || 0);
    entry.capacityHours += hours;
    if (slot.booked) {
      entry.bookedHours += hours;
    }
  }

  const results: LabUtilizationStat[] = [];
  for (const [labId, stat] of totals.entries()) {
    const meta = labMeta.get(labId);
    const utilizationPct =
      stat.capacityHours > 0
        ? Math.min(100, Math.round((stat.bookedHours / stat.capacityHours) * 100))
        : 0;
    results.push({
      labId,
      labName: meta?.name ?? labId,
      room: meta?.room ?? '',
      departmentId: meta?.departmentId ?? stat.departmentId,
      bookedHours: Number(stat.bookedHours.toFixed(1)),
      capacityHours: Number(stat.capacityHours.toFixed(1)),
      utilizationPct,
    });
  }

  return results;
}

/**
 * Return the `limit` lowest-utilization items sorted deterministically.
 */
export function getUnderusedItems(
  items: EquipmentItem[],
  slots: TimeSlot[],
  limit = 3
): UnderusedItemStat[] {
  const statsByItem = new Map<string, { bookedHours: number; capacityHours: number }>();
  for (const item of items) {
    statsByItem.set(item.id, { bookedHours: 0, capacityHours: 0 });
  }

  for (const slot of slots) {
    const entry = statsByItem.get(slot.itemId);
    if (!entry) continue;
    const hours = Math.max(0, Number(slot.durationHours) || 0);
    entry.capacityHours += hours;
    if (slot.booked) {
      entry.bookedHours += hours;
    }
  }

  const ranked: UnderusedItemStat[] = items.map((item) => {
    const entry = statsByItem.get(item.id) ?? { bookedHours: 0, capacityHours: 0 };
    const utilizationPct =
      entry.capacityHours > 0
        ? Math.min(100, Math.round((entry.bookedHours / entry.capacityHours) * 100))
        : 0;
    return {
      item,
      bookedHours: Number(entry.bookedHours.toFixed(1)),
      capacityHours: Number(entry.capacityHours.toFixed(1)),
      utilizationPct,
    };
  });

  ranked.sort((a, b) => {
    if (a.utilizationPct !== b.utilizationPct) {
      return a.utilizationPct - b.utilizationPct;
    }
    if (a.bookedHours !== b.bookedHours) {
      return a.bookedHours - b.bookedHours;
    }
    return a.item.id.localeCompare(b.item.id);
  });

  return ranked.slice(0, Math.max(0, limit));
}

/**
 * Compute high-level faculty dashboard KPIs from requests and slots.
 */
export function getSummary(
  requests: AccessRequest[],
  slots: TimeSlot[],
  items: EquipmentItem[] = [],
  referenceDate = DEFAULT_REFERENCE_DATE
): LabAnalyticsSummary {
  const pendingCount = requests.filter((req) => isPendingStatus(req.status)).length;

  const weekAgoIso = addDaysIso(referenceDate, -7);
  const approvedThisWeek = requests.filter((req) => {
    if (req.status !== 'Approved') return false;
    const activityDate = req.reviewedAt ?? req.submittedAt;
    return activityDate >= weekAgoIso;
  }).length;

  const openConflicts = detectConflicts(requests, slots).length;

  const allowedIds = items.length > 0 ? new Set(items.map((i) => i.id)) : null;
  let bookedHours = 0;
  let capacityHours = 0;
  for (const slot of slots) {
    if (allowedIds && !allowedIds.has(slot.itemId)) continue;
    const hrs = Math.max(0, Number(slot.durationHours) || 0);
    capacityHours += hrs;
    if (slot.booked) {
      bookedHours += hrs;
    }
  }

  const overallUtilizationPct =
    capacityHours > 0
      ? Math.min(100, Math.round((bookedHours / capacityHours) * 100))
      : 0;

  return {
    pendingCount,
    approvedThisWeek,
    openConflicts,
    overallUtilizationPct,
  };
}
