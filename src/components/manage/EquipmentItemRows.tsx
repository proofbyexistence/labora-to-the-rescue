/**
 * Multi-column select rows shared by EquipmentItemForm.
 */
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
} from '../../js/constants';
import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentType,
  Lab,
} from '../../js/types';
import type { ItemFormState } from './types';

/**
 * Renders the dependent Subject and Laboratory dropdown row for EquipmentItemForm.
 *
 * @param props - Department list, lab list, current item form state, errors, and setter.
 * @returns Two-column select grid.
 */
export function ItemDeptLabSelectRow({
  departments,
  labs,
  values,
  fieldErrors,
  onChange,
}: {
  departments: Department[];
  labs: Lab[];
  values: ItemFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: ItemFormState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="manage-item-dept" className="block text-sm font-bold text-[var(--ink)]">
          Subject (required)
        </label>
        <select
          id="manage-item-dept"
          value={values.departmentId}
          onChange={(e) => {
            const nextDept = e.target.value;
            const matchingLabs = labs.filter((l) => l.departmentId === nextDept);
            onChange({
              ...values,
              departmentId: nextDept,
              labId: matchingLabs[0]?.id ?? '',
            });
          }}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.departmentId)}
          aria-describedby={fieldErrors.departmentId ? 'err-item-dept' : undefined}
          className="notebook-input mt-1"
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {fieldErrors.departmentId && (
          <p id="err-item-dept" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.departmentId}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manage-item-lab" className="block text-sm font-bold text-[var(--ink)]">
          Laboratory (required)
        </label>
        <select
          id="manage-item-lab"
          value={values.labId}
          onChange={(e) => onChange({ ...values, labId: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.labId)}
          aria-describedby={fieldErrors.labId ? 'err-item-lab' : undefined}
          className="notebook-input mt-1"
        >
          {labs
            .filter((l) => l.departmentId === values.departmentId)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.room})
              </option>
            ))}
        </select>
        {fieldErrors.labId && (
          <p id="err-item-lab" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.labId}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the Type, Status, and Access Level dropdown row for EquipmentItemForm.
 *
 * @param props - Controlled item form values, validation errors, and change handler.
 * @returns Three-column select grid.
 */
export function ItemClassificationRow({
  values,
  fieldErrors,
  onChange,
}: {
  values: ItemFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: ItemFormState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="manage-item-type" className="block text-sm font-bold text-[var(--ink)]">
          Type
        </label>
        <select
          id="manage-item-type"
          value={values.type}
          onChange={(e) => onChange({ ...values, type: e.target.value as EquipmentType })}
          aria-invalid={Boolean(fieldErrors.type)}
          aria-describedby={fieldErrors.type ? 'err-item-type' : undefined}
          className="notebook-input mt-1"
        >
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="manage-item-status" className="block text-sm font-bold text-[var(--ink)]">
          Status
        </label>
        <select
          id="manage-item-status"
          value={values.status}
          onChange={(e) => onChange({ ...values, status: e.target.value as AvailabilityStatus })}
          className="notebook-input mt-1"
        >
          {AVAILABILITY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="manage-item-access" className="block text-sm font-bold text-[var(--ink)]">
          Access level
        </label>
        <select
          id="manage-item-access"
          value={values.accessLevel}
          onChange={(e) => onChange({ ...values, accessLevel: e.target.value as AccessLevel })}
          className="notebook-input mt-1"
        >
          {ACCESS_LEVELS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
