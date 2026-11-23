import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocate,
  ALLOCATION_WEIGHTS,
  buildWeekDates,
  buildWeeklyHourlySlots,
  canUserBookItem,
  detectConflicts,
  explainAllocation,
  scoreRequest,
  validateBooking,
} from '../src/js/scheduler.ts';
import {
  buildItem,
  buildRequest,
  buildSlot,
  buildUser,
  FIXED_PAST_DATE,
  FIXED_SATURDAY,
  FIXED_SUNDAY,
  FIXED_TODAY,
  FIXED_TUESDAY,
  FIXED_WEDNESDAY,
} from './helpers.js';
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
  LAB_SCHEDULE,
  REQUEST_STATUSES,
  ROLES,
} from '../src/js/constants.ts';

describe('validateBooking rules and overlap checks', () => {
  const existingSlots = [
    buildSlot({
      id: 'sl-booked-tue',
      itemId: 'eq-phy-01',
      date: FIXED_TUESDAY,
      start: '13:00',
      end: '15:00',
      window: '13:00 – 15:00',
      durationHours: 2,
      booked: true,
      status: 'booked',
      bookedBy: 'R. Kapoor',
    }),
    buildSlot({
      id: 'sl-free-tue',
      itemId: 'eq-phy-01',
      date: FIXED_TUESDAY,
      start: '10:00',
      end: '11:00',
      window: '10:00 – 11:00',
      durationHours: 1,
      booked: false,
      status: 'free',
    }),
  ];

  it('rejects slots scheduled in the past relative to referenceDate', () => {
    const res = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_PAST_DATE, start: '10:00', durationHours: 2, purpose: 'Optical test' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.toLowerCase().includes('past')));
  });

  it('rejects bookings on Sunday when labs are closed', () => {
    const res = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_SUNDAY, start: '10:00', durationHours: 2, purpose: 'Weekend run' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.toLowerCase().includes('sunday')));
  });

  it('rejects start times or durations extending outside 09:00–17:00 lab hours', () => {
    const tooEarly = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_TUESDAY, start: '08:00', durationHours: 2, purpose: 'Early run' },
      existingSlots,
      FIXED_TODAY
    );
    const tooLate = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_TUESDAY, start: '16:00', durationHours: 2, purpose: 'Late run' },
      existingSlots,
      FIXED_TODAY
    );
    const halfHour = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_TUESDAY, start: '10:30', durationHours: 1, purpose: 'Half hour' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(tooEarly.ok, false);
    assert.equal(tooLate.ok, false);
    assert.equal(halfHour.ok, false);
  });

  it('rejects bookings that overlap an existing booked slot on the same item', () => {
    const res = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_TUESDAY, start: '12:00', durationHours: 2, purpose: 'Overlap run' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.toLowerCase().includes('overlaps')));
  });

  it('rejects durations over max or less than min hours', () => {
    const overFour = validateBooking(
      {
        itemId: 'eq-phy-01',
        date: FIXED_WEDNESDAY,
        start: '09:00',
        durationHours: LAB_SCHEDULE.MAX_BOOKING_HOURS + 1,
        purpose: 'Long run',
      },
      existingSlots,
      FIXED_TODAY
    );
    const zeroHours = validateBooking(
      {
        itemId: 'eq-phy-01',
        date: FIXED_WEDNESDAY,
        start: '09:00',
        durationHours: LAB_SCHEDULE.MIN_BOOKING_HOURS - 1,
        purpose: 'Zero run',
      },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(overFour.ok, false);
    assert.equal(zeroHours.ok, false);
  });

  it('rejects missing itemId, invalid date, or missing/invalid purpose', () => {
    const res = validateBooking(
      { itemId: '', date: 'not-a-date', start: '', durationHours: 2, purpose: 'ab' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.length >= 4);
  });

  it('accepts a valid Mon–Sat booking within 09:00–17:00 without overlaps', () => {
    const saturdayOk = validateBooking(
      {
        itemId: 'eq-phy-01',
        date: FIXED_SATURDAY,
        start: '13:00',
        durationHours: LAB_SCHEDULE.MAX_BOOKING_HOURS,
        purpose: 'UV transmittance sweep',
      },
      existingSlots,
      FIXED_TODAY
    );
    const freeSlotOk = validateBooking(
      { itemId: 'eq-phy-01', date: FIXED_TUESDAY, start: '10:00', durationHours: 2, purpose: 'Beam calibration' },
      existingSlots,
      FIXED_TODAY
    );
    assert.equal(saturdayOk.ok, true);
    assert.deepEqual(saturdayOk.errors, []);
    assert.equal(freeSlotOk.ok, true);
  });

  it('expands a week grid to 48 canonical Mon–Sat hourly slots', () => {
    const dates = buildWeekDates(FIXED_TODAY);
    assert.deepEqual(dates, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
    const grid = buildWeeklyHourlySlots('eq-phy-01', existingSlots, FIXED_TODAY);
    assert.equal(grid.length, LAB_SCHEDULE.WEEK_SLOT_COUNT);
    assert.equal(grid.filter((s) => s.status === 'booked').length, 2);
  });
});

describe('detectConflicts', () => {
  it('detects overlapping active requests for the same item and date', () => {
    const r1 = buildRequest({
      id: 'req-a',
      itemId: 'eq-phy-01',
      status: REQUEST_STATUSES[0],
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });
    const r2 = buildRequest({
      id: 'req-b',
      student: 'Alex Rivera',
      studentId: 'stu-02',
      itemId: 'eq-phy-01',
      status: REQUEST_STATUSES[1],
      preferredDate: FIXED_TUESDAY,
      preferredStart: '11:00',
      preferredDurationHours: 2,
    });
    const conflicts = detectConflicts([r1, r2]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].itemId, 'eq-phy-01');
    assert.equal(conflicts[0].start, '10:00');
    assert.equal(conflicts[0].end, '13:00');
    assert.deepEqual(conflicts[0].requests.map((r) => r.id), ['req-a', 'req-b']);
  });

  it('ignores non-overlapping slots, different items/dates, and already-decided requests', () => {
    const requests = [
      buildRequest({ id: 'req-1', itemId: 'eq-phy-01', preferredDate: FIXED_TUESDAY, preferredStart: '09:00', preferredDurationHours: 2, status: REQUEST_STATUSES[0] }),
      buildRequest({ id: 'req-2', itemId: 'eq-phy-01', preferredDate: FIXED_TUESDAY, preferredStart: '11:00', preferredDurationHours: 2, status: REQUEST_STATUSES[0] }),
      buildRequest({ id: 'req-3', itemId: 'eq-phy-01', preferredDate: FIXED_TUESDAY, preferredStart: '09:00', preferredDurationHours: 2, status: REQUEST_STATUSES[2] }),
      buildRequest({ id: 'req-4', itemId: 'eq-phy-01', preferredDate: FIXED_WEDNESDAY, preferredStart: '09:00', preferredDurationHours: 2, status: REQUEST_STATUSES[0] }),
      buildRequest({ id: 'req-5', itemId: 'eq-phy-02', preferredDate: FIXED_TUESDAY, preferredStart: '09:00', preferredDurationHours: 2, status: REQUEST_STATUSES[0] }),
    ];
    assert.deepEqual(detectConflicts(requests), []);
  });
});

describe('scoreRequest', () => {
  it('returns a score from 0 to 100 whose breakdown points sum exactly to the total', () => {
    const item = buildItem();
    const req = buildRequest({
      deadline: '2026-11-26',
      project: 'UV-Vis spectrometer wavelength scan',
      teamSize: 3,
      hoursNeeded: 4,
    });
    const result = scoreRequest(req, {
      item,
      slots: [],
      recentHoursByStudent: { 'Maya Lin': 2 },
      referenceDate: FIXED_TODAY,
    });

    assert.equal(
      ALLOCATION_WEIGHTS.deadlineUrgency +
        ALLOCATION_WEIGHTS.feasibility +
        ALLOCATION_WEIGHTS.studentRequirements +
        ALLOCATION_WEIGHTS.fairness,
      100
    );
    assert.ok(result.score >= 0 && result.score <= 100);
    const sum = result.breakdown.reduce((acc, b) => acc + b.points, 0);
    assert.equal(sum, result.score);
  });

  it('scores urgent deadlines higher than distant deadlines', () => {
    const item = buildItem();
    const urgent = buildRequest({ id: 'req-urgent', deadline: '2026-11-25' }); // 2 days
    const distant = buildRequest({ id: 'req-distant', deadline: '2026-12-20' }); // 27 days

    const urgentRes = scoreRequest(urgent, { item, slots: [], referenceDate: FIXED_TODAY });
    const distantRes = scoreRequest(distant, { item, slots: [], referenceDate: FIXED_TODAY });

    assert.ok(urgentRes.score > distantRes.score);
    assert.ok(urgentRes.breakdown[0].points > distantRes.breakdown[0].points);
  });

  it('scores students with fewer recently booked hours higher on fairness', () => {
    const item = buildItem();
    const lowUsage = buildRequest({ id: 'req-low', student: 'Jordan Kim' });
    const highUsage = buildRequest({ id: 'req-high', student: 'Sam Patel' });
    const recentHoursByStudent = { 'Jordan Kim': 0, 'Sam Patel': 10 };

    const lowRes = scoreRequest(lowUsage, { item, slots: [], recentHoursByStudent, referenceDate: FIXED_TODAY });
    const highRes = scoreRequest(highUsage, { item, slots: [], recentHoursByStudent, referenceDate: FIXED_TODAY });

    assert.ok(lowRes.score > highRes.score);
    assert.ok(lowRes.breakdown[3].points > highRes.breakdown[3].points);
  });
});

describe('allocate deterministic conflict resolution', () => {
  it('is deterministic across input ordering and resolves ties by submission time then id', () => {
    const item = buildItem();
    const reqB = buildRequest({
      id: 'req-b',
      student: 'Student B',
      submittedAt: '2026-11-22',
      deadline: '2026-11-25',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });
    const reqA = buildRequest({
      id: 'req-a',
      student: 'Student A',
      submittedAt: '2026-11-22',
      deadline: '2026-11-25',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });
    const reqEarlier = buildRequest({
      id: 'req-c',
      student: 'Student C',
      submittedAt: '2026-11-21',
      deadline: '2026-11-25',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });

    const firstOrder = allocate([reqB, reqA, reqEarlier], item, [], [item], {
      recentHoursByStudent: { 'Student A': 0, 'Student B': 0, 'Student C': 0 },
      referenceDate: FIXED_TODAY,
    });
    const reversedOrder = allocate([reqEarlier, reqA, reqB], item, [], [item], {
      recentHoursByStudent: { 'Student A': 0, 'Student B': 0, 'Student C': 0 },
      referenceDate: FIXED_TODAY,
    });

    assert.deepEqual(
      firstOrder.ranked.map((r) => r.request.id),
      ['req-c', 'req-a', 'req-b']
    );
    assert.deepEqual(firstOrder.assignments, reversedOrder.assignments);
  });

  it('gives the contested slot to the top scorer and moves remaining requests to the earliest feasible slot', () => {
    const item = buildItem();
    const urgentReq = buildRequest({
      id: 'req-top',
      student: 'Maya Lin',
      deadline: '2026-11-25',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });
    const laterReq = buildRequest({
      id: 'req-second',
      student: 'Alex Rivera',
      deadline: '2026-11-28',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });

    const res = allocate([laterReq, urgentReq], item, [], [item], {
      recentHoursByStudent: { 'Maya Lin': 0, 'Alex Rivera': 6 },
      referenceDate: FIXED_TODAY,
    });

    assert.equal(res.assignments[0].requestId, 'req-top');
    assert.equal(res.assignments[0].isContestedSlot, true);
    assert.equal(res.assignments[0].date, FIXED_TUESDAY);
    assert.equal(res.assignments[0].start, '10:00');

    assert.equal(res.assignments[1].requestId, 'req-second');
    assert.equal(res.assignments[1].isContestedSlot, false);
    assert.equal(res.assignments[1].date, FIXED_TODAY);
    assert.equal(res.assignments[1].start, '09:00');
    assert.equal(res.feasible['req-top'], true);
    assert.equal(res.feasible['req-second'], true);
    assert.ok(explainAllocation(res).includes('Maya Lin'));
  });

  it('proposes a similar alternative item and marks the request infeasible when no slot fits before deadline', () => {
    const primary = buildItem({
      id: 'eq-phy-01',
      name: 'UV-Vis Optical Spectrometer',
      type: EQUIPMENT_TYPES[0],
      specs: '190-1100 nm optical spectrometer',
    });
    const similar = buildItem({
      id: 'eq-phy-alt',
      name: 'Benchtop UV Spectrometer',
      type: EQUIPMENT_TYPES[0],
      location: 'SHN-206',
      status: AVAILABILITY_STATUSES[0],
      specs: '200-1000 nm optical spectrometer',
      nextFreeSlot: '11-23 · 11:00',
    });

    // Book every hour on FIXED_TODAY (2026-11-23) for primary so the loser with deadline 2026-11-23 has 0 free slots
    const fullDaySlots = [
      buildSlot({
        id: 'sl-full-day',
        itemId: 'eq-phy-01',
        date: FIXED_TODAY,
        start: '09:00',
        end: '17:00',
        window: '09:00 – 17:00',
        durationHours: 8,
        booked: true,
        status: 'booked',
        bookedBy: 'Other Lab',
      }),
      buildSlot({
        id: 'sl-alt-free',
        itemId: 'eq-phy-alt',
        date: FIXED_TODAY,
        start: '11:00',
        end: '13:00',
        window: '11:00 – 13:00',
        durationHours: 2,
        booked: false,
        status: 'free',
      }),
    ];

    const winnerReq = buildRequest({
      id: 'req-win',
      student: 'Maya Lin',
      deadline: '2026-11-26',
      preferredDate: FIXED_TUESDAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });
    const squeezedReq = buildRequest({
      id: 'req-fail',
      student: 'Alex Rivera',
      deadline: FIXED_TODAY,
      preferredDate: FIXED_TODAY,
      preferredStart: '10:00',
      preferredDurationHours: 2,
    });

    const res = allocate([winnerReq, squeezedReq], primary, fullDaySlots, [primary, similar], {
      recentHoursByStudent: { 'Maya Lin': 0, 'Alex Rivera': 10 },
      referenceDate: FIXED_TODAY,
    });

    assert.equal(res.feasible['req-fail'], false);
    assert.equal(res.alternatives.length, 1);
    assert.equal(res.alternatives[0].requestId, 'req-fail');
    assert.equal(res.alternatives[0].suggestedItemId, 'eq-phy-alt');
  });
});

describe('canUserBookItem access control', () => {
  it('blocks booking of approval-required items until an approved request exists for that student', () => {
    const approvalItem = buildItem({ id: 'eq-ece-02', accessLevel: ACCESS_LEVELS[1] });
    const student = buildUser({ id: 'stu-01', name: 'Maya Lin', role: ROLES.STUDENT });

    const pendingReq = buildRequest({ studentId: 'stu-01', itemId: 'eq-ece-02', itemIds: ['eq-ece-02'], status: REQUEST_STATUSES[0] });
    assert.equal(canUserBookItem(approvalItem, student, [pendingReq]).allowed, false);

    const otherStudentApproved = buildRequest({ studentId: 'stu-99', student: 'Other Student', itemId: 'eq-ece-02', itemIds: ['eq-ece-02'], status: REQUEST_STATUSES[2] });
    assert.equal(canUserBookItem(approvalItem, student, [otherStudentApproved]).allowed, false);

    const approvedReq = buildRequest({ studentId: 'stu-01', itemId: 'eq-ece-02', itemIds: ['eq-ece-02'], status: REQUEST_STATUSES[2] });
    assert.equal(canUserBookItem(approvalItem, student, [approvedReq]).allowed, true);
  });

  it('requires confirmed training or an approved request for Training required items unless user is faculty', () => {
    const trainingItem = buildItem({ id: 'eq-phy-02', accessLevel: ACCESS_LEVELS[2] });
    const untrained = buildUser({ role: ROLES.STUDENT, confirmedTrainingItemIds: [] });
    const trained = buildUser({ role: ROLES.STUDENT, confirmedTrainingItemIds: ['eq-phy-02'] });
    const faculty = buildUser({ id: 'fac-01', role: ROLES.FACULTY, name: 'Dr. Vance' });

    assert.equal(canUserBookItem(trainingItem, untrained, []).allowed, false);
    assert.equal(canUserBookItem(trainingItem, trained, []).allowed, true);
    assert.equal(canUserBookItem(trainingItem, faculty, []).allowed, true);
  });
});
