/**
 * Equipment item create-and-edit form rendered inside CatalogModalHost.
 */
import type { FormEvent } from 'react';
import type { Department, Lab } from '../../js/types';
import { ItemClassificationRow, ItemDeptLabSelectRow } from './EquipmentItemRows';
import type { ItemFormState } from './types';

interface EquipmentItemFormProps {
  mode: 'add' | 'edit';
  departments: Department[];
  labs: Lab[];
  values: ItemFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: ItemFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

/**
 * Renders the add/edit form fields for a catalog equipment item.
 *
 * @param props - Catalog options, controlled values, validation errors, and callbacks.
 * @returns Accessible form element for equipment management.
 */
export function EquipmentItemForm({
  mode,
  departments,
  labs,
  values,
  fieldErrors,
  onChange,
  onCancel,
  onSubmit,
}: EquipmentItemFormProps) {
  const update = (patch: Partial<ItemFormState>) => onChange({ ...values, ...patch });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
      <div>
        <label htmlFor="manage-item-name" className="block text-sm font-bold text-[var(--ink)]">
          Equipment name (required, 2–80 characters)
        </label>
        <input
          id="manage-item-name"
          type="text"
          value={values.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'err-item-name' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.name && (
          <p id="err-item-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <ItemDeptLabSelectRow
        departments={departments}
        labs={labs}
        values={values}
        fieldErrors={fieldErrors}
        onChange={onChange}
      />

      <ItemClassificationRow values={values} fieldErrors={fieldErrors} onChange={onChange} />

      <div>
        <label htmlFor="manage-item-location" className="block text-sm font-bold text-[var(--ink)]">
          Bench location (required)
        </label>
        <input
          id="manage-item-location"
          type="text"
          value={values.location}
          onChange={(e) => update({ location: e.target.value })}
          placeholder="e.g., SHN-204 · Bench C"
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.location)}
          aria-describedby={fieldErrors.location ? 'err-item-location' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.location && (
          <p id="err-item-location" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.location}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manage-item-specs" className="block text-sm font-bold text-[var(--ink)]">
          Specifications (up to 200 characters)
        </label>
        <textarea
          id="manage-item-specs"
          rows={2}
          value={values.specs}
          onChange={(e) => update({ specs: e.target.value })}
          aria-invalid={Boolean(fieldErrors.specs)}
          aria-describedby={fieldErrors.specs ? 'err-item-specs' : undefined}
          className="notebook-input mt-1"
        />
        {fieldErrors.specs && (
          <p id="err-item-specs" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.specs}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="labora-btn labora-btn-paper text-sm">
          Cancel
        </button>
        <button type="submit" className="labora-btn text-sm">
          {mode === 'add' ? 'Create Equipment' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
