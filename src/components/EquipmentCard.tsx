/**
 * Reusable equipment card presenting status, access rules, doodle artwork, and booking actions.
 */
import { AlertTriangle, CalendarClock, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { AppPageId } from '../js/filter';
import type { EquipmentItem } from '../js/types';
import { EquipmentDoodle } from './LabDoodles';

export type PageId = AppPageId;

interface EquipmentCardProps {
  item: EquipmentItem;
  departmentName?: string;
  labName?: string;
  onBookItem: (itemId: string) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

const STATUS_META: Record<
  EquipmentItem['status'],
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Available: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Limited: { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Booked: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

/**
 * Renders a single campus equipment card with doodle artwork, status badge, specs, and actions.
 *
 * @param props - Component properties containing item data, scope labels, and action handlers.
 * @returns Article element displaying equipment details and actions.
 */
export function EquipmentCard({
  item,
  departmentName,
  labName,
  onBookItem,
  onInspectItem,
}: EquipmentCardProps) {
  const statusInfo = STATUS_META[item.status];
  const StatusIcon = statusInfo.Icon;

  return (
    <article className="notebook-sheet flex flex-col justify-between p-5">
      <div>
        {/* Hand-drawn Equipment Doodle Banner */}
        <div className="flex items-center justify-between gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--ink)] truncate">
              {departmentName || 'Campus Lab'}
            </div>
            <div className="text-sm text-[var(--ink)]">
              {item.type}
            </div>
          </div>
          <EquipmentDoodle
            type={item.type}
            departmentId={item.departmentId}
            className="h-16 w-16 shrink-0"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={statusInfo.className}>
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.status}</span>
          </span>
          <span className="text-sm text-[var(--ink)]">{item.accessLevel}</span>
        </div>

        <h3 className="mt-2.5 text-2xl font-bold leading-snug text-[var(--ink)]">
          {item.name}
        </h3>

        <p className="mt-1.5 text-base leading-relaxed text-[var(--ink)]">
          {item.specs}
        </p>

        <dl className="mt-4 space-y-1.5 border-t-2 border-dashed border-[var(--border-subtle)] pt-3 text-base">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold text-[var(--ink)] shrink-0">Location</dt>
            <dd className="text-right text-[var(--ink)] truncate">
              {labName ? `${item.location} (${labName})` : item.location}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold text-[var(--ink)] shrink-0">Next Slot</dt>
            <dd className="tabular-nums text-right text-[var(--ink)]">
              {item.nextFreeSlot}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => onBookItem(item.id)}
          className="labora-btn flex-1"
        >
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          Book slot
        </button>

        <button
          type="button"
          onClick={(e) => onInspectItem(item.id, e.currentTarget)}
          className="labora-btn labora-btn-paper"
        >
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Details
        </button>
      </div>
    </article>
  );
}
