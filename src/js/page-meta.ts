/**
 * Route metadata, initial URL parsing, breadcrumb generation, and scroll helpers.
 */
import type { BreadcrumbItem } from '../components/Layout';
import {
  parseUrlState,
  type AppPageId,
  type DiscoverFilterCriteria,
} from './filter';
import { getDepartments, getItemById, getItems, getLabs } from './lab-data';

export const EMPTY_FILTERS: Required<DiscoverFilterCriteria> = {
  query: '',
  departmentId: '',
  labId: '',
  type: '',
  status: '',
  accessLevel: '',
};

/**
 * Reads initial route state from `window.location.search`, hash, and pathname.
 *
 * @returns Initial page ID, validated filters, catalog page number, and selected item ID.
 */
export function readInitialRouteState() {
  const departments = getDepartments();
  const labs = getLabs();
  const items = getItems();
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
  const rawHash = typeof window !== 'undefined' ? window.location.hash : '';
  const parsed = parseUrlState(rawSearch, rawHash, { departments, labs, items });
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/' &&
    window.location.pathname !== '/index.html'
  ) {
    return { ...parsed, page: 'not-found' as const };
  }
  return parsed;
}

const STATIC_PAGE_META: Record<
  Exclude<AppPageId, 'discover' | 'booking'>,
  { title: string; description: string }
> = {
  request: {
    title: 'Request Lab Access — LABORA',
    description:
      'Submit project-based access requests for restricted or training-required campus laboratory instruments and track approval progress.',
  },
  approvals: {
    title: 'Faculty Approvals & Manage — LABORA',
    description:
      'Review student access requests, resolve scheduling conflicts, track lab utilization analytics, and manage subjects, labs, items, and slots.',
  },
  'not-found': {
    title: 'Page Not Found — LABORA',
    description:
      'The requested LABORA notebook section could not be found. Return home to browse campus labs and equipment.',
  },
  home: {
    title: 'LABORA — Every lab. One notebook.',
    description:
      'Every lab. One notebook. Discover campus laboratory equipment, book instrument slots, submit access requests, and manage faculty approvals.',
  },
};

/**
 * Computes unique document title and meta description for the active route and scope.
 *
 * @param page - Current page route identifier.
 * @param filters - Active catalog filter state.
 * @param selectedItemId - Active item ID on Smart Booking or Request Access.
 * @returns Title and description strings for `<head>` synchronization.
 */
export function getPageMeta(
  page: AppPageId,
  filters: Required<DiscoverFilterCriteria>,
  selectedItemId: string
): { title: string; description: string } {
  if (page === 'discover') {
    const lab = getLabs().find((l) => l.id === filters.labId);
    const dept = getDepartments().find((d) => d.id === filters.departmentId);
    const scope = lab?.name || dept?.name;
    return {
      title: scope ? `Discover · ${scope} — LABORA` : 'Discover Equipment — LABORA',
      description: scope
        ? `Browse and filter shared campus laboratory instruments and safety requirements for ${scope} on LABORA.`
        : 'Search and filter campus laboratory instruments, development kits, workstations, and safety gear across seven departments.',
    };
  }
  if (page === 'booking') {
    const item = getItemById(selectedItemId);
    return {
      title: item ? `Smart Booking · ${item.name} — LABORA` : 'Smart Booking — LABORA',
      description: item
        ? `Inspect weekly Mon–Sat lab availability and reserve bench slots for ${item.name} on LABORA.`
        : 'Reserve weekly Mon–Sat lab slots and resolve competing student requests with deterministic fair allocation.',
    };
  }
  return STATIC_PAGE_META[page];
}

/**
 * Builds ordered breadcrumb trail entries for the current route and scope.
 *
 * @param page - Active page route ID.
 * @param filters - Active discover filters.
 * @param selectedItemId - Active equipment item ID.
 * @returns Array of `BreadcrumbItem` records from root to current section.
 */
export function buildBreadcrumbs(
  page: AppPageId,
  filters: Required<DiscoverFilterCriteria>,
  selectedItemId: string
): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: 'LABORA', page: 'home' }];
  if (page === 'home') return [...crumbs, { label: 'Home' }];

  if (page === 'discover') {
    const dept = getDepartments().find((d) => d.id === filters.departmentId);
    const lab = getLabs().find((l) => l.id === filters.labId);
    crumbs.push({ label: 'Discover', page: dept ? 'discover' : undefined, departmentId: '', labId: '' });
    if (dept) crumbs.push({ label: dept.name, page: lab ? 'discover' : undefined, departmentId: dept.id, labId: '' });
    if (lab) crumbs.push({ label: lab.name });
    return crumbs;
  }

  if (page === 'booking') {
    crumbs.push({ label: 'Smart Booking', page: 'booking' });
    const item = getItemById(selectedItemId);
    if (item) crumbs.push({ label: item.name });
    return crumbs;
  }
  if (page === 'request') return [...crumbs, { label: 'Request Access' }];
  if (page === 'approvals') return [...crumbs, { label: 'Faculty Approvals' }];
  return [...crumbs, { label: 'Page not found' }];
}

/**
 * Scrolls the viewport to the top while respecting `prefers-reduced-motion`.
 */
export function scrollPageToTop(): void {
  if (typeof window === 'undefined') return;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}
