/**
 * Accessible focus-trapped modal prompting faculty for a reason when rejecting or requesting changes.
 */
import { useRef, type FormEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import { LIMITS } from '../js/constants';
import { useDialogFocusTrap } from '../js/dialog-focus-trap';
import type { AccessRequest } from '../js/types';

export interface ReasonModalState {
  request: AccessRequest;
  decision: 'Rejected' | 'Changes requested';
}

interface DecisionReasonModalProps {
  modalState: ReasonModalState | null;
  reasonDraft: string;
  reasonError: string;
  reasonInputRef: RefObject<HTMLTextAreaElement | null>;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: (event: FormEvent) => void;
}

/**
 * Renders the faculty decision reason dialog with Escape/Tab focus trapping.
 *
 * @param props - Active modal state, controlled draft text, validation error, and callbacks.
 * @returns Modal dialog overlay or null when closed.
 */
export function DecisionReasonModal({
  modalState,
  reasonDraft,
  reasonError,
  reasonInputRef,
  onReasonChange,
  onClose,
  onConfirm,
}: DecisionReasonModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(Boolean(modalState), modalRef, onClose, {
    focusableSelector:
      'textarea:not([disabled]), button:not([disabled]), [href], input:not([disabled])',
  });

  if (!modalState) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        className="notebook-sheet w-full max-w-lg p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reason-dialog-title" className="text-2xl font-bold text-[var(--ink)]">
              {modalState.decision === 'Rejected'
                ? 'Reject access request'
                : 'Request changes from student'}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink)]">
              {modalState.request.project} · {modalState.request.student}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reason dialog"
            className="labora-btn labora-btn-paper !px-2.5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onConfirm} noValidate className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="faculty-decision-reason"
              className="block text-base font-bold text-[var(--ink)]"
            >
              Reason for {modalState.decision.toLowerCase()} (required, {LIMITS.REASON_MIN}–
              {LIMITS.REASON_MAX} characters)
            </label>
            <textarea
              ref={reasonInputRef}
              id="faculty-decision-reason"
              rows={3}
              value={reasonDraft}
              onChange={(e) => onReasonChange(e.target.value)}
              aria-required="true"
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'err-decision-reason' : undefined}
              placeholder={
                modalState.decision === 'Rejected'
                  ? 'Explain why this request cannot be cleared...'
                  : 'Specify what documentation, safety check, or schedule change is needed...'
              }
              className="notebook-input mt-1"
            />
            {reasonError && (
              <p id="err-decision-reason" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                {reasonError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="labora-btn labora-btn-paper text-sm">
              Cancel
            </button>
            <button
              type="submit"
              className={`labora-btn text-sm ${
                modalState.decision === 'Rejected' ? '!bg-[var(--status-booked-bg)]' : ''
              }`}
            >
              Confirm {modalState.decision}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
