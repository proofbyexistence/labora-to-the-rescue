/**
 * Home notebook spread: platform summary, live KPI strip, department directory, and open items.
 */
import { useMemo } from 'react';
import { ArrowRight, BookOpenCheck, Compass } from 'lucide-react';
import { EquipmentCard, type PageId } from '../components/EquipmentCard';
import { HomeDepartmentGrid, HomeKpiStrip } from '../components/HomeDepartmentGrid';
import { HeroBenchDoodle } from '../components/LabDoodles';
import { buildHomeSummaryData } from '../js/home-stats';
import { getStateVersion } from '../js/lab-data';

interface HomePageProps {
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

/**
 * Renders the LABORA Home notebook spread.
 *
 * @param props - Route navigation and equipment quick-inspection callbacks.
 * @returns Home page layout.
 */
export function HomePage({ onNavigate, onInspectItem }: HomePageProps) {
  const dataVersion = getStateVersion();
  const summary = useMemo(() => buildHomeSummaryData(), [dataVersion]);

  return (
    <div className="space-y-9">
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

      <HomeKpiStrip
        deptCount={summary.departments.length}
        labCount={summary.labs.length}
        availableCount={summary.availableItems.length}
        totalItems={summary.items.length}
        pendingCount={summary.pendingCount}
      />

      <HomeDepartmentGrid
        departments={summary.departments}
        totalItems={summary.items.length}
        deptStatsMap={summary.deptStatsMap}
        onNavigate={onNavigate}
      />

      <section aria-labelledby="ready-to-book-heading" className="perf-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ready-to-book-heading" className="text-3xl font-bold text-[var(--ink)]">
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
          {summary.featuredItems.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              departmentName={summary.departmentNameMap.get(item.departmentId)}
              labName={summary.labNameMap.get(item.labId)}
              onBookItem={(itemId) => onNavigate('booking', { itemId })}
              onInspectItem={onInspectItem}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
