/**
 * Store mutation handlers for custom slot bookings, cancellations, and allocation commits.
 */
import { getCurrentUser, getItemById } from './lab-queries';
import { getStoreState, persistState } from './lab-store';
import {
  DEFAULT_REFERENCE_DATE,
  formatHour,
  parseHour,
  validateBooking,
  type AllocationResult,
} from './scheduler';
import type { TimeSlot } from './types';
import { normalizeText } from './validation';

function syncItemAvailabilityFromSlots(itemId: string): void {
  const { dataset } = getStoreState();
  const item = dataset.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const openSlots = dataset.slots.filter((s) => s.itemId === itemId && !s.booked);
  if (openSlots.length === 0) {
    item.status = 'Booked';
    item.nextFreeSlot = 'Waitlist open';
    return;
  }
  item.status = openSlots.length <= 1 ? 'Limited' : 'Available';
  const next = openSlots[0];
  item.nextFreeSlot = `${next.date.slice(5)} · ${next.window.split(' ')[0]}`;
}

/**
 * Cancels a booked slot by ID and restores item availability.
 *
 * @param slotId - Target slot ID.
 * @param itemId - Equipment item ID owning the slot.
 * @returns Freed slot copy, or null if not found/not booked.
 */
export function cancelSlotBooking(slotId: string, itemId: string): TimeSlot | null {
  const { dataset } = getStoreState();
  const slot = dataset.slots.find((e) => e.id === slotId && e.itemId === itemId);
  if (!slot || !slot.booked) return null;

  slot.booked = false;
  slot.bookedBy = null;
  slot.note = '';
  slot.status = 'free';
  slot.requestId = null;
  syncItemAvailabilityFromSlots(itemId);
  persistState();
  return { ...slot };
}

/**
 * Creates and validates a custom equipment booking on the Mon–Sat schedule.
 *
 * @param input - Reservation fields (`itemId`, `date`, `start`, `durationHours`, `purpose`).
 * @returns Newly persisted `TimeSlot` record, or null when validation fails.
 */
export function createCustomBooking(input: {
  itemId: string;
  date: string;
  start: string;
  durationHours: number;
  purpose: string;
  bookedBy?: string;
  requestId?: string | null;
}): TimeSlot | null {
  if (!getItemById(input.itemId)) return null;
  const { dataset } = getStoreState();
  const cleanPurpose = normalizeText(input.purpose ?? '');
  const itemSlots = dataset.slots.filter((s) => s.itemId === input.itemId);
  const check = validateBooking({ ...input, purpose: cleanPurpose }, itemSlots);
  if (!check.ok) return null;

  const end = formatHour(parseHour(input.start) + input.durationHours);
  const created: TimeSlot = {
    id: `sl-custom-${input.itemId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: input.itemId,
    date: input.date,
    window: `${input.start} – ${end}`,
    durationHours: input.durationHours,
    booked: true,
    bookedBy: input.bookedBy ?? getCurrentUser().name,
    note: cleanPurpose,
    start: input.start,
    end,
    status: 'booked',
    requestId: input.requestId ?? null,
  };
  dataset.slots.push(created);
  syncItemAvailabilityFromSlots(input.itemId);
  persistState();
  return { ...created };
}

/**
 * Applies deterministic conflict allocation assignments and alternative prompts to store state.
 *
 * @param result - Deterministic allocation result from `allocate`.
 */
export function applyAllocationSuggestion(result: AllocationResult): void {
  const { dataset } = getStoreState();
  for (const assignment of result.assignments) {
    createCustomBooking({
      itemId: assignment.itemId,
      date: assignment.date,
      start: assignment.start,
      durationHours: assignment.durationHours,
      purpose: `AI Fair Allocation (${assignment.score}/100)`,
      bookedBy: assignment.student,
      requestId: assignment.requestId,
    });
    const req = dataset.requests.find((r) => r.id === assignment.requestId);
    if (req) {
      req.status = 'Approved';
      req.facultyNote = `Allocated ${assignment.date} ${assignment.start}–${assignment.end} via fair-allocation engine.`;
    }
  }
  for (const alt of result.alternatives) {
    const req = dataset.requests.find((r) => r.id === alt.requestId);
    if (req) {
      req.status = 'Changes requested';
      req.facultyNote = alt.reason;
      req.reviewedAt = DEFAULT_REFERENCE_DATE;
    }
  }
  persistState();
}
