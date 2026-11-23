/**
 * Shared state and modal descriptors for the Faculty Catalog Manage workspace.
 */
import type { DependentReport } from '../../js/catalog-admin';
import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
} from '../../js/types';

export type ManageTabId = 'subjects' | 'equipment' | 'slots';

export type ActiveModal =
  | { kind: 'dept'; mode: 'add' | 'edit'; dept?: Department }
  | { kind: 'lab'; mode: 'add' | 'edit'; defaultDeptId?: string; lab?: Lab }
  | { kind: 'item'; mode: 'add' | 'edit'; item?: EquipmentItem }
  | { kind: 'slots'; itemId: string }
  | {
      kind: 'delete';
      entityType: 'department' | 'lab' | 'item' | 'slot';
      entityId: string;
      entityName: string;
      dependents: DependentReport;
    };

export interface DeptFormState {
  name: string;
  code: string;
  building: string;
  leadFaculty: string;
  summary: string;
}

export interface LabFormState {
  departmentId: string;
  name: string;
  room: string;
  supervisor: string;
  hours: string;
  description: string;
}

export interface ItemFormState {
  name: string;
  departmentId: string;
  labId: string;
  type: EquipmentType;
  location: string;
  status: AvailabilityStatus;
  accessLevel: AccessLevel;
  specs: string;
}

export interface SlotsFormState {
  date: string;
  startTime: string;
  endTime: string;
}
