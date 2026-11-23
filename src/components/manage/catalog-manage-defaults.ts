/**
 * Default form values, DOM error ID maps, and focus helper for CatalogManagePanel.
 */
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
  LAB_SCHEDULE,
} from '../../js/constants';
import type {
  DeptFormState,
  ItemFormState,
  LabFormState,
  SlotsFormState,
} from './types';

export const DEPT_FIELD_IDS: Record<string, string> = {
  name: 'manage-dept-name',
  code: 'manage-dept-code',
  building: 'manage-dept-building',
  leadFaculty: 'manage-dept-lead',
  summary: 'manage-dept-summary',
};

export const LAB_FIELD_IDS: Record<string, string> = {
  departmentId: 'manage-lab-dept',
  name: 'manage-lab-name',
  room: 'manage-lab-room',
  supervisor: 'manage-lab-supervisor',
  hours: 'manage-lab-hours',
  description: 'manage-lab-description',
};

export const ITEM_FIELD_IDS: Record<string, string> = {
  name: 'manage-item-name',
  departmentId: 'manage-item-dept',
  labId: 'manage-item-lab',
  type: 'manage-item-type',
  location: 'manage-item-location',
  status: 'manage-item-status',
  accessLevel: 'manage-item-access',
  specs: 'manage-item-specs',
};

export const SLOT_FIELD_IDS: Record<string, string> = {
  itemId: 'manage-slot-item',
  date: 'manage-slot-date',
  startTime: 'manage-slot-start',
  endTime: 'manage-slot-end',
};

export const EMPTY_DEPT: DeptFormState = {
  name: '',
  code: '',
  building: '',
  leadFaculty: '',
  summary: '',
};

export const EMPTY_LAB: LabFormState = {
  departmentId: '',
  name: '',
  room: '',
  supervisor: '',
  hours: '09:00 – 17:00',
  description: '',
};

export const EMPTY_ITEM: ItemFormState = {
  name: '',
  departmentId: '',
  labId: '',
  type: EQUIPMENT_TYPES[0],
  location: '',
  status: AVAILABILITY_STATUSES[0],
  accessLevel: ACCESS_LEVELS[0],
  specs: '',
};

export const EMPTY_SLOTS: SlotsFormState = {
  date: LAB_SCHEDULE.DEFAULT_REFERENCE_DATE,
  startTime: '09:00',
  endTime: '12:00',
};

/**
 * Moves keyboard focus to the first DOM input matching an entry in `errors`.
 *
 * @param errors - Validation error map keyed by field name.
 * @param idByField - Mapping from field names to DOM element IDs.
 */
export function focusFirstErrorField(
  errors: Record<string, string>,
  idByField: Record<string, string>
): void {
  const firstKey = Object.keys(errors)[0];
  const domId = firstKey ? idByField[firstKey] : undefined;
  if (domId) {
    window.requestAnimationFrame(() => document.getElementById(domId)?.focus());
  }
}
