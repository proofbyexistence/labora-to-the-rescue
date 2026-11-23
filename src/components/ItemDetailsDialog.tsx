/**
 * Accessible focus-trapped equipment specification modal with booking and access shortcuts.
 */
import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../js/types';
import { EquipmentDoodle } from './LabDoodles';

interface ItemDetailsDialogProps {
  item: EquipmentItem | null;
  department?: Department;
  lab?: Lab;
  onClose: () => void;
  onBookItem: (itemId: string) => void;
  onRequestAccess: (itemId: string) => void;
}

const STATUS_META: Record<
  EquipmentItem['status'],
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Available: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Limited: { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Booked: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

export function ItemDetailsDialog({
  item,
  department,
  lab,
  onClose,
  onBookItem,
  onRequestAccess,
}: ItemDetailsDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!item) return;

    // Move keyboard focus into the dialog, trap Tab cycling, and close cleanly on Escape.
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  const statusMeta = STATUS_META[item.status];
  const StatusIcon = statusMeta.Icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-details-title"
        aria-describedby="item-details-specs"
        className="notebook-sheet max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--ink)] pb-4">
          <div className="flex items-center gap-4">
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-2">
              <EquipmentDoodle
                type={item.type}
                departmentId={item.departmentId}
                className="h-14 w-14 shrink-0"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--ink)]">
                {item.id} · {item.type}
              </div>
              <h2
                id="item-details-title"
                className="text-3xl font-bold leading-tight text-[var(--ink)]"
              >
                {item.name}
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="labora-btn labora-btn-paper !px-3"
            aria-label="Close equipment details dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={statusMeta.className}>
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.status}</span>
          </span>
          <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-3 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
            {item.accessLevel}
          </span>
        </div>

        <p
          id="item-details-specs"
          className="mt-4 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4 text-base leading-relaxed text-[var(--ink)]"
        >
          {item.specs}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 border-t-2 border-dashed border-[var(--border-subtle)] pt-4 text-base sm:grid-cols-2">
          <div>
            <dt className="text-sm font-bold text-[var(--ink)]">Department</dt>
            <dd className="text-[var(--ink)]">
              {department ? `${department.name} (${department.code}) · ${department.building}` : item.departmentId}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--ink)]">Laboratory</dt>
            <dd className="text-[var(--ink)]">
              {lab ? `${lab.name} (${lab.room})` : item.labId}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--ink)]">Bench Location</dt>
            <dd className="text-[var(--ink)]">{item.location}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--ink)]">Next Free Slot</dt>
            <dd className="tabular-nums text-[var(--ink)]">{item.nextFreeSlot}</dd>
          </div>
          {lab && (
            <>
              <div>
                <dt className="text-sm font-bold text-[var(--ink)]">Lab Supervisor</dt>
                <dd className="text-[var(--ink)]">{lab.supervisor}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-[var(--ink)]">Lab Hours</dt>
                <dd className="tabular-nums text-[var(--ink)]">{lab.hours}</dd>
              </div>
            </>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t-2 border-[var(--ink)] pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestAccess(item.id);
            }}
            className="labora-btn labora-btn-paper"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Request Access
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onBookItem(item.id);
            }}
            className="labora-btn"
          >
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Book Slot
          </button>
        </div>
      </div>
    </div>
  );
}
