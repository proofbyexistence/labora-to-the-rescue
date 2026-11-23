/**
 * Schedule metrics row and justification/safety attestation sections for AccessRequestForm.
 */
import type { RefObject } from 'react';
import { LIMITS } from '../js/constants';
import type { RequestFieldKey } from '../js/requests';

export interface RequestFormRefs {
  project: RefObject<HTMLInputElement | null>;
  subjectCourse: RefObject<HTMLInputElement | null>;
  departmentId: RefObject<HTMLSelectElement | null>;
  teamSize: RefObject<HTMLInputElement | null>;
  deadline: RefObject<HTMLInputElement | null>;
  itemIds: RefObject<HTMLInputElement | null>;
  hoursNeeded: RefObject<HTMLInputElement | null>;
  justification: RefObject<HTMLTextAreaElement | null>;
  trainingConfirmed: RefObject<HTMLInputElement | null>;
}

/**
 * Renders the 3-column team size, deadline date, and requested hours row.
 *
 * @param props - Metric values, field validation errors, refs, and change handlers.
 * @returns Three-column grid of numeric and date inputs.
 */
export function RequestScheduleMetricsRow({
  teamSize,
  deadline,
  hoursNeeded,
  fieldErrors,
  refs,
  onTeamSizeChange,
  onDeadlineChange,
  onHoursChange,
}: {
  teamSize: number;
  deadline: string;
  hoursNeeded: number;
  fieldErrors: Partial<Record<RequestFieldKey, string>>;
  refs: Pick<RequestFormRefs, 'teamSize' | 'deadline' | 'hoursNeeded'>;
  onTeamSizeChange: (v: number) => void;
  onDeadlineChange: (v: string) => void;
  onHoursChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="req-team" className="block text-base font-bold text-[var(--ink)]">
          Team members (required)
        </label>
        <input
          ref={refs.teamSize}
          id="req-team"
          type="number"
          min={LIMITS.TEAM_MIN}
          max={LIMITS.TEAM_MAX}
          value={teamSize}
          onChange={(e) => onTeamSizeChange(Number(e.target.value))}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.teamSize)}
          aria-describedby={fieldErrors.teamSize ? 'err-team' : undefined}
          className="notebook-input mt-1 tabular-nums"
        />
        {fieldErrors.teamSize && (
          <p id="err-team" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.teamSize}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="req-deadline" className="block text-base font-bold text-[var(--ink)]">
          Deadline (required)
        </label>
        <input
          ref={refs.deadline}
          id="req-deadline"
          type="date"
          value={deadline}
          onChange={(e) => onDeadlineChange(e.target.value)}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.deadline)}
          aria-describedby={fieldErrors.deadline ? 'err-deadline' : undefined}
          className="notebook-input mt-1 tabular-nums"
        />
        {fieldErrors.deadline && (
          <p id="err-deadline" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.deadline}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="req-hours" className="block text-base font-bold text-[var(--ink)]">
          Hours needed (required)
        </label>
        <input
          ref={refs.hoursNeeded}
          id="req-hours"
          type="number"
          min={LIMITS.HOURS_NEEDED_MIN}
          max={LIMITS.HOURS_NEEDED_MAX}
          value={hoursNeeded}
          onChange={(e) => onHoursChange(Number(e.target.value))}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.hoursNeeded)}
          aria-describedby={fieldErrors.hoursNeeded ? 'err-hours' : undefined}
          className="notebook-input mt-1 tabular-nums"
        />
        {fieldErrors.hoursNeeded && (
          <p id="err-hours" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.hoursNeeded}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the experiment justification textarea and safety training confirmation checkbox.
 *
 * @param props - Text/checkbox values, training requirement flag, errors, refs, and setters.
 * @returns Justification and safety attestation controls.
 */
export function JustificationAndTrainingSection({
  justification,
  trainingConfirmed,
  requiresTraining,
  fieldErrors,
  refs,
  onJustificationChange,
  onTrainingChange,
}: {
  justification: string;
  trainingConfirmed: boolean;
  requiresTraining: boolean;
  fieldErrors: Partial<Record<RequestFieldKey, string>>;
  refs: Pick<RequestFormRefs, 'justification' | 'trainingConfirmed'>;
  onJustificationChange: (v: string) => void;
  onTrainingChange: (checked: boolean) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="req-justification" className="block text-base font-bold text-[var(--ink)]">
          Justification &amp; experiment plan (required, {LIMITS.JUSTIFICATION_MIN}–
          {LIMITS.JUSTIFICATION_MAX} characters)
        </label>
        <textarea
          ref={refs.justification}
          id="req-justification"
          rows={3}
          value={justification}
          onChange={(e) => onJustificationChange(e.target.value)}
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.justification)}
          aria-describedby={fieldErrors.justification ? 'err-justification' : undefined}
          placeholder="Describe materials, measurement goals, and faculty sponsor..."
          className="notebook-input mt-1"
        />
        {fieldErrors.justification && (
          <p id="err-justification" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.justification}
          </p>
        )}
      </div>

      <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3">
        <label
          htmlFor="req-training"
          className="flex min-h-[44px] cursor-pointer items-start gap-2.5 text-base text-[var(--ink)]"
        >
          <input
            ref={refs.trainingConfirmed}
            id="req-training"
            type="checkbox"
            checked={trainingConfirmed}
            onChange={(e) => onTrainingChange(e.target.checked)}
            aria-required={requiresTraining}
            aria-invalid={Boolean(fieldErrors.trainingConfirmed)}
            aria-describedby={fieldErrors.trainingConfirmed ? 'err-training' : undefined}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--ink)]"
          />
          <span>
            <span className="font-bold">Safety &amp; instrument training completed</span>
            {requiresTraining ? (
              <span className="block text-sm font-bold">
                Required: your selection includes training-gated equipment.
              </span>
            ) : (
              <span className="block text-sm">
                Check if you already hold bench safety certification for these tools.
              </span>
            )}
          </span>
        </label>
        {fieldErrors.trainingConfirmed && (
          <p id="err-training" role="alert" className="mt-1.5 text-sm font-bold text-[var(--ink)]">
            {fieldErrors.trainingConfirmed}
          </p>
        )}
      </div>
    </>
  );
}
