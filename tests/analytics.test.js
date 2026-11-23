import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSummary,
  getUnderusedItems,
  getUtilizationByLab,
} from '../src/js/analytics.ts';
import {
  buildItem,
  buildLab,
  buildRequest,
  buildSlot,
  FIXED_TODAY,
  FIXED_TUESDAY,
} from './helpers.js';
import { REQUEST_STATUSES } from '../src/js/constants.ts';

describe('getUtilizationByLab', () => {
  it('computes accurate bookedHours, capacityHours, and rounded utilization percentages per lab', () => {
    const labs = [
      buildLab({ id: 'lab-a', name: 'Optics Lab', room: 'SHN-204', departmentId: 'dept-physics' }),
      buildLab({ id: 'lab-b', name: 'FPGA Lab', room: 'ENG-312', departmentId: 'dept-ece' }),
    ];
    const items = [
      buildItem({ id: 'eq-a1', labId: 'lab-a', departmentId: 'dept-physics' }),
      buildItem({ id: 'eq-b1', labId: 'lab-b', departmentId: 'dept-ece' }),
    ];
    const slots = [
      buildSlot({ id: 's1', itemId: 'eq-a1', durationHours: 2, booked: true }),
      buildSlot({ id: 's2', itemId: 'eq-a1', durationHours: 2, booked: false }),
      buildSlot({ id: 's3', itemId: 'eq-b1', durationHours: 3, booked: true }),
      buildSlot({ id: 's4', itemId: 'eq-missing', durationHours: 4, booked: true }),
    ];

    const stats = getUtilizationByLab(slots, items, labs);
    assert.equal(stats.length, 2);
    assert.equal(stats[0].bookedHours, 2);
    assert.equal(stats[0].capacityHours, 4);
    assert.equal(stats[0].utilizationPct, 50);

    assert.equal(stats[1].bookedHours, 3);
    assert.equal(stats[1].capacityHours, 3);
    assert.equal(stats[1].utilizationPct, 100);
  });

  it('returns 0% utilization without dividing by zero when slots or items are empty', () => {
    const labs = [buildLab({ id: 'lab-empty' })];
    const emptySlotsStats = getUtilizationByLab([], [buildItem({ labId: 'lab-empty' })], labs);
    assert.equal(emptySlotsStats[0].utilizationPct, 0);
    assert.equal(emptySlotsStats[0].capacityHours, 0);
    assert.equal(emptySlotsStats[0].bookedHours, 0);

    assert.deepEqual(getUtilizationByLab([], [], []), []);
  });
});

describe('getUnderusedItems', () => {
  it('sorts items deterministically from lowest utilization to highest, tie-breaking by bookedHours then id', () => {
    const items = [
      buildItem({ id: 'eq-high' }),
      buildItem({ id: 'eq-zero-b' }),
      buildItem({ id: 'eq-zero-a' }),
      buildItem({ id: 'eq-mid' }),
    ];
    const slots = [
      buildSlot({ id: 's1', itemId: 'eq-high', durationHours: 2, booked: true }),
      buildSlot({ id: 's2', itemId: 'eq-mid', durationHours: 2, booked: true }),
      buildSlot({ id: 's3', itemId: 'eq-mid', durationHours: 2, booked: false }),
      buildSlot({ id: 's4', itemId: 'eq-zero-a', durationHours: 2, booked: false }),
      buildSlot({ id: 's5', itemId: 'eq-zero-b', durationHours: 2, booked: false }),
    ];

    const underused = getUnderusedItems(items, slots, 3);
    assert.deepEqual(
      underused.map((u) => u.item.id),
      ['eq-zero-a', 'eq-zero-b', 'eq-mid']
    );
    assert.equal(underused[0].utilizationPct, 0);
    assert.equal(underused[2].utilizationPct, 50);
  });

  it('handles empty items and zero-slot items without NaN', () => {
    assert.deepEqual(getUnderusedItems([], [], 3), []);
    const zeroCapacity = getUnderusedItems([buildItem({ id: 'eq-noslots' })], [], 3);
    assert.equal(zeroCapacity.length, 1);
    assert.equal(zeroCapacity[0].utilizationPct, 0);
  });
});

describe('getSummary', () => {
  it('counts pending requests, recent weekly approvals, open conflicts, and overall utilization', () => {
    const items = [buildItem({ id: 'eq-1' })];
    const slots = [
      buildSlot({ id: 's1', itemId: 'eq-1', durationHours: 1, booked: true }),
      buildSlot({ id: 's2', itemId: 'eq-1', durationHours: 3, booked: false }),
    ];
    const requests = [
      buildRequest({
        id: 'r-sub-1',
        itemId: 'eq-1',
        status: REQUEST_STATUSES[0],
        preferredDate: FIXED_TUESDAY,
        preferredStart: '10:00',
        preferredDurationHours: 2,
      }),
      buildRequest({
        id: 'r-rev-1',
        itemId: 'eq-1',
        status: REQUEST_STATUSES[1],
        preferredDate: FIXED_TUESDAY,
        preferredStart: '10:00',
        preferredDurationHours: 2,
      }),
      buildRequest({
        id: 'r-app-recent',
        itemId: 'eq-1',
        status: REQUEST_STATUSES[2],
        submittedAt: '2026-11-10',
        reviewedAt: '2026-11-20',
      }),
      buildRequest({
        id: 'r-app-old',
        itemId: 'eq-1',
        status: REQUEST_STATUSES[2],
        submittedAt: '2026-11-01',
        reviewedAt: '2026-11-10',
      }),
    ];

    const summary = getSummary(requests, slots, items, FIXED_TODAY);
    assert.equal(summary.pendingCount, 2);
    assert.equal(summary.approvedThisWeek, 1);
    assert.equal(summary.openConflicts, 1);
    assert.equal(summary.overallUtilizationPct, 25);
  });

  it('returns zeroed summary metrics on empty arrays without dividing by zero', () => {
    const summary = getSummary([], [], [], FIXED_TODAY);
    assert.deepEqual(summary, {
      pendingCount: 0,
      approvedThisWeek: 0,
      openConflicts: 0,
      overallUtilizationPct: 0,
    });
  });
});
