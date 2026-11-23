/**
 * Laboratory create-and-edit form rendered inside CatalogModalHost.
 */
import type { FormEvent } from 'react';
import type { Department } from '../../js/types';
import type { LabFormState } from './types';

interface LabFormProps {
  mode: 'add' | 'edit';
  departments: Department[];
  values: LabFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: LabFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

/**
 * Renders the add/edit form fields for a campus laboratory record.
 *
 * @param props - Department choices, form values, field validation errors, and callbacks.
 * @returns Accessible form element for laboratory management.
 */
export function LabForm({
  mode,
  departments,
  values,
  fieldErrors,
  onChange,
  onCancel,
  onSubmit,
}: LabFormProps) {
  const update = (patch: Partial<LabFormState>) => onChange({ ...values, ...patch });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
      <div>
        <label htmlFor="manage-lab-dept" className="block text-sm font-bold text-[var(--ink)]">
          Subject / Department (required)
        </label>
        <select
          id="manage-lab-dept"
          value={values.departmentId}
          onChange={(e) => update({ departmentId: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.departmentId)}
          aria-describedby={fieldErrors.departmentId ? 'err-lab-dept' : undefined}
          className="notebook-input mt-1"
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {fieldErrors.departmentId && (
          <p id="err-lab-dept" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.departmentId}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manage-lab-name" className="block text-sm font-bold text-[var(--ink)]">
          Laboratory name (required, 2–60 characters)
        </label>
        <input
          id="manage-lab-name"
          type="text"
          value={values.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'err-lab-name' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.name && (
          <p id="err-lab-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="manage-lab-room" className="block text-sm font-bold text-[var(--ink)]">
            Room code
          </label>
          <input
            id="manage-lab-room"
            type="text"
            value={values.room}
            onChange={(e) => update({ room: e.target.value })}
            placeholder="e.g., SHN-310"
            aria-invalid={Boolean(fieldErrors.room)}
            aria-describedby={fieldErrors.room ? 'err-lab-room' : undefined}
            className="notebook-input mt-1"
          />
          {fieldErrors.room && (
            <p id="err-lab-room" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.room}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="manage-lab-hours" className="block text-sm font-bold text-[var(--ink)]">
            Lab hours
          </label>
          <input
            id="manage-lab-hours"
            type="text"
            value={values.hours}
            onChange={(e) => update({ hours: e.target.value })}
            aria-invalid={Boolean(fieldErrors.hours)}
            aria-describedby={fieldErrors.hours ? 'err-lab-hours' : undefined}
            className="notebook-input mt-1"
          />
          {fieldErrors.hours && (
            <p id="err-lab-hours" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.hours}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="manage-lab-supervisor" className="block text-sm font-bold text-[var(--ink)]">
          Supervisor
        </label>
        <input
          id="manage-lab-supervisor"
          type="text"
          value={values.supervisor}
          onChange={(e) => update({ supervisor: e.target.value })}
          placeholder="e.g., Dr. Elena Rostova"
          aria-invalid={Boolean(fieldErrors.supervisor)}
          aria-describedby={fieldErrors.supervisor ? 'err-lab-supervisor' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.supervisor && (
          <p id="err-lab-supervisor" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.supervisor}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manage-lab-description" className="block text-sm font-bold text-[var(--ink)]">
          Description (up to 200 characters)
        </label>
        <textarea
          id="manage-lab-description"
          rows={2}
          value={values.description}
          onChange={(e) => update({ description: e.target.value })}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? 'err-lab-desc' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.description && (
          <p id="err-lab-desc" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.description}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="labora-btn labora-btn-paper text-sm">
          Cancel
        </button>
        <button type="submit" className="labora-btn text-sm">
          {mode === 'add' ? 'Create Lab' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
