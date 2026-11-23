/**
 * Shared accessible breadcrumb bar and site footer components.
 */
import { ChevronRight } from 'lucide-react';
import type { PageId } from './EquipmentCard';
import { FlaskDoodle } from './LabDoodles';
import type { BreadcrumbItem } from './Layout';
import { NAV_ITEMS } from './SiteHeader';

/**
 * Renders the ordered breadcrumb trail above page content.
 *
 * @param props - Breadcrumbs array and navigation handler.
 * @returns Accessible `<nav aria-label="Breadcrumb">` bar.
 */
export function BreadcrumbNav({
  breadcrumbs,
  onNavigate,
}: {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string }) => void;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-base text-[var(--ink)]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {isLast || !crumb.page ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="font-bold underline decoration-[var(--lavender)] decoration-4 underline-offset-4"
                >
                  {crumb.label}
                </span>
              ) : (
                <a
                  href={`#${crumb.page}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(crumb.page!, {
                      departmentId: crumb.departmentId ?? '',
                      labId: crumb.labId ?? '',
                    });
                  }}
                  className="inline-flex min-h-[44px] items-center px-1 underline underline-offset-4"
                >
                  {crumb.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Renders the shared campus footer with brand mark, quick links, and summary counts.
 *
 * @param props - Current page ID, catalog counts, and route click callback.
 * @returns Footer landmark element.
 */
export function SiteFooter({
  currentPage,
  deptCount,
  labCount,
  itemCount,
  onNavigate,
}: {
  currentPage: PageId;
  deptCount: number;
  labCount: number;
  itemCount: number;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <footer className="border-t-2 border-[var(--ink)] bg-[var(--white)]">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-6 text-base text-[var(--ink)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <FlaskDoodle className="h-7 w-7 shrink-0" />
          <span className="font-heading text-2xl font-bold">LABORA</span>
          <span aria-hidden="true">·</span>
          <span>Every lab. One notebook.</span>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-4">
          {NAV_ITEMS.map((nav) => {
            const isActive = currentPage === nav.id;
            return (
              <a
                key={nav.id}
                href={`#${nav.id}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(nav.id);
                }}
                className="inline-flex min-h-[44px] items-center px-1 underline underline-offset-4 whitespace-nowrap"
              >
                {nav.label}
              </a>
            );
          })}
        </nav>

        <div className="tabular-nums text-sm">
          {deptCount} Depts · {labCount} Labs · {itemCount} Instruments
        </div>
      </div>
    </footer>
  );
}
