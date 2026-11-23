/**
 * Smart Booking workspace: Mon–Sat weekly schedule table, slot reservations, and conflict resolution.
 */
import { CheckCircle2, Compass } from 'lucide-react';
import { BookingHeaderSummary } from '../components/BookingHeaderSummary';
import { BookingSidebarForm } from '../components/BookingSidebarForm';
import { ConflictResolutionPanel } from '../components/ConflictResolutionPanel';
import type { PageId } from '../components/EquipmentCard';
import { HeroBenchDoodle } from '../components/LabDoodles';
import { WeeklySlotGrid } from '../components/WeeklySlotGrid';
import type { CampusUser } from '../js/types';
import { useSmartBooking } from '../js/use-smart-booking';
import { addDaysIso } from '../js/validation';

interface SmartBookingPageProps {
  selectedItemId: string;
  currentUser: CampusUser;
  onSelectItem: (itemId: string) => void;
  onNavigate: (page: PageId, options?: { departmentId?: string; labId?: string; itemId?: string }) => void;
  onDataMutated: () => void;
}

/**
 * Renders the Smart Booking workspace uniting item availability, fair conflict allocation, and reservations.
 *
 * @param props - Active item ID, demo user context, navigation, and mutation callbacks.
 * @returns Smart Booking page element.
 */
export function SmartBookingPage({
  selectedItemId,
  currentUser,
  onSelectItem,
  onNavigate,
  onDataMutated,
}: SmartBookingPageProps) {
  const vm = useSmartBooking(selectedItemId, currentUser, onDataMutated);

  if (!vm.currentItem) {
    return (
      <section className="notebook-sheet p-8 text-center">
        <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
        <h1 className="text-3xl font-bold text-[var(--ink)]">Equipment item not found</h1>
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

  return (
    <div className="space-y-6">
      <BookingHeaderSummary
        currentItem={vm.currentItem}
        departments={vm.departments}
        allItems={vm.allItems}
        departmentName={vm.deptMap.get(vm.currentItem.departmentId)}
        currentLab={vm.currentLab}
        onSelectItem={(id) => {
          vm.setValidationErrors([]);
          vm.setLiveMessage('');
          onSelectItem(id);
        }}
      />

      <div
        aria-live="polite"
        className={
          vm.liveMessage
            ? 'notebook-sheet flex items-center gap-2 bg-[var(--status-available-bg)] px-4 py-3 text-base font-bold text-[var(--ink)]'
            : 'sr-only'
        }
      >
        {vm.liveMessage && (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{vm.liveMessage}</span>
          </>
        )}
      </div>

      {vm.primaryConflict && vm.allocationResult && (
        <ConflictResolutionPanel
          conflict={vm.primaryConflict}
          allocationResult={vm.allocationResult}
          allocationExplanation={vm.allocationExplanation}
          plainExplanation={vm.plainExplanation}
          explainLoading={vm.explainLoading}
          explainError={vm.explainError}
          onExplainPlainWords={vm.handleExplainPlainWords}
          onSelectItem={onSelectItem}
          onAcceptSuggestion={vm.applySuggestion}
          onPickAnotherSlot={() => {
            const reduced =
              typeof window !== 'undefined' &&
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            vm.firstCalendarSlotRef.current?.focus();
            vm.calendarSectionRef.current?.scrollIntoView({
              behavior: reduced ? 'auto' : 'smooth',
              block: 'nearest',
            });
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <WeeklySlotGrid
          itemName={vm.currentItem.name}
          weekDates={vm.weekDates}
          slotLookup={vm.slotLookup}
          conflictSlotKeys={vm.conflictSlotKeys}
          pickedSlotKeys={vm.pickedSlotKeys}
          activeWeekBookings={vm.activeWeekBookings}
          calendarSectionRef={vm.calendarSectionRef}
          firstCalendarSlotRef={vm.firstCalendarSlotRef}
          onShiftWeek={(delta) => vm.setWeekAnchor((prev) => addDaysIso(prev, delta))}
          onSelectSlot={(date, start) => {
            vm.setBookingDate(date);
            vm.setBookingStart(start);
            vm.setValidationErrors([]);
            vm.setLiveMessage(`Selected ${date} at ${start} in booking form.`);
          }}
          onReleaseSlot={vm.releaseSlot}
        />
        <BookingSidebarForm
          currentItem={vm.currentItem}
          currentUser={currentUser}
          currentLab={vm.currentLab}
          accessCheck={vm.accessCheck}
          bookingDate={vm.bookingDate}
          bookingStart={vm.bookingStart}
          durationHours={vm.durationHours}
          purpose={vm.purpose}
          validationErrors={vm.validationErrors}
          bookingDateRef={vm.bookingDateRef}
          bookingPurposeRef={vm.bookingPurposeRef}
          bookingErrorRef={vm.bookingErrorRef}
          onChangeDate={vm.setBookingDate}
          onChangeStart={vm.setBookingStart}
          onChangeDuration={vm.setDurationHours}
          onChangePurpose={vm.setPurpose}
          onSubmit={vm.handleBookingSubmit}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
