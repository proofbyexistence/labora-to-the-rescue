/**
 * State hook managing Smart Booking calendar state, conflict allocation, AI explanation, and reservations.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { explainAllocationWithAI, type AiSource } from './ai-client';
import { buildConflictSlotKeys, buildPickedSlotKeys } from './booking-view-helpers';
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
} from './lab-data';
import {
  allocate,
  buildWeekDates,
  buildWeeklyHourlySlots,
  canUserBookItem,
  DEFAULT_REFERENCE_DATE,
  detectConflicts,
  explainAllocation,
  validateBooking,
} from './scheduler';
import type { CampusUser } from './types';

/**
 * Encapsulates Smart Booking calendar navigation, conflict resolution, AI explainers, and booking form state.
 *
 * @param selectedItemId - Active equipment ID from URL/app state.
 * @param currentUser - Current campus user context.
 * @param onDataMutated - Callback invoked when bookings or allocations mutate store state.
 * @returns View state, refs, derived conflict/calendar data, and event handlers.
 */
export function useSmartBooking(
  selectedItemId: string,
  currentUser: CampusUser,
  onDataMutated: () => void
) {
  const [weekAnchor, setWeekAnchor] = useState<string>(DEFAULT_REFERENCE_DATE);
  const [bookingDate, setBookingDate] = useState<string>(DEFAULT_REFERENCE_DATE);
  const [bookingStart, setBookingStart] = useState('14:00');
  const [durationHours, setDurationHours] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [liveMessage, setLiveMessage] = useState('');
  const [plainExplanation, setPlainExplanation] = useState<{ text: string; source: AiSource } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');

  const calendarSectionRef = useRef<HTMLElement | null>(null);
  const firstCalendarSlotRef = useRef<HTMLButtonElement | null>(null);
  const bookingDateRef = useRef<HTMLInputElement | null>(null);
  const bookingPurposeRef = useRef<HTMLTextAreaElement | null>(null);
  const bookingErrorRef = useRef<HTMLDivElement | null>(null);
  const dataVersion = getStateVersion();

  const { allItems, departments, allRequests, deptMap, labMap } = useMemo(() => {
    const items = getItems();
    const depts = getDepartments();
    const labs = getLabs();
    return {
      allItems: items,
      departments: depts,
      allRequests: getRequests(),
      deptMap: new Map(depts.map((d) => [d.id, d.name])),
      labMap: new Map(labs.map((l) => [l.id, l])),
    };
  }, [dataVersion]);

  const currentItem = selectedItemId ? getItemById(selectedItemId) : allItems[0];
  const rawSlots = useMemo(() => (currentItem ? getSlots(currentItem.id) : []), [currentItem, dataVersion]);
  const weekDates = useMemo(() => buildWeekDates(weekAnchor), [weekAnchor]);
  const weeklySlots = useMemo(
    () => (currentItem ? buildWeeklyHourlySlots(currentItem.id, rawSlots, weekAnchor) : []),
    [currentItem, rawSlots, weekAnchor]
  );
  const itemConflicts = useMemo(
    () => (currentItem ? detectConflicts(allRequests, rawSlots).filter((c) => c.itemId === currentItem.id) : []),
    [allRequests, rawSlots, currentItem]
  );
  const conflictSlotKeys = useMemo(() => buildConflictSlotKeys(itemConflicts), [itemConflicts]);
  const slotLookup = useMemo(() => new Map(weeklySlots.map((s) => [`${s.date}|${s.start}`, s])), [weeklySlots]);

  const primaryConflict = itemConflicts[0];
  const allocationResult = useMemo(
    () => (currentItem && primaryConflict ? allocate(primaryConflict.requests, currentItem, rawSlots, allItems) : null),
    [primaryConflict, currentItem, rawSlots, allItems]
  );
  const allocationExplanation = useMemo(
    () => (allocationResult ? explainAllocation(allocationResult) : ''),
    [allocationResult]
  );
  const allocationSignature = allocationResult
    ? `${currentItem?.id ?? ''}:${allocationResult.ranked.map((e) => `${e.request.id}=${e.score}`).join(',')}:${allocationResult.assignments.map((a) => `${a.requestId}@${a.date}-${a.start}`).join(',')}`
    : '';

  useEffect(() => {
    setPlainExplanation(null);
    setExplainError('');
    setExplainLoading(false);
  }, [allocationSignature]);

  const handleExplainPlainWords = async () => {
    if (!allocationResult) return;
    setExplainLoading(true);
    setExplainError('');
    try {
      setPlainExplanation(await explainAllocationWithAI(allocationResult));
    } catch (err) {
      setPlainExplanation(null);
      setExplainError(
        err instanceof Error && err.message ? err.message : 'Unable to explain allocation in plain words right now.'
      );
    } finally {
      setExplainLoading(false);
    }
  };

  const handleBookingSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentItem) return;
    setLiveMessage('');
    const check = validateBooking({ itemId: currentItem.id, date: bookingDate, start: bookingStart, durationHours, purpose }, rawSlots);
    if (!check.ok) {
      setValidationErrors(check.errors);
      const joined = check.errors.join(' ').toLowerCase();
      window.requestAnimationFrame(() => {
        if (joined.includes('purpose')) bookingPurposeRef.current?.focus();
        else if (joined.includes('date') || joined.includes('past') || joined.includes('sunday')) bookingDateRef.current?.focus();
        else bookingErrorRef.current?.focus();
      });
      return;
    }
    const created = createCustomBooking({ itemId: currentItem.id, date: bookingDate, start: bookingStart, durationHours, purpose });
    if (created) {
      setValidationErrors([]);
      setPurpose('');
      setLiveMessage(`Booked ${currentItem.name} on ${created.date} (${created.window}) for "${created.note}".`);
      onDataMutated();
    }
  };

  return {
    allItems,
    departments,
    deptMap,
    currentItem,
    currentLab: currentItem ? labMap.get(currentItem.labId) : undefined,
    accessCheck: currentItem ? canUserBookItem(currentItem, currentUser, allRequests) : { allowed: false, reason: '' },
    weekDates,
    slotLookup,
    conflictSlotKeys,
    pickedSlotKeys: buildPickedSlotKeys(bookingDate, bookingStart, durationHours),
    activeWeekBookings: rawSlots.filter((s) => s.booked && weekDates.includes(s.date)),
    primaryConflict,
    allocationResult,
    allocationExplanation,
    plainExplanation,
    explainLoading,
    explainError,
    bookingDate,
    bookingStart,
    durationHours,
    purpose,
    validationErrors,
    liveMessage,
    calendarSectionRef,
    firstCalendarSlotRef,
    bookingDateRef,
    bookingPurposeRef,
    bookingErrorRef,
    setWeekAnchor,
    setBookingDate,
    setBookingStart,
    setDurationHours,
    setPurpose,
    setValidationErrors,
    setLiveMessage,
    handleExplainPlainWords,
    handleBookingSubmit,
    applySuggestion: () => {
      if (!allocationResult || !currentItem) return;
      applyAllocationSuggestion(allocationResult);
      setLiveMessage(`Applied fair-allocation schedule for ${currentItem.name}. ${allocationResult.assignments.length} session(s) updated.`);
      onDataMutated();
    },
    releaseSlot: (slotId: string, windowLabel: string, date: string) => {
      if (currentItem && cancelSlotBooking(slotId, currentItem.id)) {
        setLiveMessage(`Released booking for ${date} (${windowLabel}).`);
        onDataMutated();
      }
    },
  };
}
