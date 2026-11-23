/**
 * Shared TypeScript contracts for faculty catalog administration and dependent cleanup.
 */
import type {
  AccessLevel,
  AccessRequest,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
  TimeSlot,
} from './types';

export interface CatalogSnapshot {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  slots: TimeSlot[];
  requests: AccessRequest[];
}

export type DeleteOption = 'cancelAffected' | 'cancel';

export interface DependentReport {
  entityType: 'department' | 'lab' | 'item' | 'slot';
  entityId: string;
  entityLabel: string;
  childLabs: Lab[];
  childItems: EquipmentItem[];
  activeBookings: TimeSlot[];
  affectedRequests: AccessRequest[];
  totalCount: number;
}

export interface CatalogMutationResult<T = unknown> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  dependents?: DependentReport;
  nextState?: CatalogSnapshot;
}

export interface DepartmentInput {
  name: string;
  code?: string;
  building?: string;
  leadFaculty?: string;
  summary?: string;
}

export interface LabInput {
  departmentId: string;
  name: string;
  room?: string;
  supervisor?: string;
  hours?: string;
  description?: string;
}

export interface EquipmentInput {
  name: string;
  departmentId: string;
  labId: string;
  type: EquipmentType;
  location: string;
  status: AvailabilityStatus;
  accessLevel: AccessLevel;
  specs: string;
}

export interface AddSlotsInput {
  itemId: string;
  date: string;
  startTime: string;
  endTime: string;
}
