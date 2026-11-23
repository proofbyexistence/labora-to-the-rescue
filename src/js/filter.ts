/**
 * Pure equipment catalog filtering, pagination, and URL state re-exports.
 */
import { LIMITS } from './constants';
import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
} from './types';

export type { AppPageId, ParsedHashState } from './url-state';
export { parseHashState, parseUrlState, serializeHashState } from './url-state';

export interface DiscoverFilterCriteria {
  query?: string;
  departmentId?: string;
  labId?: string;
  type?: EquipmentType | '';
  status?: AvailabilityStatus | '';
  accessLevel?: AccessLevel | '';
}

export interface FilterContext {
  departments?: Department[];
  labs?: Lab[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

let lastFilterCache: {
  items: EquipmentItem[];
  departments: Department[] | undefined;
  labs: Lab[] | undefined;
  query: string;
  departmentId: string;
  labId: string;
  type: string;
  status: string;
  accessLevel: string;
  result: EquipmentItem[];
} | null = null;

function itemMatchesCriteria(
  item: EquipmentItem,
  normalized: Required<DiscoverFilterCriteria>,
  deptById: Map<string, Department>,
  labById: Map<string, Lab>
): boolean {
  if (normalized.departmentId && item.departmentId !== normalized.departmentId) return false;
  if (normalized.labId && item.labId !== normalized.labId) return false;
  if (normalized.type && item.type !== normalized.type) return false;
  if (normalized.status && item.status !== normalized.status) return false;
  if (normalized.accessLevel && item.accessLevel !== normalized.accessLevel) return false;
  if (!normalized.query) return true;

  const dept = deptById.get(item.departmentId);
  const lab = labById.get(item.labId);
  const searchable = [
    item.name,
    item.type,
    item.specs,
    item.location,
    dept?.name ?? '',
    dept?.code ?? '',
    lab?.name ?? '',
    lab?.room ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return searchable.includes(normalized.query);
}

/**
 * Filters catalog equipment without touching the DOM and memoizes the latest filter tuple.
 *
 * @param items - Full equipment catalog.
 * @param criteria - Optional text search and facet filters.
 * @param context - Department and lab metadata used when matching search text.
 * @returns Filtered shallow copy of matching equipment items.
 */
export function filterItems(
  items: EquipmentItem[],
  criteria: DiscoverFilterCriteria = {},
  context: FilterContext = {}
): EquipmentItem[] {
  const normalized: Required<DiscoverFilterCriteria> = {
    query: (criteria.query ?? '').trim().toLowerCase(),
    departmentId: criteria.departmentId ?? '',
    labId: criteria.labId ?? '',
    type: criteria.type ?? '',
    status: criteria.status ?? '',
    accessLevel: criteria.accessLevel ?? '',
  };

  if (
    lastFilterCache &&
    lastFilterCache.items === items &&
    lastFilterCache.departments === context.departments &&
    lastFilterCache.labs === context.labs &&
    lastFilterCache.query === normalized.query &&
    lastFilterCache.departmentId === normalized.departmentId &&
    lastFilterCache.labId === normalized.labId &&
    lastFilterCache.type === normalized.type &&
    lastFilterCache.status === normalized.status &&
    lastFilterCache.accessLevel === normalized.accessLevel
  ) {
    return lastFilterCache.result.slice();
  }

  const deptById = new Map((context.departments ?? []).map((d) => [d.id, d]));
  const labById = new Map((context.labs ?? []).map((l) => [l.id, l]));
  const result = items.filter((item) => itemMatchesCriteria(item, normalized, deptById, labById));

  lastFilterCache = { items, departments: context.departments, labs: context.labs, ...normalized, result };
  return result.slice();
}

/**
 * Paginates an item slice safely within `[1, totalPages]`.
 *
 * @param items - Pre-filtered array of items.
 * @param requestedPage - 1-based requested page number.
 * @param pageSize - Number of entries per page.
 * @returns Slice and clamped pagination metadata.
 */
export function paginateItems<T>(
  items: T[],
  requestedPage = 1,
  pageSize = LIMITS.CATALOG_PAGE_SIZE
): PaginatedResult<T> {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const parsedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(Math.max(1, parsedPage), totalPages);
  const start = (page - 1) * safeSize;

  return {
    items: items.slice(start, start + safeSize),
    page,
    pageSize: safeSize,
    totalItems,
    totalPages,
  };
}
