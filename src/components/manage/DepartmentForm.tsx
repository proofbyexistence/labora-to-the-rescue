/**
 * Subject / Department create-and-edit form rendered inside CatalogModalHost.
 */
import type { FormEvent } from 'react';
import type { DeptFormState } from './types';

interface DepartmentFormProps {
  mode: 'add' | 'edit';
  values: DeptFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: DeptFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

/**
 * Renders the add/edit form fields for a campus subject / academic department.
 *
 * @param props - Current form values, mode, field validation errors, and callbacks.
 * @returns Accessible form element for department management.
 */
export function DepartmentForm({
  mode,
  values,
  fieldErrors,
  onChange,
  onCancel,
  onSubmit,
}: DepartmentFormProps) {
  const update = (patch: Partial<DeptFormState>) => onChange({ ...values, ...patch });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
      <div>
        <label htmlFor="manage-dept-name" className="block text-sm font-bold text-[var(--ink)]">
          Subject name (required, 2–50 characters)
        </label>
        <input
          id="manage-dept-name"
          type="text"
          value={values.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'err-dept-name' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.name && (
          <p id="err-dept-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="manage-dept-code" className="block text-sm font-bold text-[var(--ink)]">
            Department code (2–10 chars)
          </label>
          <input
            id="manage-dept-code"
            type="text"
            value={values.code}
            onChange={(e) => update({ code: e.target.value })}
            placeholder="e.g., AERO"
            aria-invalid={Boolean(fieldErrors.code)}
            aria-describedby={fieldErrors.code ? 'err-dept-code' : undefined}
            className="notebook-input mt-1"
          />
          {fieldErrors.code && (
            <p id="err-dept-code" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.code}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="manage-dept-building" className="block text-sm font-bold text-[var(--ink)]">
            Building
          </label>
          <input
            id="manage-dept-building"
            type="text"
            value={values.building}
            onChange={(e) => update({ building: e.target.value })}
            placeholder="e.g., Faraday Hall"
            aria-invalid={Boolean(fieldErrors.building)}
            aria-describedby={fieldErrors.building ? 'err-dept-building' : undefined}
            className="notebook-input mt-1"
          />
          {fieldErrors.building && (
            <p id="err-dept-building" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.building}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="manage-dept-lead" className="block text-sm font-bold text-[var(--ink)]">
          Lead faculty
        </label>
        <input
          id="manage-dept-lead"
          type="text"
          value={values.leadFaculty}
          onChange={(e) => update({ leadFaculty: e.target.value })}
          placeholder="e.g., Prof. Maya Patel"
          aria-invalid={Boolean(fieldErrors.leadFaculty)}
          aria-describedby={fieldErrors.leadFaculty ? 'err-dept-lead' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.leadFaculty && (
          <p id="err-dept-lead" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.leadFaculty}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manage-dept-summary" className="block text-sm font-bold text-[var(--ink)]">
          Summary (up to 200 characters)
        </label>
        <textarea
          id="manage-dept-summary"
          rows={2}
          value={values.summary}
          onChange={(e) => update({ summary: e.target.value })}
          aria-invalid={Boolean(fieldErrors.summary)}
          aria-describedby={fieldErrors.summary ? 'err-dept-summary' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.summary && (
          <p id="err-dept-summary" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.summary}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="labora-btn labora-btn-paper text-sm">
          Cancel
        </button>
        <button type="submit" className="labora-btn text-sm">
          {mode === 'add' ? 'Create Subject' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
