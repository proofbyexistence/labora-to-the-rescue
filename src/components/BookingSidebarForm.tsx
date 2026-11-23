/**
 * Reserve Bench Session form and faculty approval/training access gate panel.
 */
import type { FormEvent, RefObject } from 'react';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { BOOKING_DURATION_OPTIONS, START_HOURS } from '../js/booking-view-helpers';
import { LIMITS } from '../js/constants';
import { formatHour } from '../js/scheduler';
import type { CampusUser, EquipmentItem, Lab } from '../js/types';
import type { PageId } from './EquipmentCard';

interface BookingSidebarFormProps {
  currentItem: EquipmentItem;
  currentUser: CampusUser;
  currentLab?: Lab;
  accessCheck: { allowed: boolean; reason: string };
  bookingDate: string;
  bookingStart: string;
  durationHours: number;
  purpose: string;
  validationErrors: string[];
  bookingDateRef: RefObject<HTMLInputElement | null>;
  bookingPurposeRef: RefObject<HTMLTextAreaElement | null>;
  bookingErrorRef: RefObject<HTMLDivElement | null>;
  onChangeDate: (value: string) => void;
  onChangeStart: (value: string) => void;
  onChangeDuration: (value: number) => void;
  onChangePurpose: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onNavigate: (page: PageId, options?: { itemId?: string }) => void;
}

/**
 * Renders either the access-gate warning card or the slot reservation form.
 *
 * @param props - Access check verdict, controlled form values, refs, and handlers.
 * @returns Sidebar booking section element.
 */
export function BookingSidebarForm({
  currentItem,
  currentUser,
  currentLab,
  accessCheck,
  bookingDate,
  bookingStart,
  durationHours,
  purpose,
  validationErrors,
  bookingDateRef,
  bookingPurposeRef,
  bookingErrorRef,
  onChangeDate,
  onChangeStart,
  onChangeDuration,
  onChangePurpose,
  onSubmit,
  onNavigate,
}: BookingSidebarFormProps) {
  return (
    <section className="notebook-sheet p-5 xl:col-span-5">
      {!accessCheck.allowed ? (
        <div>
          <div className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-[var(--ink)]">Approval Required Before Booking</h2>
          </div>
          <div className="mt-4 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--status-limited-bg)] p-4 text-base text-[var(--ink)]">
            <p className="font-bold">{currentItem.accessLevel}</p>
            <p className="mt-2 text-base">{accessCheck.reason}</p>
            <p className="mt-2 text-sm">
              Supervisor: <strong>{currentLab?.supervisor}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('request', { itemId: currentItem.id })}
            className="labora-btn mt-5 w-full"
          >
            Go to Request Access
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="border-b-2 border-[var(--ink)] pb-3">
            <h2 className="text-2xl font-bold text-[var(--ink)]">Reserve Bench Session</h2>
            <p className="text-sm text-[var(--ink)]">
              Booking as <strong>{currentUser.name}</strong> ({accessCheck.reason})
            </p>
          </div>

          {validationErrors.length > 0 && (
            <div
              ref={bookingErrorRef}
              id="booking-form-errors"
              tabIndex={-1}
              role="alert"
              className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] p-3.5 text-sm text-[var(--ink)]"
            >
              <div className="flex items-center gap-1.5 font-bold">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Please fix the following before booking:</span>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="book-date" className="mb-1 block text-sm font-bold text-[var(--ink)]">
              Date (required)
            </label>
            <input
              ref={bookingDateRef}
              id="book-date"
              type="date"
              value={bookingDate}
              onChange={(e) => onChangeDate(e.target.value)}
              aria-required="true"
              aria-invalid={validationErrors.length > 0}
              aria-describedby={validationErrors.length > 0 ? 'booking-form-errors' : 'book-date-help'}
              className="notebook-input tabular-nums"
              required
            />
            <p id="book-date-help" className="mt-1 text-xs text-[var(--ink)]">
              Mon–Sat campus lab hours (09:00–17:00).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="book-start" className="mb-1 block text-sm font-bold text-[var(--ink)]">
                Start time
              </label>
              <select
                id="book-start"
                value={bookingStart}
                onChange={(e) => onChangeStart(e.target.value)}
                className="notebook-input tabular-nums"
              >
                {START_HOURS.map((h) => {
                  const val = formatHour(h);
                  return (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label htmlFor="book-duration" className="mb-1 block text-sm font-bold text-[var(--ink)]">
                Duration (hours)
              </label>
              <select
                id="book-duration"
                value={durationHours}
                onChange={(e) => onChangeDuration(Number.parseInt(e.target.value, 10))}
                className="notebook-input tabular-nums"
              >
                {BOOKING_DURATION_OPTIONS.map((hrs) => (
                  <option key={hrs} value={hrs}>
                    {hrs} {hrs === 1 ? 'hour' : 'hours'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="book-purpose" className="mb-1 block text-sm font-bold text-[var(--ink)]">
              Purpose (required, {LIMITS.PURPOSE_MIN}–{LIMITS.PURPOSE_MAX} characters)
            </label>
            <textarea
              ref={bookingPurposeRef}
              id="book-purpose"
              rows={3}
              maxLength={LIMITS.PURPOSE_MAX}
              value={purpose}
              onChange={(e) => onChangePurpose(e.target.value)}
              placeholder="Describe your measurement, sample, or course lab run..."
              aria-required="true"
              aria-invalid={validationErrors.length > 0}
              aria-describedby={validationErrors.length > 0 ? 'booking-form-errors' : undefined}
              className="notebook-input"
              required
            />
          </div>

          <button type="submit" className="labora-btn w-full">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Confirm Slot Booking
          </button>
        </form>
      )}
    </section>
  );
}
