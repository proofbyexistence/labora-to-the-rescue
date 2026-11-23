/**
 * Slot time parsing and Mon–Sat weekly hourly grid expansion helpers.
 */
import { LAB_SCHEDULE } from './constants';
import type { ScheduleSlot } from './scheduler-types';
import type { TimeSlot } from './types';
import { addDaysIso, parseIsoDateUtc } from './validation';

/**
 * Formats an integer 24-hour clock value as `HH:00`.
 *
 * @param hour - Whole hour in 0–23.
 * @returns Zero-padded `HH:00` time string.
 */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Parses a strict whole-hour `HH:00` string into an integer hour.
 *
 * @param timeStr - Candidate time string (e.g., `09:00`).
 * @returns Integer hour, or `NaN` when invalid or non-zero minutes.
 */
export function parseHour(timeStr: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return Number.NaN;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute !== 0) {
    return Number.NaN;
  }
  return hour;
}

/**
 * Extracts integer start and end hours from either explicit fields or a `HH:MM – HH:MM` window.
 *
 * @param slot - Stored time slot record.
 * @returns Start/end hour pair, or null when unparseable.
 */
export function parseWindowRange(slot: TimeSlot): { startHour: number; endHour: number } | null {
  if (slot.start && slot.end) {
    const startHour = Number.parseInt(slot.start.split(':')[0], 10);
    const endHour = Number.parseInt(slot.end.split(':')[0], 10);
    if (Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour) {
      return { startHour, endHour };
    }
  }
  const parts = slot.window.split(/[–-]/).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const startHour = Number.parseInt(parts[0].split(':')[0], 10);
  const endHour = Number.parseInt(parts[1].split(':')[0], 10);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
    return null;
  }
  return { startHour, endHour };
}

/**
 * Computes the six Monday–Saturday ISO dates for the week containing `anchorDate`.
 *
 * @param anchorDate - Anchor `YYYY-MM-DD` date.
 * @returns Ordered Mon–Sat ISO date array.
 */
export function buildWeekDates(anchorDate: string = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE): string[] {
  const dt =
    parseIsoDateUtc(anchorDate) ?? parseIsoDateUtc(LAB_SCHEDULE.DEFAULT_REFERENCE_DATE)!;
  const day = dt.getUTCDay();
  const mondayOffset = day === LAB_SCHEDULE.CLOSED_WEEKDAY_SUNDAY ? 1 : 1 - day;
  const mondayStr = addDaysIso(dt.toISOString().slice(0, 10), mondayOffset);
  return Array.from({ length: LAB_SCHEDULE.OPEN_DAYS_PER_WEEK }, (_, idx) =>
    addDaysIso(mondayStr, idx)
  );
}

function buildGridCellsForWeek(
  itemId: string,
  weekDates: string[],
  bookedLookup: Map<string, TimeSlot>
): ScheduleSlot[] {
  const hourly: ScheduleSlot[] = [];
  for (const date of weekDates) {
    for (
      let hour = LAB_SCHEDULE.START_HOUR;
      hour < LAB_SCHEDULE.END_HOUR;
      hour += LAB_SCHEDULE.SLOT_STEP_HOURS
    ) {
      const start = formatHour(hour);
      const hit = bookedLookup.get(`${date}|${start}`);
      hourly.push({
        id: hit ? hit.id : `grid-${itemId}-${date}-${hour}`,
        itemId,
        date,
        start,
        end: formatHour(hour + LAB_SCHEDULE.SLOT_STEP_HOURS),
        status: hit ? 'booked' : 'free',
        bookedBy: hit ? hit.bookedBy : null,
        requestId: hit?.requestId ?? null,
        note: hit?.note ?? '',
      });
    }
  }
  return hourly;
}

/**
 * Expands stored time slots for an item into canonical 1-hour Mon–Sat `09:00–17:00` cells.
 *
 * @param itemId - Equipment item identifier.
 * @param rawSlots - Stored raw slot records.
 * @param weekAnchorDate - Anchor ISO date selecting the displayed week.
 * @returns Canonical 48-slot weekly schedule array.
 */
export function buildWeeklyHourlySlots(
  itemId: string,
  rawSlots: TimeSlot[],
  weekAnchorDate: string = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): ScheduleSlot[] {
  const weekDates = buildWeekDates(weekAnchorDate);
  const bookedLookup = new Map<string, TimeSlot>();

  for (const raw of rawSlots) {
    if (raw.itemId !== itemId) continue;
    if (raw.status !== 'booked' && !raw.booked) continue;
    const range = parseWindowRange(raw);
    if (!range) continue;
    for (let h = range.startHour; h < range.endHour; h += LAB_SCHEDULE.SLOT_STEP_HOURS) {
      bookedLookup.set(`${raw.date}|${formatHour(h)}`, raw);
    }
  }

  return buildGridCellsForWeek(itemId, weekDates, bookedLookup);
}
