import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Lock,
  MessageSquareText,
  Pin,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { PageId } from '../components/EquipmentCard';
import { EquipmentDoodle, HeroBenchDoodle } from '../components/LabDoodles';
import {
  explainAllocationWithAI,
  formatAiSourceLabel,
  type AiSource,
} from '../js/ai-client';
import {
  applyAllocationSuggestion,
  cancelSlotBooking,
  createCustomBooking,
  getDepartments,
  getItemById,
  getItems,
  getLabs,
  getRequests,
  getSlots,
  getStateVersion,
} from '../js/labData';
import {
  allocate,
  buildWeekDates,
  buildWeeklyHourlySlots,
  canUserBookItem,
  DEFAULT_REFERENCE_DATE,
  detectConflicts,
  explainAllocation,
  formatHour,
  LAB_END_HOUR,
  LAB_START_HOUR,
  parseHour,
  validateBooking,
} from '../js/scheduler';
import type { CampusUser, EquipmentItem } from '../js/types';

interface SmartBookingPageProps {
  selectedItemId: string;
  currentUser: CampusUser;
  onSelectItem: (itemId: string) => void;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onDataMutated: () => void;
}

const STATUS_BADGE_META: Record<
  EquipmentItem['status'],
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Available: { className: 'status-badge status-badge-available', Icon: CheckCircle2 },
  Limited: { className: 'status-badge status-badge-limited', Icon: AlertTriangle },
  Booked: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

const START_HOURS = Array.from(
  { length: LAB_END_HOUR - LAB_START_HOUR },
  (_, idx) => LAB_START_HOUR + idx
);

function shiftIsoDate(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

function formatDayHeader(isoDate: string): { weekday: string; shortDate: string } {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const shortDate = dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return { weekday, shortDate };
}

function formatFullDayHourLabel(isoDate: string, hour: number, stateLabel: string): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const fullDay = dt.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour > 12 ? hour - 12 : hour;
  return `${fullDay} ${hour12} ${suffix}, ${stateLabel}`;
}

export function SmartBookingPage({
  selectedItemId,
  currentUser,
  onSelectItem,
  onNavigate,
  onDataMutated,
}: SmartBookingPageProps) {
  const [weekAnchor, setWeekAnchor] = useState(DEFAULT_REFERENCE_DATE);
  const [bookingDate, setBookingDate] = useState(DEFAULT_REFERENCE_DATE);
  const [bookingStart, setBookingStart] = useState('14:00');
  const [durationHours, setDurationHours] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [liveMessage, setLiveMessage] = useState('');
  const [plainExplanation, setPlainExplanation] = useState<{
    text: string;
    source: AiSource;
  } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');

  const calendarSectionRef = useRef<HTMLElement | null>(null);
  const firstCalendarSlotRef = useRef<HTMLButtonElement | null>(null);
  const bookingDateRef = useRef<HTMLInputElement | null>(null);
  const bookingPurposeRef = useRef<HTMLTextAreaElement | null>(null);
  const bookingErrorRef = useRef<HTMLDivElement | null>(null);

  const dataVersion = getStateVersion();

  const { allItems, departments, labs, allRequests, deptMap, labMap } = useMemo(() => {
    const items = getItems();
    const depts = getDepartments();
    const allLabs = getLabs();
    const requests = getRequests();
    return {
      allItems: items,
      departments: depts,
      labs: allLabs,
      allRequests: requests,
      deptMap: new Map(depts.map((d) => [d.id, d.name])),
      labMap: new Map(allLabs.map((l) => [l.id, l])),
    };
  }, [dataVersion]);

  const currentItem = selectedItemId ? getItemById(selectedItemId) : allItems[0];

  const rawSlots = useMemo(
    () => (currentItem ? getSlots(currentItem.id) : []),
    [currentItem, dataVersion]
  );
  const weekDates = useMemo(() => buildWeekDates(weekAnchor), [weekAnchor]);
  const weeklySlots = useMemo(
    () =>
      currentItem
        ? buildWeeklyHourlySlots(currentItem.id, rawSlots, weekAnchor)
        : [],
    [currentItem, rawSlots, weekAnchor]
  );

  const itemConflicts = useMemo(() => {
    if (!currentItem) return [];
    return detectConflicts(allRequests, rawSlots).filter(
      (c) => c.itemId === currentItem.id
    );
  }, [allRequests, rawSlots, currentItem]);

  const conflictSlotKeys = useMemo(() => {
    const set = new Set<string>();
    for (const conflict of itemConflicts) {
      const startH = parseHour(conflict.start);
      const endH = parseHour(conflict.end);
      for (let h = startH; h < endH; h += 1) {
        set.add(`${conflict.date}|${formatHour(h)}`);
      }
    }
    return set;
  }, [itemConflicts]);

  const slotLookup = useMemo(
    () => new Map(weeklySlots.map((s) => [`${s.date}|${s.start}`, s])),
    [weeklySlots]
  );

  const primaryConflict = itemConflicts[0];
  const allocationResult = useMemo(
    () =>
      currentItem && primaryConflict
        ? allocate(primaryConflict.requests, currentItem, rawSlots, allItems)
        : null,
    [primaryConflict, currentItem, rawSlots, allItems]
  );
  const allocationExplanation = useMemo(
    () => (allocationResult ? explainAllocation(allocationResult) : ''),
    [allocationResult]
  );
  const allocationSignature = allocationResult
    ? `${currentItem?.id ?? ''}:${allocationResult.ranked
        .map((entry) => `${entry.request.id}=${entry.score}`)
        .join(',')}:${allocationResult.assignments
        .map((a) => `${a.requestId}@${a.date}-${a.start}`)
        .join(',')}`
    : '';

  useEffect(() => {
    setPlainExplanation(null);
    setExplainError('');
    setExplainLoading(false);
  }, [allocationSignature]);

  // Empty state for unknown item IDs from URL hash.
  if (!currentItem) {
    return (
      <section className="notebook-sheet p-8 text-center">
        <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
        <h1 className="text-3xl font-bold text-[var(--ink)]">
          Equipment item not found
        </h1>
        <p className="mt-2 text-base text-[var(--ink)]">
          We could not find an instrument matching &ldquo;{selectedItemId}&rdquo; in the campus notebook.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('discover', { departmentId: '', labId: '' })}
          className="labora-btn mt-5"
        >
          <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to Discover
        </button>
      </section>
    );
  }

  const currentLab = labMap.get(currentItem.labId);
  const itemStatusMeta = STATUS_BADGE_META[currentItem.status];
  const ItemStatusIcon = itemStatusMeta.Icon;

  const accessCheck = canUserBookItem(currentItem, currentUser, allRequests);

  // Highlight user's current pick across the chosen duration span.
  const pickedSlotKeys = new Set<string>();
  const pickedStartHour = parseHour(bookingStart);
  if (Number.isFinite(pickedStartHour)) {
    for (let offset = 0; offset < durationHours; offset += 1) {
      pickedSlotKeys.add(`${bookingDate}|${formatHour(pickedStartHour + offset)}`);
    }
  }

  const activeWeekBookings = rawSlots.filter(
    (s) => s.booked && weekDates.includes(s.date)
  );

  const handleExplainPlainWords = async () => {
    if (!allocationResult) return;
    setExplainLoading(true);
    setExplainError('');
    try {
      const result = await explainAllocationWithAI(allocationResult);
      setPlainExplanation(result);
    } catch (err) {
      setPlainExplanation(null);
      setExplainError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to explain allocation in plain words right now.'
      );
    } finally {
      setExplainLoading(false);
    }
  };

  const handleSelectCalendarSlot = (date: string, start: string) => {
    setBookingDate(date);
    setBookingStart(start);
    setValidationErrors([]);
    setLiveMessage(`Selected ${date} at ${start} in booking form.`);
  };

  const handleBookingSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLiveMessage('');

    const check = validateBooking(
      {
        itemId: currentItem.id,
        date: bookingDate,
        start: bookingStart,
        durationHours,
        purpose,
      },
      rawSlots
    );

    if (!check.ok) {
      setValidationErrors(check.errors);
      const joined = check.errors.join(' ').toLowerCase();
      window.requestAnimationFrame(() => {
        if (joined.includes('purpose')) {
          bookingPurposeRef.current?.focus();
        } else if (joined.includes('date') || joined.includes('past') || joined.includes('sunday')) {
          bookingDateRef.current?.focus();
        } else {
          bookingErrorRef.current?.focus();
        }
      });
      return;
    }

    const created = createCustomBooking({
      itemId: currentItem.id,
      date: bookingDate,
      start: bookingStart,
      durationHours,
      purpose,
    });

    if (created) {
      setValidationErrors([]);
      setPurpose('');
      setLiveMessage(
        `Booked ${currentItem.name} on ${created.date} (${created.window}) for "${created.note}".`
      );
      onDataMutated();
    }
  };

  const handleReleaseSlot = (slotId: string, windowLabel: string, date: string) => {
    const released = cancelSlotBooking(slotId, currentItem.id);
    if (released) {
      setLiveMessage(`Released booking for ${date} (${windowLabel}).`);
      onDataMutated();
    }
  };

  const handleAcceptSuggestion = () => {
    if (!allocationResult) return;
    applyAllocationSuggestion(allocationResult);
    setLiveMessage(
      `Applied fair-allocation schedule for ${currentItem.name}. ${allocationResult.assignments.length} session(s) updated.`
    );
    onDataMutated();
  };

  const handlePickAnotherSlot = () => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    firstCalendarSlotRef.current?.focus();
    calendarSectionRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
    });
  };

  return (
    <div className="space-y-6">
      {/* Item Summary Card & Equipment Picker */}
      <section className="notebook-sheet p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[var(--ink)] pb-5">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">
              Smart Booking
            </h1>
            <p className="mt-1 text-base text-[var(--ink)]">
              Inspect weekly Mon–Sat lab availability (09:00–17:00), reserve a session, or resolve competing requests.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <label
              htmlFor="booking-item-select"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Equipment Item
            </label>
            <select
              id="booking-item-select"
              value={currentItem.id}
              onChange={(e) => {
                setValidationErrors([]);
                setLiveMessage('');
                onSelectItem(e.target.value);
              }}
              className="notebook-input"
            >
              {departments.map((dept) => (
                <optgroup key={dept.id} label={dept.name}>
                  {allItems
                    .filter((item) => item.departmentId === dept.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.status})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col items-center justify-center rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-center lg:col-span-4">
            <EquipmentDoodle
              type={currentItem.type}
              departmentId={currentItem.departmentId}
              className="h-24 w-24"
            />
            <h2 className="mt-2 text-2xl font-bold text-[var(--ink)]">
              {currentItem.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className={itemStatusMeta.className}>
                <ItemStatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{currentItem.status}</span>
              </span>
              <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
                {currentItem.accessLevel}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-base lg:col-span-8">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
                <div className="text-xs font-bold text-[var(--ink)]">Department</div>
                <div>{deptMap.get(currentItem.departmentId)}</div>
              </div>
              <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
                <div className="text-xs font-bold text-[var(--ink)]">Laboratory & Room</div>
                <div className="tabular-nums">
                  {currentLab?.name} ({currentLab?.room})
                </div>
              </div>
              <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
                <div className="text-xs font-bold text-[var(--ink)]">Supervisor</div>
                <div>{currentLab?.supervisor}</div>
              </div>
              <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2">
                <div className="text-xs font-bold text-[var(--ink)]">Next Free Slot</div>
                <div className="tabular-nums">{currentItem.nextFreeSlot}</div>
              </div>
            </div>
            <p className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2.5 text-base text-[var(--ink)]">
              <strong className="mr-1.5">Specs:</strong>
              {currentItem.specs}
            </p>
          </div>
        </div>
      </section>

      {/* Polite live region for booking & allocation announcements */}
      <div
        aria-live="polite"
        className={
          liveMessage
            ? 'notebook-sheet flex items-center gap-2 bg-[var(--status-available-bg)] px-4 py-3 text-base font-bold text-[var(--ink)]'
            : 'sr-only'
        }
      >
        {liveMessage && (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{liveMessage}</span>
          </>
        )}
      </div>

      {/* Conflict Panel + AI Fair-Allocation Recommendation */}
      {primaryConflict && allocationResult && (
        <section
          aria-labelledby="conflict-panel-heading"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          {/* Conflict Panel */}
          <div className="notebook-sheet notebook-sheet-alt-tape p-5 xl:col-span-5">
            <div className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
              <h2 id="conflict-panel-heading" className="text-2xl font-bold text-[var(--ink)]">
                Competing Requests Detected
              </h2>
            </div>

            <p className="mt-2.5 text-base text-[var(--ink)]">
              Contested window: <strong className="tabular-nums">{primaryConflict.date} · {primaryConflict.start}–{primaryConflict.end}</strong>
            </p>

            <ul className="mt-4 space-y-3">
              {primaryConflict.requests.map((req) => (
                <li
                  key={req.id}
                  className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-[var(--ink)]">{req.student}</span>
                    <span className="status-badge status-badge-limited text-sm">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Conflict</span>
                    </span>
                  </div>
                  <div className="mt-1 text-base font-bold text-[var(--ink)]">
                    {req.project}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-[var(--ink)]">
                    <span>Deadline: {req.deadline}</span>
                    <span>Hours: {req.hoursNeeded}h</span>
                    <span>Team: {req.teamSize}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Fair-Allocation Recommendation Card */}
          <div className="notebook-sheet p-5 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-[var(--ink)]">
                  Fair-Allocation Recommendation
                </h2>
              </div>
              <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
                Deterministic Priority Score
              </span>
            </div>

            <p className="mt-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5 text-base text-[var(--ink)]">
              {allocationExplanation}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExplainPlainWords}
                disabled={explainLoading}
                aria-busy={explainLoading}
                className="labora-btn labora-btn-paper text-sm"
              >
                <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
                {explainLoading ? 'Writing plain summary...' : 'Explain in plain words'}
              </button>
              <span className="text-xs text-[var(--ink)]">
                Only your project text and the equipment catalog are sent to the AI.
              </span>
            </div>

            <div aria-live="polite" className="mt-2">
              {explainError && (
                <p
                  role="alert"
                  className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
                >
                  {explainError}
                </p>
              )}
              {plainExplanation && (
                <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-3.5 text-base text-[var(--ink)]">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">Plain-language summary</span>
                    <span className="status-badge bg-[var(--lavender)] !text-[var(--on-lavender)] text-xs">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{formatAiSourceLabel(plainExplanation.source)}</span>
                    </span>
                  </div>
                  <p>{plainExplanation.text}</p>
                </div>
              )}
            </div>

            <ul className="mt-4 space-y-3">
              {allocationResult.ranked.map((entry, idx) => {
                const isFeasible = allocationResult.feasible[entry.request.id];
                const assignment = allocationResult.assignments.find(
                  (a) => a.requestId === entry.request.id
                );

                return (
                  <li
                    key={entry.request.id}
                    className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-lg font-bold text-[var(--ink)]">
                        #{idx + 1} · {entry.request.student}
                        <span className="ml-2 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2 py-0.5 text-sm tabular-nums text-[var(--on-lavender)]">
                          {entry.score} / 100
                        </span>
                      </div>

                      <span
                        className={
                          isFeasible
                            ? 'status-badge status-badge-available text-sm'
                            : 'status-badge status-badge-booked text-sm'
                        }
                      >
                        {isFeasible ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          Feasible before deadline: {isFeasible ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>

                    {assignment && (
                      <p className="mt-1.5 text-sm font-bold text-[var(--ink)] tabular-nums">
                        Suggested window: {assignment.date} · {assignment.start}–{assignment.end}
                        {assignment.isContestedSlot ? ' (contested slot)' : ' (earliest free slot)'}
                      </p>
                    )}

                    <div className="mt-2 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                      {entry.breakdown.map((factor) => (
                        <div
                          key={factor.factor}
                          className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--paper)] px-2.5 py-1.5"
                        >
                          <div className="flex items-center justify-between font-bold tabular-nums">
                            <span>{factor.factor}</span>
                            <span>
                              {factor.points}/{factor.maxPoints}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--ink)]">{factor.reason}</div>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>

            {allocationResult.alternatives.length > 0 && (
              <div className="mt-4 space-y-2">
                {allocationResult.alternatives.map((alt) => (
                  <div
                    key={alt.requestId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-3.5 text-sm text-[var(--ink)]"
                  >
                    <div>
                      <div className="font-bold">
                        Alternative Equipment for {alt.student}: {alt.suggestedItemName}
                      </div>
                      <div>{alt.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectItem(alt.suggestedItemId)}
                      className="labora-btn labora-btn-paper text-sm"
                    >
                      Inspect Alternative
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAcceptSuggestion}
                className="labora-btn"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Accept suggestion
              </button>

              <button
                type="button"
                onClick={handlePickAnotherSlot}
                className="labora-btn labora-btn-paper"
              >
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                Pick another slot
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Weekly Calendar + Access-Gated Booking Form */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Weekly Mon–Sat 09:00–17:00 Calendar */}
        <section
          ref={calendarSectionRef}
          aria-labelledby="weekly-calendar-heading"
          className="notebook-sheet calendar-card-stable p-5 xl:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
            <div>
              <h2 id="weekly-calendar-heading" className="text-2xl font-bold text-[var(--ink)]">
                Weekly Lab Schedule
              </h2>
              <p className="text-sm tabular-nums text-[var(--ink)]">
                Week of {weekDates[0]} to {weekDates[5]} · Mon–Sat, 09:00–17:00
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekAnchor((prev) => shiftIsoDate(prev, -7))}
                className="labora-btn labora-btn-paper !px-3 text-sm"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((prev) => shiftIsoDate(prev, 7))}
                className="labora-btn labora-btn-paper !px-3 text-sm"
                aria-label="Next week"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Legend with icon + text (never color alone) */}
          <div
            aria-label="Slot status legend"
            className="mt-3 flex flex-wrap items-center gap-2.5 text-sm"
          >
            <span className="status-badge bg-[var(--white)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Free</span>
            </span>
            <span className="status-badge status-badge-booked">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Booked</span>
            </span>
            <span className="status-badge bg-[var(--lavender)] !text-[var(--on-lavender)]">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Your pick</span>
            </span>
            <span className="status-badge status-badge-limited">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Conflict</span>
            </span>
          </div>

          {/* 6-Day × 8-Hour Accessible Schedule Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] border-separate border-spacing-1.5 text-center">
              <caption className="sr-only">
                Weekly schedule for {currentItem.name}, week of {weekDates[0]} to {weekDates[5]}, Monday to Saturday, 09:00 to 17:00
              </caption>
              <thead>
                <tr className="text-sm font-bold text-[var(--ink)]">
                  <th scope="col" className="py-1.5 text-left">
                    Time
                  </th>
                  {weekDates.map((date) => {
                    const { weekday, shortDate } = formatDayHeader(date);
                    return (
                      <th
                        key={date}
                        scope="col"
                        className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--paper)] py-1 font-bold"
                      >
                        <div>{weekday}</div>
                        <div className="text-xs font-normal tabular-nums">{shortDate}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody
                onClick={(event: MouseEvent<HTMLTableSectionElement>) => {
                  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
                    'button[data-slot-date][data-slot-start]'
                  );
                  if (!btn || btn.disabled) return;
                  const slotDate = btn.dataset.slotDate ?? '';
                  const slotStart = btn.dataset.slotStart ?? '';
                  if (slotDate && slotStart) {
                    handleSelectCalendarSlot(slotDate, slotStart);
                  }
                }}
              >
                {START_HOURS.map((hour, rowIdx) => {
                  const startStr = formatHour(hour);
                  return (
                    <tr key={startStr}>
                      <th
                        scope="row"
                        className="tabular-nums text-left text-sm font-bold text-[var(--ink)]"
                      >
                        {startStr}
                      </th>
                      {weekDates.map((date, colIdx) => {
                        const key = `${date}|${startStr}`;
                        const slot = slotLookup.get(key);
                        const isBooked = slot?.status === 'booked';
                        const isConflict = !isBooked && conflictSlotKeys.has(key);
                        const isPicked = !isBooked && pickedSlotKeys.has(key);

                        let stateLabel = 'free';
                        let cellBg = 'bg-[var(--white)] hover:bg-[var(--lavender-soft)]';
                        let CellIcon = CheckCircle2;
                        let shortText = 'Free';

                        if (isBooked) {
                          stateLabel = `booked by ${slot?.bookedBy ?? 'student'}`;
                          cellBg =
                            'bg-[var(--status-booked-bg)] border-dashed cursor-not-allowed';
                          CellIcon = Lock;
                          shortText = 'Booked';
                        } else if (isPicked) {
                          stateLabel = 'your pick';
                          cellBg = 'bg-[var(--lavender)] shadow-[2px_2px_0_var(--ink)]';
                          CellIcon = Pin;
                          shortText = 'Pick';
                        } else if (isConflict) {
                          stateLabel = 'conflict';
                          cellBg = 'bg-[var(--status-limited-bg)] hover:bg-[var(--lavender-soft)]';
                          CellIcon = AlertTriangle;
                          shortText = 'Conflict';
                        }

                        const isFirstGridButton = rowIdx === 0 && colIdx === 0;

                        return (
                          <td key={key} className="p-0">
                            <button
                              ref={isFirstGridButton ? firstCalendarSlotRef : undefined}
                              type="button"
                              disabled={isBooked}
                              data-slot-date={date}
                              data-slot-start={startStr}
                              aria-pressed={isPicked}
                              aria-label={formatFullDayHourLabel(date, hour, stateLabel)}
                              className={`flex min-h-[44px] w-full items-center justify-center gap-1 rounded-[8px] border-2 border-[var(--ink)] px-1.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                isPicked ? 'text-[var(--on-lavender)]' : 'text-[var(--ink)]'
                              } ${cellBg}`}
                            >
                              <CellIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>{shortText}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Active Week Bookings List with Release Control */}
          {activeWeekBookings.length > 0 && (
            <div className="mt-5 border-t-2 border-dashed border-[var(--border-subtle)] pt-4">
              <h3 className="text-xl font-bold text-[var(--ink)]">
                Booked Sessions This Week
              </h3>
              <ul className="mt-2 space-y-2">
                {activeWeekBookings.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-bold tabular-nums">
                        {slot.date} · {slot.window}
                      </span>
                      <span className="ml-2">
                        — {slot.bookedBy} {slot.note ? `(${slot.note})` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReleaseSlot(slot.id, slot.window, slot.date)}
                      className="labora-btn labora-btn-paper !px-3 !py-1 text-xs"
                    >
                      Release Slot
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Booking Form OR Access Gate */}
        <section className="notebook-sheet p-5 xl:col-span-5">
          {!accessCheck.allowed ? (
            <div>
              <div className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-[var(--ink)]">
                  Approval Required Before Booking
                </h2>
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
            <form onSubmit={handleBookingSubmit} noValidate className="space-y-4">
              <div className="border-b-2 border-[var(--ink)] pb-3">
                <h2 className="text-2xl font-bold text-[var(--ink)]">
                  Reserve Bench Session
                </h2>
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
                <label
                  htmlFor="book-date"
                  className="mb-1 block text-sm font-bold text-[var(--ink)]"
                >
                  Date (required)
                </label>
                <input
                  ref={bookingDateRef}
                  id="book-date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
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
                  <label
                    htmlFor="book-start"
                    className="mb-1 block text-sm font-bold text-[var(--ink)]"
                  >
                    Start time
                  </label>
                  <select
                    id="book-start"
                    value={bookingStart}
                    onChange={(e) => setBookingStart(e.target.value)}
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
                  <label
                    htmlFor="book-duration"
                    className="mb-1 block text-sm font-bold text-[var(--ink)]"
                  >
                    Duration (hours)
                  </label>
                  <select
                    id="book-duration"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number.parseInt(e.target.value, 10))}
                    className="notebook-input tabular-nums"
                  >
                    {[1, 2, 3, 4].map((hrs) => (
                      <option key={hrs} value={hrs}>
                        {hrs} {hrs === 1 ? 'hour' : 'hours'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="book-purpose"
                  className="mb-1 block text-sm font-bold text-[var(--ink)]"
                >
                  Purpose (required, 3–200 characters)
                </label>
                <textarea
                  ref={bookingPurposeRef}
                  id="book-purpose"
                  rows={3}
                  maxLength={200}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
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
      </div>
    </div>
  );
}
