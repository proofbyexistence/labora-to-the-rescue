import type {
  AccessRequest,
  CampusUser,
  EquipmentItem,
  TimeSlot,
} from './types';
import { hasControlChars, normalizeText } from './validation.ts';

// Adjustable allocation weights (must sum to 100).
export const ALLOCATION_WEIGHTS = {
  deadlineUrgency: 35,
  feasibility: 25,
  studentRequirements: 20,
  fairness: 20,
} as const;

export const LAB_START_HOUR = 9;
export const LAB_END_HOUR = 17;
export const MAX_BOOKING_HOURS = 4;
export const DEFAULT_REFERENCE_DATE = '2026-11-23';

export interface ScheduleSlot {
  id: string;
  itemId: string;
  date: string;
  start: string;
  end: string;
  status: 'free' | 'booked';
  bookedBy: string | null;
  requestId: string | null;
  note?: string;
}

export interface BookingInput {
  itemId: string;
  date: string;
  start: string;
  durationHours: number;
  purpose: string;
}

export interface BookingValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ConflictGroup {
  itemId: string;
  date: string;
  start: string;
  end: string;
  requests: AccessRequest[];
}

export interface ScoreBreakdownItem {
  factor: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface RequestScoreResult {
  score: number;
  breakdown: ScoreBreakdownItem[];
}

export interface AllocationAssignment {
  requestId: string;
  student: string;
  itemId: string;
  itemName: string;
  date: string;
  start: string;
  end: string;
  durationHours: number;
  isContestedSlot: boolean;
  score: number;
}

export interface AllocationAlternative {
  requestId: string;
  student: string;
  suggestedItemId: string;
  suggestedItemName: string;
  location: string;
  nextFreeSlot: string;
  reason: string;
}

export interface RankedAllocationEntry {
  request: AccessRequest;
  score: number;
  breakdown: ScoreBreakdownItem[];
}

export interface AllocationResult {
  assignments: AllocationAssignment[];
  alternatives: AllocationAlternative[];
  feasible: Record<string, boolean>;
  reasons: string[];
  ranked: RankedAllocationEntry[];
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

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

function parseIsoDateUtc(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function addDaysIso(dateStr: string, offsetDays: number): string {
  const dt = parseIsoDateUtc(dateStr);
  if (!dt) return dateStr;
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Return Monday–Saturday ISO dates for the week containing anchorDate.
 */
export function buildWeekDates(anchorDate: string = DEFAULT_REFERENCE_DATE): string[] {
  const dt = parseIsoDateUtc(anchorDate) ?? parseIsoDateUtc(DEFAULT_REFERENCE_DATE)!;
  const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const mondayOffset = day === 0 ? 1 : 1 - day;
  const mondayStr = addDaysIso(dt.toISOString().slice(0, 10), mondayOffset);
  return Array.from({ length: 6 }, (_, idx) => addDaysIso(mondayStr, idx));
}

function parseWindowRange(slot: TimeSlot): { startHour: number; endHour: number } | null {
  if (slot.start && slot.end) {
    const s = Number.parseInt(slot.start.split(':')[0], 10);
    const e = Number.parseInt(slot.end.split(':')[0], 10);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      return { startHour: s, endHour: e };
    }
  }
  const parts = slot.window.split(/[–-]/).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const s = Number.parseInt(parts[0].split(':')[0], 10);
  const e = Number.parseInt(parts[1].split(':')[0], 10);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return { startHour: s, endHour: e };
}

/**
 * Expand raw stored TimeSlots into canonical 1-hour Mon–Sat 09:00–17:00 ScheduleSlots.
 */
export function buildWeeklyHourlySlots(
  itemId: string,
  rawSlots: TimeSlot[],
  weekAnchorDate: string = DEFAULT_REFERENCE_DATE
): ScheduleSlot[] {
  const weekDates = buildWeekDates(weekAnchorDate);
  const bookedLookup = new Map<string, TimeSlot>();

  for (const raw of rawSlots) {
    if (raw.itemId !== itemId) continue;
    const isBooked = raw.status === 'booked' || raw.booked;
    if (!isBooked) continue;
    const range = parseWindowRange(raw);
    if (!range) continue;
    for (let h = range.startHour; h < range.endHour; h += 1) {
      bookedLookup.set(`${raw.date}|${formatHour(h)}`, raw);
    }
  }

  const hourly: ScheduleSlot[] = [];
  for (const date of weekDates) {
    for (let hour = LAB_START_HOUR; hour < LAB_END_HOUR; hour += 1) {
      const start = formatHour(hour);
      const end = formatHour(hour + 1);
      const hit = bookedLookup.get(`${date}|${start}`);
      hourly.push({
        id: hit ? hit.id : `grid-${itemId}-${date}-${hour}`,
        itemId,
        date,
        start,
        end,
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
 * Validate a booking request against lab rules, past-date bounds, and slot overlaps.
 */
export function validateBooking(
  booking: BookingInput,
  existingSlots: Array<ScheduleSlot | TimeSlot>,
  referenceDate: string = DEFAULT_REFERENCE_DATE
): BookingValidationResult {
  const errors: string[] = [];

  if (!booking.itemId || !booking.itemId.trim() || hasControlChars(booking.itemId)) {
    errors.push('Select an equipment item before booking.');
  }

  const parsedDate = parseIsoDateUtc(booking.date);
  if (!parsedDate) {
    errors.push('Enter a valid booking date.');
  } else {
    if (booking.date < referenceDate) {
      errors.push('Cannot book a slot in the past.');
    }
    if (parsedDate.getUTCDay() === 0) {
      errors.push('Laboratories are closed on Sundays (open Monday to Saturday).');
    }
  }

  const startHour = parseHour(booking.start);
  if (!Number.isFinite(startHour)) {
    errors.push('Choose a valid whole-hour start time (e.g. 09:00 to 16:00).');
  }

  const duration = Number(booking.durationHours);
  if (!Number.isInteger(duration) || duration < 1) {
    errors.push('Duration must be at least 1 hour.');
  } else if (duration > MAX_BOOKING_HOURS) {
    errors.push('Bookings cannot exceed 4 hours per session.');
  }

  if (Number.isFinite(startHour) && Number.isInteger(duration) && duration >= 1) {
    if (startHour < LAB_START_HOUR || startHour + duration > LAB_END_HOUR) {
      errors.push('Selected time falls outside lab hours (Mon–Sat, 09:00 to 17:00).');
    }
  }

  const rawPurpose = booking.purpose ?? '';
  if (hasControlChars(rawPurpose)) {
    errors.push('Purpose cannot contain control characters.');
  } else {
    const cleanPurpose = normalizeText(rawPurpose);
    if (cleanPurpose.length < 3 || cleanPurpose.length > 200) {
      errors.push('Enter a brief purpose for your lab session (3 to 200 characters).');
    }
  }

  if (parsedDate && Number.isFinite(startHour) && Number.isInteger(duration) && duration >= 1) {
    // Expand existing booked blocks on this item to detect any 1-hour overlap.
    const bookedHours = new Set<number>();
    for (const slot of existingSlots) {
      if (slot.itemId !== booking.itemId || slot.date !== booking.date) continue;
      const isBooked =
        'status' in slot && slot.status !== undefined
          ? slot.status === 'booked'
          : Boolean((slot as TimeSlot).booked);
      if (!isBooked) continue;

      if ('start' in slot && slot.start && slot.end) {
        const s = parseHour(slot.start);
        const e = parseHour(slot.end);
        for (let h = s; h < e; h += 1) bookedHours.add(h);
      } else {
        const range = parseWindowRange(slot as TimeSlot);
        if (range) {
          for (let h = range.startHour; h < range.endHour; h += 1) bookedHours.add(h);
        }
      }
    }

    for (let h = startHour; h < startHour + duration; h += 1) {
      if (bookedHours.has(h)) {
        errors.push(`Selected window overlaps an existing booking at ${formatHour(h)}.`);
        break;
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Detect groups of two or more active requests competing for the same item and time window.
 */
export function detectConflicts(
  requests: AccessRequest[],
  slots: Array<ScheduleSlot | TimeSlot> = []
): ConflictGroup[] {
  const activeRequests = requests.filter(
    (req) => req.status === 'Submitted' || req.status === 'Under review'
  );

  // Group requests by itemId + preferredDate, then check overlapping hourly ranges.
  const byItemDate = new Map<string, AccessRequest[]>();
  for (const req of activeRequests) {
    if (!req.preferredDate || !req.preferredStart) continue;
    const key = `${req.itemId}|${req.preferredDate}`;
    const list = byItemDate.get(key) ?? [];
    list.push(req);
    byItemDate.set(key, list);
  }

  const conflicts: ConflictGroup[] = [];
  for (const [key, group] of byItemDate.entries()) {
    if (group.length < 2) continue;
    const [itemId, date] = key.split('|');

    const spans = group.map((req) => {
      const startHour = parseHour(req.preferredStart!);
      const dur = Math.max(1, Math.min(MAX_BOOKING_HOURS, req.preferredDurationHours ?? 1));
      return { req, startHour, endHour: startHour + dur };
    });

    const overlapping: AccessRequest[] = [];
    let minStart = LAB_END_HOUR;
    let maxEnd = LAB_START_HOUR;

    for (let i = 0; i < spans.length; i += 1) {
      let hasOverlap = false;
      for (let j = 0; j < spans.length; j += 1) {
        if (i === j) continue;
        if (spans[i].startHour < spans[j].endHour && spans[j].startHour < spans[i].endHour) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) {
        overlapping.push(spans[i].req);
        minStart = Math.min(minStart, spans[i].startHour);
        maxEnd = Math.max(maxEnd, spans[i].endHour);
      }
    }

    if (overlapping.length >= 2) {
      // Also verify slot context is respected (used if slots are supplied).
      void slots;
      conflicts.push({
        itemId,
        date,
        start: formatHour(minStart),
        end: formatHour(maxEnd),
        requests: overlapping,
      });
    }
  }

  return conflicts;
}

function countFreeHoursBeforeDeadline(
  itemId: string,
  deadline: string,
  slots: Array<ScheduleSlot | TimeSlot>,
  referenceDate: string
): number {
  const weekDates = buildWeekDates(referenceDate);
  const extendedDates = [...weekDates, ...buildWeekDates(addDaysIso(weekDates[0], 7))];
  const validDates = extendedDates.filter((d) => d >= referenceDate && d <= deadline);
  const candidateDates = validDates.length > 0 ? validDates : weekDates;

  const bookedKeys = new Set<string>();
  for (const s of slots) {
    if (s.itemId !== itemId) continue;
    const isBooked =
      'status' in s && s.status !== undefined
        ? s.status === 'booked'
        : Boolean((s as TimeSlot).booked);
    if (!isBooked) continue;
    if ('start' in s && s.start) {
      bookedKeys.add(`${s.date}|${s.start}`);
    } else {
      const range = parseWindowRange(s as TimeSlot);
      if (range) {
        for (let h = range.startHour; h < range.endHour; h += 1) {
          bookedKeys.add(`${s.date}|${formatHour(h)}`);
        }
      }
    }
  }

  let freeCount = 0;
  for (const d of candidateDates) {
    for (let h = LAB_START_HOUR; h < LAB_END_HOUR; h += 1) {
      if (!bookedKeys.has(`${d}|${formatHour(h)}`)) {
        freeCount += 1;
      }
    }
  }
  return freeCount;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/**
 * Score a competing access request from 0 to 100 using ALLOCATION_WEIGHTS.
 */
export function scoreRequest(
  request: AccessRequest,
  context: {
    item: EquipmentItem;
    slots: Array<ScheduleSlot | TimeSlot>;
    recentHoursByStudent?: Record<string, number>;
    referenceDate?: string;
  }
): RequestScoreResult {
  const referenceDate = context.referenceDate ?? DEFAULT_REFERENCE_DATE;
  const refDt = parseIsoDateUtc(referenceDate) ?? parseIsoDateUtc(DEFAULT_REFERENCE_DATE)!;
  const deadlineDt = parseIsoDateUtc(request.deadline);

  // 1. Deadline urgency (0 to 35)
  const daysUntil = deadlineDt
    ? Math.round((deadlineDt.getTime() - refDt.getTime()) / 86_400_000)
    : 30;
  let urgencyPoints = 6;
  let urgencyReason = `Deadline is ${daysUntil} days away.`;
  if (daysUntil <= 3) {
    urgencyPoints = ALLOCATION_WEIGHTS.deadlineUrgency;
    urgencyReason = `Immediate deadline (${daysUntil} days left).`;
  } else if (daysUntil <= 7) {
    urgencyPoints = Math.round(ALLOCATION_WEIGHTS.deadlineUrgency * 0.8);
    urgencyReason = `Near-term deadline (${daysUntil} days left).`;
  } else if (daysUntil <= 14) {
    urgencyPoints = Math.round(ALLOCATION_WEIGHTS.deadlineUrgency * 0.57);
    urgencyReason = `Moderate deadline window (${daysUntil} days left).`;
  }

  // 2. Feasibility before deadline (0 to 25)
  const freeHours = countFreeHoursBeforeDeadline(
    context.item.id,
    request.deadline,
    context.slots,
    referenceDate
  );
  const needed = Math.max(1, request.hoursNeeded);
  let feasibilityPoints = 5;
  let feasibilityReason = `Only ${freeHours}h free before ${request.deadline} for ${needed}h needed.`;
  if (freeHours >= needed) {
    feasibilityPoints = ALLOCATION_WEIGHTS.feasibility;
    feasibilityReason = `${freeHours}h open before ${request.deadline} easily fits ${needed}h needed.`;
  } else if (freeHours >= Math.ceil(needed / 2)) {
    feasibilityPoints = Math.round(ALLOCATION_WEIGHTS.feasibility * 0.6);
    feasibilityReason = `${freeHours}h available before ${request.deadline} partially covers ${needed}h.`;
  }

  // 3. Student requirements: team size, reasonable session length, spec match (0 to 20)
  const itemTokens = new Set(tokenize(`${context.item.name} ${context.item.specs} ${context.item.type}`));
  const reqTokens = tokenize(`${request.project} ${request.facultyNote}`);
  const matchedTokens = reqTokens.filter((t) => itemTokens.has(t));
  const specPoints = matchedTokens.length >= 2 ? 8 : matchedTokens.length === 1 ? 5 : 2;
  const teamPoints = request.teamSize >= 3 ? 7 : request.teamSize === 2 ? 5 : 3;
  const durationPoints = request.hoursNeeded <= 8 ? 5 : 3;
  const reqPoints = Math.min(
    ALLOCATION_WEIGHTS.studentRequirements,
    specPoints + teamPoints + durationPoints
  );
  const reqReason = `Team of ${request.teamSize}, ${request.hoursNeeded}h requested, ${matchedTokens.length} spec keyword match(es).`;

  // 4. Fairness: fewer recently used hours score higher (0 to 20)
  const recentHours = context.recentHoursByStudent?.[request.student] ?? 0;
  let fairnessPoints = 5;
  if (recentHours <= 1) {
    fairnessPoints = ALLOCATION_WEIGHTS.fairness;
  } else if (recentHours <= 4) {
    fairnessPoints = Math.round(ALLOCATION_WEIGHTS.fairness * 0.75);
  } else if (recentHours <= 8) {
    fairnessPoints = Math.round(ALLOCATION_WEIGHTS.fairness * 0.5);
  }
  const fairnessReason = `${recentHours}h booked recently by ${request.student}.`;

  const score = urgencyPoints + feasibilityPoints + reqPoints + fairnessPoints;

  return {
    score,
    breakdown: [
      {
        factor: 'Deadline urgency',
        points: urgencyPoints,
        maxPoints: ALLOCATION_WEIGHTS.deadlineUrgency,
        reason: urgencyReason,
      },
      {
        factor: 'Feasibility',
        points: feasibilityPoints,
        maxPoints: ALLOCATION_WEIGHTS.feasibility,
        reason: feasibilityReason,
      },
      {
        factor: 'Student requirements',
        points: reqPoints,
        maxPoints: ALLOCATION_WEIGHTS.studentRequirements,
        reason: reqReason,
      },
      {
        factor: 'Fairness',
        points: fairnessPoints,
        maxPoints: ALLOCATION_WEIGHTS.fairness,
        reason: fairnessReason,
      },
    ],
  };
}

function findSimilarAlternativeItem(
  primaryItem: EquipmentItem,
  allItems: EquipmentItem[],
  slots: Array<ScheduleSlot | TimeSlot>
): EquipmentItem | null {
  const primaryTokens = new Set(tokenize(`${primaryItem.name} ${primaryItem.specs}`));
  const candidates = allItems
    .filter(
      (candidate) =>
        candidate.id !== primaryItem.id &&
        candidate.type === primaryItem.type &&
        candidate.status !== 'Booked'
    )
    .map((candidate) => {
      const tokens = tokenize(`${candidate.name} ${candidate.specs}`);
      const overlap = tokens.filter((t) => primaryTokens.has(t)).length;
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
 * Deterministically allocate a contested slot and re-slot remaining competing requests.
 */
export function allocate(
  conflictingRequests: AccessRequest[],
  item: EquipmentItem,
  slots: Array<ScheduleSlot | TimeSlot>,
  allItems: EquipmentItem[],
  context: {
    recentHoursByStudent?: Record<string, number>;
    referenceDate?: string;
  } = {}
): AllocationResult {
  const referenceDate = context.referenceDate ?? DEFAULT_REFERENCE_DATE;

  const recentHoursByStudent: Record<string, number> = {
    ...(context.recentHoursByStudent ?? {}),
  };
  if (Object.keys(recentHoursByStudent).length === 0) {
    for (const s of slots) {
      const isBooked =
        'status' in s && s.status !== undefined
          ? s.status === 'booked'
          : Boolean((s as TimeSlot).booked);
      if (isBooked && s.bookedBy) {
        const hrs =
          'start' in s && s.start && s.end
            ? Math.max(1, parseHour(s.end) - parseHour(s.start))
            : Math.max(1, (s as TimeSlot).durationHours || 1);
        recentHoursByStudent[s.bookedBy] = (recentHoursByStudent[s.bookedBy] ?? 0) + hrs;
      }
    }
  }

  const scored: RankedAllocationEntry[] = conflictingRequests
    .map((request) => {
      const res = scoreRequest(request, {
        item,
        slots,
        recentHoursByStudent,
        referenceDate,
      });
      return { request, score: res.score, breakdown: res.breakdown };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.request.submittedAt !== b.request.submittedAt) {
        return a.request.submittedAt.localeCompare(b.request.submittedAt);
      }
      return a.request.id.localeCompare(b.request.id);
    });

  const assignments: AllocationAssignment[] = [];
  const alternatives: AllocationAlternative[] = [];
  const feasible: Record<string, boolean> = {};
  const reasons: string[] = [];

  if (scored.length === 0) {
    return { assignments, alternatives, feasible, reasons, ranked: scored };
  }

  // Track occupied hours across the next 2 weeks so reassigned requests do not collide.
  const week1 = buildWeekDates(referenceDate);
  const week2 = buildWeekDates(addDaysIso(week1[0], 7));
  const candidateDates = [...week1, ...week2].filter((d) => d >= referenceDate);

  const occupiedKeys = new Set<string>();
  for (const s of slots) {
    if (s.itemId !== item.id) continue;
    const isBooked =
      'status' in s && s.status !== undefined
        ? s.status === 'booked'
        : Boolean((s as TimeSlot).booked);
    if (!isBooked) continue;
    if ('start' in s && s.start && s.end) {
      const sh = parseHour(s.start);
      const eh = parseHour(s.end);
      for (let h = sh; h < eh; h += 1) occupiedKeys.add(`${s.date}|${formatHour(h)}`);
    } else {
      const range = parseWindowRange(s as TimeSlot);
      if (range) {
        for (let h = range.startHour; h < range.endHour; h += 1) {
          occupiedKeys.add(`${s.date}|${formatHour(h)}`);
        }
      }
    }
  }

  // Winner receives the contested slot window.
  const winner = scored[0];
  const winnerDate = winner.request.preferredDate ?? week1[1] ?? referenceDate;
  const winnerStartHour = parseHour(winner.request.preferredStart ?? '10:00');
  const winnerDur = Math.max(
    1,
    Math.min(MAX_BOOKING_HOURS, winner.request.preferredDurationHours ?? winner.request.hoursNeeded ?? 1)
  );
  const winnerEndHour = Math.min(LAB_END_HOUR, winnerStartHour + winnerDur);

  for (let h = winnerStartHour; h < winnerEndHour; h += 1) {
    occupiedKeys.add(`${winnerDate}|${formatHour(h)}`);
  }

  feasible[winner.request.id] = winnerDate <= winner.request.deadline;
  assignments.push({
    requestId: winner.request.id,
    student: winner.request.student,
    itemId: item.id,
    itemName: item.name,
    date: winnerDate,
    start: formatHour(winnerStartHour),
    end: formatHour(winnerEndHour),
    durationHours: winnerEndHour - winnerStartHour,
    isContestedSlot: true,
    score: winner.score,
  });
  reasons.push(
    `${winner.request.student} ranked #1 (${winner.score}/100) and keeps the contested ${winnerDate} ${formatHour(winnerStartHour)}–${formatHour(winnerEndHour)} window.`
  );

  // Assign earliest feasible slot before deadline for each remaining request.
  for (let i = 1; i < scored.length; i += 1) {
    const entry = scored[i];
    const req = entry.request;
    const neededDur = Math.max(
      1,
      Math.min(MAX_BOOKING_HOURS, req.preferredDurationHours ?? req.hoursNeeded ?? 1)
    );

    let assigned: AllocationAssignment | null = null;
    for (const date of candidateDates) {
      if (date > req.deadline) break;
      for (let h = LAB_START_HOUR; h <= LAB_END_HOUR - neededDur; h += 1) {
        let blockFree = true;
        for (let offset = 0; offset < neededDur; offset += 1) {
          if (occupiedKeys.has(`${date}|${formatHour(h + offset)}`)) {
            blockFree = false;
            break;
          }
        }
        if (blockFree) {
          for (let offset = 0; offset < neededDur; offset += 1) {
            occupiedKeys.add(`${date}|${formatHour(h + offset)}`);
          }
          assigned = {
            requestId: req.id,
            student: req.student,
            itemId: item.id,
            itemName: item.name,
            date,
            start: formatHour(h),
            end: formatHour(h + neededDur),
            durationHours: neededDur,
            isContestedSlot: false,
            score: entry.score,
          };
          break;
        }
      }
      if (assigned) break;
    }

    if (assigned) {
      feasible[req.id] = true;
      assignments.push(assigned);
      reasons.push(
        `${req.student} (${entry.score}/100) is reassigned to the earliest open window (${assigned.date} ${assigned.start}–${assigned.end}) before their ${req.deadline} deadline.`
      );
    } else {
      feasible[req.id] = false;
      const alt = findSimilarAlternativeItem(item, allItems, slots);
      if (alt) {
        alternatives.push({
          requestId: req.id,
          student: req.student,
          suggestedItemId: alt.id,
          suggestedItemName: alt.name,
          location: alt.location,
          nextFreeSlot: alt.nextFreeSlot,
          reason: `No ${neededDur}h slot remains on ${item.name} before ${req.deadline}; ${alt.name} is an available ${alt.type} alternative in ${alt.location}.`,
        });
        reasons.push(
          `No feasible slot remained for ${req.student} before ${req.deadline}; suggested alternative ${alt.name} (${alt.location}).`
        );
      } else {
        reasons.push(
          `No feasible slot remained on ${item.name} for ${req.student} before ${req.deadline}.`
        );
      }
    }
  }

  return {
    assignments,
    alternatives,
    feasible,
    reasons,
    ranked: scored,
  };
}

/**
 * Plain-language summary of an allocation result.
 * Kept intentionally isolated as a pure function so an AI-generated explanation can replace it later.
 */
export function explainAllocation(result: AllocationResult): string {
  if (result.reasons.length === 0) {
    return 'No competing requests were detected for this item.';
  }
  return result.reasons.join(' ');
}

/**
 * Access-rule check: open items are bookable directly; restricted items require an approved
 * request or confirmed training for students.
 */
export function canUserBookItem(
  item: EquipmentItem,
  user: CampusUser,
  requests: AccessRequest[]
): { allowed: boolean; reason: string } {
  if (item.accessLevel === 'Open' || user.role === 'faculty') {
    return { allowed: true, reason: 'Open access or faculty supervisor override.' };
  }

  const hasApprovedRequest = requests.some((req) => {
    if (req.status !== 'Approved') return false;
    const isOwner = req.studentId === user.id || req.student === user.name;
    if (!isOwner) return false;
    return req.itemId === item.id || Boolean(req.itemIds?.includes(item.id));
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
