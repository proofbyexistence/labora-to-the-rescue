/**
 * Discover catalog pagination bar and friendly empty-filter / deleted-scope recovery views.
 */
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { HeroBenchDoodle } from './LabDoodles';

/**
 * Renders accessible Previous/Next and numbered pagination buttons.
 *
 * @param props - Active page, total pages, and page change handler.
 * @returns Pagination nav element or null when only 1 page exists.
 */
export function DiscoverPagination({
  page,
  totalPages,
  onChangePage,
}: {
  page: number;
  totalPages: number;
  onChangePage: (nextPage: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pageNumbers = Array.from({ length: totalPages }, (_, idx) => idx + 1);

  return (
    <nav aria-label="Catalog pagination" className="notebook-sheet flex flex-wrap items-center justify-between gap-3 p-4">
      <button
        type="button"
        onClick={() => onChangePage(page - 1)}
        disabled={page <= 1}
        className="labora-btn labora-btn-paper text-sm"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        Previous
      </button>

      <div className="flex flex-wrap items-center gap-2">
        {pageNumbers.map((pageNum) => {
          const isCurrent = pageNum === page;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onChangePage(pageNum)}
              aria-label={`Page ${pageNum}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={`labora-btn !min-w-[44px] !px-3 text-sm tabular-nums ${isCurrent ? '' : 'labora-btn-paper'}`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChangePage(page + 1)}
        disabled={page >= totalPages}
        className="labora-btn labora-btn-paper text-sm"
      >
        Next
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </nav>
  );
}

/**
 * Renders friendly empty-state messaging when filters return zero items or a lab was deleted.
 *
 * @param props - Heading, body message, and reset handler.
 * @returns Notebook recovery card section.
 */
export function DiscoverEmptyState({
  title,
  message,
  actionLabel,
  onReset,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onReset: () => void;
}) {
  return (
    <section className="notebook-sheet p-8 text-center">
      <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
      <h2 className="text-2xl font-bold text-[var(--ink)]">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-lg text-base text-[var(--ink)]">{message}</p>
      <button type="button" onClick={onReset} className="labora-btn mt-5">
        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
        {actionLabel}
      </button>
    </section>
  );
}
