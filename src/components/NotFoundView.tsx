/**
 * Friendly 404 recovery view with direct navigation back to the campus home spread.
 */
import { Home } from 'lucide-react';
import type { PageId } from './EquipmentCard';
import { HeroBenchDoodle } from './LabDoodles';

interface NotFoundViewProps {
  onNavigateHome: (page: PageId, options: { departmentId: string; labId: string }) => void;
}

/**
 * Renders the 404 fallback card when an unknown route path is visited.
 *
 * @param props - Navigation handler back to the Home view.
 * @returns Friendly notebook-styled 404 section.
 */
export function NotFoundView({ onNavigateHome }: NotFoundViewProps) {
  return (
    <section className="notebook-sheet p-8 text-center">
      <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
      <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">Page not found (404)</h1>
      <p className="mx-auto mt-2 max-w-lg text-base text-[var(--ink)]">
        That page or section is not in the LABORA campus notebook. Return home to browse departments, reserve lab slots, or submit an access request.
      </p>
      <div className="mt-5 flex justify-center">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome('home', { departmentId: '', labId: '' });
          }}
          className="labora-btn"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Back to Home</span>
        </a>
      </div>
    </section>
  );
}
