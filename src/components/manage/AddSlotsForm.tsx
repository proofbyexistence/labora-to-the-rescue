/**
 * One-hour slot publishing form rendered inside CatalogModalHost.
 */
import type { FormEvent } from 'react';
import { LAB_SCHEDULE } from '../../js/constants';
import { formatHour } from '../../js/scheduler';
import type { SlotsFormState } from './types';

interface AddSlotsFormProps {
  itemName: string;
  values: SlotsFormState;
  fieldErrors: Record<string, string>;
  onChange: (next: SlotsFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

const HOUR_SPAN = LAB_SCHEDULE.END_HOUR - LAB_SCHEDULE.START_HOUR;
const START_HOURS = Array.from({ length: HOUR_SPAN }, (_, idx) =>
  formatHour(LAB_SCHEDULE.START_HOUR + idx)
);
const END_HOURS = Array.from({ length: HOUR_SPAN }, (_, idx) =>
  formatHour(LAB_SCHEDULE.START_HOUR + 1 + idx)
);

/**
 * Renders the date and hour-window form for creating one-hour bench slots.
 *
 * @param props - Target item name, controlled slot window fields, validation errors, and callbacks.
 * @returns Accessible form element for slot creation.
 */
export function AddSlotsForm({
  itemName,
  values,
  fieldErrors,
  onChange,
  onCancel,
  onSubmit,
}: AddSlotsFormProps) {
  const update = (patch: Partial<SlotsFormState>) => onChange({ ...values, ...patch });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
      <p className="text-sm text-[var(--ink)]">
        Equipment: <strong>{itemName}</strong>
      </p>

      <div>
        <label htmlFor="manage-slot-date" className="block text-sm font-bold text-[var(--ink)]">
          Date (required, Mon–Sat, {LAB_SCHEDULE.DEFAULT_REFERENCE_DATE} or later)
        </label>
        <input
          id="manage-slot-date"
          type="date"
          value={values.date}
          onChange={(e) => update({ date: e.target.value })}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.date)}
          aria-describedby={fieldErrors.date ? 'err-slot-date' : undefined}
          className="notebook-input mt-1 tabular-nums"
        />
        {fieldErrors.date && (
          <p id="err-slot-date" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.date}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="manage-slot-start" className="block text-sm font-bold text-[var(--ink)]">
            Start time (required)
          </label>
          <select
            id="manage-slot-start"
            value={values.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.startTime)}
            aria-describedby={fieldErrors.startTime ? 'err-slot-start' : undefined}
            className="notebook-input mt-1 tabular-nums"
          >
            {START_HOURS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {fieldErrors.startTime && (
            <p id="err-slot-start" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.startTime}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="manage-slot-end" className="block text-sm font-bold text-[var(--ink)]">
            End time (required)
          </label>
          <select
            id="manage-slot-end"
            value={values.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.endTime)}
            aria-describedby={fieldErrors.endTime ? 'err-slot-end' : undefined}
            className="notebook-input mt-1 tabular-nums"
          >
            {END_HOURS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {fieldErrors.endTime && (
            <p id="err-slot-end" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
              {fieldErrors.endTime}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="labora-btn labora-btn-paper text-sm">
          Cancel
        </button>
        <button type="submit" className="labora-btn text-sm">
          Create Hourly Slots
        </button>
      </div>
    </form>
  );
}
