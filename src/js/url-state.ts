/**
 * Sanitized URL query and hash parsing/serialization for bookmarkable navigation and filters.
 */
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
} from './constants';
import type { DiscoverFilterCriteria } from './filter';
import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
} from './types';

export type AppPageId =
  | 'home'
  | 'discover'
  | 'booking'
  | 'request'
  | 'approvals'
  | 'not-found';

export interface ParsedHashState {
  page: AppPageId;
  filters: Required<DiscoverFilterCriteria>;
  catalogPage: number;
  itemId: string;
}

const VALID_PAGES: AppPageId[] = ['home', 'discover', 'booking', 'request', 'approvals'];

const DEPARTMENT_ALIASES: Record<string, string> = {
  physics: 'dept-physics',
  chemistry: 'dept-chemistry',
  electronics: 'dept-ece',
  ece: 'dept-ece',
  cs: 'dept-cs',
  'computer-science': 'dept-cs',
  mechanical: 'dept-mechanical',
  biotech: 'dept-biotech',
  biotechnology: 'dept-biotech',
  civil: 'dept-civil',
};

const TYPE_ALIASES: Record<string, EquipmentType> = {
  instruments: 'Instruments',
  'dev-kits': 'Development kits',
  'development-kits': 'Development kits',
  workstations: 'Workstations',
  'safety-gear': 'Safety gear',
};

const STATUS_ALIASES: Record<string, AvailabilityStatus> = {
  available: 'Available',
  limited: 'Limited',
  booked: 'Booked',
};

const ACCESS_ALIASES: Record<string, AccessLevel> = {
  open: 'Open',
  'faculty-approval': 'Needs faculty approval',
  'needs-faculty-approval': 'Needs faculty approval',
  training: 'Training required',
  'training-required': 'Training required',
};

function sanitizeQueryText(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
}

function emptyFilters(): Required<DiscoverFilterCriteria> {
  return { query: '', departmentId: '', labId: '', type: '', status: '', accessLevel: '' };
}

function resolvePageAndQuerySegment(cleanedHash: string): {
  page: AppPageId;
  querySegment: string;
} {
  if (cleanedHash.includes('=')) {
    const firstAmp = cleanedHash.indexOf('&');
    const prefix = firstAmp === -1 ? '' : cleanedHash.slice(0, firstAmp);
    if (VALID_PAGES.includes(prefix as AppPageId)) {
      return { page: prefix as AppPageId, querySegment: cleanedHash.slice(firstAmp + 1) };
    }
    // Bare filter hash such as `#dept=electronics` routes directly to Discover.
    return { page: 'discover', querySegment: cleanedHash };
  }
  if (VALID_PAGES.includes(cleanedHash as AppPageId)) {
    return { page: cleanedHash as AppPageId, querySegment: '' };
  }
  if (cleanedHash === 'main-content') {
    return { page: 'home', querySegment: '' };
  }
  return { page: 'not-found', querySegment: '' };
}

function extractValidatedFilters(
  params: URLSearchParams,
  valid: { departments: Department[]; labs: Lab[] }
): Required<DiscoverFilterCriteria> {
  const validDeptIds = new Set(valid.departments.map((d) => d.id));
  const labById = new Map(valid.labs.map((l) => [l.id, l]));

  const rawDept = (params.get('dept') ?? '').trim();
  const mappedDept = DEPARTMENT_ALIASES[rawDept.toLowerCase()] ?? rawDept;
  let departmentId = validDeptIds.has(mappedDept) ? mappedDept : '';

  const matchedLab = labById.get((params.get('lab') ?? '').trim());
  let labId = '';
  if (matchedLab && (!departmentId || matchedLab.departmentId === departmentId)) {
    labId = matchedLab.id;
    departmentId = matchedLab.departmentId;
  }

  const rawType = (params.get('type') ?? '').trim();
  const mappedType = TYPE_ALIASES[rawType.toLowerCase()] ?? rawType;
  const type = EQUIPMENT_TYPES.includes(mappedType as EquipmentType)
    ? (mappedType as EquipmentType)
    : '';

  const rawStatus = (params.get('status') ?? '').trim();
  const mappedStatus = STATUS_ALIASES[rawStatus.toLowerCase()] ?? rawStatus;
  const status = AVAILABILITY_STATUSES.includes(mappedStatus as AvailabilityStatus)
    ? (mappedStatus as AvailabilityStatus)
    : '';

  const rawAccess = (params.get('access') ?? '').trim();
  const mappedAccess = ACCESS_ALIASES[rawAccess.toLowerCase()] ?? rawAccess;
  const accessLevel = ACCESS_LEVELS.includes(mappedAccess as AccessLevel)
    ? (mappedAccess as AccessLevel)
    : '';

  return {
    query: sanitizeQueryText(params.get('q')),
    departmentId,
    labId,
    type,
    status,
    accessLevel,
  };
}

/**
 * Parses and validates a URL hash string into sanitized page and Discover filter state.
 *
 * @param rawHash - Raw `window.location.hash` value.
 * @param valid - Known departments, labs, and items used for allowlist validation.
 * @returns Sanitized navigation and filter state.
 */
export function parseHashState(
  rawHash: string,
  valid: { departments: Department[]; labs: Lab[]; items: EquipmentItem[] }
): ParsedHashState {
  const cleaned = rawHash.replace(/^#/, '').trim();
  if (!cleaned) {
    return {
      page: 'home',
      filters: emptyFilters(),
      catalogPage: 1,
      itemId: valid.items[0]?.id ?? '',
    };
  }

  const { page, querySegment } = resolvePageAndQuerySegment(cleaned);
  const params = new URLSearchParams(querySegment);
  const filters = extractValidatedFilters(params, valid);

  const rawPageNum = Number.parseInt(params.get('p') ?? '1', 10);
  const catalogPage = Number.isFinite(rawPageNum) && rawPageNum > 0 ? rawPageNum : 1;

  const validItemIds = new Set(valid.items.map((i) => i.id));
  const rawItem = (params.get('item') ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const itemId = rawItem && validItemIds.has(rawItem) ? rawItem : valid.items[0]?.id ?? '';

  return { page, filters, catalogPage, itemId };
}

/**
 * Validates URL query parameters and hash against known IDs and enums.
 *
 * @param rawSearch - Raw `window.location.search` string.
 * @param rawHash - Raw `window.location.hash` string.
 * @param valid - Known catalog IDs for allowlist checks.
 * @returns Parsed navigation and filter state.
 */
export function parseUrlState(
  rawSearch: string,
  rawHash: string,
  valid: { departments: Department[]; labs: Lab[]; items: EquipmentItem[] }
): ParsedHashState {
  if (rawHash && rawHash.replace(/^#/, '').trim()) {
    return parseHashState(rawHash, valid);
  }
  const cleanedSearch = rawSearch.replace(/^\?/, '').trim();
  if (!cleanedSearch) {
    return parseHashState('', valid);
  }
  const searchParams = new URLSearchParams(cleanedSearch);
  const rawPage = (searchParams.get('page') ?? '').trim();
  const hasValidPage = VALID_PAGES.includes(rawPage as AppPageId);
  const hasFilterKey = ['dept', 'lab', 'type', 'status', 'access', 'q', 'p'].some((k) =>
    searchParams.has(k)
  );
  const pagePrefix = hasValidPage ? `${rawPage}&` : hasFilterKey ? 'discover&' : 'home&';
  return parseHashState(`#${pagePrefix}${cleanedSearch}`, valid);
}

/**
 * Serializes active page and validated filters into a clean bookmarkable URL hash.
 *
 * @param state - Active page, Discover filters, catalog page number, and selected item ID.
 * @returns Hash string starting with `#`.
 */
export function serializeHashState(state: {
  page: AppPageId;
  filters?: DiscoverFilterCriteria;
  catalogPage?: number;
  itemId?: string;
}): string {
  if (state.page === 'discover') {
    const params = new URLSearchParams();
    const filters = state.filters ?? {};
    if (filters.departmentId) params.set('dept', filters.departmentId);
    if (filters.labId) params.set('lab', filters.labId);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.accessLevel) params.set('access', filters.accessLevel);
    if (filters.query && filters.query.trim()) params.set('q', filters.query.trim());
    if (state.catalogPage && state.catalogPage > 1) params.set('p', String(state.catalogPage));
    const qs = params.toString();
    return qs ? `#discover&${qs}` : '#discover';
  }

  if ((state.page === 'booking' || state.page === 'request') && state.itemId) {
    const params = new URLSearchParams();
    params.set('item', state.itemId);
    return `#${state.page}&${params.toString()}`;
  }

  return `#${state.page}`;
}
