/**
 * Discover catalog page: multi-faceted equipment filtering, pagination, and AI project finder.
 */
import { useEffect, useMemo, useState } from 'react';
import { AiEquipmentFinder } from '../components/AiEquipmentFinder';
import { DiscoverFilterBar } from '../components/DiscoverFilterBar';
import { DiscoverEmptyState, DiscoverPagination } from '../components/DiscoverPagination';
import { EquipmentCard, type PageId } from '../components/EquipmentCard';
import { LIMITS } from '../js/constants';
import { filterItems, paginateItems, type DiscoverFilterCriteria } from '../js/filter';
import { getDepartments, getItems, getLabs, getStateVersion } from '../js/lab-data';

interface DiscoverPageProps {
  filters: Required<DiscoverFilterCriteria>;
  catalogPage: number;
  onUpdateFilters: (next: Partial<DiscoverFilterCriteria>) => void;
  onClearFilters: () => void;
  onChangePage: (page: number) => void;
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string; itemId?: string }) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

/**
 * Renders the searchable, filterable equipment catalog and AI project matching assistant.
 *
 * @param props - Active filter criteria, current page, and navigation callbacks.
 * @returns Discover page element.
 */
export function DiscoverPage({
  filters,
  catalogPage,
  onUpdateFilters,
  onClearFilters,
  onChangePage,
  onNavigate,
  onInspectItem,
}: DiscoverPageProps) {
  const [searchDraft, setSearchDraft] = useState(filters.query);

  useEffect(() => {
    setSearchDraft(filters.query);
  }, [filters.query]);

  // Debounce live search updates by 250 ms to keep filtering responsive without hash thrashing.
  useEffect(() => {
    if (searchDraft === filters.query) return;
    const timer = window.setTimeout(() => onUpdateFilters({ query: searchDraft }), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.query, onUpdateFilters]);

  const dataVersion = getStateVersion();
  const { departments, allLabs, allItems, departmentMap, labMap } = useMemo(() => {
    const depts = getDepartments();
    const labs = getLabs();
    return {
      departments: depts,
      allLabs: labs,
      allItems: getItems(),
      departmentMap: new Map(depts.map((d) => [d.id, d])),
      labMap: new Map(labs.map((l) => [l.id, l])),
    };
  }, [dataVersion]);

  const scopedLabs = useMemo(
    () => (filters.departmentId ? allLabs.filter((lab) => lab.departmentId === filters.departmentId) : allLabs),
    [allLabs, filters.departmentId]
  );

  const matchingItems = useMemo(
    () => filterItems(allItems, filters, { departments, labs: allLabs }),
    [allItems, filters, departments, allLabs]
  );

  const paginated = useMemo(
    () => paginateItems(matchingItems, catalogPage, LIMITS.CATALOG_PAGE_SIZE),
    [matchingItems, catalogPage]
  );

  const activeDepartment = filters.departmentId ? departmentMap.get(filters.departmentId) : undefined;
  const activeLab = filters.labId ? labMap.get(filters.labId) : undefined;
  const hasFilters = Boolean(
    filters.departmentId || filters.labId || searchDraft.trim() || filters.type || filters.status || filters.accessLevel
  );

  const handleResetAll = () => {
    setSearchDraft('');
    onClearFilters();
  };

  if ((filters.labId && !activeLab) || (filters.departmentId && !activeDepartment)) {
    return (
      <DiscoverEmptyState
        title="Laboratory or subject no longer listed"
        message="This laboratory or subject was removed from the campus catalog. Return to Discover to browse active labs and instruments."
        actionLabel="Back to Discover"
        onReset={handleResetAll}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DiscoverFilterBar
        filters={filters}
        searchDraft={searchDraft}
        activeDepartment={activeDepartment}
        activeLab={activeLab}
        departments={departments}
        scopedLabs={scopedLabs}
        labMap={labMap}
        totalItems={paginated.totalItems}
        page={paginated.page}
        totalPages={paginated.totalPages}
        hasFilters={hasFilters}
        onSearchDraftChange={setSearchDraft}
        onUpdateFilters={onUpdateFilters}
        onResetAll={handleResetAll}
      />

      <AiEquipmentFinder
        dataVersion={dataVersion}
        departmentMap={departmentMap}
        labMap={labMap}
        onNavigate={onNavigate}
        onInspectItem={onInspectItem}
      />

      {paginated.items.length > 0 ? (
        <>
          <section
            aria-label="Equipment catalog results"
            className="results-grid-stable perf-section grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {paginated.items.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                departmentName={departmentMap.get(item.departmentId)?.name}
                labName={labMap.get(item.labId)?.name}
                onBookItem={(itemId) => onNavigate('booking', { itemId })}
                onInspectItem={onInspectItem}
              />
            ))}
          </section>
          <DiscoverPagination page={paginated.page} totalPages={paginated.totalPages} onChangePage={onChangePage} />
        </>
      ) : (
        <DiscoverEmptyState
          title="No matching lab equipment found"
          message="Try clearing your search or filters, or pick another department from the Lab Index."
          actionLabel="Clear filters"
          onReset={handleResetAll}
        />
      )}
    </div>
  );
}
