/**
 * Pure faculty-guarded creation and deletion of equipment schedule slots.
 */
import { getDependents } from './catalog-admin-dependents';
import {
  assertFaculty,
  cloneSnapshot,
  deriveItemStatusFromSlots,
  generateUniqueId,
  isBlockingRequestStatus,
  parseTimeRangeForSlot,
} from './catalog-admin-helpers';
import type {
  AddSlotsInput,
  CatalogMutationResult,
  CatalogSnapshot,
  DeleteOption,
} from './catalog-admin-types';
import { LAB_SCHEDULE } from './constants';
import { formatHour, parseHour } from './scheduler';
import type { TimeSlot, UserRole } from './types';
import { parseIsoDateUtc } from './validation';

function checkSlotOverlap(
  input: AddSlotsInput,
  slots: TimeSlot[],
  startHour: number,
  endHour: number
): string | null {
  const occupied = new Set<number>();
  for (const slot of slots) {
    if (slot.itemId !== input.itemId || slot.date !== input.date) continue;
    const range = parseTimeRangeForSlot(slot);
    if (range) for (let h = range.startHour; h < range.endHour; h += 1) occupied.add(h);
  }
  for (let h = startHour; h < endHour; h += 1) {
    if (occupied.has(h)) {
      return `Hour ${formatHour(h)} already has a slot on ${input.date}.`;
    }
  }
  return null;
}

function validateNewSlotWindow(
  input: AddSlotsInput,
  snapshot: CatalogSnapshot,
  referenceDate: string
): { fieldErrors: Record<string, string>; itemIdx: number; startHour: number; endHour: number } {
  const fieldErrors: Record<string, string> = {};
  const itemIdx = snapshot.items.findIndex((i) => i.id === input.itemId);
  if (itemIdx === -1) fieldErrors.itemId = 'Select an existing equipment item.';

  const parsedDate = parseIsoDateUtc((input.date ?? '').trim());
  if (!parsedDate) fieldErrors.date = 'Choose a valid date (YYYY-MM-DD).';
  else if (input.date < referenceDate) {
    fieldErrors.date = `Past dates before ${referenceDate} cannot be scheduled.`;
  } else if (parsedDate.getUTCDay() === LAB_SCHEDULE.CLOSED_WEEKDAY_SUNDAY) {
    fieldErrors.date = 'Campus labs are closed on Sunday (hours are Mon–Sat).';
  }

  const startHour = parseHour((input.startTime ?? '').trim());
  const endHour = parseHour((input.endTime ?? '').trim());
  if (!Number.isInteger(startHour)) {
    fieldErrors.startTime = 'Choose a valid whole-hour start time (e.g., 09:00).';
  }
  if (!Number.isInteger(endHour)) {
    fieldErrors.endTime = 'Choose a valid whole-hour end time (e.g., 12:00).';
  }
  if (Number.isInteger(startHour) && Number.isInteger(endHour)) {
    if (startHour < LAB_SCHEDULE.START_HOUR || endHour > LAB_SCHEDULE.END_HOUR) {
      fieldErrors.startTime = 'Slots must fall within Mon–Sat lab hours (09:00 to 17:00).';
    } else if (endHour <= startHour) {
      fieldErrors.endTime = 'End time must be at least 1 hour after start time.';
    }
  }
  if (Object.keys(fieldErrors).length === 0) {
    const overlapErr = checkSlotOverlap(input, snapshot.slots, startHour, endHour);
    if (overlapErr) fieldErrors.startTime = overlapErr;
  }
  return { fieldErrors, itemIdx, startHour, endHour };
}

function buildHourlySlotsForWindow(
  itemId: string,
  date: string,
  startHour: number,
  endHour: number,
  existingSlotIds: Set<string>
): TimeSlot[] {
  const created: TimeSlot[] = [];
  for (let h = startHour; h < endHour; h += 1) {
    const start = formatHour(h);
    const end = formatHour(h + 1);
    const id = generateUniqueId('sl', `${itemId}-${date}-${h}`, existingSlotIds);
    existingSlotIds.add(id);
    created.push({
      id,
      itemId,
      date,
      window: `${start} – ${end}`,
      durationHours: 1,
      booked: false,
      bookedBy: null,
      note: '',
      start,
      end,
      status: 'free',
      requestId: null,
    });
  }
  return created;
}

/**
 * Creates 1-hour bookable slots between `startTime` and `endTime` inside Mon–Sat lab hours.
 *
 * @param role - Active user role.
 * @param input - Item, date, and whole-hour start/end window.
 * @param snapshot - Current catalog snapshot.
 * @param referenceDate - Reference ISO date guarding against past slots.
 * @returns Mutation result with created 1-hour slots and updated item availability.
 */
export function addSlots(
  role: UserRole,
  input: AddSlotsInput,
  snapshot: CatalogSnapshot,
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): CatalogMutationResult<TimeSlot[]> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const { fieldErrors, itemIdx, startHour, endHour } = validateNewSlotWindow(
    input,
    snapshot,
    referenceDate
  );
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors };
  }

  const nextState = cloneSnapshot(snapshot);
  const existingSlotIds = new Set(nextState.slots.map((s) => s.id));
  const created = buildHourlySlotsForWindow(
    input.itemId,
    input.date,
    startHour,
    endHour,
    existingSlotIds
  );
  nextState.slots.push(...created);
  nextState.items[itemIdx] = deriveItemStatusFromSlots(nextState.items[itemIdx], nextState.slots);
  return { ok: true, data: created, nextState };
}

/**
 * Deletes a free slot directly, or cancels a booked slot when `option === 'cancelAffected'`.
 *
 * @param role - Active user role.
 * @param slotId - Target slot ID.
 * @param snapshot - Current catalog snapshot.
 * @param option - Cascade confirmation mode (`'cancelAffected'` or `'cancel'`).
 * @param referenceDate - Reference ISO date recorded on linked requests.
 * @returns Mutation result with deleted slot and recomputed equipment status.
 */
export function deleteSlot(
  role: UserRole,
  slotId: string,
  snapshot: CatalogSnapshot,
  option?: DeleteOption,
  referenceDate = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): CatalogMutationResult<TimeSlot> {
  const roleError = assertFaculty(role);
  if (roleError) return { ok: false, error: roleError };

  const target = snapshot.slots.find((s) => s.id === slotId);
  if (!target) return { ok: false, error: 'Time slot not found.' };

  if (target.booked && option !== 'cancelAffected') {
    const dependents = getDependents({ type: 'slot', id: slotId }, snapshot);
    const cancelMsg = 'Slot removal canceled; existing booking was kept.';
    const blockMsg = `Only free slots can be deleted directly (${target.date} ${target.window} is booked by ${target.bookedBy ?? 'a student'}).`;
    return { ok: false, error: option === 'cancel' ? cancelMsg : blockMsg, dependents };
  }

  const nextState = cloneSnapshot(snapshot);
  nextState.slots = nextState.slots.filter((s) => s.id !== slotId);
  if (target.booked && target.requestId) {
    const note = `Automatic update: booked slot ${target.date} (${target.window}) was removed by faculty admin.`;
    nextState.requests = nextState.requests.map((req) =>
      req.id === target.requestId && isBlockingRequestStatus(req.status)
        ? { ...req, status: 'Changes requested', facultyNote: note, reviewedAt: referenceDate }
        : req
    );
  }
  nextState.items = nextState.items.map((item) =>
    item.id === target.itemId ? deriveItemStatusFromSlots(item, nextState.slots) : item
  );
  return { ok: true, data: target, nextState };
}
