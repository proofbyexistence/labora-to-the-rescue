/**
 * Pure presentation and grid-mapping helpers for Smart Booking weekly calendar and slot state.
 */
import { LAB_SCHEDULE } from './constants';
import { formatHour, parseHour, type ConflictGroup } from './scheduler';

/** Canonical Mon–Sat starting hour integers (09..16). */
export const START_HOURS = Array.from(
  { length: LAB_SCHEDULE.END_HOUR - LAB_SCHEDULE.START_HOUR },
  (_, idx) => LAB_SCHEDULE.START_HOUR + idx
);

/** Supported custom booking durations (1 to 4 hours). */
export const BOOKING_DURATION_OPTIONS = Array.from(
  { length: LAB_SCHEDULE.MAX_BOOKING_HOURS - LAB_SCHEDULE.MIN_BOOKING_HOURS + 1 },
  (_, idx) => LAB_SCHEDULE.MIN_BOOKING_HOURS + idx
);

/**
 * Formats an ISO date into short weekday and month/day header labels using UTC.
 *
 * @param isoDate - YYYY-MM-DD date string.
 * @returns Short weekday (`Mon`) and date (`Nov 23`) labels.
 */
export function formatDayHeader(isoDate: string): { weekday: string; shortDate: string } {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    shortDate: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  };
}

/**
 * Builds an accessible ARIA label describing a single grid cell's day, hour, and booking state.
 *
 * @param isoDate - YYYY-MM-DD date string.
 * @param hour - 24-hour integer start hour.
 * @param stateLabel - Human-readable slot status phrase.
 * @returns Screen-reader label string.
 */
export function formatFullDayHourLabel(isoDate: string, hour: number, stateLabel: string): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const fullDay = dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour > 12 ? hour - 12 : hour;
  return `${fullDay} ${hour12} ${suffix}, ${stateLabel}`;
}

/**
 * Computes `YYYY-MM-DD|HH:MM` lookup keys spanning the user's selected start hour and duration.
 *
 * @param date - Selected YYYY-MM-DD booking date.
 * @param start - Selected `HH:MM` start time.
 * @param durationHours - Selected duration in whole hours.
 * @returns Set of slot keys covered by the selection.
 */
export function buildPickedSlotKeys(date: string, start: string, durationHours: number): Set<string> {
  const picked = new Set<string>();
  const startHour = parseHour(start);
  if (!Number.isFinite(startHour)) return picked;
  for (let offset = 0; offset < durationHours; offset += 1) {
    picked.add(`${date}|${formatHour(startHour + offset)}`);
  }
  return picked;
}

/**
 * Expands item conflict windows into `YYYY-MM-DD|HH:MM` hourly keys for table highlighting.
 *
 * @param conflicts - Conflict groups scoped to the current equipment item.
 * @returns Set of contested hour keys.
 */
export function buildConflictSlotKeys(conflicts: ConflictGroup[]): Set<string> {
  const keys = new Set<string>();
  for (const conflict of conflicts) {
    const startH = parseHour(conflict.start);
    const endH = parseHour(conflict.end);
    for (let h = startH; h < endH; h += 1) {
      keys.add(`${conflict.date}|${formatHour(h)}`);
    }
  }
  return keys;
}

/**
 * Resolves visual class, label, and status text for a single weekly schedule cell.
 *
 * @param isBooked - Whether the hourly slot is already booked.
 * @param isPicked - Whether the cell falls inside the active form selection.
 * @param isConflict - Whether the cell is part of an active request conflict.
 * @param bookedBy - Optional occupant name if booked.
 * @returns State label, short text, and Tailwind cell styling classes.
 */
export function getSlotCellMeta(
  isBooked: boolean,
  isPicked: boolean,
  isConflict: boolean,
  bookedBy?: string | null
): { stateLabel: string; cellBg: string; shortText: string; kind: 'booked' | 'picked' | 'conflict' | 'free' } {
  if (isBooked) {
    return {
      kind: 'booked',
      stateLabel: `booked by ${bookedBy ?? 'student'}`,
      cellBg: 'bg-[var(--status-booked-bg)] border-dashed cursor-not-allowed',
      shortText: 'Booked',
    };
  }
  if (isPicked) {
    return {
      kind: 'picked',
      stateLabel: 'your pick',
      cellBg: 'bg-[var(--lavender)] shadow-[2px_2px_0_var(--ink)]',
      shortText: 'Pick',
    };
  }
  if (isConflict) {
    return {
      kind: 'conflict',
      stateLabel: 'conflict',
      cellBg: 'bg-[var(--status-limited-bg)] hover:bg-[var(--lavender-soft)]',
      shortText: 'Conflict',
    };
  }
  return {
    kind: 'free',
    stateLabel: 'free',
    cellBg: 'bg-[var(--white)] hover:bg-[var(--lavender-soft)]',
    shortText: 'Free',
  };
}
