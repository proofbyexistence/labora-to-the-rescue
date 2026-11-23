/**
 * Pure summary aggregation helper for the Home notebook spread KPI strip and subject cards.
 */
import { getDepartments, getItems, getLabs, getRequests } from './lab-data';
import { isPendingStatus } from './requests';
import type { Department, EquipmentItem, Lab } from './types';

export interface DepartmentCounts {
  labs: number;
  items: number;
  available: number;
}

export interface HomeSummaryData {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  availableItems: EquipmentItem[];
  pendingCount: number;
  departmentNameMap: Map<string, string>;
  labNameMap: Map<string, string>;
  featuredItems: EquipmentItem[];
  deptStatsMap: Map<string, DepartmentCounts>;
}

/**
 * Aggregates campus department counts, available equipment, and pending request count.
 *
 * @returns Precomputed maps and lists consumed by `HomePage` and `HomeDepartmentGrid`.
 */
export function buildHomeSummaryData(): HomeSummaryData {
  const departments = getDepartments();
  const labs = getLabs();
  const items = getItems();
  const availableItems = items.filter((item) => item.status === 'Available');
  const pendingCount = getRequests().filter((req) => isPendingStatus(req.status)).length;
  const deptStatsMap = new Map<string, DepartmentCounts>();

  for (const dept of departments) deptStatsMap.set(dept.id, { labs: 0, items: 0, available: 0 });
  for (const lab of labs) {
    const entry = deptStatsMap.get(lab.departmentId);
    if (entry) entry.labs += 1;
  }
  for (const item of items) {
    const entry = deptStatsMap.get(item.departmentId);
    if (entry) {
      entry.items += 1;
      if (item.status === 'Available') entry.available += 1;
    }
  }

  return {
    departments,
    labs,
    items,
    availableItems,
    pendingCount,
    departmentNameMap: new Map(departments.map((d) => [d.id, d.name])),
    labNameMap: new Map(labs.map((l) => [l.id, l.name])),
    featuredItems: availableItems.slice(0, 6),
    deptStatsMap,
  };
}
