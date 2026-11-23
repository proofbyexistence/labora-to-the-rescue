/**
 * Booking slot validation rules and role/training/approval access checks.
 */
import { LAB_SCHEDULE, LIMITS, ROLES } from './constants';
import { formatHour, parseHour, parseWindowRange } from './scheduler-slots';
import type {
  BookingInput,
  BookingValidationResult,
  ScheduleSlot,
} from './scheduler-types';
import type {
  AccessRequest,
  CampusUser,
  EquipmentItem,
  TimeSlot,
} from './types';
import { hasControlChars, normalizeText, parseIsoDateUtc } from './validation';

function collectBookedHoursForDate(
  itemId: string,
  date: string,
  existingSlots: Array<ScheduleSlot | TimeSlot>
): Set<number> {
  const bookedHours = new Set<number>();
  for (const slot of existingSlots) {
    if (slot.itemId !== itemId || slot.date !== date) continue;
    const isBooked =
      'status' in slot && slot.status !== undefined
        ? slot.status === 'booked'
        : Boolean((slot as TimeSlot).booked);
    if (!isBooked) continue;

    if ('start' in slot && slot.start && slot.end) {
      const startH = parseHour(slot.start);
      const endH = parseHour(slot.end);
      for (let h = startH; h < endH; h += LAB_SCHEDULE.SLOT_STEP_HOURS) {
        bookedHours.add(h);
      }
    } else {
      const range = parseWindowRange(slot as TimeSlot);
      if (range) {
        for (let h = range.startHour; h < range.endHour; h += LAB_SCHEDULE.SLOT_STEP_HOURS) {
          bookedHours.add(h);
        }
      }
    }
  }
  return bookedHours;
}

function validateBookingBasics(
  booking: BookingInput,
  referenceDate: string
): { errors: string[]; parsedDate: Date | null; startHour: number; duration: number } {
  const errors: string[] = [];
  if (!booking.itemId || !booking.itemId.trim() || hasControlChars(booking.itemId)) {
    errors.push('Select an equipment item before booking.');
  }

  const parsedDate = parseIsoDateUtc(booking.date);
  if (!parsedDate) {
    errors.push('Enter a valid booking date.');
  } else {
    if (booking.date < referenceDate) errors.push('Cannot book a slot in the past.');
    if (parsedDate.getUTCDay() === LAB_SCHEDULE.CLOSED_WEEKDAY_SUNDAY) {
      errors.push('Laboratories are closed on Sundays (open Monday to Saturday).');
    }
  }

  const startHour = parseHour(booking.start);
  if (!Number.isFinite(startHour)) {
    errors.push('Choose a valid whole-hour start time (e.g. 09:00 to 16:00).');
  }

  const duration = Number(booking.durationHours);
  if (!Number.isInteger(duration) || duration < LAB_SCHEDULE.MIN_BOOKING_HOURS) {
    errors.push('Duration must be at least 1 hour.');
  } else if (duration > LAB_SCHEDULE.MAX_BOOKING_HOURS) {
    errors.push('Bookings cannot exceed 4 hours per session.');
  }

  return { errors, parsedDate, startHour, duration };
}

function validatePurposeAndOverlap(
  booking: BookingInput,
  existingSlots: Array<ScheduleSlot | TimeSlot>,
  parsedDate: Date | null,
  startHour: number,
  duration: number
): string[] {
  const errors: string[] = [];
  const rawPurpose = booking.purpose ?? '';
  if (hasControlChars(rawPurpose)) {
    errors.push('Purpose cannot contain control characters.');
  } else {
    const cleanPurpose = normalizeText(rawPurpose);
    if (cleanPurpose.length < LIMITS.PURPOSE_MIN || cleanPurpose.length > LIMITS.PURPOSE_MAX) {
      errors.push('Enter a brief purpose for your lab session (3 to 200 characters).');
    }
  }

  const hasValidRange =
    Number.isFinite(startHour) &&
    Number.isInteger(duration) &&
    duration >= LAB_SCHEDULE.MIN_BOOKING_HOURS;
  if (parsedDate && hasValidRange) {
    const bookedHours = collectBookedHoursForDate(booking.itemId, booking.date, existingSlots);
    for (let h = startHour; h < startHour + duration; h += LAB_SCHEDULE.SLOT_STEP_HOURS) {
      if (bookedHours.has(h)) {
        errors.push(`Selected window overlaps an existing booking at ${formatHour(h)}.`);
        break;
      }
    }
  }
  return errors;
}

/**
 * Validates a booking request against lab hours, Sunday closure, past-date bounds, and overlaps.
 *
 * @param booking - Candidate booking form values.
 * @param existingSlots - Existing slots for overlap detection.
 * @param referenceDate - Current reference ISO date.
 * @returns Validation summary with `ok` and list of error messages.
 */
export function validateBooking(
  booking: BookingInput,
  existingSlots: Array<ScheduleSlot | TimeSlot>,
  referenceDate: string = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE
): BookingValidationResult {
  const { errors, parsedDate, startHour, duration } = validateBookingBasics(
    booking,
    referenceDate
  );

  const hasValidRange =
    Number.isFinite(startHour) &&
    Number.isInteger(duration) &&
    duration >= LAB_SCHEDULE.MIN_BOOKING_HOURS;
  if (
    hasValidRange &&
    (startHour < LAB_SCHEDULE.START_HOUR || startHour + duration > LAB_SCHEDULE.END_HOUR)
  ) {
    errors.push('Selected time falls outside lab hours (Mon–Sat, 09:00 to 17:00).');
  }

  errors.push(
    ...validatePurposeAndOverlap(booking, existingSlots, parsedDate, startHour, duration)
  );

  return { ok: errors.length === 0, errors };
}

/**
 * Evaluates whether a user is allowed to book an equipment item directly.
 *
 * @param item - Target equipment item.
 * @param user - Active campus user.
 * @param requests - Existing access request records.
 * @returns Allowance verdict and human-readable explanation.
 */
export function canUserBookItem(
  item: EquipmentItem,
  user: CampusUser,
  requests: AccessRequest[]
): { allowed: boolean; reason: string } {
  if (item.accessLevel === 'Open' || user.role === ROLES.FACULTY) {
    return { allowed: true, reason: 'Open access or faculty supervisor override.' };
  }

  const hasApprovedRequest = requests.some((req) => {
    if (req.status !== 'Approved') return false;
    const isOwner = req.studentId === user.id || req.student === user.name;
    return isOwner && (req.itemId === item.id || Boolean(req.itemIds?.includes(item.id)));
  });
  if (hasApprovedRequest) {
    return { allowed: true, reason: 'Approved faculty access request on file.' };
  }

  const hasConfirmedTraining =
    item.accessLevel === 'Training required' &&
    Boolean(user.confirmedTrainingItemIds?.includes(item.id));
  if (hasConfirmedTraining) {
    return { allowed: true, reason: 'Confirmed lab training credential on file.' };
  }

  return {
    allowed: false,
    reason:
      item.accessLevel === 'Needs faculty approval'
        ? 'This equipment requires an approved faculty access request before booking.'
        : 'This equipment requires confirmed lab safety training or an approved access request before booking.',
  };
}
