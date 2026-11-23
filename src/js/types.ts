/**
 * Shared TypeScript domain interfaces and uniform Result wrapper types.
 */

/** Canonical equipment category identifier. */
export type EquipmentType = 'Instruments' | 'Development kits' | 'Workstations' | 'Safety gear';

/** Canonical equipment availability indicator. */
export type AvailabilityStatus = 'Available' | 'Limited' | 'Booked';

/** Access policy enforced prior to booking an equipment item. */
export type AccessLevel = 'Open' | 'Needs faculty approval' | 'Training required';

/** Workflow states for a student access request. */
export type RequestStatus =
  | 'Submitted'
  | 'Under review'
  | 'Approved'
  | 'Rejected'
  | 'Changes requested';

/** Active persona role for previewing student vs faculty workflows. */
export type UserRole = 'student' | 'faculty';

/** Standard discriminated result shape returned by logic operations. */
export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Academic department directory entry. */
export interface Department {
  id: string;
  code: string;
  name: string;
  building: string;
  leadFaculty: string;
  summary: string;
}

/** Campus laboratory room record belonging to a department. */
export interface Lab {
  id: string;
  name: string;
  departmentId: string;
  room: string;
  supervisor: string;
  hours: string;
  description: string;
}

/** Shared laboratory instrument, kit, workstation, or safety gear record. */
export interface EquipmentItem {
  id: string;
  name: string;
  departmentId: string;
  labId: string;
  type: EquipmentType;
  location: string;
  status: AvailabilityStatus;
  accessLevel: AccessLevel;
  nextFreeSlot: string;
  specs: string;
  image: string;
}

/** Scheduled or available time slot associated with an equipment item. */
export interface TimeSlot {
  id: string;
  itemId: string;
  date: string;
  window: string;
  durationHours: number;
  booked: boolean;
  bookedBy: string | null;
  note: string;
  start?: string;
  end?: string;
  status?: 'free' | 'booked';
  requestId?: string | null;
}

/** Student request for restricted or scheduled equipment access. */
export interface AccessRequest {
  id: string;
  student: string;
  studentId: string;
  departmentId: string;
  itemId: string;
  itemIds?: string[];
  equipmentNeeded: string;
  project: string;
  subjectCourse?: string;
  deadline: string;
  status: RequestStatus;
  teamSize: number;
  hoursNeeded: number;
  submittedAt: string;
  reviewedAt?: string;
  justification?: string;
  trainingConfirmed?: boolean;
  facultyNote: string;
  preferredDate?: string;
  preferredStart?: string;
  preferredDurationHours?: number;
}

/** Active campus user profile stored in the demo persona map. */
export interface CampusUser {
  id: string;
  role: UserRole;
  name: string;
  title: string;
  email: string;
  departmentId: string;
  confirmedTrainingItemIds?: string[];
}

/** Complete JSON seed and persisted store schema. */
export interface LabDataset {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  slots: TimeSlot[];
  requests: AccessRequest[];
  users: Record<UserRole, CampusUser>;
}

/** Filter parameters accepted by the Discover catalog filter. */
export interface ItemFilters {
  departmentId?: string;
  labId?: string;
  type?: EquipmentType | '';
  status?: AvailabilityStatus | '';
  accessLevel?: AccessLevel | '';
  query?: string;
}

/** Filter parameters accepted by the Faculty request queue filter. */
export interface RequestFilters {
  status?: RequestStatus | '';
  departmentId?: string;
  student?: string;
}

/** Form payload submitted when creating a new lab access request. */
export interface NewRequestInput {
  itemId?: string;
  itemIds?: string[];
  departmentId?: string;
  project: string;
  subjectCourse?: string;
  deadline: string;
  teamSize: number;
  hoursNeeded: number;
  justification?: string;
  trainingConfirmed?: boolean;
}
