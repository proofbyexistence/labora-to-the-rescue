/**
 * Mon–Sat 09:00–17:00 weekly equipment availability grid and active week booking release list.
 */
import type { MouseEvent, RefObject } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Lock, Pin } from 'lucide-react';
import {
  formatDayHeader,
  formatFullDayHourLabel,
  getSlotCellMeta,
  START_HOURS,
} from '../js/booking-view-helpers';
import { formatHour, type ScheduleSlot } from '../js/scheduler';
import type { TimeSlot } from '../js/types';

interface WeeklySlotGridProps {
  itemName: string;
  weekDates: string[];
  slotLookup: Map<string, ScheduleSlot>;
  conflictSlotKeys: Set<string>;
  pickedSlotKeys: Set<string>;
  activeWeekBookings: TimeSlot[];
  calendarSectionRef: RefObject<HTMLElement | null>;
  firstCalendarSlotRef: RefObject<HTMLButtonElement | null>;
  onShiftWeek: (deltaDays: number) => void;
  onSelectSlot: (date: string, start: string) => void;
  onReleaseSlot: (slotId: string, windowLabel: string, date: string) => void;
}

const CELL_ICONS = {
  booked: Lock,
  picked: Pin,
  conflict: AlertTriangle,
  free: CheckCircle2,
} as const;

/**
 * Renders the accessible Mon–Sat weekly schedule table, status legend, and weekly booking list.
 *
 * @param props - Week dates, slot lookup map, selection/conflict highlights, and slot actions.
 * @returns Weekly schedule calendar section.
 */
export function WeeklySlotGrid({
  itemName,
  weekDates,
  slotLookup,
  conflictSlotKeys,
  pickedSlotKeys,
  activeWeekBookings,
  calendarSectionRef,
  firstCalendarSlotRef,
  onShiftWeek,
  onSelectSlot,
  onReleaseSlot,
}: WeeklySlotGridProps) {
  const handleTableClick = (event: MouseEvent<HTMLTableSectionElement>) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-slot-date][data-slot-start]');
    if (!btn || btn.disabled) return;
    const slotDate = btn.dataset.slotDate ?? '';
    const slotStart = btn.dataset.slotStart ?? '';
    if (slotDate && slotStart) onSelectSlot(slotDate, slotStart);
  };

  return (
    <section
      ref={calendarSectionRef}
      aria-labelledby="weekly-calendar-heading"
      className="notebook-sheet calendar-card-stable p-5 xl:col-span-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h2 id="weekly-calendar-heading" className="text-2xl font-bold text-[var(--ink)]">
            Weekly Lab Schedule
          </h2>
          <p className="text-sm tabular-nums text-[var(--ink)]">
            Week of {weekDates[0]} to {weekDates[5]} · Mon–Sat, 09:00–17:00
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onShiftWeek(-7)} className="labora-btn labora-btn-paper !px-3 text-sm" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          <button type="button" onClick={() => onShiftWeek(7)} className="labora-btn labora-btn-paper !px-3 text-sm" aria-label="Next week">
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div aria-label="Slot status legend" className="mt-3 flex flex-wrap items-center gap-2.5 text-sm">
        <span className="status-badge bg-[var(--white)]">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Free</span>
        </span>
        <span className="status-badge status-badge-booked">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Booked</span>
        </span>
        <span className="status-badge bg-[var(--lavender)] !text-[var(--on-lavender)]">
          <Pin className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Your pick</span>
        </span>
        <span className="status-badge status-badge-limited">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Conflict</span>
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[540px] border-separate border-spacing-1.5 text-center">
          <caption className="sr-only">
            Weekly schedule for {itemName}, week of {weekDates[0]} to {weekDates[5]}, Monday to Saturday, 09:00 to 17:00
          </caption>
          <thead>
            <tr className="text-sm font-bold text-[var(--ink)]">
              <th scope="col" className="py-1.5 text-left">
                Time
              </th>
              {weekDates.map((date) => {
                const { weekday, shortDate } = formatDayHeader(date);
                return (
                  <th key={date} scope="col" className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--paper)] py-1 font-bold">
                    <div>{weekday}</div>
                    <div className="text-xs font-normal tabular-nums">{shortDate}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody onClick={handleTableClick}>
            {START_HOURS.map((hour, rowIdx) => {
              const startStr = formatHour(hour);
              return (
                <tr key={startStr}>
                  <th scope="row" className="tabular-nums text-left text-sm font-bold text-[var(--ink)]">
                    {startStr}
                  </th>
                  {weekDates.map((date, colIdx) => {
                    const key = `${date}|${startStr}`;
                    const slot = slotLookup.get(key);
                    const isBooked = slot?.status === 'booked';
                    const meta = getSlotCellMeta(
                      isBooked,
                      !isBooked && pickedSlotKeys.has(key),
                      !isBooked && conflictSlotKeys.has(key),
                      slot?.bookedBy
                    );
                    const CellIcon = CELL_ICONS[meta.kind];
                    return (
                      <td key={key} className="p-0">
                        <button
                          ref={rowIdx === 0 && colIdx === 0 ? firstCalendarSlotRef : undefined}
                          type="button"
                          disabled={isBooked}
                          data-slot-date={date}
                          data-slot-start={startStr}
                          aria-pressed={meta.kind === 'picked'}
                          aria-label={formatFullDayHourLabel(date, hour, meta.stateLabel)}
                          className={`flex min-h-[44px] w-full items-center justify-center gap-1 rounded-[8px] border-2 border-[var(--ink)] px-1.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                            meta.kind === 'picked' ? 'text-[var(--on-lavender)]' : 'text-[var(--ink)]'
                          } ${meta.cellBg}`}
                        >
                          <CellIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{meta.shortText}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeWeekBookings.length > 0 && (
        <div className="mt-5 border-t-2 border-dashed border-[var(--border-subtle)] pt-4">
          <h3 className="text-xl font-bold text-[var(--ink)]">Booked Sessions This Week</h3>
          <ul className="mt-2 space-y-2">
            {activeWeekBookings.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-bold tabular-nums">
                    {slot.date} · {slot.window}
                  </span>
                  <span className="ml-2">
                    — {slot.bookedBy} {slot.note ? `(${slot.note})` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onReleaseSlot(slot.id, slot.window, slot.date)}
                  className="labora-btn labora-btn-paper !px-3 !py-1 text-xs"
                >
                  Release Slot
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
