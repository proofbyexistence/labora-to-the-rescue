/**
 * Deterministic scheduling, conflict detection, fairness scoring, and allocation facade.
 */
import { ALLOCATION_WEIGHTS, LAB_SCHEDULE } from './constants';

export { ALLOCATION_WEIGHTS };
export const LAB_START_HOUR = LAB_SCHEDULE.START_HOUR;
export const LAB_END_HOUR = LAB_SCHEDULE.END_HOUR;
export const MIN_BOOKING_HOURS = LAB_SCHEDULE.MIN_BOOKING_HOURS;
export const MAX_BOOKING_HOURS = LAB_SCHEDULE.MAX_BOOKING_HOURS;
export const DEFAULT_REFERENCE_DATE = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE;

export { allocate, explainAllocation } from './scheduler-allocation';
export { detectConflicts, scoreRequest } from './scheduler-scoring';
export {
  buildWeekDates,
  buildWeeklyHourlySlots,
  formatHour,
  parseHour,
} from './scheduler-slots';
export { canUserBookItem, validateBooking } from './scheduler-validation';
export type {
  AllocationAlternative,
  AllocationAssignment,
  AllocationResult,
  BookingInput,
  BookingValidationResult,
  ConflictGroup,
  RankedAllocationEntry,
  RequestScoreResult,
  ScheduleSlot,
  ScoreBreakdownItem,
} from './scheduler-types';
