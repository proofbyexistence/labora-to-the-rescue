import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
} from './types';

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

export type AppPageId = 'home' | 'discover' | 'booking' | 'request' | 'approvals';

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

/**
 * Pure, DOM-free equipment filter.
 * Matches search text across item name, lab name/room, department name/code, type, and specs.
 * Memoizes the last filter computation so unchanged re-renders avoid rescanning the catalog.
 */
export function filterItems(
  items: EquipmentItem[],
  criteria: DiscoverFilterCriteria = {},
  context: FilterContext = {}
): EquipmentItem[] {
  const normalizedQuery = (criteria.query ?? '').trim().toLowerCase();
  const departmentId = criteria.departmentId ?? '';
  const labId = criteria.labId ?? '';
  const type = criteria.type ?? '';
  const status = criteria.status ?? '';
  const accessLevel = criteria.accessLevel ?? '';

  if (
    lastFilterCache &&
    lastFilterCache.items === items &&
    lastFilterCache.departments === context.departments &&
    lastFilterCache.labs === context.labs &&
    lastFilterCache.query === normalizedQuery &&
    lastFilterCache.departmentId === departmentId &&
    lastFilterCache.labId === labId &&
    lastFilterCache.type === type &&
    lastFilterCache.status === status &&
    lastFilterCache.accessLevel === accessLevel
  ) {
    return lastFilterCache.result.slice();
  }

  const deptById = new Map<string, Department>(
    (context.departments ?? []).map((dept) => [dept.id, dept])
  );
  const labById = new Map<string, Lab>(
    (context.labs ?? []).map((lab) => [lab.id, lab])
  );

  const result = items.filter((item) => {
    if (departmentId && item.departmentId !== departmentId) {
      return false;
    }
    if (labId && item.labId !== labId) {
      return false;
    }
    if (type && item.type !== type) {
      return false;
    }
    if (status && item.status !== status) {
      return false;
    }
    if (accessLevel && item.accessLevel !== accessLevel) {
      return false;
    }

    if (normalizedQuery) {
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

      if (!searchable.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });

  lastFilterCache = {
    items,
    departments: context.departments,
    labs: context.labs,
    query: normalizedQuery,
    departmentId,
    labId,
    type,
    status,
    accessLevel,
    result,
  };

  return result.slice();
}

/**
 * Pure pagination helper clamped safely within [1, totalPages].
 */
export function paginateItems<T>(
  items: T[],
  requestedPage = 1,
  pageSize = 9
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

function sanitizeQueryText(raw: string | null): string {
  if (!raw) return '';
  // Strip control characters and clamp length so malformed hashes/queries cannot bloat UI state.
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
}

/**
 * Parse and validate URL hash into sanitized page and Discover filter state.
 * Supports both `#discover&dept=...` and direct bookmark slugs like `#dept=electronics&type=dev-kits`.
 */
export function parseHashState(
  rawHash: string,
  valid: {
    departments: Department[];
    labs: Lab[];
    items: EquipmentItem[];
  }
): ParsedHashState {
  const emptyFilters: Required<DiscoverFilterCriteria> = {
    query: '',
    departmentId: '',
    labId: '',
    type: '',
    status: '',
    accessLevel: '',
  };

  const cleaned = rawHash.replace(/^#/, '').trim();
  if (!cleaned) {
    return {
      page: 'home',
      filters: emptyFilters,
      catalogPage: 1,
      itemId: valid.items[0]?.id ?? '',
    };
  }

  let page: AppPageId = 'home';
  let querySegment = '';

  if (cleaned.includes('=')) {
    const firstAmp = cleaned.indexOf('&');
    const prefix = firstAmp === -1 ? '' : cleaned.slice(0, firstAmp);
    if (VALID_PAGES.includes(prefix as AppPageId)) {
      page = prefix as AppPageId;
      querySegment = cleaned.slice(firstAmp + 1);
    } else {
      // Bare filter hash such as `#dept=electronics&type=dev-kits` routes directly to Discover.
      page = 'discover';
      querySegment = cleaned;
    }
  } else if (VALID_PAGES.includes(cleaned as AppPageId)) {
    page = cleaned as AppPageId;
  }

  const params = new URLSearchParams(querySegment);
  const validDeptIds = new Set(valid.departments.map((d) => d.id));
  const labById = new Map(valid.labs.map((l) => [l.id, l]));
  const validItemIds = new Set(valid.items.map((i) => i.id));

  const rawDept = (params.get('dept') ?? '').trim();
  const mappedDept = DEPARTMENT_ALIASES[rawDept.toLowerCase()] ?? rawDept;
  let departmentId = validDeptIds.has(mappedDept) ? mappedDept : '';

  const rawLab = (params.get('lab') ?? '').trim();
  const matchedLab = labById.get(rawLab);
  let labId = '';
  if (matchedLab) {
    if (!departmentId || matchedLab.departmentId === departmentId) {
      labId = matchedLab.id;
      departmentId = matchedLab.departmentId;
    }
  }

  const rawType = (params.get('type') ?? '').trim();
  const mappedType = TYPE_ALIASES[rawType.toLowerCase()] ?? rawType;
  const validTypes: EquipmentType[] = [
    'Instruments',
    'Development kits',
    'Workstations',
    'Safety gear',
  ];
  const type = validTypes.includes(mappedType as EquipmentType)
    ? (mappedType as EquipmentType)
    : '';

  const rawStatus = (params.get('status') ?? '').trim();
  const mappedStatus = STATUS_ALIASES[rawStatus.toLowerCase()] ?? rawStatus;
  const validStatuses: AvailabilityStatus[] = ['Available', 'Limited', 'Booked'];
  const status = validStatuses.includes(mappedStatus as AvailabilityStatus)
    ? (mappedStatus as AvailabilityStatus)
    : '';

  const rawAccess = (params.get('access') ?? '').trim();
  const mappedAccess = ACCESS_ALIASES[rawAccess.toLowerCase()] ?? rawAccess;
  const validAccess: AccessLevel[] = [
    'Open',
    'Needs faculty approval',
    'Training required',
  ];
  const accessLevel = validAccess.includes(mappedAccess as AccessLevel)
    ? (mappedAccess as AccessLevel)
    : '';

  const query = sanitizeQueryText(params.get('q'));

  const rawPageNum = Number.parseInt(params.get('p') ?? '1', 10);
  const catalogPage = Number.isFinite(rawPageNum) && rawPageNum > 0 ? rawPageNum : 1;

  const rawItem = (params.get('item') ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const itemId = rawItem && validItemIds.has(rawItem)
    ? rawItem
    : valid.items[0]?.id ?? '';

  return {
    page,
    filters: {
      query,
      departmentId,
      labId,
      type,
      status,
      accessLevel,
    },
    catalogPage,
    itemId,
  };
}

/**
 * Validate both URL query string and hash against known IDs and enums, ignoring unknown parameters.
 */
export function parseUrlState(
  rawSearch: string,
  rawHash: string,
  valid: {
    departments: Department[];
    labs: Lab[];
    items: EquipmentItem[];
  }
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
  const filterKeys = ['dept', 'lab', 'type', 'status', 'access', 'q', 'p'];
  const hasFilterKey = filterKeys.some((key) => searchParams.has(key));
  const pagePrefix = hasValidPage
    ? `${rawPage}&`
    : hasFilterKey
      ? 'discover&'
      : 'home&';
  return parseHashState(`#${pagePrefix}${cleanedSearch}`, valid);
}

/**
 * Serialize active page and validated filters into a clean bookmarkable hash.
 */
export function serializeHashState(state: {
  page: AppPageId;
  filters?: DiscoverFilterCriteria;
  catalogPage?: number;
  itemId?: string;
}): string {
  if (state.page === 'discover') {
    const params = new URLSearchParams();
    const f = state.filters ?? {};
    if (f.departmentId) params.set('dept', f.departmentId);
    if (f.labId) params.set('lab', f.labId);
    if (f.type) params.set('type', f.type);
    if (f.status) params.set('status', f.status);
    if (f.accessLevel) params.set('access', f.accessLevel);
    if (f.query && f.query.trim()) params.set('q', f.query.trim());
    if (state.catalogPage && state.catalogPage > 1) {
      params.set('p', String(state.catalogPage));
    }
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
