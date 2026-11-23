/**
 * Shared TypeScript interfaces for weekly slot scheduling, booking validation,
 * conflict detection, and deterministic allocation scoring.
 */
import type { AccessRequest } from './types';

/** Normalized 1-hour slot entry used in the Mon–Sat booking grid. */
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

/** Input payload for creating a custom equipment reservation. */
export interface BookingInput {
  itemId: string;
  date: string;
  start: string;
  durationHours: number;
  purpose: string;
}

/** Result returned by booking rule validation. */
export interface BookingValidationResult {
  ok: boolean;
  errors: string[];
}

/** Group of active requests overlapping on the same item and date. */
export interface ConflictGroup {
  itemId: string;
  date: string;
  start: string;
  end: string;
  requests: AccessRequest[];
}

/** Individual factor score contribution inside a request score breakdown. */
export interface ScoreBreakdownItem {
  factor: string;
  points: number;
  maxPoints: number;
  reason: string;
}

/** Weighted priority score and itemized factor breakdown for one request. */
export interface RequestScoreResult {
  score: number;
  breakdown: ScoreBreakdownItem[];
}

/** Assigned slot decision produced by deterministic allocation. */
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

/** Similar-item alternative suggested when no pre-deadline slot exists. */
export interface AllocationAlternative {
  requestId: string;
  student: string;
  suggestedItemId: string;
  suggestedItemName: string;
  location: string;
  nextFreeSlot: string;
  reason: string;
}

/** Ranked entry pairing a competing request with its priority score breakdown. */
export interface RankedAllocationEntry {
  request: AccessRequest;
  score: number;
  breakdown: ScoreBreakdownItem[];
}

/** Complete output returned by deterministic conflict allocation. */
export interface AllocationResult {
  assignments: AllocationAssignment[];
  alternatives: AllocationAlternative[];
  feasible: Record<string, boolean>;
  reasons: string[];
  ranked: RankedAllocationEntry[];
}
