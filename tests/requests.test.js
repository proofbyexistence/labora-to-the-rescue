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

function createRequestContext() {
  const departments = [
    buildDepartment({ id: 'dept-physics', name: 'Physics' }),
    buildDepartment({ id: 'dept-ece', name: 'Electronics & ECE' }),
  ];
  const items = [
    buildItem({ id: 'eq-open', accessLevel: 'Open' }),
    buildItem({ id: 'eq-approval', accessLevel: 'Needs faculty approval' }),
    buildItem({ id: 'eq-training', accessLevel: 'Training required' }),
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
        project: 'x'.repeat(81),
        subjectCourse: 'y'.repeat(81),
        departmentId: 'dept-physics',
        teamSize: 2,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-open'],
        hoursNeeded: 4,
        justification: 'z'.repeat(501),
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
        teamSize: 11,
        deadline: FIXED_FUTURE_DEADLINE,
        itemIds: ['eq-missing'],
        hoursNeeded: 101,
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
    const initial = buildRequest({ status: 'Submitted' });

    const inReview = transitionRequest(initial, 'Under review', '', FIXED_TODAY, 'faculty');
    assert.equal(inReview.ok, true);
    assert.equal(inReview.request.status, 'Under review');
    assert.equal(inReview.request.reviewedAt, FIXED_TODAY);

    const changes = transitionRequest(inReview.request, 'Changes requested', 'Clarify sample prep steps.', FIXED_TODAY, 'faculty');
    assert.equal(changes.ok, true);
    assert.equal(changes.request.status, 'Changes requested');

    const resubmitted = transitionRequest(changes.request, 'Submitted', '', FIXED_TODAY, 'student');
    assert.equal(resubmitted.ok, true);
    assert.equal(resubmitted.request.status, 'Submitted');

    const reviewAgain = transitionRequest(resubmitted.request, 'Under review', '', FIXED_TODAY, 'faculty');
    const approved = transitionRequest(reviewAgain.request, 'Approved', 'Cleared for Tuesday bench.', FIXED_TODAY, 'faculty');
    assert.equal(approved.ok, true);
    assert.equal(approved.request.status, 'Approved');
  });

  it('rejects invalid transitions, terminal transitions, and non-faculty review decisions', () => {
    const submitted = buildRequest({ status: 'Submitted' });
    const skipToApproved = transitionRequest(submitted, 'Approved', 'Skipping', FIXED_TODAY, 'faculty');
    assert.equal(skipToApproved.ok, false);
    assert.equal(skipToApproved.request.status, 'Submitted');

    const studentAttempt = transitionRequest(submitted, 'Under review', '', FIXED_TODAY, 'student');
    assert.equal(studentAttempt.ok, false);

    const underReview = transitionRequest(submitted, 'Under review', '', FIXED_TODAY, 'faculty').request;
    const rejected = transitionRequest(underReview, 'Rejected', 'Lab undergoing maintenance.', FIXED_TODAY, 'faculty');
    assert.equal(rejected.ok, true);

    const reopenRejected = transitionRequest(rejected.request, 'Submitted', '', FIXED_TODAY, 'faculty');
    assert.equal(reopenRejected.ok, false);
  });

  it('requires a 3–300 char reason for Rejected and Changes requested decisions', () => {
    const underReview = buildRequest({ status: 'Under review' });

    const shortReject = transitionRequest(underReview, 'Rejected', 'no', FIXED_TODAY, 'faculty');
    const blankChanges = transitionRequest(underReview, 'Changes requested', '   ', FIXED_TODAY, 'faculty');
    const longReject = transitionRequest(underReview, 'Rejected', 'r'.repeat(301), FIXED_TODAY, 'faculty');

    assert.equal(shortReject.ok, false);
    assert.equal(blankChanges.ok, false);
    assert.equal(longReject.ok, false);
  });

  it('unlocks Smart Booking for restricted equipment once the request transitions to Approved', () => {
    const restrictedItem = buildItem({ id: 'eq-approval', accessLevel: 'Needs faculty approval' });
    const student = buildUser({ id: 'stu-01', name: 'Maya Lin', role: 'student' });

    const submitted = buildRequest({
      studentId: 'stu-01',
      itemId: 'eq-approval',
      itemIds: ['eq-approval'],
      status: 'Submitted',
    });
    assert.equal(canUserBookItem(restrictedItem, student, [submitted]).allowed, false);

    const underReview = transitionRequest(submitted, 'Under review', '', FIXED_TODAY, 'faculty').request;
    const approved = transitionRequest(underReview, 'Approved', 'Approved for lab use.', FIXED_TODAY, 'faculty').request;
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
