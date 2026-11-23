/**
 * Pure conflict detection and deterministic 0–100 priority scoring for competing requests.
 */
import { ALLOCATION_WEIGHTS, LAB_SCHEDULE, LIMITS, PENDING_REQUEST_STATUSES } from './constants';
import {
  buildWeekDates,
  formatHour,
  parseHour,
  parseWindowRange,
} from './scheduler-slots';
import type {
  ConflictGroup,
  RequestScoreResult,
  ScheduleSlot,
  ScoreBreakdownItem,
} from './scheduler-types';
import type { AccessRequest, EquipmentItem, TimeSlot } from './types';
import { addDaysIso, parseIsoDateUtc } from './validation';

/**
 * Tokenizes text into lowercase alphanumeric words of 3 or more characters.
 *
 * @param text - Input text to tokenize.
 * @returns Array of normalized keyword tokens.
 */
export function tokenizeSearchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/**
 * Collects active overlapping request groups competing for the same item and date.
 *
 * @param requests - All access requests to inspect.
 * @param slots - Optional slot context (preserved for caller symmetry).
 * @returns List of overlapping conflict groups containing 2+ requests.
 */
export function detectConflicts(
  requests: AccessRequest[],
  slots: Array<ScheduleSlot | TimeSlot> = []
): ConflictGroup[] {
  void slots;
  const byItemDate = new Map<string, AccessRequest[]>();
  for (const req of requests) {
    if (!PENDING_REQUEST_STATUSES.includes(req.status)) continue;
    if (!req.preferredDate || !req.preferredStart) continue;
    const key = `${req.itemId}|${req.preferredDate}`;
    const list = byItemDate.get(key) ?? [];
    list.push(req);
    byItemDate.set(key, list);
  }

  const conflicts: ConflictGroup[] = [];
  for (const [key, group] of byItemDate.entries()) {
    const conflict = buildOverlapGroup(key, group);
    if (conflict) conflicts.push(conflict);
  }
  return conflicts;
}

function buildOverlapGroup(key: string, group: AccessRequest[]): ConflictGroup | null {
  if (group.length < 2) return null;
  const [itemId, date] = key.split('|');
  const spans = group.map((req) => {
    const startHour = parseHour(req.preferredStart!);
    const dur = Math.max(
      LAB_SCHEDULE.MIN_BOOKING_HOURS,
      Math.min(LAB_SCHEDULE.MAX_BOOKING_HOURS, req.preferredDurationHours ?? 1)
    );
    return { req, startHour, endHour: startHour + dur };
  });

  const overlapping: AccessRequest[] = [];
  let minStart: number = LAB_SCHEDULE.END_HOUR;
  let maxEnd: number = LAB_SCHEDULE.START_HOUR;

  for (let i = 0; i < spans.length; i += 1) {
    const hasOverlap = spans.some(
      (other, j) =>
        i !== j && spans[i].startHour < other.endHour && other.startHour < spans[i].endHour
    );
    if (hasOverlap) {
      overlapping.push(spans[i].req);
      minStart = Math.min(minStart, spans[i].startHour);
      maxEnd = Math.max(maxEnd, spans[i].endHour);
    }
  }

  if (overlapping.length < 2) return null;
  return { itemId, date, start: formatHour(minStart), end: formatHour(maxEnd), requests: overlapping };
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
    for (let h = LAB_SCHEDULE.START_HOUR; h < LAB_SCHEDULE.END_HOUR; h += 1) {
      if (!bookedKeys.has(`${d}|${formatHour(h)}`)) freeCount += 1;
    }
  }
  return freeCount;
}

function scoreUrgencyFactor(deadline: string, referenceDate: string): ScoreBreakdownItem {
  const refDt =
    parseIsoDateUtc(referenceDate) ?? parseIsoDateUtc(LAB_SCHEDULE.DEFAULT_REFERENCE_DATE)!;
  const deadlineDt = parseIsoDateUtc(deadline);
  const daysUntil = deadlineDt
    ? Math.round((deadlineDt.getTime() - refDt.getTime()) / LIMITS.MS_PER_DAY)
    : 30;
  const maxPoints = ALLOCATION_WEIGHTS.deadlineUrgency;

  let points = 6;
  let reason = `Deadline is ${daysUntil} days away.`;
  if (daysUntil <= 3) {
    points = maxPoints;
    reason = `Immediate deadline (${daysUntil} days left).`;
  } else if (daysUntil <= 7) {
    points = Math.round(maxPoints * 0.8);
    reason = `Near-term deadline (${daysUntil} days left).`;
  } else if (daysUntil <= 14) {
    points = Math.round(maxPoints * 0.57);
    reason = `Moderate deadline window (${daysUntil} days left).`;
  }
  return { factor: 'Deadline urgency', points, maxPoints, reason };
}

function scoreFeasibilityFactor(
  request: AccessRequest,
  item: EquipmentItem,
  slots: Array<ScheduleSlot | TimeSlot>,
  referenceDate: string
): ScoreBreakdownItem {
  const freeHours = countFreeHoursBeforeDeadline(item.id, request.deadline, slots, referenceDate);
  const needed = Math.max(1, request.hoursNeeded);
  const maxPoints = ALLOCATION_WEIGHTS.feasibility;

  let points = 5;
  let reason = `Only ${freeHours}h free before ${request.deadline} for ${needed}h needed.`;
  if (freeHours >= needed) {
    points = maxPoints;
    reason = `${freeHours}h open before ${request.deadline} easily fits ${needed}h needed.`;
  } else if (freeHours >= Math.ceil(needed / 2)) {
    points = Math.round(maxPoints * 0.6);
    reason = `${freeHours}h available before ${request.deadline} partially covers ${needed}h.`;
  }
  return { factor: 'Feasibility', points, maxPoints, reason };
}

function scoreRequirementsFactor(
  request: AccessRequest,
  item: EquipmentItem
): ScoreBreakdownItem {
  const itemTokens = new Set(tokenizeSearchTerms(`${item.name} ${item.specs} ${item.type}`));
  const matchedCount = tokenizeSearchTerms(`${request.project} ${request.facultyNote}`).filter((t) =>
    itemTokens.has(t)
  ).length;
  const specPoints = matchedCount >= 2 ? 8 : matchedCount === 1 ? 5 : 2;
  const teamPoints = request.teamSize >= 3 ? 7 : request.teamSize === 2 ? 5 : 3;
  const durationPoints = request.hoursNeeded <= 8 ? 5 : 3;
  const maxPoints = ALLOCATION_WEIGHTS.studentRequirements;
  const points = Math.min(maxPoints, specPoints + teamPoints + durationPoints);

  return {
    factor: 'Student requirements',
    points,
    maxPoints,
    reason: `Team of ${request.teamSize}, ${request.hoursNeeded}h requested, ${matchedCount} spec keyword match(es).`,
  };
}

function scoreFairnessFactor(
  student: string,
  recentHoursByStudent?: Record<string, number>
): ScoreBreakdownItem {
  const recentHours = recentHoursByStudent?.[student] ?? 0;
  const maxPoints = ALLOCATION_WEIGHTS.fairness;
  let points = 5;
  if (recentHours <= 1) points = maxPoints;
  else if (recentHours <= 4) points = Math.round(maxPoints * 0.75);
  else if (recentHours <= 8) points = Math.round(maxPoints * 0.5);

  return {
    factor: 'Fairness',
    points,
    maxPoints,
    reason: `${recentHours}h booked recently by ${student}.`,
  };
}

/**
 * Scores a competing access request from 0 to 100 using `ALLOCATION_WEIGHTS`.
 *
 * @param request - Access request to evaluate.
 * @param context - Target equipment, slots, recent student usage, and reference date.
 * @returns Total 0–100 score and 4-factor breakdown summing exactly to `score`.
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
  const referenceDate = context.referenceDate ?? LAB_SCHEDULE.DEFAULT_REFERENCE_DATE;
  const breakdown = [
    scoreUrgencyFactor(request.deadline, referenceDate),
    scoreFeasibilityFactor(request, context.item, context.slots, referenceDate),
    scoreRequirementsFactor(request, context.item),
    scoreFairnessFactor(request.student, context.recentHoursByStudent),
  ];
  const score = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { score, breakdown };
}
