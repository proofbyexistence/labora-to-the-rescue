/**
 * Shared application shell coordinating navbar, Lab Index sidebar, theme state, and footer.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getDepartments, getItems, getLabs, getRequests } from '../js/lab-data';
import { isPendingStatus } from '../js/requests';
import { applyTheme, getInitialTheme, saveTheme, watchSystemTheme, type ThemeMode } from '../js/theme';
import type { CampusUser, UserRole } from '../js/types';
import { DaydreamStrip } from './DaydreamStrip';
import type { PageId } from './EquipmentCard';
import { DoodleSprite } from './LabDoodles';
import { LabIndexSidebar } from './LabIndexSidebar';
import { BreadcrumbNav, SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

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
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string; itemId?: string }) => void;
  onSwitchRole: (role: UserRole) => void;
  children: ReactNode;
}

/**
 * Wraps every page in the shared notebook shell, skip link, sidebar, and daydream footer.
 *
 * @param props - Active route state, user role, breadcrumbs, and page children.
 * @returns Full page layout tree.
 */
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

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => watchSystemTheme((systemTheme) => setTheme(systemTheme)), []);

  useEffect(() => {
    if (selectedDepartmentId) {
      setExpandedDeptIds((prev) =>
        prev[selectedDepartmentId] ? prev : { ...prev, [selectedDepartmentId]: true }
      );
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (!sidebarOpen) return;
    window.requestAnimationFrame(() => {
      sidebarRef.current?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
        window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const departments = getDepartments();
  const allLabs = getLabs();
  const allItems = getItems();
  const pendingCount = getRequests().filter((req) => isPendingStatus(req.status)).length;

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  };

  return (
    <div className="notebook-canvas flex min-h-screen flex-col text-[var(--ink)]">
      <DoodleSprite />
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

      <SiteHeader
        currentPage={currentPage}
        currentUser={currentUser}
        theme={theme}
        sidebarOpen={sidebarOpen}
        sidebarToggleRef={sidebarToggleRef}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onNavigate={onNavigate}
        onSwitchRole={onSwitchRole}
        onToggleTheme={handleToggleTheme}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1360px] flex-1 flex-col lg:flex-row gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <LabIndexSidebar
          sidebarOpen={sidebarOpen}
          sidebarRef={sidebarRef}
          currentPage={currentPage}
          selectedDepartmentId={selectedDepartmentId}
          selectedLabId={selectedLabId}
          expandedDeptIds={expandedDeptIds}
          departments={departments}
          labCount={allLabs.length}
          itemCount={allItems.length}
          pendingCount={pendingCount}
          onSelectDepartment={(deptId) => {
            setSidebarOpen(false);
            if (deptId) setExpandedDeptIds((prev) => ({ ...prev, [deptId]: true }));
            onNavigate('discover', { departmentId: deptId, labId: '' });
          }}
          onSelectLab={(deptId, labId) => {
            setSidebarOpen(false);
            setExpandedDeptIds((prev) => ({ ...prev, [deptId]: true }));
            onNavigate('discover', { departmentId: deptId, labId });
          }}
          onCloseMobileSidebar={() => {
            setSidebarOpen(false);
            window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
          }}
        />

        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <BreadcrumbNav breadcrumbs={breadcrumbs} onNavigate={onNavigate} />
          {children}
        </main>
      </div>

      <div className="relative z-10 mt-10">
        <DaydreamStrip />
        <SiteFooter
          currentPage={currentPage}
          deptCount={departments.length}
          labCount={allLabs.length}
          itemCount={allItems.length}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
