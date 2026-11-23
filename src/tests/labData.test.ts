import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import aiRoutes from '../../server/aiRoutes';
import {
  loadServerCatalog,
  suggestEquipmentFallback,
} from '../../server/catalogFallback';
import { stripMarkup } from '../../server/geminiClient';
import { checkRateLimit } from '../../server/rateLimit';
import {
  formatAiSourceLabel,
  validateProjectDescription,
} from '../js/ai-client';
import {
  getSummary,
  getUnderusedItems,
  getUtilizationByLab,
} from '../js/analytics';
import {
  filterItems,
  paginateItems,
  parseHashState,
  parseUrlState,
  serializeHashState,
} from '../js/filter';
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
} from '../js/catalog-admin';
import {
  adminAddDepartment,
  adminAddItem,
  adminAddLab,
  adminAddSlots,
  adminDeleteDepartment,
  adminDeleteItem,
  adminDeleteLab,
  adminDeleteSlot,
  adminEditDepartment,
  adminEditItem,
  adminEditLab,
  applyAllocationSuggestion,
  bookSlot,
  cancelSlotBooking,
  createCustomBooking,
  getAllSlots,
  getCurrentUser,
  getDepartments,
  getEntityDependents,
  getItemById,
  getItems,
  getLabs,
  getRequests,
  getSlots,
  resetLabStore,
  reviewAccessRequest,
  submitAccessRequest,
  switchUserRole,
  transitionAccessRequest,
  validatePersistedState,
} from '../js/labData';
import {
  buildFacultySuggestion,
  transitionRequest,
  validateRequest,
} from '../js/requests';
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
} from '../js/scheduler';
import {
  getInitialTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from '../js/theme';

function runTests() {
  resetLabStore();

  // 1. Structural dataset guarantees
  const departments = getDepartments();
  assert.equal(departments.length, 7, 'Expected 7 academic departments');

  const allLabs = getLabs();
  assert.equal(allLabs.length, 14, 'Expected 2 labs per department (14 total)');
  for (const dept of departments) {
    assert.equal(getLabs(dept.id).length, 2, `Expected 2 labs for ${dept.name}`);
  }

  const allItems = getItems();
  assert.ok(allItems.length >= 30, `Expected at least 30 items, got ${allItems.length}`);
  for (const lab of allLabs) {
    const labItems = getItems({ labId: lab.id });
    assert.ok(
      labItems.length >= 3 && labItems.length <= 5,
      `Expected 3-5 items in ${lab.name}, got ${labItems.length}`
    );
  }

  const requiredTypes = ['Instruments', 'Development kits', 'Workstations', 'Safety gear'];
  for (const type of requiredTypes) {
    const matching = getItems({ type: type as typeof allItems[number]['type'] });
    assert.ok(matching.length > 0, `Expected equipment of type ${type}`);
  }

  const initialRequests = getRequests();
  assert.ok(initialRequests.length >= 6, 'Expected at least 6 initial sample access requests');

  // 2. Pure filter module tests
  const byDeptSearch = filterItems(
    allItems,
    { query: '  biotechnology  ' },
    { departments, labs: allLabs }
  );
  assert.equal(byDeptSearch.length, 6, 'Search should match department name case-insensitively');

  const byLabSearch = filterItems(
    allItems,
    { query: 'SHN-204' },
    { departments, labs: allLabs }
  );
  assert.equal(byLabSearch.length, 3, 'Search should match lab room');

  const byCombined = filterItems(
    allItems,
    { departmentId: 'dept-ece', type: 'Development kits', status: 'Available' },
    { departments, labs: allLabs }
  );
  assert.ok(byCombined.length >= 2, 'Combined filters should return matching ECE dev kits');

  // 3. Pagination & hash parsing tests
  const page1 = paginateItems(allItems, 1, 9);
  assert.equal(page1.items.length, 9);
  assert.equal(page1.page, 1);
  assert.equal(page1.totalPages, Math.ceil(allItems.length / 9));

  const parsedAlias = parseHashState('#dept=electronics&type=dev-kits&q=  FPGA  &p=2', {
    departments,
    labs: allLabs,
    items: allItems,
  });
  assert.equal(parsedAlias.page, 'discover');
  assert.equal(parsedAlias.filters.departmentId, 'dept-ece');
  assert.equal(parsedAlias.filters.type, 'Development kits');
  assert.equal(parsedAlias.filters.query, 'FPGA');
  assert.equal(parsedAlias.catalogPage, 2);

  const parsedUnknownItem = parseHashState('#booking&item=unknown-999', {
    departments,
    labs: allLabs,
    items: allItems,
  });
  assert.equal(parsedUnknownItem.page, 'booking');
  assert.equal(parsedUnknownItem.itemId, allItems[0].id);

  // Query string + unknown param / ID validation via parseUrlState
  const parsedUrlQuery = parseUrlState(
    '?page=discover&dept=dept-ece&lab=lab-ece-bad&type=InvalidType&unknown=evil&p=999',
    '',
    { departments, labs: allLabs, items: allItems }
  );
  assert.equal(parsedUrlQuery.page, 'discover');
  assert.equal(parsedUrlQuery.filters.departmentId, 'dept-ece');
  assert.equal(parsedUrlQuery.filters.labId, '');
  assert.equal(parsedUrlQuery.filters.type, '');
  assert.equal(parsedUrlQuery.catalogPage, 999);

  const parsedBadPage = parseUrlState('?page=<script>&item=bad-id', '', {
    departments,
    labs: allLabs,
    items: allItems,
  });
  assert.equal(parsedBadPage.page, 'home');
  assert.equal(parsedBadPage.itemId, allItems[0].id);

  const serialized = serializeHashState({
    page: 'discover',
    filters: { departmentId: 'dept-ece', type: 'Development kits' },
    catalogPage: 2,
  });
  assert.equal(serialized, '#discover&dept=dept-ece&type=Development+kits&p=2');

  // 4. Scheduler validation, conflict detection, scoring & allocation
  const weekDates = buildWeekDates('2026-11-23');
  assert.equal(weekDates.length, 6, 'Week grid should contain Mon–Sat (6 days)');
  assert.equal(weekDates[0], '2026-11-23');
  assert.equal(weekDates[5], '2026-11-28');

  const phySlots = getSlots('eq-phy-01');
  const hourlyPhy = buildWeeklyHourlySlots('eq-phy-01', phySlots, '2026-11-23');
  assert.equal(hourlyPhy.length, 48, '6 days x 8 hours = 48 one-hour slots');

  // Validation rejections
  const pastCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-20', start: '10:00', durationHours: 2, purpose: 'Test' },
    phySlots
  );
  assert.equal(pastCheck.ok, false);

  const sundayCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-29', start: '10:00', durationHours: 2, purpose: 'Test' },
    phySlots
  );
  assert.equal(sundayCheck.ok, false);

  const outsideHoursCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-24', start: '16:00', durationHours: 2, purpose: 'Test' },
    phySlots
  );
  assert.equal(outsideHoursCheck.ok, false);

  const overFourCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-24', start: '09:00', durationHours: 5, purpose: 'Test' },
    phySlots
  );
  assert.equal(overFourCheck.ok, false);

  // Overlap on 2026-11-24 13:00-15:00 (booked by R. Kapoor)
  const overlapCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-24', start: '13:00', durationHours: 2, purpose: 'Overlap' },
    phySlots
  );
  assert.equal(overlapCheck.ok, false);

  const validCheck = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-25', start: '10:00', durationHours: 2, purpose: 'Transmission run' },
    phySlots
  );
  assert.equal(validCheck.ok, true);

  // Conflict detection & deterministic scoring / allocation
  assert.equal(
    ALLOCATION_WEIGHTS.deadlineUrgency +
      ALLOCATION_WEIGHTS.feasibility +
      ALLOCATION_WEIGHTS.studentRequirements +
      ALLOCATION_WEIGHTS.fairness,
    100
  );

  const conflicts = detectConflicts(initialRequests, phySlots);
  assert.ok(conflicts.length >= 1, 'Expected seeded conflict on eq-phy-01');
  const phyConflict = conflicts.find((c) => c.itemId === 'eq-phy-01');
  assert.ok(phyConflict && phyConflict.requests.length === 2);

  const phyItem = getItemById('eq-phy-01')!;
  const scored0 = scoreRequest(phyConflict.requests[0], { item: phyItem, slots: phySlots });
  assert.ok(scored0.score >= 0 && scored0.score <= 100);
  assert.equal(scored0.breakdown.length, 4);

  const allocation = allocate(phyConflict.requests, phyItem, phySlots, allItems);
  assert.equal(allocation.assignments.length, 2, 'Both competing requests should receive slots');
  assert.equal(allocation.assignments[0].student, 'Maya Lin');
  assert.equal(allocation.assignments[0].isContestedSlot, true);
  assert.equal(allocation.assignments[1].isContestedSlot, false);
  assert.ok(explainAllocation(allocation).length > 10);

  // 5. Access rules
  const student = getCurrentUser();
  assert.equal(student.role, 'student');
  const restrictedItem = getItemById('eq-ece-02')!;
  assert.equal(canUserBookItem(restrictedItem, student, initialRequests).allowed, false);
  const trainedItem = getItemById('eq-ece-06')!;
  assert.equal(canUserBookItem(trainedItem, student, initialRequests).allowed, true);
  assert.equal(canUserBookItem(phyItem, student, initialRequests).allowed, true);

  // 6. Custom booking & allocation persistence
  const customBooked = createCustomBooking({
    itemId: 'eq-phy-01',
    date: '2026-11-25',
    start: '10:00',
    durationHours: 2,
    purpose: 'Lab check',
  });
  assert.ok(customBooked && customBooked.booked);

  applyAllocationSuggestion(allocation);
  const updatedReq = getRequests().find((r) => r.id === 'req-107');
  assert.equal(updatedReq?.status, 'Approved');

  // 7. Pure requests validation & state-machine tests
  resetLabStore();
  const invalidReq = validateRequest(
    {
      project: 'ab',
      subjectCourse: '',
      departmentId: 'dept-unknown',
      teamSize: 12,
      deadline: '2026-11-20',
      itemIds: [],
      hoursNeeded: 0,
      justification: 'short',
      trainingConfirmed: false,
    },
    { departments, items: allItems, referenceDate: '2026-11-23' }
  );
  assert.equal(invalidReq.ok, false);
  assert.ok(invalidReq.fieldErrors.project);
  assert.ok(invalidReq.fieldErrors.subjectCourse);
  assert.ok(invalidReq.fieldErrors.departmentId);
  assert.ok(invalidReq.fieldErrors.teamSize);
  assert.ok(invalidReq.fieldErrors.deadline);
  assert.ok(invalidReq.fieldErrors.itemIds);
  assert.ok(invalidReq.fieldErrors.hoursNeeded);
  assert.ok(invalidReq.fieldErrors.justification);

  // Training checkbox required when any selected item has Training required (e.g., eq-phy-02)
  const missingTraining = validateRequest(
    {
      project: 'Cryo Hall Mobility Study',
      subjectCourse: 'PHYS 418',
      departmentId: 'dept-physics',
      teamSize: 2,
      deadline: '2026-12-10',
      itemIds: ['eq-phy-01', 'eq-phy-02'],
      hoursNeeded: 6,
      justification: 'Testing carrier concentration and Hall voltage across thin films.',
      trainingConfirmed: false,
    },
    { departments, items: allItems, referenceDate: '2026-11-23' }
  );
  assert.equal(missingTraining.ok, false);
  assert.ok(missingTraining.fieldErrors.trainingConfirmed);

  const validMultiReq = validateRequest(
    {
      project: 'Cryo Hall Mobility Study',
      subjectCourse: 'PHYS 418',
      departmentId: 'dept-physics',
      teamSize: 2,
      deadline: '2026-12-10',
      itemIds: ['eq-phy-01', 'eq-phy-02'],
      hoursNeeded: 6,
      justification: 'Testing carrier concentration and Hall voltage across thin films.',
      trainingConfirmed: true,
    },
    { departments, items: allItems, referenceDate: '2026-11-23' }
  );
  assert.equal(validMultiReq.ok, true);

  // State machine transitions
  const sampleReq = getRequests().find((r) => r.id === 'req-107')!;
  assert.equal(sampleReq.status, 'Submitted');

  const illegalSkip = transitionRequest(sampleReq, 'Approved', 'Skipping');
  assert.equal(illegalSkip.ok, false, 'Submitted cannot skip directly to Approved');
  assert.equal(illegalSkip.request.status, 'Submitted');

  const toReview = transitionRequest(sampleReq, 'Under review');
  assert.equal(toReview.ok, true);
  assert.equal(toReview.request.status, 'Under review');

  const rejectNoReason = transitionRequest(toReview.request, 'Rejected', ' ');
  assert.equal(rejectNoReason.ok, false, 'Rejected requires a 3–300 char reason');

  const toChanges = transitionRequest(
    toReview.request,
    'Changes requested',
    'Specify target wavelength sweep range.'
  );
  assert.equal(toChanges.ok, true);
  assert.equal(toChanges.request.status, 'Changes requested');

  const resubmit = transitionRequest(toChanges.request, 'Submitted');
  assert.equal(resubmit.ok, true);
  assert.equal(resubmit.request.status, 'Submitted');

  const approvedFinal = transitionRequest(toReview.request, 'Approved', 'Cleared');
  assert.equal(approvedFinal.ok, true);
  const illegalReopen = transitionRequest(approvedFinal.request, 'Submitted');
  assert.equal(illegalReopen.ok, false, 'Approved is terminal');

  // 8. Multi-item request submission, faculty review, and Smart Booking unlock
  const multiCreated = submitAccessRequest({
    itemIds: ['eq-ece-02', 'eq-phy-04'],
    departmentId: 'dept-ece',
    project: 'Multi-Bench Radar & Hall Probe Verification',
    subjectCourse: 'ECE 490 · Capstone',
    deadline: '2026-12-20',
    teamSize: 2,
    hoursNeeded: 6,
    justification: 'Validating FPGA baseband timing alongside carrier mobility substrates.',
    trainingConfirmed: true,
  });
  assert.ok(multiCreated);
  assert.equal(multiCreated.status, 'Submitted');

  // Student role cannot invoke faculty-only request transitions or reviews
  assert.equal(getCurrentUser().role, 'student');
  assert.equal(transitionAccessRequest(multiCreated.id, 'Under review')?.ok, false);
  assert.equal(reviewAccessRequest(multiCreated.id, 'Approved', 'Bypass attempt'), null);

  const faculty = switchUserRole('faculty');
  assert.equal(faculty.role, 'faculty');
  const stepReview = transitionAccessRequest(multiCreated.id, 'Under review');
  assert.equal(stepReview?.ok, true);
  const reviewed = reviewAccessRequest(multiCreated.id, 'Approved', 'Cleared for both labs');
  assert.equal(reviewed?.status, 'Approved');

  const backToStudent = switchUserRole('student');
  const updatedRequestsAfterApproval = getRequests();
  assert.equal(
    canUserBookItem(getItemById('eq-ece-02')!, backToStudent, updatedRequestsAfterApproval).allowed,
    true
  );
  assert.equal(
    canUserBookItem(getItemById('eq-phy-04')!, backToStudent, updatedRequestsAfterApproval).allowed,
    true
  );

  // 9. Analytics & faculty suggestion tests
  const allSlots = getAllSlots();
  const labStats = getUtilizationByLab(allSlots, allItems, allLabs);
  assert.equal(labStats.length, 14, 'Should report utilization for all 14 labs');
  for (const stat of labStats) {
    assert.ok(stat.utilizationPct >= 0 && stat.utilizationPct <= 100);
  }

  const underused = getUnderusedItems(allItems, allSlots, 3);
  assert.equal(underused.length, 3);
  assert.ok(underused[0].utilizationPct <= underused[1].utilizationPct);

  const summary = getSummary(updatedRequestsAfterApproval, allSlots, allItems);
  assert.ok(summary.pendingCount >= 1);
  assert.ok(summary.approvedThisWeek >= 2);
  assert.ok(summary.openConflicts >= 1);
  assert.ok(summary.overallUtilizationPct >= 0 && summary.overallUtilizationPct <= 100);

  const suggestion = buildFacultySuggestion(
    updatedRequestsAfterApproval.find((r) => r.id === 'req-101')!,
    getItemById('eq-ece-02'),
    allSlots
  );
  assert.ok(suggestion.label.length > 10);

  // 10. Existing slot book/release check
  resetLabStore();
  const openSlot = getSlots('eq-phy-01').find((s) => !s.booked);
  assert.ok(openSlot);
  const booked = bookSlot(openSlot.id, 'eq-phy-01', 'Optics check');
  assert.equal(booked?.booked, true);
  const released = cancelSlotBooking(openSlot.id, 'eq-phy-01');
  assert.equal(released?.booked, false);

  // 11. Catalog Management (catalog-admin.ts + labData.ts) tests
  resetLabStore();
  // Role guard: Student cannot invoke any catalog admin function
  assert.equal(getCurrentUser().role, 'student');
  assert.equal(adminAddDepartment({ name: 'Aerospace' }).ok, false);
  assert.equal(adminEditDepartment('dept-physics', { name: 'Applied Physics' }).ok, false);
  assert.equal(adminDeleteDepartment('dept-physics').ok, false);
  assert.equal(adminAddLab({ departmentId: 'dept-physics', name: 'Laser Lab' }).ok, false);
  assert.equal(adminEditLab('lab-phy-optics', { departmentId: 'dept-physics', name: 'Optics II' }).ok, false);
  assert.equal(adminDeleteLab('lab-phy-optics').ok, false);
  assert.equal(
    adminAddItem({
      name: 'Laser Meter',
      departmentId: 'dept-physics',
      labId: 'lab-phy-optics',
      type: 'Instruments',
      location: 'SHN-204',
      status: 'Available',
      accessLevel: 'Open',
      specs: '1 mW to 5 W power meter',
    }).ok,
    false
  );
  assert.equal(
    adminEditItem('eq-phy-01', {
      name: 'Spectrometer',
      departmentId: 'dept-physics',
      labId: 'lab-phy-optics',
      type: 'Instruments',
      location: 'SHN-204',
      status: 'Available',
      accessLevel: 'Open',
      specs: 'Updated',
    }).ok,
    false
  );
  assert.equal(adminDeleteItem('eq-phy-01').ok, false);
  assert.equal(
    adminAddSlots({ itemId: 'eq-phy-01', date: '2026-11-27', startTime: '09:00', endTime: '11:00' }).ok,
    false
  );
  assert.equal(adminDeleteSlot('sl-001').ok, false);

  // Also test pure functions directly with 'student' role
  const snapshot = {
    departments: getDepartments(),
    labs: getLabs(),
    items: getItems(),
    slots: getAllSlots(),
    requests: getRequests(),
  };
  assert.equal(addDepartment('student', { name: 'Aerospace' }, snapshot).ok, false);
  assert.equal(editDepartment('student', 'dept-physics', { name: 'Optics' }, snapshot).ok, false);
  assert.equal(deleteDepartment('student', 'dept-physics', snapshot, 'cancelAffected').ok, false);
  assert.equal(addLab('student', { departmentId: 'dept-physics', name: 'X' }, snapshot).ok, false);
  assert.equal(editLab('student', 'lab-phy-optics', { departmentId: 'dept-physics', name: 'X' }, snapshot).ok, false);
  assert.equal(deleteLab('student', 'lab-phy-optics', snapshot, 'cancelAffected').ok, false);
  assert.equal(deleteItem('student', 'eq-phy-01', snapshot, 'cancelAffected').ok, false);
  assert.equal(
    addSlots('student', { itemId: 'eq-phy-01', date: '2026-11-27', startTime: '09:00', endTime: '10:00' }, snapshot).ok,
    false
  );
  assert.equal(deleteSlot('student', 'sl-001', snapshot).ok, false);

  // Switch to faculty for valid catalog management checks
  switchUserRole('faculty');

  // Departments: uniqueness & length validation
  assert.equal(adminAddDepartment({ name: 'P' }).ok, false);
  assert.equal(adminAddDepartment({ name: '  physics  ' }).ok, false, 'Case-insensitive duplicate rejected');
  const addedDeptRes = adminAddDepartment({
    name: '  Aerospace Engineering  ',
    code: 'aero',
    building: 'Wright Hall',
    leadFaculty: 'Prof. N. Singh',
    summary: 'Wind tunnel and avionics testbeds.',
  });
  assert.equal(addedDeptRes.ok, true);
  const aeroId = addedDeptRes.data!.id;
  assert.equal(addedDeptRes.data!.name, 'Aerospace Engineering');
  assert.equal(addedDeptRes.data!.code, 'AERO');

  const editedDeptRes = adminEditDepartment(aeroId, {
    name: 'Aerospace & Flight Systems',
    code: 'AERO',
    building: 'Wright Hall',
    leadFaculty: 'Prof. N. Singh',
    summary: 'Wind tunnel and avionics.',
  });
  assert.equal(editedDeptRes.ok, true);
  assert.equal(getDepartments().some((d) => d.name === 'Aerospace & Flight Systems'), true);

  // Labs: parent department check + uniqueness within department
  assert.equal(adminAddLab({ departmentId: 'dept-nope', name: 'Bad Lab' }).ok, false);
  const addedLabRes = adminAddLab({
    departmentId: aeroId,
    name: 'Subsonic Wind Tunnel Lab',
    room: 'WRT-105',
    supervisor: 'Dr. A. Diaz',
    hours: '09:00 – 17:00',
    description: 'Low-speed aerodynamic test section.',
  });
  assert.equal(addedLabRes.ok, true);
  const aeroLabId = addedLabRes.data!.id;
  assert.equal(
    adminAddLab({ departmentId: aeroId, name: 'subsonic wind tunnel lab' }).ok,
    false,
    'Duplicate lab name within same department rejected'
  );
  assert.equal(
    adminEditLab(aeroLabId, {
      departmentId: aeroId,
      name: 'Subsonic & Avionics Lab',
      room: 'WRT-105',
      supervisor: 'Dr. A. Diaz',
      hours: '09:00 – 17:00',
      description: 'Updated description.',
    }).ok,
    true
  );

  // Equipment: add, duplicate in same lab rejected, edit, nextFreeSlot derived from slots
  const addedItemRes = adminAddItem({
    name: 'Pitot Pressure Rake',
    departmentId: aeroId,
    labId: aeroLabId,
    type: 'Instruments',
    location: 'WRT-105 · Tunnel Throat',
    status: 'Available',
    accessLevel: 'Open',
    specs: '32-port differential scanner',
  });
  assert.equal(addedItemRes.ok, true);
  const aeroItemId = addedItemRes.data!.id;
  assert.equal(addedItemRes.data!.nextFreeSlot, 'Unscheduled');
  assert.equal(
    adminAddItem({
      name: 'pitot pressure rake',
      departmentId: aeroId,
      labId: aeroLabId,
      type: 'Instruments',
      location: 'WRT-105',
      status: 'Available',
      accessLevel: 'Open',
      specs: 'Duplicate',
    }).ok,
    false
  );
  assert.equal(
    adminEditItem(aeroItemId, {
      name: 'Pitot Pressure Rake Mk II',
      departmentId: aeroId,
      labId: aeroLabId,
      type: 'Instruments',
      location: 'WRT-105 · Bay 1',
      status: 'Available',
      accessLevel: 'Needs faculty approval',
      specs: '32-port calibrated scanner',
    }).ok,
    true
  );

  // Slots: hourly creation, past/Sunday/out-of-hours/overlap rejections, delete free only
  assert.equal(
    adminAddSlots({ itemId: aeroItemId, date: '2026-11-20', startTime: '09:00', endTime: '11:00' }).ok,
    false,
    'Past date rejected'
  );
  assert.equal(
    adminAddSlots({ itemId: aeroItemId, date: '2026-11-29', startTime: '09:00', endTime: '11:00' }).ok,
    false,
    'Sunday rejected'
  );
  assert.equal(
    adminAddSlots({ itemId: aeroItemId, date: '2026-11-27', startTime: '08:00', endTime: '10:00' }).ok,
    false,
    'Before 09:00 rejected'
  );
  assert.equal(
    adminAddSlots({ itemId: aeroItemId, date: '2026-11-27', startTime: '15:00', endTime: '18:00' }).ok,
    false,
    'After 17:00 rejected'
  );
  const addedSlotsRes = adminAddSlots({
    itemId: aeroItemId,
    date: '2026-11-27',
    startTime: '09:00',
    endTime: '12:00',
  });
  assert.equal(addedSlotsRes.ok, true);
  assert.equal(addedSlotsRes.data!.length, 3, '09:00–12:00 creates 3 one-hour slots');
  assert.equal(getItemById(aeroItemId)?.nextFreeSlot, '11-27 · 09:00');
  assert.equal(
    adminAddSlots({ itemId: aeroItemId, date: '2026-11-27', startTime: '10:00', endTime: '13:00' }).ok,
    false,
    'Overlapping slot creation rejected'
  );

  // Delete free slot works; deleting booked slot directly fails unless cancelAffected
  const freeSlotToDelete = addedSlotsRes.data![0];
  assert.equal(adminDeleteSlot(freeSlotToDelete.id).ok, true);
  const bookedSlotCheck = createCustomBooking({
    itemId: aeroItemId,
    date: '2026-11-28',
    start: '13:00',
    durationHours: 1,
    purpose: 'Wind check',
    bookedBy: 'Maya Lin',
  })!;
  assert.equal(adminDeleteSlot(bookedSlotCheck.id).ok, false, 'Booked slot blocked without cancelAffected');
  assert.equal(adminDeleteSlot(bookedSlotCheck.id, 'cancelAffected').ok, true);

  // Safe Delete rules on department/lab/item with dependents
  // Create a fresh booking + pending request on aeroItemId
  createCustomBooking({
    itemId: aeroItemId,
    date: '2026-11-28',
    start: '14:00',
    durationHours: 1,
    purpose: 'Active tunnel test',
    bookedBy: 'Maya Lin',
  });
  switchUserRole('student');
  const depReq = submitAccessRequest({
    itemIds: [aeroItemId],
    departmentId: aeroId,
    project: 'Wingtip Vortex Study',
    subjectCourse: 'AERO 301',
    deadline: '2026-12-18',
    teamSize: 2,
    hoursNeeded: 4,
    justification: 'Measuring wake turbulence behind winglet geometry.',
    trainingConfirmed: false,
  })!;
  assert.ok(depReq);

  switchUserRole('faculty');
  const depsReport = getEntityDependents({ type: 'department', id: aeroId });
  assert.equal(depsReport.childLabs.length, 1);
  assert.equal(depsReport.childItems.length, 1);
  assert.equal(depsReport.activeBookings.length, 1);
  assert.equal(depsReport.affectedRequests.length, 1);

  assert.equal(adminDeleteDepartment(aeroId).ok, false, 'Must block when dependents exist');
  assert.equal(adminDeleteDepartment(aeroId, 'cancel').ok, false, 'Cancel leaves data intact');
  assert.ok(getItemById(aeroItemId), 'Item still exists after cancel');

  const safeDelRes = adminDeleteDepartment(aeroId, 'cancelAffected');
  assert.equal(safeDelRes.ok, true);
  assert.equal(getDepartments().some((d) => d.id === aeroId), false);
  assert.equal(getLabs().some((l) => l.id === aeroLabId), false);
  assert.equal(getItemById(aeroItemId), undefined);
  assert.equal(getSlots(aeroItemId).length, 0);
  const affectedReqAfter = getRequests().find((r) => r.id === depReq.id)!;
  assert.equal(affectedReqAfter.status, 'Changes requested');
  assert.equal(affectedReqAfter.itemId, '');
  assert.equal(affectedReqAfter.departmentId, '');
  assert.ok(affectedReqAfter.facultyNote.length > 10);

  // Direct pure-module helpers sanity check
  const pureDeps = getDependents({ type: 'item', id: 'eq-phy-01' }, snapshot);
  assert.ok(pureDeps.totalCount >= 1);
  assert.equal(addItem('student', {
    name: 'X',
    departmentId: 'dept-physics',
    labId: 'lab-phy-optics',
    type: 'Instruments',
    location: 'Room',
    status: 'Available',
    accessLevel: 'Open',
    specs: 'Specs',
  }, snapshot).ok, false);

  // 12. Security audit validations: control chars, role guards, localStorage schema
  const ctrlBooking = validateBooking(
    { itemId: 'eq-phy-01', date: '2026-11-25', start: '10:00', durationHours: 2, purpose: 'Check\u0007run' },
    phySlots
  );
  assert.equal(ctrlBooking.ok, false, 'Control characters in booking purpose rejected');

  const ctrlReq = validateRequest(
    {
      project: 'Cryo\u0000Project',
      subjectCourse: 'PHYS 418',
      departmentId: 'dept-physics',
      teamSize: 2,
      deadline: '2026-12-10',
      itemIds: ['eq-phy-01'],
      hoursNeeded: 4,
      justification: 'Testing carrier concentration and Hall voltage across thin films.',
      trainingConfirmed: true,
    },
    { departments, items: allItems, referenceDate: '2026-11-23' }
  );
  assert.equal(ctrlReq.ok, false, 'Control characters in request title rejected');

  const studentTransitionCheck = transitionRequest(
    toReview.request,
    'Approved',
    'Attempt as student',
    undefined,
    'student'
  );
  assert.equal(studentTransitionCheck.ok, false, 'Student cannot run faculty transition directly');

  const ctrlTransition = transitionRequest(
    toReview.request,
    'Rejected',
    'Bad\u0007reason',
    undefined,
    'faculty'
  );
  assert.equal(ctrlTransition.ok, false, 'Control characters in transition reason rejected');

  const ctrlDept = addDepartment('faculty', { name: 'Robotics\u0000Lab' }, snapshot);
  assert.equal(ctrlDept.ok, false, 'Control characters in department name rejected');

  // validatePersistedState rejects tampered or malformed localStorage snapshots
  const validPersistedSample = {
    departments,
    labs: allLabs,
    items: allItems,
    slots: allSlots,
    requests: initialRequests,
    activeRole: 'student',
  };
  assert.ok(validatePersistedState(validPersistedSample));
  assert.equal(validatePersistedState(null), null);
  assert.equal(validatePersistedState({ ...validPersistedSample, activeRole: 'admin' }), null);
  assert.equal(
    validatePersistedState({
      ...validPersistedSample,
      items: [{ ...allItems[0], labId: 'lab-nonexistent' }],
    }),
    null
  );
  assert.equal(
    validatePersistedState({
      ...validPersistedSample,
      items: [{ ...allItems[0], type: 'Explosives' }],
    }),
    null
  );
  assert.equal(
    validatePersistedState({
      ...validPersistedSample,
      departments: [{ ...departments[0], name: 'Physics\u0007' }],
    }),
    null
  );

  resetLabStore();
}

async function runAiTests() {
  // 1. Client validation & source labels
  assert.equal(validateProjectDescription('   short  ').ok, false);
  assert.equal(validateProjectDescription('a'.repeat(501)).ok, false);
  const validDesc = validateProjectDescription('  Measure frequency response of an analog filter.  ');
  assert.equal(validDesc.ok, true);
  assert.equal(validDesc.cleaned, 'Measure frequency response of an analog filter.');
  assert.equal(formatAiSourceLabel('ai'), 'Suggested by AI');
  assert.equal(formatAiSourceLabel('fallback'), 'Smart keyword match');

  // 2. Markup stripping & compact catalog
  assert.equal(stripMarkup('<script>alert(1)</script> Oscilloscope <b>probe</b>'), 'alert(1) Oscilloscope probe');
  const catalog = loadServerCatalog();
  assert.equal(catalog.compact.length, 43);

  // 3. Deterministic fallback matches catalog items cleanly
  const fallbackMatches = suggestEquipmentFallback('Need oscilloscope frequency response and soldering station');
  assert.ok(fallbackMatches.length >= 1 && fallbackMatches.length <= 5);
  for (const s of fallbackMatches) {
    assert.ok(catalog.validItemIds.has(s.itemId));
    assert.ok(s.reason.length > 0 && s.reason.length < 120);
  }

  // 4. Rate limiter unit check (10 req/min per IP)
  const testIp = '198.51.100.42';
  const baseNow = 1_700_000_000_000;
  for (let i = 0; i < 10; i += 1) {
    assert.equal(checkRateLimit(testIp, baseNow + i * 100).allowed, true);
  }
  const blocked = checkRateLimit(testIp, baseNow + 2000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
  assert.equal(checkRateLimit(testIp, baseNow + 62_000).allowed, true);

  // 5. Express /api route validation, payload cap, fallback & 429 checks
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  const app = express();
  app.use('/api', aiRoutes);

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind ephemeral test port');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // Valid suggest-equipment fallback
    const okSuggest = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ project: 'Microfluidic PDMS device inspection and laser optics' }),
    });
    assert.equal(okSuggest.status, 200);
    const okSuggestJson = (await okSuggest.json()) as {
      suggestions: Array<{ itemId: string; reason: string }>;
      source: string;
    };
    assert.equal(okSuggestJson.source, 'fallback');
    assert.ok(okSuggestJson.suggestions.length >= 1 && okSuggestJson.suggestions.length <= 5);

    // Too short -> 400
    const shortRes = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
      body: JSON.stringify({ project: 'short' }),
    });
    assert.equal(shortRes.status, 400);

    // Control characters -> 400
    const ctrlRes = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.16' },
      body: JSON.stringify({ project: 'Measure frequency\u0007response of analog filter' }),
    });
    assert.equal(ctrlRes.status, 400);

    // Over 5 KB -> 413
    const hugeRes = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
      body: JSON.stringify({ project: 'x'.repeat(6000) }),
    });
    assert.equal(hugeRes.status, 413);

    // Malformed JSON -> 400
    const badJsonRes = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.13' },
      body: '{not-valid-json',
    });
    assert.equal(badJsonRes.status, 400);

    // Valid explain-allocation fallback
    const items = getItems();
    const firstConflict = detectConflicts(getRequests(), getSlots(items[0].id))[0];
    const allocationSample = allocate(
      firstConflict.requests,
      getItemById(firstConflict.itemId)!,
      getSlots(firstConflict.itemId),
      items
    );
    const explainRes = await fetch(`${baseUrl}/api/explain-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.14' },
      body: JSON.stringify(allocationSample),
    });
    assert.equal(explainRes.status, 200);
    const explainJson = (await explainRes.json()) as { text: string; source: string };
    assert.equal(explainJson.source, 'fallback');
    assert.ok(explainJson.text.length >= 15);

    // Malformed explain-allocation -> 400
    const badExplainRes = await fetch(`${baseUrl}/api/explain-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.15' },
      body: JSON.stringify({ ranked: [] }),
    });
    assert.equal(badExplainRes.status, 400);

    // Burst rate limit -> 429 on 11th request from same IP
    const burstIp = '203.0.113.99';
    for (let i = 0; i < 10; i += 1) {
      const r = await fetch(`${baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': burstIp },
        body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit test' }),
      });
      assert.equal(r.status, 200);
    }
    const burstBlocked = await fetch(`${baseUrl}/api/suggest-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': burstIp },
      body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit test' }),
    });
    assert.equal(burstBlocked.status, 429);
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main() {
  assert.equal(THEME_STORAGE_KEY, 'labora_theme_v1');
  assert.equal(getInitialTheme(), 'light');
  saveTheme('dark'); // safely no-ops outside browser window without throwing
  runTests();
  await runAiTests();
}

main();



