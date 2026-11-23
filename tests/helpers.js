import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
  LAB_SCHEDULE,
  ROLES,
} from '../src/js/constants.ts';

export const FIXED_TODAY = LAB_SCHEDULE.DEFAULT_REFERENCE_DATE; // Monday
export const FIXED_TUESDAY = '2026-11-24';
export const FIXED_WEDNESDAY = '2026-11-25';
export const FIXED_SATURDAY = '2026-11-28';
export const FIXED_SUNDAY = '2026-11-29';
export const FIXED_PAST_DATE = '2026-11-20';
export const FIXED_FUTURE_DEADLINE = '2026-12-10';

export function buildDepartment(overrides = {}) {
  return {
    id: 'dept-physics',
    code: 'PHYS',
    name: 'Physics',
    building: 'Science Hall North',
    leadFaculty: 'Dr. E. Vance',
    summary: 'Optics, photonics, and condensed-matter teaching labs.',
    ...overrides,
  };
}

export function buildLab(overrides = {}) {
  return {
    id: 'lab-phy-optics',
    name: 'Laser & Optics Bench',
    departmentId: 'dept-physics',
    room: 'SHN-204',
    supervisor: 'Dr. E. Vance',
    hours: '09:00 – 17:00',
    description: 'Interferometry, spectroscopy, and optical alignment benches.',
    ...overrides,
  };
}

export function buildItem(overrides = {}) {
  return {
    id: 'eq-phy-01',
    name: 'UV-Vis Optical Spectrometer',
    departmentId: 'dept-physics',
    labId: 'lab-phy-optics',
    type: EQUIPMENT_TYPES[0],
    location: 'SHN-204 · Bench A',
    status: AVAILABILITY_STATUSES[0],
    accessLevel: ACCESS_LEVELS[0],
    nextFreeSlot: '11-24 · 09:00',
    specs: '190–1100 nm wavelength range, 1 nm spectral bandwidth',
    image: '',
    ...overrides,
  };
}

export function buildSlot(overrides = {}) {
  return {
    id: 'sl-001',
    itemId: 'eq-phy-01',
    date: FIXED_TUESDAY,
    window: '09:00 – 10:00',
    durationHours: 1,
    booked: false,
    bookedBy: null,
    note: '',
    start: '09:00',
    end: '10:00',
    status: 'free',
    requestId: null,
    ...overrides,
  };
}

export function buildRequest(overrides = {}) {
  return {
    id: 'req-001',
    student: 'Maya Lin',
    studentId: 'stu-01',
    departmentId: 'dept-physics',
    itemId: 'eq-phy-01',
    itemIds: ['eq-phy-01'],
    equipmentNeeded: 'UV-Vis Optical Spectrometer',
    project: 'Thin Film Transmission Spectroscopy',
    subjectCourse: 'PHYS 310',
    deadline: '2026-11-30',
    status: 'Submitted',
    teamSize: 2,
    hoursNeeded: 2,
    submittedAt: FIXED_TODAY,
    justification: 'Measuring optical absorption spectra across coated glass substrates.',
    trainingConfirmed: true,
    facultyNote: '',
    preferredDate: FIXED_TUESDAY,
    preferredStart: '10:00',
    preferredDurationHours: 2,
    ...overrides,
  };
}

export function buildUser(overrides = {}) {
  return {
    id: 'stu-01',
    role: ROLES.STUDENT,
    name: 'Maya Lin',
    title: 'Undergraduate Researcher',
    email: 'maya.lin@campus.edu',
    departmentId: 'dept-physics',
    confirmedTrainingItemIds: [],
    ...overrides,
  };
}

export function buildCatalogSnapshot(overrides = {}) {
  return {
    departments: [
      buildDepartment(),
      buildDepartment({
        id: 'dept-ece',
        code: 'ECE',
        name: 'Electronics & ECE',
        building: 'Engineering West',
        leadFaculty: 'Prof. R. Nair',
        summary: 'Mixed-signal circuits, FPGA, and embedded systems benches.',
      }),
    ],
    labs: [
      buildLab(),
      buildLab({
        id: 'lab-ece-fpga',
        name: 'Embedded & FPGA Studio',
        departmentId: 'dept-ece',
        room: 'ENG-312',
        supervisor: 'Prof. R. Nair',
      }),
    ],
    items: [
      buildItem(),
      buildItem({
        id: 'eq-phy-02',
        name: 'Cryogenic Hall Probe Station',
        departmentId: 'dept-physics',
        labId: 'lab-phy-optics',
        type: 'Instruments',
        location: 'SHN-204 · Bay B',
        status: 'Limited',
        accessLevel: 'Training required',
        specs: '77 K liquid nitrogen stage, 1.5 T electromagnet',
      }),
      buildItem({
        id: 'eq-ece-01',
        name: 'Xilinx Artix-7 FPGA Dev Kit',
        departmentId: 'dept-ece',
        labId: 'lab-ece-fpga',
        type: 'Development kits',
        location: 'ENG-312 · Pod 4',
        status: 'Available',
        accessLevel: 'Needs faculty approval',
        specs: '100 MHz clock, JTAG programmer, Pmod headers',
      }),
    ],
    slots: [
      buildSlot(),
      buildSlot({
        id: 'sl-002',
        itemId: 'eq-phy-01',
        date: FIXED_TUESDAY,
        window: '13:00 – 15:00',
        durationHours: 2,
        booked: true,
        bookedBy: 'R. Kapoor',
        note: 'Course calibration',
        start: '13:00',
        end: '15:00',
        status: 'booked',
      }),
    ],
    requests: [],
    ...overrides,
  };
}

export function createMemoryStorage(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

export function createThrowingStorage(errorMessage = 'SecurityError: storage blocked') {
  const fail = () => {
    throw new Error(errorMessage);
  };
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  };
}
