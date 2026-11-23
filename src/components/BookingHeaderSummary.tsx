/**
 * Smart Booking equipment header, dropdown item switcher, and specification summary tiles.
 */
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../js/types';
import { EquipmentDoodle } from './LabDoodles';

const STATUS_BADGE_META: Record<EquipmentItem['status'], { className: string; Icon: typeof CheckCircle2 }> = {
  Available: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Limited: { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Booked: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

interface BookingHeaderSummaryProps {
  currentItem: EquipmentItem;
  departments: Department[];
  allItems: EquipmentItem[];
  departmentName?: string;
  currentLab?: Lab;
  onSelectItem: (itemId: string) => void;
}

/**
 * Renders the Smart Booking page header, equipment selector, and live metadata tiles.
 *
 * @param props - Active equipment item, catalog options, lab metadata, and selection handler.
 * @returns Equipment summary section element.
 */
export function BookingHeaderSummary({
  currentItem,
  departments,
  allItems,
  departmentName,
  currentLab,
  onSelectItem,
}: BookingHeaderSummaryProps) {
  const itemStatusMeta = STATUS_BADGE_META[currentItem.status];
  const ItemStatusIcon = itemStatusMeta.Icon;

  return (
    <section className="notebook-sheet p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[var(--ink)] pb-5">
        <div>
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">Smart Booking</h1>
          <p className="mt-1 text-base text-[var(--ink)]">
            Inspect weekly Mon–Sat lab availability (09:00–17:00), reserve a session, or resolve competing requests.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <label htmlFor="booking-item-select" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            Equipment Item
          </label>
          <select
            id="booking-item-select"
            value={currentItem.id}
            onChange={(e) => onSelectItem(e.target.value)}
            className="notebook-input"
          >
            {departments.map((dept) => (
              <optgroup key={dept.id} label={dept.name}>
                {allItems
                  .filter((item) => item.departmentId === dept.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.status})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col items-center justify-center rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-center lg:col-span-4">
          <EquipmentDoodle type={currentItem.type} departmentId={currentItem.departmentId} className="h-24 w-24" />
          <h2 className="mt-2 text-2xl font-bold text-[var(--ink)]">{currentItem.name}</h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className={itemStatusMeta.className}>
              <ItemStatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{currentItem.status}</span>
            </span>
            <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
              {currentItem.accessLevel}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 text-base lg:col-span-8">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
              <div className="text-xs font-bold text-[var(--ink)]">Department</div>
              <div>{departmentName}</div>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
              <div className="text-xs font-bold text-[var(--ink)]">Laboratory &amp; Room</div>
              <div className="tabular-nums">
                {currentLab?.name} ({currentLab?.room})
              </div>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
              <div className="text-xs font-bold text-[var(--ink)]">Supervisor</div>
              <div>{currentLab?.supervisor}</div>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
              <div className="text-xs font-bold text-[var(--ink)]">Next Free Slot</div>
              <div className="tabular-nums">{currentItem.nextFreeSlot}</div>
            </div>
          </div>
          <p className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2.5 text-base text-[var(--ink)]">
            <strong className="mr-1.5">Specs:</strong>
            {currentItem.specs}
          </p>
        </div>
      </div>
    </section>
  );
}
