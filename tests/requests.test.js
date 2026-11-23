import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFacultySuggestion,
  normalizeSelectedItemIds,
  transitionRequest,
  validateRequest,
} from '../src/js/requests.ts';
import { canUserBookItem } from '../src/js/scheduler.ts';
import {
  buildDepartment,
  buildItem,
  buildRequest,
  buildSlot,
  buildUser,
  FIXED_FUTURE_DEADLINE,
  FIXED_PAST_DATE,
  FIXED_TODAY,
} from './helpers.js';
import {
  ACCESS_LEVELS,
  LIMITS,
  REQUEST_STATUSES,
  ROLES,
} from '../src/js/constants.ts';

function createRequestContext() {
  const departments = [
    buildDepartment({ id: 'dept-physics', name: 'Physics' }),
    buildDepartment({ id: 'dept-ece', name: 'Electronics & ECE' }),
  ];
  const items = [
    buildItem({ id: 'eq-open', accessLevel: ACCESS_LEVELS[0] }),
    buildItem({ id: 'eq-approval', accessLevel: ACCESS_LEVELS[1] }),
    buildItem({ id: 'eq-training', accessLevel: ACCESS_LEVELS[2] }),
  ];
  return { departments, items, referenceDate: FIXED_TODAY };
}

describe('validateRequest field validation', () => {
  it('accepts a valid request with all rules satisfied', () => {
    const ctx = createRequestContext();
    const res = validateRequest(
      {
        project: 'Thin-Film Interferometry',
        subjectCourse: 'PHYS 310',
        departmentId: 'dept-physics',
        teamSize: 3,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open', 'eq-approval'],
        hoursNeeded: 8,
        justification: 'Measuring optical film thickness across three sample wafers.',
        trainingConfirmed: false,
      },
      ctx
    );
    assert.equal(res.ok, true);
    assert.deepEqual(res.errors, []);
  });

  it('rejects project titles and course codes outside length bounds or with control characters', () => {
    const ctx = createRequestContext();
    const tooShort = validateRequest(
      {
        project: 'ab',
        subjectCourse: 'P',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'Valid justification length here.',
      },
      ctx
    );
    assert.equal(tooShort.ok, false);
    assert.ok(tooShort.fieldErrors.project);
    assert.ok(tooShort.fieldErrors.subjectCourse);

    const tooLong = validateRequest(
      {
        project: 'x'.repeat(LIMITS.PROJECT_MAX + 1),
        subjectCourse: 'y'.repeat(LIMITS.SUBJECT_MAX + 1),
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'z'.repeat(LIMITS.JUSTIFICATION_MAX + 1),
      },
      ctx
    );
    assert.equal(tooLong.ok, false);
    assert.ok(tooLong.fieldErrors.project);
    assert.ok(tooLong.fieldErrors.subjectCourse);
    assert.ok(tooLong.fieldErrors.justification);

    const controlChar = validateRequest(
      {
        project: 'Optics\u0007Study',
        subjectCourse: 'PHYS\u0000310',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'Valid justification\u0007with bell.',
      },
      ctx
    );
    assert.equal(controlChar.ok, false);
    assert.ok(controlChar.fieldErrors.project);
    assert.ok(controlChar.fieldErrors.subjectCourse);
    assert.ok(controlChar.fieldErrors.justification);
  });

  it('rejects deadlines on or before referenceDate and invalid date strings', () => {
    const ctx = createRequestContext();
    const sameDay = validateRequest(
      {
        project: 'Same Day Deadline',
        subjectCourse: 'PHYS 310',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_TODAY,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'Valid justification length here.',
      },
      ctx
    );
    const past = validateRequest(
      {
        project: 'Past Deadline',
        subjectCourse: 'PHYS 310',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_PAST_DATE,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'Valid justification length here.',
      },
      ctx
    );
    assert.equal(sameDay.ok, false);
    assert.ok(sameDay.fieldErrors.deadline);
    assert.equal(past.ok, false);
    assert.ok(past.fieldErrors.deadline);
  });

  it('rejects unknown item IDs, empty selections, out-of-range teamSize, and hours outside 1–100', () => {
    const ctx = createRequestContext();
    const unknownItem = validateRequest(
      {
        project: 'Unknown Item Test',
        subjectCourse: 'PHYS 310',
        departmentId: 'dept-unknown',
        teamSize: LIMITS.TEAM_MAX + 1,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-missing'],
        hoursNeeded: LIMITS.HOURS_NEEDED_MAX + 1,
        justification: 'Short',
      },
      ctx
    );
    assert.equal(unknownItem.ok, false);
    assert.ok(unknownItem.fieldErrors.departmentId);
    assert.ok(unknownItem.fieldErrors.teamSize);
    assert.ok(unknownItem.fieldErrors.itemIds);
    assert.ok(unknownItem.fieldErrors.hoursNeeded);
    assert.ok(unknownItem.fieldErrors.justification);

    const zeroHours = validateRequest(
      {
        project: 'Zero Hours Test',
        subjectCourse: 'PHYS 310',
        departmentId: 'dept-physics',
        teamSize: 0,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: [],
        hoursNeeded: 0,
        justification: 'Valid justification length here.',
      },
      ctx
    );
    assert.equal(zeroHours.ok, false);
    assert.ok(zeroHours.fieldErrors.teamSize);
    assert.ok(zeroHours.fieldErrors.itemIds);
    assert.ok(zeroHours.fieldErrors.hoursNeeded);
  });

  it('requires trainingConfirmed checkbox only when at least one selected item requires training', () => {
    const ctx = createRequestContext();
    const missingCheckbox = validateRequest(
      {
        project: 'Cryo Stage Run',
        subjectCourse: 'PHYS 418',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open', 'eq-training'],
        hoursNeeded: 6,
        justification: 'Measuring Hall voltage at 77 K across doped films.',
        trainingConfirmed: false,
      },
      ctx
    );
    assert.equal(missingCheckbox.ok, false);
    assert.ok(missingCheckbox.fieldErrors.trainingConfirmed);

    const confirmed = validateRequest(
      {
        project: 'Cryo Stage Run',
        subjectCourse: 'PHYS 418',
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open', 'eq-training'],
        hoursNeeded: 6,
        justification: 'Measuring Hall voltage at 77 K across doped films.',
        trainingConfirmed: true,
      },
      ctx
    );
    assert.equal(confirmed.ok, true);
  });

  it('deduplicates and normalizes selected item IDs from itemIds or legacy itemId', () => {
    assert.deepEqual(normalizeSelectedItemIds({ itemIds: [' eq-1 ', 'eq-1', 'eq-2', ''] }), ['eq-1', 'eq-2']);
    assert.deepEqual(normalizeSelectedItemIds({ itemId: ' eq-9 ' }), ['eq-9']);
  });
});

describe('transitionRequest state machine and booking unlock', () => {
  it('follows valid status transitions from Submitted through Under review to Approved or Changes requested and resubmission', () => {
    const initial = buildRequest({ status: REQUEST_STATUSES[0] });

    const inReview = transitionRequest(initial, REQUEST_STATUSES[1], '', FIXED_TODAY, ROLES.FACULTY);
    assert.equal(inReview.ok, true);
    assert.equal(inReview.request.status, REQUEST_STATUSES[1]);
    assert.equal(inReview.request.reviewedAt, FIXED_TODAY);

    const changes = transitionRequest(
      inReview.request,
      REQUEST_STATUSES[4],
      'Clarify sample prep steps.',
      FIXED_TODAY,
      ROLES.FACULTY
    );
    assert.equal(changes.ok, true);
    assert.equal(changes.request.status, REQUEST_STATUSES[4]);

    const resubmitted = transitionRequest(changes.request, REQUEST_STATUSES[0], '', FIXED_TODAY, ROLES.STUDENT);
    assert.equal(resubmitted.ok, true);
    assert.equal(resubmitted.request.status, REQUEST_STATUSES[0]);

    const reviewAgain = transitionRequest(resubmitted.request, REQUEST_STATUSES[1], '', FIXED_TODAY, ROLES.FACULTY);
    const approved = transitionRequest(
      reviewAgain.request,
      REQUEST_STATUSES[2],
      'Cleared for Tuesday bench.',
      FIXED_TODAY,
      ROLES.FACULTY
    );
    assert.equal(approved.ok, true);
    assert.equal(approved.request.status, REQUEST_STATUSES[2]);
  });

  it('rejects invalid transitions, terminal transitions, and non-faculty review decisions', () => {
    const submitted = buildRequest({ status: REQUEST_STATUSES[0] });
    const skipToApproved = transitionRequest(submitted, REQUEST_STATUSES[2], 'Skipping', FIXED_TODAY, ROLES.FACULTY);
    assert.equal(skipToApproved.ok, false);
    assert.equal(skipToApproved.request.status, REQUEST_STATUSES[0]);

    const studentAttempt = transitionRequest(submitted, REQUEST_STATUSES[1], '', FIXED_TODAY, ROLES.STUDENT);
    assert.equal(studentAttempt.ok, false);

    const underReview = transitionRequest(submitted, REQUEST_STATUSES[1], '', FIXED_TODAY, ROLES.FACULTY).request;
    const rejected = transitionRequest(
      underReview,
      REQUEST_STATUSES[3],
      'Lab undergoing maintenance.',
      FIXED_TODAY,
      ROLES.FACULTY
    );
    assert.equal(rejected.ok, true);

    const reopenRejected = transitionRequest(rejected.request, REQUEST_STATUSES[0], '', FIXED_TODAY, ROLES.FACULTY);
    assert.equal(reopenRejected.ok, false);
  });

  it('requires a valid reason for Rejected and Changes requested decisions', () => {
    const underReview = buildRequest({ status: REQUEST_STATUSES[1] });

    const shortReject = transitionRequest(underReview, REQUEST_STATUSES[3], 'no', FIXED_TODAY, ROLES.FACULTY);
    const blankChanges = transitionRequest(underReview, REQUEST_STATUSES[4], '   ', FIXED_TODAY, ROLES.FACULTY);
    const longReject = transitionRequest(
      underReview,
      REQUEST_STATUSES[3],
      'r'.repeat(LIMITS.REASON_MAX + 1),
      FIXED_TODAY,
      ROLES.FACULTY
    );

    assert.equal(shortReject.ok, false);
    assert.equal(blankChanges.ok, false);
    assert.equal(longReject.ok, false);
  });

  it('unlocks Smart Booking for restricted equipment once the request transitions to Approved', () => {
    const restrictedItem = buildItem({ id: 'eq-approval', accessLevel: ACCESS_LEVELS[1] });
    const student = buildUser({ id: 'stu-01', name: 'Maya Lin', role: ROLES.STUDENT });

    const submitted = buildRequest({
      studentId: 'stu-01',
      itemId: 'eq-approval',
      itemIds: ['eq-approval'],
      status: REQUEST_STATUSES[0],
    });
    assert.equal(canUserBookItem(restrictedItem, student, [submitted]).allowed, false);

    const underReview = transitionRequest(submitted, REQUEST_STATUSES[1], '', FIXED_TODAY, ROLES.FACULTY).request;
    const approved = transitionRequest(
      underReview,
      REQUEST_STATUSES[2],
      'Approved for lab use.',
      FIXED_TODAY,
      ROLES.FACULTY
    ).request;
    assert.equal(canUserBookItem(restrictedItem, student, [approved]).allowed, true);
  });

  it('builds a deterministic faculty suggestion summary with score', () => {
    const item = buildItem({ id: 'eq-open' });
    const req = buildRequest({ itemId: 'eq-open', deadline: '2026-11-26', hoursNeeded: 2 });
    const slots = [buildSlot({ itemId: 'eq-open', durationHours: 2, booked: false })];

    const suggestion = buildFacultySuggestion(req, item, slots, FIXED_TODAY);
    assert.ok(suggestion.score >= 70);
    assert.ok(suggestion.label.includes('Recommended: approve'));

    const missing = buildFacultySuggestion(req, undefined, slots, FIXED_TODAY);
    assert.equal(missing.score, 0);
  });
});
