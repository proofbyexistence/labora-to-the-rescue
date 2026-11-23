/**
 * Root router, URL hash/pathname synchronizer, page metadata updater, and modal host.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { PageId } from './components/EquipmentCard';
import { Layout } from './components/Layout';
import { NotFoundView } from './components/NotFoundView';
import { parseHashState, serializeHashState, type DiscoverFilterCriteria } from './js/filter';
import { getCurrentUser, getDepartments, getItemById, getItems, getLabs, switchUserRole } from './js/lab-data';
import { buildBreadcrumbs, EMPTY_FILTERS, getPageMeta, readInitialRouteState, scrollPageToTop } from './js/page-meta';
import type { UserRole } from './js/types';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const SmartBookingPage = lazy(() => import('./pages/SmartBookingPage').then((m) => ({ default: m.SmartBookingPage })));
const RequestAccessPage = lazy(() => import('./pages/RequestAccessPage').then((m) => ({ default: m.RequestAccessPage })));
const FacultyApprovalsPage = lazy(() =>
  import('./pages/FacultyApprovalsPage').then((m) => ({ default: m.FacultyApprovalsPage }))
);
const ItemDetailsDialog = lazy(() =>
  import('./components/ItemDetailsDialog').then((m) => ({ default: m.ItemDetailsDialog }))
);

function pushHashState(next: {
  page: PageId;
  filters: Required<DiscoverFilterCriteria>;
  catalogPage: number;
  itemId: string;
}) {
  if (typeof window === 'undefined') return;
  const targetHash = serializeHashState(next);
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    window.history.replaceState(null, '', `/${targetHash}`);
    return;
  }
  if (window.location.hash !== targetHash) window.location.hash = targetHash;
}

/** Root LABORA single-page application component. */
export default function App() {
  const initial = readInitialRouteState();
  const [currentPage, setCurrentPage] = useState<PageId>(initial.page);
  const [discoverFilters, setDiscoverFilters] = useState<Required<DiscoverFilterCriteria>>(initial.filters);
  const [catalogPage, setCatalogPage] = useState<number>(initial.catalogPage);
  const [selectedItemId, setSelectedItemId] = useState<string>(initial.itemId);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [, setVersion] = useState(0);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    const meta = getPageMeta(currentPage, discoverFilters, selectedItemId);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  }, [currentPage, discoverFilters, selectedItemId]);

  const refreshData = () => setVersion((v) => v + 1);

  const handleNavigate = (page: PageId, options?: { departmentId?: string; labId?: string; itemId?: string }) => {
    const nextFilters: Required<DiscoverFilterCriteria> = {
      ...discoverFilters,
      ...(options?.departmentId !== undefined ? { departmentId: options.departmentId } : {}),
      ...(options?.labId !== undefined ? { labId: options.labId } : {}),
    };
    const nextCatalogPage =
      options?.departmentId !== undefined || options?.labId !== undefined ? 1 : catalogPage;
    const nextItemId = options?.itemId ?? selectedItemId;

    setDiscoverFilters(nextFilters);
    setCatalogPage(nextCatalogPage);
    setSelectedItemId(nextItemId);
    setCurrentPage(page);
    pushHashState({ page, filters: nextFilters, catalogPage: nextCatalogPage, itemId: nextItemId });
    scrollPageToTop();
  };

  const handleUpdateFilters = useCallback(
    (patch: Partial<DiscoverFilterCriteria>) => {
      setDiscoverFilters((prev) => {
        const next = { ...prev, ...patch };
        setCatalogPage(1);
        pushHashState({ page: 'discover', filters: next, catalogPage: 1, itemId: selectedItemId });
        return next;
      });
    },
    [selectedItemId]
  );

  const handleClearFilters = useCallback(() => {
    setDiscoverFilters(EMPTY_FILTERS);
    setCatalogPage(1);
    pushHashState({ page: 'discover', filters: EMPTY_FILTERS, catalogPage: 1, itemId: selectedItemId });
  }, [selectedItemId]);

  const handleChangeCatalogPage = useCallback(
    (nextPage: number) => {
      const safePage = Math.max(1, nextPage);
      setCatalogPage(safePage);
      pushHashState({ page: 'discover', filters: discoverFilters, catalogPage: safePage, itemId: selectedItemId });
      scrollPageToTop();
    },
    [discoverFilters, selectedItemId]
  );

  const handleSwitchRole = (role: UserRole) => {
    setCurrentUser(switchUserRole(role));
    refreshData();
  };

  const handleInspectItem = (itemId: string, trigger?: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger ?? null;
    setInspectedItemId(itemId);
  };

  const handleCloseDetails = () => {
    setInspectedItemId(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const inspectedItem = inspectedItemId ? getItemById(inspectedItemId) ?? null : null;
  const inspectedDept = inspectedItem ? getDepartments().find((d) => d.id === inspectedItem.departmentId) : undefined;
  const inspectedLab = inspectedItem ? getLabs().find((l) => l.id === inspectedItem.labId) : undefined;

  return (
    <Layout
      currentPage={currentPage}
      currentUser={currentUser}
      selectedDepartmentId={discoverFilters.departmentId}
      selectedLabId={discoverFilters.labId}
      breadcrumbs={buildBreadcrumbs(currentPage, discoverFilters, selectedItemId)}
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
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} onInspectItem={handleInspectItem} />}
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
              pushHashState({ page: 'booking', filters: discoverFilters, catalogPage, itemId });
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
          <FacultyApprovalsPage currentUser={currentUser} onNavigate={handleNavigate} onDataMutated={refreshData} />
        )}
        {currentPage === 'not-found' && <NotFoundView onNavigateHome={handleNavigate} />}
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
