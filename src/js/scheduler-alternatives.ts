/**
 * Allocation lookup helpers for occupied slots, recent student usage, and similar equipment.
 */
import { tokenizeSearchTerms } from './scheduler-scoring';
import { formatHour, parseHour, parseWindowRange } from './scheduler-slots';
import type { ScheduleSlot } from './scheduler-types';
import type { EquipmentItem, TimeSlot } from './types';

/**
 * Selects the closest available alternative equipment item matching type and specification terms.
 *
 * @param primaryItem - Contested primary equipment item.
 * @param allItems - Full equipment catalog.
 * @param slots - Existing slot records used to prefer items with open slots.
 * @returns Best alternative equipment item, or null when none are available.
 */
export function findSimilarAlternativeItem(
  primaryItem: EquipmentItem,
  allItems: EquipmentItem[],
  slots: Array<ScheduleSlot | TimeSlot>
): EquipmentItem | null {
  const primaryTokens = new Set(tokenizeSearchTerms(`${primaryItem.name} ${primaryItem.specs}`));
  const candidates = allItems
    .filter(
      (candidate) =>
        candidate.id !== primaryItem.id &&
        candidate.type === primaryItem.type &&
        candidate.status !== 'Booked'
    )
    .map((candidate) => {
      const overlap = tokenizeSearchTerms(`${candidate.name} ${candidate.specs}`).filter((t) =>
        primaryTokens.has(t)
      ).length;
      const hasFreeSlot = slots.some(
        (s) =>
          s.itemId === candidate.id &&
          ('status' in s ? s.status === 'free' : !(s as TimeSlot).booked)
      );
      return {
        candidate,
        rank: overlap * 10 + (candidate.status === 'Available' ? 5 : 1) + (hasFreeSlot ? 3 : 0),
      };
    })
    .sort((a, b) => b.rank - a.rank);

  return candidates[0]?.candidate ?? null;
}

/**
 * Builds a map of booked hours per student from slot history unless explicitly provided.
 *
 * @param slots - Existing schedule slots.
 * @param provided - Optional explicit usage map override.
 * @returns Map of student name to recently booked hours.
 */
export function buildRecentHoursMap(
  slots: Array<ScheduleSlot | TimeSlot>,
  provided?: Record<string, number>
): Record<string, number> {
  const recentHoursByStudent: Record<string, number> = { ...(provided ?? {}) };
  if (Object.keys(recentHoursByStudent).length > 0) return recentHoursByStudent;

  for (const slot of slots) {
    const isBooked =
      'status' in slot && slot.status !== undefined
        ? slot.status === 'booked'
        : Boolean((slot as TimeSlot).booked);
    if (!isBooked || !slot.bookedBy) continue;
    const hrs =
      'start' in slot && slot.start && slot.end
        ? Math.max(1, parseHour(slot.end) - parseHour(slot.start))
        : Math.max(1, (slot as TimeSlot).durationHours || 1);
    recentHoursByStudent[slot.bookedBy] = (recentHoursByStudent[slot.bookedBy] ?? 0) + hrs;
  }
  return recentHoursByStudent;
}

/**
 * Indexes all already-booked `YYYY-MM-DD|HH:00` keys for an equipment item.
 *
 * @param itemId - Equipment item ID.
 * @param slots - Existing slot records.
 * @returns Set of occupied `date|startHour` keys.
 */
export function buildOccupiedSlotKeys(
  itemId: string,
  slots: Array<ScheduleSlot | TimeSlot>
): Set<string> {
  const occupiedKeys = new Set<string>();
  for (const slot of slots) {
    if (slot.itemId !== itemId) continue;
    const isBooked =
      'status' in slot && slot.status !== undefined
        ? slot.status === 'booked'
        : Boolean((slot as TimeSlot).booked);
    if (!isBooked) continue;

    if ('start' in slot && slot.start && slot.end) {
      const sh = parseHour(slot.start);
      const eh = parseHour(slot.end);
      for (let h = sh; h < eh; h += 1) occupiedKeys.add(`${slot.date}|${formatHour(h)}`);
    } else {
      const range = parseWindowRange(slot as TimeSlot);
      if (range) {
        for (let h = range.startHour; h < range.endHour; h += 1) {
          occupiedKeys.add(`${slot.date}|${formatHour(h)}`);
        }
      }
    }
  }
  return occupiedKeys;
}
