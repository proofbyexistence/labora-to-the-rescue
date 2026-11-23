import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDepartment,
  addItem,
  addLab,
  addSlots,
  deleteDepartment,
  deleteItem,
  deleteLab,
  deleteSlot,
  editDepartment,
  editItem,
  editLab,
  getDependents,
} from '../src/js/catalog-admin.ts';
import {
  buildCatalogSnapshot,
  buildRequest,
  buildSlot,
  FIXED_PAST_DATE,
  FIXED_SUNDAY,
  FIXED_TODAY,
  FIXED_WEDNESDAY,
} from './helpers.js';

describe('catalog-admin role guard', () => {
  it('rejects every add, edit, and delete catalog operation when role is student', () => {
    const snap = buildCatalogSnapshot();

    assert.equal(addDepartment('student', { name: 'Aerospace' }, snap).ok, false);
    assert.equal(editDepartment('student', 'dept-physics', { name: 'Applied Physics' }, snap).ok, false);
    assert.equal(deleteDepartment('student', 'dept-physics', snap, 'cancelAffected', FIXED_TODAY).ok, false);

    assert.equal(addLab('student', { departmentId: 'dept-physics', name: 'Optics II' }, snap).ok, false);
    assert.equal(editLab('student', 'lab-phy-optics', { departmentId: 'dept-physics', name: 'Optics II' }, snap).ok, false);
    assert.equal(deleteLab('student', 'lab-phy-optics', snap, 'cancelAffected', FIXED_TODAY).ok, false);

    const itemInput = {
      name: 'Laser Power Meter',
      departmentId: 'dept-physics',
      labId: 'lab-phy-optics',
      type: 'Instruments',
      location: 'SHN-204 · Bench C',
      status: 'Available',
      accessLevel: 'Open',
      specs: '1 mW to 5 W',
    };
    assert.equal(addItem('student', itemInput, snap).ok, false);
    assert.equal(editItem('student', 'eq-phy-01', itemInput, snap).ok, false);
    assert.equal(deleteItem('student', 'eq-phy-01', snap, 'cancelAffected', FIXED_TODAY).ok, false);

    assert.equal(
      addSlots('student', { itemId: 'eq-phy-01', date: FIXED_WEDNESDAY, startTime: '09:00', endTime: '11:00' }, snap, FIXED_TODAY).ok,
      false
    );
    assert.equal(deleteSlot('student', 'sl-001', snap, 'cancelAffected', FIXED_TODAY).ok, false);
  });
});

describe('catalog-admin CRUD, trimming, length limits, and duplicates', () => {
  it('adds and edits departments while trimming whitespace and rejecting duplicates and oversized fields', () => {
    const snap = buildCatalogSnapshot();

    const dup = addDepartment('faculty', { name: '  physics  ' }, snap);
    assert.equal(dup.ok, false);

    const tooLong = addDepartment('faculty', { name: 'A'.repeat(51), summary: 'S'.repeat(201) }, snap);
    assert.equal(tooLong.ok, false);
    assert.ok(tooLong.fieldErrors?.name);
    assert.ok(tooLong.fieldErrors?.summary);

    const added = addDepartment(
      'faculty',
      {
        name: '  Aerospace   Engineering ',
        code: 'aero',
        building: ' Wright   Hall ',
        leadFaculty: ' Dr.  N.  Singh ',
        summary: 'Wind tunnel and avionics testbeds.',
      },
      snap
    );
    assert.equal(added.ok, true);
    assert.equal(added.data?.name, 'Aerospace Engineering');
    assert.equal(added.data?.code, 'AERO');
    assert.equal(added.data?.building, 'Wright Hall');

    const edited = editDepartment(
      'faculty',
      added.data.id,
      { name: 'Aerospace Systems', code: 'AERS', building: 'Wright Hall', leadFaculty: 'Dr. N. Singh' },
      added.nextState
    );
    assert.equal(edited.ok, true);
    assert.equal(edited.nextState?.departments.some((d) => d.name === 'Aerospace Systems'), true);
  });

  it('adds and edits labs, enforces unique names per department, and keeps child items synced on department move', () => {
    const snap = buildCatalogSnapshot();

    const dupLab = addLab('faculty', { departmentId: 'dept-physics', name: '  laser & optics bench ' }, snap);
    assert.equal(dupLab.ok, false);

    const tooLongLab = addLab('faculty', { departmentId: 'dept-physics', name: 'L'.repeat(61), room: 'R'.repeat(25) }, snap);
    assert.equal(tooLongLab.ok, false);
    assert.ok(tooLongLab.fieldErrors?.name);
    assert.ok(tooLongLab.fieldErrors?.room);

    const added = addLab(
      'faculty',
      { departmentId: 'dept-physics', name: '  Photonics   Annex ', room: ' SHN-210 ' },
      snap
    );
    assert.equal(added.ok, true);
    assert.equal(added.data?.name, 'Photonics Annex');
    assert.equal(added.data?.room, 'SHN-210');

    // Moving lab-phy-optics to dept-ece updates its child items' departmentId
    const moved = editLab(
      'faculty',
      'lab-phy-optics',
      { departmentId: 'dept-ece', name: 'Photonics & Optics Lab', room: 'ENG-105' },
      added.nextState
    );
    assert.equal(moved.ok, true);
    const movedItem = moved.nextState?.items.find((i) => i.id === 'eq-phy-01');
    assert.equal(movedItem?.departmentId, 'dept-ece');
  });

  it('adds and edits equipment items, rejects duplicate names in the same lab, and enforces field limits', () => {
    const snap = buildCatalogSnapshot();

    const dupItem = addItem(
      'faculty',
      {
        name: '  uv-vis optical spectrometer ',
        departmentId: 'dept-physics',
        labId: 'lab-phy-optics',
        type: 'Instruments',
        location: 'SHN-204',
        status: 'Available',
        accessLevel: 'Open',
        specs: 'Duplicate',
      },
      snap
    );
    assert.equal(dupItem.ok, false);

    const badLength = addItem(
      'faculty',
      {
        name: 'X'.repeat(81),
        departmentId: 'dept-physics',
        labId: 'lab-phy-optics',
        type: 'Instruments',
        location: 'Y'.repeat(81),
        status: 'Available',
        accessLevel: 'Open',
        specs: 'Z'.repeat(201),
      },
      snap
    );
    assert.equal(badLength.ok, false);
    assert.ok(badLength.fieldErrors?.name);
    assert.ok(badLength.fieldErrors?.location);
    assert.ok(badLength.fieldErrors?.specs);

    const added = addItem(
      'faculty',
      {
        name: '  Lock-In   Amplifier ',
        departmentId: 'dept-physics',
        labId: 'lab-phy-optics',
        type: 'Instruments',
        location: ' SHN-204 · Rack 2 ',
        status: 'Available',
        accessLevel: 'Open',
        specs: '100 kHz dual-phase DSP lock-in',
      },
      snap
    );
    assert.equal(added.ok, true);
    assert.equal(added.data?.name, 'Lock-In Amplifier');
    assert.equal(added.data?.nextFreeSlot, 'Unscheduled');

    const edited = editItem(
      'faculty',
      added.data.id,
      {
        name: 'Lock-In Amplifier SR830',
        departmentId: 'dept-physics',
        labId: 'lab-phy-optics',
        type: 'Instruments',
        location: 'SHN-204 · Rack 3',
        status: 'Limited',
        accessLevel: 'Needs faculty approval',
        specs: '102 kHz dual-phase DSP',
      },
      added.nextState
    );
    assert.equal(edited.ok, true);
    assert.equal(edited.data?.accessLevel, 'Needs faculty approval');
  });

  it('adds 1-hour slots within Mon–Sat 09:00–17:00 and rejects past dates, Sundays, out-of-hours, and overlaps', () => {
    const snap = buildCatalogSnapshot();

    assert.equal(
      addSlots('faculty', { itemId: 'eq-phy-01', date: FIXED_PAST_DATE, startTime: '09:00', endTime: '11:00' }, snap, FIXED_TODAY).ok,
      false
    );
    assert.equal(
      addSlots('faculty', { itemId: 'eq-phy-01', date: FIXED_SUNDAY, startTime: '09:00', endTime: '11:00' }, snap, FIXED_TODAY).ok,
      false
    );
    assert.equal(
      addSlots('faculty', { itemId: 'eq-phy-01', date: FIXED_WEDNESDAY, startTime: '08:00', endTime: '10:00' }, snap, FIXED_TODAY).ok,
      false
    );
    assert.equal(
      addSlots('faculty', { itemId: 'eq-phy-01', date: FIXED_WEDNESDAY, startTime: '15:00', endTime: '18:00' }, snap, FIXED_TODAY).ok,
      false
    );

    const added = addSlots(
      'faculty',
      { itemId: 'eq-phy-01', date: FIXED_WEDNESDAY, startTime: '09:00', endTime: '12:00' },
      snap,
      FIXED_TODAY
    );
    assert.equal(added.ok, true);
    assert.equal(added.data?.length, 3);

    const overlapping = addSlots(
      'faculty',
      { itemId: 'eq-phy-01', date: FIXED_WEDNESDAY, startTime: '10:00', endTime: '13:00' },
      added.nextState,
      FIXED_TODAY
    );
    assert.equal(overlapping.ok, false);
  });
});

describe('getDependents and safe deletion with cancelAffected', () => {
  it('finds child labs, child items, active bookings, and blocking requests via getDependents', () => {
    const snap = buildCatalogSnapshot({
      requests: [
        buildRequest({ id: 'req-active', departmentId: 'dept-physics', itemId: 'eq-phy-01', itemIds: ['eq-phy-01'], status: 'Submitted' }),
        buildRequest({ id: 'req-rejected', departmentId: 'dept-physics', itemId: 'eq-phy-01', itemIds: ['eq-phy-01'], status: 'Rejected' }),
      ],
    });

    const deptDeps = getDependents({ type: 'department', id: 'dept-physics' }, snap);
    assert.equal(deptDeps.childLabs.length, 1);
    assert.equal(deptDeps.childItems.length, 2);
    assert.equal(deptDeps.activeBookings.length, 1);
    assert.equal(deptDeps.affectedRequests.length, 1);
    assert.equal(deptDeps.affectedRequests[0].id, 'req-active');

    const slotDeps = getDependents({ type: 'slot', id: 'sl-002' }, snap);
    assert.equal(slotDeps.activeBookings.length, 1);
  });

  it('blocks deleting a department with dependents unless cancelAffected is given, leaving zero orphaned bookings or requests', () => {
    const snap = buildCatalogSnapshot({
      requests: [
        buildRequest({ id: 'req-dep-1', departmentId: 'dept-physics', itemId: 'eq-phy-01', itemIds: ['eq-phy-01'], status: 'Approved' }),
      ],
    });

    const blocked = deleteDepartment('faculty', 'dept-physics', snap, undefined, FIXED_TODAY);
    assert.equal(blocked.ok, false);
    assert.ok((blocked.dependents?.totalCount ?? 0) > 0);

    const canceled = deleteDepartment('faculty', 'dept-physics', snap, 'cancel', FIXED_TODAY);
    assert.equal(canceled.ok, false);

    const forced = deleteDepartment('faculty', 'dept-physics', snap, 'cancelAffected', FIXED_TODAY);
    assert.equal(forced.ok, true);
    const next = forced.nextState;

    assert.equal(next.departments.some((d) => d.id === 'dept-physics'), false);
    assert.equal(next.labs.some((l) => l.departmentId === 'dept-physics'), false);
    assert.equal(next.items.some((i) => i.departmentId === 'dept-physics'), false);
    assert.equal(next.slots.some((s) => s.itemId === 'eq-phy-01' || s.itemId === 'eq-phy-02'), false);

    const updatedReq = next.requests.find((r) => r.id === 'req-dep-1');
    assert.equal(updatedReq?.status, 'Changes requested');
    assert.equal(updatedReq?.departmentId, '');
    assert.equal(updatedReq?.itemId, '');
    assert.deepEqual(updatedReq?.itemIds, []);
  });

  it('blocks deleting a lab or item with dependents unless cancelAffected is given and cleans up slots and requests', () => {
    const snap = buildCatalogSnapshot({
      requests: [
        buildRequest({ id: 'req-lab', departmentId: 'dept-physics', itemId: 'eq-phy-01', itemIds: ['eq-phy-01'], status: 'Under review' }),
      ],
    });

    assert.equal(deleteLab('faculty', 'lab-phy-optics', snap, undefined, FIXED_TODAY).ok, false);
    const labDeleted = deleteLab('faculty', 'lab-phy-optics', snap, 'cancelAffected', FIXED_TODAY);
    assert.equal(labDeleted.ok, true);
    assert.equal(labDeleted.nextState.items.some((i) => i.labId === 'lab-phy-optics'), false);
    assert.equal(labDeleted.nextState.slots.some((s) => s.itemId === 'eq-phy-01'), false);
    assert.equal(labDeleted.nextState.requests[0].status, 'Changes requested');
    assert.equal(labDeleted.nextState.requests[0].itemId, '');

    assert.equal(deleteItem('faculty', 'eq-phy-01', snap, undefined, FIXED_TODAY).ok, false);
    const itemDeleted = deleteItem('faculty', 'eq-phy-01', snap, 'cancelAffected', FIXED_TODAY);
    assert.equal(itemDeleted.ok, true);
    assert.equal(itemDeleted.nextState.items.some((i) => i.id === 'eq-phy-01'), false);
    assert.equal(itemDeleted.nextState.slots.some((s) => s.itemId === 'eq-phy-01'), false);
    assert.equal(itemDeleted.nextState.requests[0].status, 'Changes requested');
    assert.equal(itemDeleted.nextState.requests[0].itemId, '');
  });

  it('allows deleting a free slot directly and blocks deleting a booked slot unless cancelAffected is given', () => {
    const linkedReq = buildRequest({
      id: 'req-slot-linked',
      departmentId: 'dept-physics',
      itemId: 'eq-phy-01',
      itemIds: ['eq-phy-01'],
      status: 'Approved',
    });
    const bookedSlot = buildSlot({
      id: 'sl-booked-linked',
      itemId: 'eq-phy-01',
      booked: true,
      bookedBy: 'Maya Lin',
      status: 'booked',
      requestId: 'req-slot-linked',
    });
    const snap = buildCatalogSnapshot({
      slots: [buildSlot({ id: 'sl-free', booked: false }), bookedSlot],
      requests: [linkedReq],
    });

    const freeDeleted = deleteSlot('faculty', 'sl-free', snap, undefined, FIXED_TODAY);
    assert.equal(freeDeleted.ok, true);
    assert.equal(freeDeleted.nextState.slots.some((s) => s.id === 'sl-free'), false);

    const bookedBlocked = deleteSlot('faculty', 'sl-booked-linked', snap, undefined, FIXED_TODAY);
    assert.equal(bookedBlocked.ok, false);
    assert.equal(bookedBlocked.dependents?.activeBookings.length, 1);

    const bookedForced = deleteSlot('faculty', 'sl-booked-linked', snap, 'cancelAffected', FIXED_TODAY);
    assert.equal(bookedForced.ok, true);
    assert.equal(bookedForced.nextState.slots.some((s) => s.id === 'sl-booked-linked'), false);
    const updatedReq = bookedForced.nextState.requests.find((r) => r.id === 'req-slot-linked');
    assert.equal(updatedReq?.status, 'Changes requested');
    assert.equal(updatedReq?.reviewedAt, FIXED_TODAY);
  });
});
