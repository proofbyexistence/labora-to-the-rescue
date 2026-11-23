/**
 * Pure field validation helpers for departments, labs, and equipment catalog records.
 */
import type {
  CatalogSnapshot,
  DepartmentInput,
  EquipmentInput,
  LabInput,
} from './catalog-admin-types';
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  CATALOG_LIMITS,
  EQUIPMENT_TYPES,
} from './constants';
import type { Department, EquipmentItem, Lab } from './types';
import { hasControlChars, normalizeText } from './validation';

function buildDeptCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (letters.slice(0, 4) || 'LAB').padEnd(2, 'X');
}

function validateBoundedText(
  rawValue: string,
  normalized: string,
  minLen: number,
  maxLen: number,
  label: string,
  allowNewlines = false
): string | null {
  if (hasControlChars(rawValue, allowNewlines)) {
    return `${label} cannot contain control characters.`;
  }
  if (minLen === 0 && normalized.length > maxLen) {
    return `${label} must be ${maxLen} characters or fewer.`;
  }
  if (minLen > 0 && (normalized.length < minLen || normalized.length > maxLen)) {
    return `${label} must be between ${minLen} and ${maxLen} characters.`;
  }
  return null;
}

interface TextRule {
  key: string;
  raw: string;
  value: string;
  min: number;
  max: number;
  label: string;
  allowNewlines?: boolean;
}

function applyTextRules(fieldErrors: Record<string, string>, rules: TextRule[]): void {
  for (const rule of rules) {
    const err = validateBoundedText(
      rule.raw,
      rule.value,
      rule.min,
      rule.max,
      rule.label,
      Boolean(rule.allowNewlines)
    );
    if (err) fieldErrors[rule.key] = err;
  }
}

/**
 * Validates department fields and checks case-insensitive duplicate department names.
 *
 * @param input - Candidate department form values.
 * @param existingDepartments - Current departments list.
 * @param excludeDeptId - Department ID to ignore when validating edits.
 * @returns Validation status, per-field errors, and normalized payload.
 */
export function validateDepartmentFields(
  input: DepartmentInput,
  existingDepartments: Department[],
  excludeDeptId?: string
): { ok: boolean; fieldErrors: Record<string, string>; cleaned: Omit<Department, 'id'> } {
  const fieldErrors: Record<string, string> = {};
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const rawCode = input.code ?? buildDeptCode(name);
  const code = normalizeText(rawCode).toUpperCase();
  const rawBuilding = input.building ?? 'Main Science Wing';
  const building = normalizeText(rawBuilding);
  const rawLead = input.leadFaculty ?? 'Faculty Coordinator';
  const leadFaculty = normalizeText(rawLead);
  const rawSummary =
    input.summary ?? `Shared ${name || 'academic'} teaching and research laboratories.`;
  const summary = normalizeText(rawSummary);

  applyTextRules(fieldErrors, [
    { key: 'name', raw: rawName, value: name, min: CATALOG_LIMITS.DEPT_NAME_MIN, max: CATALOG_LIMITS.DEPT_NAME_MAX, label: 'Subject name' },
    { key: 'code', raw: rawCode, value: code, min: CATALOG_LIMITS.DEPT_CODE_MIN, max: CATALOG_LIMITS.DEPT_CODE_MAX, label: 'Department code' },
    { key: 'building', raw: rawBuilding, value: building, min: CATALOG_LIMITS.DEPT_NAME_MIN, max: CATALOG_LIMITS.DEPT_BUILDING_MAX, label: 'Building name' },
    { key: 'leadFaculty', raw: rawLead, value: leadFaculty, min: CATALOG_LIMITS.DEPT_NAME_MIN, max: CATALOG_LIMITS.DEPT_LEAD_MAX, label: 'Lead faculty' },
    { key: 'summary', raw: rawSummary, value: summary, min: 0, max: CATALOG_LIMITS.DEPT_SUMMARY_MAX, label: 'Summary', allowNewlines: true },
  ]);
  if (
    !fieldErrors.name &&
    existingDepartments.some((d) => d.id !== excludeDeptId && d.name.trim().toLowerCase() === name.toLowerCase())
  ) {
    fieldErrors.name = `A subject named "${name}" already exists.`;
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, cleaned: { name, code, building, leadFaculty, summary } };
}

/**
 * Validates laboratory fields and ensures uniqueness within its parent department.
 *
 * @param input - Candidate lab form values.
 * @param departments - Available parent departments.
 * @param existingLabs - Existing lab records.
 * @param excludeLabId - Lab ID to ignore during edits.
 * @returns Validation status, per-field errors, and normalized payload.
 */
export function validateLabFields(
  input: LabInput,
  departments: Department[],
  existingLabs: Lab[],
  excludeLabId?: string
): { ok: boolean; fieldErrors: Record<string, string>; cleaned: Omit<Lab, 'id'> } {
  const fieldErrors: Record<string, string> = {};
  const departmentId = (input.departmentId ?? '').trim();
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const rawRoom = input.room ?? 'LAB-101';
  const room = normalizeText(rawRoom);
  const rawSupervisor = input.supervisor ?? 'Lab Supervisor';
  const supervisor = normalizeText(rawSupervisor);
  const rawHours = input.hours ?? '09:00 – 17:00';
  const hours = normalizeText(rawHours);
  const rawDescription = input.description ?? `Shared bench facilities in ${name || 'this laboratory'}.`;
  const description = normalizeText(rawDescription);

  if (!departments.some((d) => d.id === departmentId)) {
    fieldErrors.departmentId = 'Select an existing subject/department for this lab.';
  }
  applyTextRules(fieldErrors, [
    { key: 'name', raw: rawName, value: name, min: CATALOG_LIMITS.LAB_NAME_MIN, max: CATALOG_LIMITS.LAB_NAME_MAX, label: 'Lab name' },
    { key: 'room', raw: rawRoom, value: room, min: CATALOG_LIMITS.LAB_ROOM_MIN, max: CATALOG_LIMITS.LAB_ROOM_MAX, label: 'Room code' },
    { key: 'supervisor', raw: rawSupervisor, value: supervisor, min: CATALOG_LIMITS.LAB_NAME_MIN, max: CATALOG_LIMITS.LAB_SUPERVISOR_MAX, label: 'Supervisor' },
    { key: 'hours', raw: rawHours, value: hours, min: CATALOG_LIMITS.LAB_HOURS_MIN, max: CATALOG_LIMITS.LAB_HOURS_MAX, label: 'Hours' },
    { key: 'description', raw: rawDescription, value: description, min: 0, max: CATALOG_LIMITS.LAB_DESC_MAX, label: 'Description', allowNewlines: true },
  ]);
  if (
    !fieldErrors.name &&
    existingLabs.some((l) => l.id !== excludeLabId && l.departmentId === departmentId && l.name.trim().toLowerCase() === name.toLowerCase())
  ) {
    fieldErrors.name = `A lab named "${name}" already exists in this subject.`;
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, cleaned: { departmentId, name, room, supervisor, hours, description } };
}

function validateEquipmentReferences(
  input: EquipmentInput,
  snapshot: CatalogSnapshot,
  departmentId: string,
  labId: string,
  fieldErrors: Record<string, string>
): void {
  const deptExists = snapshot.departments.some((d) => d.id === departmentId);
  if (!deptExists) fieldErrors.departmentId = 'Select an existing subject/department.';
  const lab = snapshot.labs.find((l) => l.id === labId);
  if (!lab) fieldErrors.labId = 'Select an existing laboratory.';
  else if (deptExists && lab.departmentId !== departmentId) {
    fieldErrors.labId = 'Selected laboratory does not belong to the chosen subject.';
  }
  if (!EQUIPMENT_TYPES.includes(input.type)) fieldErrors.type = 'Choose a valid equipment type.';
  if (!AVAILABILITY_STATUSES.includes(input.status)) fieldErrors.status = 'Choose a valid availability status.';
  if (!ACCESS_LEVELS.includes(input.accessLevel)) fieldErrors.accessLevel = 'Choose a valid access level.';
}

/**
 * Validates equipment catalog fields including parent lab/department consistency.
 *
 * @param input - Candidate equipment form values.
 * @param snapshot - Current catalog snapshot for foreign-key and duplicate checks.
 * @param excludeItemId - Equipment ID to ignore during edits.
 * @returns Validation status, per-field errors, and normalized payload.
 */
export function validateEquipmentFields(
  input: EquipmentInput,
  snapshot: CatalogSnapshot,
  excludeItemId?: string
): {
  ok: boolean;
  fieldErrors: Record<string, string>;
  cleaned: Omit<EquipmentItem, 'id' | 'nextFreeSlot' | 'image'>;
} {
  const fieldErrors: Record<string, string> = {};
  const rawName = input.name ?? '';
  const name = normalizeText(rawName);
  const departmentId = (input.departmentId ?? '').trim();
  const labId = (input.labId ?? '').trim();
  const rawLocation = input.location ?? '';
  const location = normalizeText(rawLocation);
  const rawSpecs = input.specs ?? '';
  const specs = normalizeText(rawSpecs);

  applyTextRules(fieldErrors, [
    { key: 'name', raw: rawName, value: name, min: CATALOG_LIMITS.ITEM_NAME_MIN, max: CATALOG_LIMITS.ITEM_NAME_MAX, label: 'Equipment name' },
    { key: 'location', raw: rawLocation, value: location, min: CATALOG_LIMITS.ITEM_LOCATION_MIN, max: CATALOG_LIMITS.ITEM_LOCATION_MAX, label: 'Location' },
    { key: 'specs', raw: rawSpecs, value: specs, min: 0, max: CATALOG_LIMITS.ITEM_SPECS_MAX, label: 'Specifications', allowNewlines: true },
  ]);
  if (
    !fieldErrors.name &&
    snapshot.items.some((i) => i.id !== excludeItemId && i.labId === labId && i.name.trim().toLowerCase() === name.toLowerCase())
  ) {
    fieldErrors.name = `"${name}" already exists in the selected lab.`;
  }
  validateEquipmentReferences(input, snapshot, departmentId, labId, fieldErrors);

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    cleaned: { name, departmentId, labId, type: input.type, location, status: input.status, accessLevel: input.accessLevel, specs },
  };
}
