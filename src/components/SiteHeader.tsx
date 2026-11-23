/**
 * Sticky campus notebook header with logo, desktop/mobile navigation, role switcher, and theme toggle.
 */
import type { RefObject } from 'react';
import { Menu, Moon, RefreshCw, Sun, X } from 'lucide-react';
import type { ThemeMode } from '../js/theme';
import type { CampusUser, UserRole } from '../js/types';
import type { PageId } from './EquipmentCard';
import { FlaskDoodle } from './LabDoodles';

export const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'booking', label: 'Smart Booking' },
  { id: 'request', label: 'Request Access' },
  { id: 'approvals', label: 'Faculty Approvals' },
];

interface SiteHeaderProps {
  currentPage: PageId;
  currentUser: CampusUser;
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarToggleRef: RefObject<HTMLButtonElement | null>;
  onToggleSidebar: () => void;
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string; itemId?: string }) => void;
  onSwitchRole: (role: UserRole) => void;
  onToggleTheme: () => void;
}

function NavLinkList({
  currentPage,
  compact,
  onNavigate,
}: {
  currentPage: PageId;
  compact: boolean;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <>
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
            className={`nav-link-notebook ${compact ? '!py-1 text-base' : ''} ${
              isActive ? 'nav-link-active' : ''
            }`}
          >
            {nav.label}
          </a>
        );
      })}
    </>
  );
}

/**
 * Renders the top navigation bar and compact mobile link strip.
 *
 * @param props - Navigation, role switcher, sidebar toggle, and theme callbacks.
 * @returns Header landmark element.
 */
export function SiteHeader({
  currentPage,
  currentUser,
  theme,
  sidebarOpen,
  sidebarToggleRef,
  onToggleSidebar,
  onNavigate,
  onSwitchRole,
  onToggleTheme,
}: SiteHeaderProps) {
  const nextRole: UserRole = currentUser.role === 'student' ? 'faculty' : 'student';

  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-[var(--white)]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            ref={sidebarToggleRef}
            type="button"
            onClick={onToggleSidebar}
            className="labora-btn labora-btn-paper !px-2.5 lg:hidden"
            aria-label={sidebarOpen ? 'Close Lab Index sidebar' : 'Open Lab Index sidebar'}
            aria-expanded={sidebarOpen}
            aria-controls="lab-index-sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
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

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-2">
          <NavLinkList currentPage={currentPage} compact={false} onNavigate={onNavigate} />
        </nav>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            onClick={onToggleTheme}
            className="labora-btn labora-btn-paper !px-3"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center gap-2 overflow-x-auto border-t-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-2"
      >
        <NavLinkList currentPage={currentPage} compact onNavigate={onNavigate} />
      </nav>
    </header>
  );
}
