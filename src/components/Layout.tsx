import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Menu,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import {
  getDepartments,
  getItems,
  getLabs,
  getRequests,
} from '../js/labData';
import { isPendingStatus } from '../js/requests';
import {
  applyTheme,
  getInitialTheme,
  saveTheme,
  watchSystemTheme,
  type ThemeMode,
} from '../js/theme';
import type { CampusUser, UserRole } from '../js/types';
import { DaydreamStrip } from './DaydreamStrip';
import type { PageId } from './EquipmentCard';
import { DepartmentDoodle, DoodleSprite, FlaskDoodle } from './LabDoodles';

export interface BreadcrumbItem {
  label: string;
  page?: PageId;
  departmentId?: string;
  labId?: string;
}

interface LayoutProps {
  currentPage: PageId;
  currentUser: CampusUser;
  selectedDepartmentId: string;
  selectedLabId: string;
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onSwitchRole: (role: UserRole) => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'booking', label: 'Smart Booking' },
  { id: 'request', label: 'Request Access' },
  { id: 'approvals', label: 'Faculty Approvals' },
];

export function Layout({
  currentPage,
  currentUser,
  selectedDepartmentId,
  selectedLabId,
  breadcrumbs,
  onNavigate,
  onSwitchRole,
  children,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Record<string, boolean>>(() =>
    selectedDepartmentId ? { [selectedDepartmentId]: true } : {}
  );

  const mainRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    return watchSystemTheme((systemTheme) => {
      setTheme(systemTheme);
    });
  }, []);

  useEffect(() => {
    // Keep the active department expanded in the Lab Index when navigated via URL/breadcrumbs.
    if (selectedDepartmentId) {
      setExpandedDeptIds((prev) =>
        prev[selectedDepartmentId] ? prev : { ...prev, [selectedDepartmentId]: true }
      );
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (!sidebarOpen) return;

    window.requestAnimationFrame(() => {
      const firstInteractive = sidebarRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href]'
      );
      firstInteractive?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
        window.requestAnimationFrame(() => {
          sidebarToggleRef.current?.focus();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const departments = getDepartments();
  const allLabs = getLabs();
  const allItems = getItems();
  const pendingRequests = getRequests().filter((req) => isPendingStatus(req.status));

  const nextRole: UserRole = currentUser.role === 'student' ? 'faculty' : 'student';

  const closeMobileSidebarAndReturnFocus = () => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => {
      sidebarToggleRef.current?.focus();
    });
  };

  const handleSelectDepartment = (departmentId: string) => {
    setSidebarOpen(false);
    if (departmentId) {
      setExpandedDeptIds((prev) => ({ ...prev, [departmentId]: true }));
    }
    onNavigate('discover', { departmentId, labId: '' });
  };

  const handleSelectLab = (departmentId: string, labId: string) => {
    setSidebarOpen(false);
    setExpandedDeptIds((prev) => ({ ...prev, [departmentId]: true }));
    onNavigate('discover', { departmentId, labId });
  };

  return (
    <div className="notebook-canvas flex min-h-screen flex-col text-[var(--ink)]">
      <DoodleSprite />
      {/* First focusable element: moves keyboard focus straight to <main> */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }}
      >
        Skip to main content
      </a>

      {/* Shared Top Navbar: flask doodle logo, 5 links, role switcher, sun/moon button */}
      <header className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-[var(--white)]">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              ref={sidebarToggleRef}
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="labora-btn labora-btn-paper !px-2.5 lg:hidden"
              aria-label={sidebarOpen ? 'Close Lab Index sidebar' : 'Open Lab Index sidebar'}
              aria-expanded={sidebarOpen}
              aria-controls="lab-index-sidebar"
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('home', { departmentId: '', labId: '' });
              }}
              className="inline-flex min-h-[44px] items-center gap-2 font-heading text-3xl font-bold tracking-tight text-[var(--ink)] whitespace-nowrap shrink-0"
            >
              <FlaskDoodle className="h-9 w-9 shrink-0" />
              <span>LABORA</span>
            </a>
          </div>

          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-2"
          >
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
                  className={`nav-link-notebook ${isActive ? 'nav-link-active' : ''}`}
                >
                  {nav.label}
                </a>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Demo role switch stored in localStorage for previewing Student vs Faculty views (not real authentication). */}
            <button
              type="button"
              onClick={() => onSwitchRole(nextRole)}
              className="labora-btn text-base"
              aria-label={`Demo role switch: currently ${currentUser.role === 'student' ? 'Student' : 'Faculty'} (${currentUser.name}). Activate to switch to ${nextRole}.`}
              title={`Demo role switch — click to preview ${nextRole} view`}
            >
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {currentUser.role === 'student' ? 'Student' : 'Faculty'} · {currentUser.name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
                setTheme(nextTheme);
                applyTheme(nextTheme);
                saveTheme(nextTheme);
              }}
              className="labora-btn labora-btn-paper !px-3"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-pressed={theme === 'dark'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Compact mobile navigation row */}
        <nav
          aria-label="Mobile navigation"
          className="flex md:hidden items-center gap-2 overflow-x-auto border-t-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-2"
        >
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
                className={`nav-link-notebook !py-1 text-base ${
                  isActive ? 'nav-link-active' : ''
                }`}
              >
                {nav.label}
              </a>
            );
          })}
        </nav>
      </header>

      {/* Main Workspace: Lab Index Notebook-Tab Sidebar + Centered Main Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1360px] flex-1 flex-col lg:flex-row gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <aside
          id="lab-index-sidebar"
          ref={sidebarRef}
          aria-label="Lab Index"
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-76 shrink-0`}
        >
          <div className="notebook-sheet notebook-sheet-alt-tape sticky top-24 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
              <div>
                <h2 className="text-2xl font-bold text-[var(--ink)]">
                  Lab Index
                </h2>
                <p className="text-sm text-[var(--ink)]">
                  {departments.length} departments · {allLabs.length} labs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectDepartment('')}
                  aria-current={
                    currentPage === 'discover' && !selectedDepartmentId && !selectedLabId
                      ? 'true'
                      : undefined
                  }
                  className="labora-btn !px-3 !py-1 text-sm"
                >
                  All Labs
                </button>
                <button
                  type="button"
                  onClick={closeMobileSidebarAndReturnFocus}
                  aria-label="Close Lab Index"
                  className="labora-btn labora-btn-paper !px-2.5 lg:hidden"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-3" aria-label="Departments and laboratories">
              {departments.map((dept) => {
                const deptLabs = getLabs(dept.id);
                const isDeptActive =
                  currentPage === 'discover' && selectedDepartmentId === dept.id && !selectedLabId;
                const isExpanded =
                  Boolean(expandedDeptIds[dept.id]) || selectedDepartmentId === dept.id;

                return (
                  <li key={dept.id} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectDepartment(dept.id)}
                      aria-expanded={isExpanded}
                      aria-current={isDeptActive ? 'true' : undefined}
                      className={`lab-index-tab font-bold ${
                        isDeptActive ? 'lab-index-tab-active' : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <DepartmentDoodle departmentId={dept.id} className="h-6 w-6 shrink-0" />
                        <span className="truncate">{dept.name}</span>
                      </span>
                      <span className="tabular-nums text-sm shrink-0">{dept.code}</span>
                    </button>

                    {isExpanded && (
                      <ul className="space-y-1.5 pl-3">
                        {deptLabs.map((lab) => {
                          const isLabActive =
                            currentPage === 'discover' && selectedLabId === lab.id;
                          return (
                            <li key={lab.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectLab(dept.id, lab.id)}
                                aria-current={isLabActive ? 'true' : undefined}
                                className={`lab-index-tab !py-1.5 text-sm ${
                                  isLabActive ? 'lab-index-tab-active font-bold' : ''
                                }`}
                              >
                                <span className="truncate">{lab.name}</span>
                                <span className="tabular-nums text-xs shrink-0">{lab.room}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 border-t-2 border-dashed border-[var(--border-subtle)] pt-3 text-base text-[var(--ink)]">
              <div className="flex items-center justify-between">
                <span>Catalog Items</span>
                <span className="tabular-nums font-bold">{allItems.length}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Pending Reviews</span>
                <span className="tabular-nums font-bold">{pendingRequests.length}</span>
              </div>
            </div>
          </div>
        </aside>

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 focus:outline-none"
        >
          <nav
            aria-label="Breadcrumb"
            className="mb-5 text-base text-[var(--ink)]"
          >
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

          {children}
        </main>
      </div>

      {/* Stick-Figure Daydream Strip Above Footer + Shared Footer */}
      <div className="relative z-10 mt-10">
        <DaydreamStrip />

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
              {departments.length} Depts · {allLabs.length} Labs · {allItems.length} Instruments
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
