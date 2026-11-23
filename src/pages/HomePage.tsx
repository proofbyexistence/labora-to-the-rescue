/**
 * Home notebook spread: platform summary, live KPI strip, department directory, and open items.
 */
import { useMemo, type MouseEvent } from 'react';
import { ArrowRight, BookOpenCheck, CheckCircle2, Compass } from 'lucide-react';
import { EquipmentCard, type PageId } from '../components/EquipmentCard';
import { DepartmentDoodle, HeroBenchDoodle } from '../components/LabDoodles';
import {
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getStateVersion,
} from '../js/labData';
import { isPendingStatus } from '../js/requests';

interface HomePageProps {
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

export function HomePage({ onNavigate, onInspectItem }: HomePageProps) {
  const dataVersion = getStateVersion();

  const {
    departments,
    labs,
    items,
    availableItems,
    pendingRequests,
    departmentNameMap,
    labNameMap,
    featuredItems,
    deptStatsMap,
  } = useMemo(() => {
    const depts = getDepartments();
    const allLabs = getLabs();
    const allItems = getItems();
    const available = allItems.filter((item) => item.status === 'Available');
    const pending = getRequests().filter((req) => isPendingStatus(req.status));
    const stats = new Map<string, { labs: number; items: number; available: number }>();

    for (const dept of depts) {
      stats.set(dept.id, { labs: 0, items: 0, available: 0 });
    }
    for (const lab of allLabs) {
      const entry = stats.get(lab.departmentId);
      if (entry) entry.labs += 1;
    }
    for (const item of allItems) {
      const entry = stats.get(item.departmentId);
      if (entry) {
        entry.items += 1;
        if (item.status === 'Available') entry.available += 1;
      }
    }

    return {
      departments: depts,
      labs: allLabs,
      items: allItems,
      availableItems: available,
      pendingRequests: pending,
      departmentNameMap: new Map(depts.map((d) => [d.id, d.name])),
      labNameMap: new Map(allLabs.map((l) => [l.id, l.name])),
      featuredItems: available.slice(0, 6),
      deptStatsMap: stats,
    };
  }, [dataVersion]);

  const handleDepartmentGridClick = (event: MouseEvent<HTMLDivElement>) => {
    const targetBtn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-dept-id]');
    if (!targetBtn) return;
    const deptId = targetBtn.dataset.deptId ?? '';
    if (deptId) {
      onNavigate('discover', { departmentId: deptId, labId: '' });
    }
  };

  return (
    <div className="space-y-9">
      {/* Hero Notebook Spread */}
      <section className="notebook-sheet p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <p className="inline-block rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-3 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
                LabLink Campus Resource Sharing
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--ink)] headline-balance sm:text-5xl">
                Every lab. One notebook.
              </h1>
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-[var(--ink)]">
                Discover instruments, development kits, compute workstations, and safety gear across seven academic departments. Check live bench availability, reserve time slots, and route faculty approvals in one shared campus ledger.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('discover', { departmentId: '', labId: '' })}
                className="labora-btn"
              >
                <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
                Explore Equipment Catalog
              </button>

              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="labora-btn labora-btn-paper"
              >
                Smart Booking
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4 lg:col-span-5">
            <HeroBenchDoodle className="mx-auto h-auto w-full max-w-[340px]" />
          </div>
        </div>
      </section>

      {/* 4-column Campus Inventory Strip */}
      <section aria-label="Campus inventory summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="notebook-sheet notebook-sheet-alt-tape p-4">
          <div className="text-base text-[var(--ink)]">Departments</div>
          <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">
            {departments.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink)]">Science & engineering</div>
        </div>

        <div className="notebook-sheet p-4">
          <div className="text-base text-[var(--ink)]">Shared Labs</div>
          <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">
            {labs.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink)]">Across 7 buildings</div>
        </div>

        <div className="notebook-sheet notebook-sheet-alt-tape p-4">
          <div className="text-base text-[var(--ink)]">Available Now</div>
          <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">
            {availableItems.length}
            <span className="ml-1.5 text-lg font-normal">/ {items.length}</span>
          </div>
          <div className="mt-1 text-sm text-[var(--ink)]">Ready for slot booking</div>
        </div>

        <div className="notebook-sheet p-4">
          <div className="text-base text-[var(--ink)]">Pending Approvals</div>
          <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-[var(--ink)]">
            {pendingRequests.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink)]">Active faculty queue</div>
        </div>
      </section>

      {/* Browse by Subject — Rendered Dynamically from getDepartments() */}
      <section aria-labelledby="browse-subject-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="browse-subject-heading"
              className="text-3xl font-bold text-[var(--ink)]"
            >
              Browse by subject
            </h2>
            <p className="mt-1 text-base text-[var(--ink)]">
              Select an academic department to inspect its laboratories, equipment inventory, and safety requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('discover', { departmentId: '', labId: '' })}
            className="labora-btn labora-btn-paper"
          >
            View all {items.length} items
          </button>
        </div>

        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          onClick={handleDepartmentGridClick}
        >
          {departments.map((dept, index) => {
            const counts = deptStatsMap.get(dept.id) ?? { labs: 0, items: 0, available: 0 };

            return (
              <button
                key={dept.id}
                type="button"
                data-dept-id={dept.id}
                className={`notebook-sheet ${
                  index % 2 === 1 ? 'notebook-sheet-alt-tape' : ''
                } flex flex-col justify-between p-5 text-left transition-transform duration-150 hover:-translate-y-1 cursor-pointer`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
                      {dept.code} · {dept.building}
                    </span>
                    <DepartmentDoodle departmentId={dept.id} className="h-10 w-10 shrink-0" />
                  </div>

                  <h3 className="mt-3 text-2xl font-bold text-[var(--ink)]">
                    {dept.name}
                  </h3>
                  <p className="mt-1.5 text-base leading-relaxed text-[var(--ink)]">
                    {dept.summary}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-[var(--border-subtle)] pt-3 text-base">
                  <span className="tabular-nums text-[var(--ink)]">
                    {counts.labs} labs · {counts.items} items
                  </span>
                  <span className="status-badge status-badge-available">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{counts.available} available</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Open Equipment */}
      <section aria-labelledby="ready-to-book-heading" className="perf-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="ready-to-book-heading"
              className="text-3xl font-bold text-[var(--ink)]"
            >
              Ready to reserve today
            </h2>
            <p className="mt-1 text-base text-[var(--ink)]">
              Instruments and kits with open afternoon slots across campus benches.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('request')}
            className="labora-btn labora-btn-paper"
          >
            <BookOpenCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Need restricted access?
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredItems.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              departmentName={departmentNameMap.get(item.departmentId)}
              labName={labNameMap.get(item.labId)}
              onBookItem={(itemId) => onNavigate('booking', { itemId })}
              onInspectItem={onInspectItem}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
