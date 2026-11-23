import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { PageId } from './components/EquipmentCard';
import { Layout, type BreadcrumbItem } from './components/Layout';
import {
  parseHashState,
  parseUrlState,
  serializeHashState,
  type DiscoverFilterCriteria,
} from './js/filter';
import {
  getCurrentUser,
  getDepartments,
  getItemById,
  getItems,
  getLabs,
  switchUserRole,
} from './js/labData';
import type { UserRole } from './js/types';

const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage }))
);
const DiscoverPage = lazy(() =>
  import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage }))
);
const SmartBookingPage = lazy(() =>
  import('./pages/SmartBookingPage').then((m) => ({ default: m.SmartBookingPage }))
);
const RequestAccessPage = lazy(() =>
  import('./pages/RequestAccessPage').then((m) => ({ default: m.RequestAccessPage }))
);
const FacultyApprovalsPage = lazy(() =>
  import('./pages/FacultyApprovalsPage').then((m) => ({ default: m.FacultyApprovalsPage }))
);
const ItemDetailsDialog = lazy(() =>
  import('./components/ItemDetailsDialog').then((m) => ({ default: m.ItemDetailsDialog }))
);

const EMPTY_FILTERS: Required<DiscoverFilterCriteria> = {
  query: '',
  departmentId: '',
  labId: '',
  type: '',
  status: '',
  accessLevel: '',
};

function readInitialHash() {
  const departments = getDepartments();
  const labs = getLabs();
  const items = getItems();
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
  const rawHash = typeof window !== 'undefined' ? window.location.hash : '';
  return parseUrlState(rawSearch, rawHash, { departments, labs, items });
}

export default function App() {
  const initial = readInitialHash();

  const [currentPage, setCurrentPage] = useState<PageId>(initial.page);
  const [discoverFilters, setDiscoverFilters] = useState<
    Required<DiscoverFilterCriteria>
  >(initial.filters);
  const [catalogPage, setCatalogPage] = useState<number>(initial.catalogPage);
  const [selectedItemId, setSelectedItemId] = useState<string>(initial.itemId);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [, setVersion] = useState(0);

  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const syncHash = useCallback(
    (next: {
      page: PageId;
      filters: Required<DiscoverFilterCriteria>;
      catalogPage: number;
      itemId: string;
    }) => {
      if (typeof window === 'undefined') return;
      const targetHash = serializeHashState({
        page: next.page,
        filters: next.filters,
        catalogPage: next.catalogPage,
        itemId: next.itemId,
      });
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    },
    []
  );

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashState(window.location.hash, {
        departments: getDepartments(),
        labs: getLabs(),
        items: getItems(),
      });
      setCurrentPage(parsed.page);
      setDiscoverFilters(parsed.filters);
      setCatalogPage(parsed.catalogPage);
      setSelectedItemId(parsed.itemId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const departments = getDepartments();
    const labs = getLabs();
    if (currentPage === 'discover') {
      const lab = labs.find((l) => l.id === discoverFilters.labId);
      const dept = departments.find((d) => d.id === discoverFilters.departmentId);
      const scope = lab?.name || dept?.name;
      document.title = scope ? `Discover · ${scope} — LABORA` : 'Discover Equipment — LABORA';
    } else if (currentPage === 'booking') {
      const item = getItemById(selectedItemId);
      document.title = item ? `Smart Booking · ${item.name} — LABORA` : 'Smart Booking — LABORA';
    } else if (currentPage === 'request') {
      document.title = 'Request Lab Access — LABORA';
    } else if (currentPage === 'approvals') {
      document.title = 'Faculty Approvals & Manage — LABORA';
    } else {
      document.title = 'LABORA — Every lab. One notebook.';
    }
  }, [currentPage, discoverFilters.departmentId, discoverFilters.labId, selectedItemId]);

  const refreshData = () => {
    setVersion((v) => v + 1);
  };

  const handleNavigate = (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => {
    const nextFilters: Required<DiscoverFilterCriteria> = {
      ...discoverFilters,
      ...(options?.departmentId !== undefined
        ? { departmentId: options.departmentId }
        : {}),
      ...(options?.labId !== undefined ? { labId: options.labId } : {}),
    };
    const nextCatalogPage =
      options?.departmentId !== undefined || options?.labId !== undefined
        ? 1
        : catalogPage;
    const nextItemId = options?.itemId ?? selectedItemId;

    setDiscoverFilters(nextFilters);
    setCatalogPage(nextCatalogPage);
    setSelectedItemId(nextItemId);
    setCurrentPage(page);

    syncHash({
      page,
      filters: nextFilters,
      catalogPage: nextCatalogPage,
      itemId: nextItemId,
    });

    if (typeof window !== 'undefined') {
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  };

  const handleUpdateFilters = useCallback(
    (patch: Partial<DiscoverFilterCriteria>) => {
      setDiscoverFilters((prev) => {
        const next: Required<DiscoverFilterCriteria> = { ...prev, ...patch };
        setCatalogPage(1);
        syncHash({
          page: 'discover',
          filters: next,
          catalogPage: 1,
          itemId: selectedItemId,
        });
        return next;
      });
    },
    [selectedItemId, syncHash]
  );

  const handleClearFilters = useCallback(() => {
    setDiscoverFilters(EMPTY_FILTERS);
    setCatalogPage(1);
    syncHash({
      page: 'discover',
      filters: EMPTY_FILTERS,
      catalogPage: 1,
      itemId: selectedItemId,
    });
  }, [selectedItemId, syncHash]);

  const handleChangeCatalogPage = useCallback(
    (nextPage: number) => {
      const safePage = Math.max(1, nextPage);
      setCatalogPage(safePage);
      syncHash({
        page: 'discover',
        filters: discoverFilters,
        catalogPage: safePage,
        itemId: selectedItemId,
      });
      if (typeof window !== 'undefined') {
        const reduced =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }
    },
    [discoverFilters, selectedItemId, syncHash]
  );

  const handleSwitchRole = (role: UserRole) => {
    const next = switchUserRole(role);
    setCurrentUser(next);
    refreshData();
  };

  const handleInspectItem = (
    itemId: string,
    trigger?: HTMLButtonElement | null
  ) => {
    lastTriggerRef.current = trigger ?? null;
    setInspectedItemId(itemId);
  };

  const handleCloseDetails = () => {
    setInspectedItemId(null);
    // Restore keyboard focus to the button that opened the details dialog.
    window.requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  };

  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ label: 'LABORA', page: 'home' }];
    const departments = getDepartments();
    const labs = getLabs();

    if (currentPage === 'home') {
      crumbs.push({ label: 'Home' });
      return crumbs;
    }

    if (currentPage === 'discover') {
      const dept = departments.find(
        (d) => d.id === discoverFilters.departmentId
      );
      const lab = labs.find((l) => l.id === discoverFilters.labId);

      crumbs.push({
        label: 'Discover',
        page: dept ? 'discover' : undefined,
        departmentId: '',
        labId: '',
      });

      if (dept) {
        crumbs.push({
          label: dept.name,
          page: lab ? 'discover' : undefined,
          departmentId: dept.id,
          labId: '',
        });
      }
      if (lab) {
        crumbs.push({ label: lab.name });
      }
      return crumbs;
    }

    if (currentPage === 'booking') {
      crumbs.push({ label: 'Smart Booking', page: 'booking' });
      const item = getItemById(selectedItemId);
      if (item) {
        crumbs.push({ label: item.name });
      }
      return crumbs;
    }

    if (currentPage === 'request') {
      crumbs.push({ label: 'Request Access' });
      return crumbs;
    }

    crumbs.push({ label: 'Faculty Approvals' });
    return crumbs;
  };

  const inspectedItem = inspectedItemId ? getItemById(inspectedItemId) ?? null : null;
  const inspectedDept = inspectedItem
    ? getDepartments().find((d) => d.id === inspectedItem.departmentId)
    : undefined;
  const inspectedLab = inspectedItem
    ? getLabs().find((l) => l.id === inspectedItem.labId)
    : undefined;

  return (
    <Layout
      currentPage={currentPage}
      currentUser={currentUser}
      selectedDepartmentId={discoverFilters.departmentId}
      selectedLabId={discoverFilters.labId}
      breadcrumbs={buildBreadcrumbs()}
      onNavigate={handleNavigate}
      onSwitchRole={handleSwitchRole}
    >
      <Suspense
        fallback={
          <section
            aria-label="Loading page content"
            className="notebook-sheet results-grid-stable flex items-center justify-center p-8 text-base text-[var(--ink)]"
          >
            Opening notebook section...
          </section>
        }
      >
        {currentPage === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onInspectItem={handleInspectItem}
          />
        )}

        {currentPage === 'discover' && (
          <DiscoverPage
            filters={discoverFilters}
            catalogPage={catalogPage}
            onUpdateFilters={handleUpdateFilters}
            onClearFilters={handleClearFilters}
            onChangePage={handleChangeCatalogPage}
            onNavigate={handleNavigate}
            onInspectItem={handleInspectItem}
          />
        )}

        {currentPage === 'booking' && (
          <SmartBookingPage
            selectedItemId={selectedItemId}
            currentUser={currentUser}
            onSelectItem={(itemId) => {
              setSelectedItemId(itemId);
              syncHash({
                page: 'booking',
                filters: discoverFilters,
                catalogPage,
                itemId,
              });
            }}
            onNavigate={handleNavigate}
            onDataMutated={refreshData}
          />
        )}

        {currentPage === 'request' && (
          <RequestAccessPage
            selectedItemId={selectedItemId}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onDataMutated={refreshData}
          />
        )}

        {currentPage === 'approvals' && (
          <FacultyApprovalsPage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onDataMutated={refreshData}
          />
        )}

        {inspectedItem && (
          <ItemDetailsDialog
            item={inspectedItem}
            department={inspectedDept}
            lab={inspectedLab}
            onClose={handleCloseDetails}
            onBookItem={(itemId) => handleNavigate('booking', { itemId })}
            onRequestAccess={(itemId) => handleNavigate('request', { itemId })}
          />
        )}
      </Suspense>
    </Layout>
  );
}
