/**
 * Deterministic conflict allocation engine and plain-language decision explainer.
 */
import { LAB_SCHEDULE } from './constants';
import {
  buildOccupiedSlotKeys,
  buildRecentHoursMap,
  findSimilarAlternativeItem,
} from './scheduler-alternatives';
import { scoreRequest } from './scheduler-scoring';
import { buildWeekDates, formatHour, parseHour } from './scheduler-slots';
import type {
  AllocationAlternative,
  AllocationAssignment,
  AllocationResult,
  RankedAllocationEntry,
  ScheduleSlot,
} from './scheduler-types';
import type { AccessRequest, EquipmentItem, TimeSlot } from './types';
import { addDaysIso } from './validation';

function rankCompetingRequests(
  conflictingRequests: AccessRequest[],
  item: EquipmentItem,
  slots: Array<ScheduleSlot | TimeSlot>,
  recentHoursByStudent: Record<string, number>,
  referenceDate: string
): RankedAllocationEntry[] {
  return conflictingRequests
    .map((request) => {
      const res = scoreRequest(request, { item, slots, recentHoursByStudent, referenceDate });
      return { request, score: res.score, breakdown: res.breakdown };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.request.submittedAt !== b.request.submittedAt) {
        return a.request.submittedAt.localeCompare(b.request.submittedAt);
      }
      return a.request.id.localeCompare(b.request.id);
    });
}

function findEarliestOpenBlock(
  req: AccessRequest,
  entryScore: number,
  item: EquipmentItem,
  neededDur: number,
  candidateDates: string[],
  occupiedKeys: Set<string>
): AllocationAssignment | null {
  for (const date of candidateDates) {
    if (date > req.deadline) break;
    for (let h = LAB_SCHEDULE.START_HOUR; h <= LAB_SCHEDULE.END_HOUR - neededDur; h += 1) {
      let blockFree = true;
      for (let offset = 0; offset < neededDur; offset += 1) {
        if (occupiedKeys.has(`${date}|${formatHour(h + offset)}`)) {
          blockFree = false;
          break;
        }
      }
      if (!blockFree) continue;
      for (let offset = 0; offset < neededDur; offset += 1) {
        occupiedKeys.add(`${date}|${formatHour(h + offset)}`);
      }
      return {
        requestId: req.id,
        student: req.student,
        itemId: item.id,
        itemName: item.name,
        date,
        start: formatHour(h),
        end: formatHour(h + neededDur),
        durationHours: neededDur,
        isContestedSlot: false,
        score: entryScore,
      };
    }
  }
  return null;
}

function clampRequestedDuration(req: AccessRequest): number {
  return Math.max(
    LAB_SCHEDULE.MIN_BOOKING_HOURS,
    Math.min(LAB_SCHEDULE.MAX_BOOKING_HOURS, req.preferredDurationHours ?? req.hoursNeeded ?? 1)
  );
}

function assignWinner(
  winner: RankedAllocationEntry,
  item: EquipmentItem,
  week1: string[],
  referenceDate: string,
  occupiedKeys: Set<string>
): { assignment: AllocationAssignment; feasible: boolean; reason: string } {
  const date = winner.request.preferredDate ?? week1[1] ?? referenceDate;
  const startHour = parseHour(winner.request.preferredStart ?? '10:00');
  const endHour = Math.min(LAB_SCHEDULE.END_HOUR, startHour + clampRequestedDuration(winner.request));
  for (let h = startHour; h < endHour; h += 1) {
    occupiedKeys.add(`${date}|${formatHour(h)}`);
  }
  const start = formatHour(startHour);
  const end = formatHour(endHour);
  return {
    feasible: date <= winner.request.deadline,
    assignment: {
      requestId: winner.request.id,
      student: winner.request.student,
      itemId: item.id,
      itemName: item.name,
      date,
      start,
      end,
      durationHours: endHour - startHour,
      isContestedSlot: true,
      score: winner.score,
    },
    reason: `${winner.request.student} ranked #1 (${winner.score}/100) and keeps the contested ${date} ${start}–${end} window.`,
  };
}

function assignRunnerUp(
  entry: RankedAllocationEntry,
  item: EquipmentItem,
  allItems: EquipmentItem[],
  slots: Array<ScheduleSlot | TimeSlot>,
  candidateDates: string[],
  occupiedKeys: Set<string>
): { feasible: boolean; assignment?: AllocationAssignment; alternative?: AllocationAlternative; reason: string } {
  const req = entry.request;
  const neededDur = clampRequestedDuration(req);
  const assigned = findEarliestOpenBlock(req, entry.score, item, neededDur, candidateDates, occupiedKeys);
  if (assigned) {
    return {
      feasible: true,
      assignment: assigned,
      reason: `${req.student} (${entry.score}/100) is reassigned to the earliest open window (${assigned.date} ${assigned.start}–${assigned.end}) before their ${req.deadline} deadline.`,
    };
  }
  const alt = findSimilarAlternativeItem(item, allItems, slots);
  if (!alt) {
    return { feasible: false, reason: `No feasible slot remained on ${item.name} for ${req.student} before ${req.deadline}.` };
  }
  return {
    feasible: false,
    alternative: {
      requestId: req.id,
      student: req.student,
      suggestedItemId: alt.id,
      suggestedItemName: alt.name,
      location: alt.location,
      nextFreeSlot: alt.nextFreeSlot,
      reason: `No ${neededDur}h slot remains on ${item.name} before ${req.deadline}; ${alt.name} is an available ${alt.type} alternative in ${alt.location}.`,
    },
    reason: `No feasible slot remained for ${req.student} before ${req.deadline}; suggested alternative ${alt.name} (${alt.location}).`,
  };
}

/**
 * Deterministically allocates a contested slot to the top-ranked request and assigns
 * remaining requests to the earliest feasible open slot or a similar available alternative.
 *
 * @param conflictingRequests - Competing access requests.
 * @param item - Contested equipment item.
 * @param slots - Existing slot bookings.
 * @param allItems - Full equipment catalog used for similar-item alternatives.
 * @param context - Optional student usage history and fixed reference date.
 * @returns Ranked assignments, feasibility map, alternatives, and explanation lines.
 */
export function allocate(
  conflictingRequests: AccessRequest[],
  item: EquipmentItem,
  slots: Array<ScheduleSlot | TimeSlot>,
  allItems: EquipmentItem[],
  context: { recentHoursByStudent?: Record<string, number>; referenceDate?: string } = {}
): AllocationResult {
  const referenceDate = context.referenceDate ?? LAB_SCHEDULE.DEFAULT_REFERENCE_DATE;
  const recentHours = buildRecentHoursMap(slots, context.recentHoursByStudent);
  const ranked = rankCompetingRequests(conflictingRequests, item, slots, recentHours, referenceDate);

  const assignments: AllocationAssignment[] = [];
  const alternatives: AllocationAlternative[] = [];
  const feasible: Record<string, boolean> = {};
  const reasons: string[] = [];
  if (ranked.length === 0) return { assignments, alternatives, feasible, reasons, ranked };

  const week1 = buildWeekDates(referenceDate);
  const week2 = buildWeekDates(addDaysIso(week1[0], 7));
  const candidateDates = [...week1, ...week2].filter((d) => d >= referenceDate);
  const occupiedKeys = buildOccupiedSlotKeys(item.id, slots);

  const topDecision = assignWinner(ranked[0], item, week1, referenceDate, occupiedKeys);
  feasible[ranked[0].request.id] = topDecision.feasible;
  assignments.push(topDecision.assignment);
  reasons.push(topDecision.reason);

  for (let i = 1; i < ranked.length; i += 1) {
    const outcome = assignRunnerUp(ranked[i], item, allItems, slots, candidateDates, occupiedKeys);
    feasible[ranked[i].request.id] = outcome.feasible;
    if (outcome.assignment) assignments.push(outcome.assignment);
    if (outcome.alternative) alternatives.push(outcome.alternative);
    reasons.push(outcome.reason);
  }

  return { assignments, alternatives, feasible, reasons, ranked };
}

/**
 * Formats a deterministic plain-language summary of an allocation decision.
 *
 * @param result - Deterministic output returned by `allocate`.
 * @returns Plain-language sentence summary.
 */
export function explainAllocation(result: AllocationResult): string {
  return result.reasons.length === 0
    ? 'No competing requests were detected for this item.'
    : result.reasons.join(' ');
}
