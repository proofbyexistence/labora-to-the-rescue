/**
 * Equipment slot management tab panel for inspecting, adding, and removing hourly windows.
 */
import { useState } from 'react';
import { CalendarPlus, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { LAB_SCHEDULE } from '../../js/constants';
import { getSlots } from '../../js/lab-data';
import type { Department, EquipmentItem, Lab, TimeSlot } from '../../js/types';

interface SlotsManageTabProps {
  departments: Department[];
  items: EquipmentItem[];
  allSlots: TimeSlot[];
  labMap: Map<string, Lab>;
  onOpenSlotsModal: (itemId: string, trigger: HTMLButtonElement) => void;
  onDeleteFreeSlot: (slot: TimeSlot) => void;
  onOpenDeleteBookedSlot: (
    slot: TimeSlot,
    trigger: HTMLButtonElement
  ) => void;
}

function SlotRow({
  slot,
  onDeleteFree,
  onDeleteBooked,
}: {
  slot: TimeSlot;
  onDeleteFree: () => void;
  onDeleteBooked: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums font-bold text-[var(--ink)]">
            {slot.date} · {slot.window}
          </span>
          <span
            className={`status-badge ${
              slot.booked ? 'status-badge-booked' : 'status-badge-available'
            }`}
          >
            {slot.booked ? (
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{slot.booked ? 'Booked' : 'Free'}</span>
          </span>
        </div>
        {slot.booked && (
          <p className="mt-0.5 text-sm text-[var(--ink)]">
            Booked by <strong>{slot.bookedBy}</strong>
            {slot.note ? ` — ${slot.note}` : ''}
          </p>
        )}
      </div>

      {!slot.booked ? (
        <button
          type="button"
          onClick={onDeleteFree}
          aria-label={`Delete free slot ${slot.date} ${slot.window}`}
          className="labora-btn labora-btn-paper text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Delete free slot
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => onDeleteBooked(e.currentTarget)}
          aria-label={`Cancel booking and delete slot ${slot.date} ${slot.window}`}
          className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cancel &amp; delete
        </button>
      )}
    </li>
  );
}

/**
 * Renders the faculty Slots management tab for publishing and removing bench windows.
 *
 * @param props - Departments, items, slots collection, lab lookup, and slot action handlers.
 * @returns Notebook section with item selector and chronological slot list.
 */
export function SlotsManageTab({
  departments,
  items,
  allSlots,
  labMap,
  onOpenSlotsModal,
  onDeleteFreeSlot,
  onOpenDeleteBookedSlot,
}: SlotsManageTabProps) {
  const [slotItemId, setSlotItemId] = useState(items[0]?.id ?? '');
  const effectiveSlotItemId = items.some((i) => i.id === slotItemId)
    ? slotItemId
    : items[0]?.id ?? '';

  const selectedSlotItem = items.find((i) => i.id === effectiveSlotItemId);
  const itemSlots = effectiveSlotItemId
    ? getSlots(effectiveSlotItemId).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start ?? a.window).localeCompare(b.start ?? b.window);
      })
    : [];

  return (
    <section className="notebook-sheet p-6" aria-labelledby="manage-slots-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h2 id="manage-slots-heading" className="text-2xl font-bold text-[var(--ink)]">
            Manage Equipment Slots
          </h2>
          <p className="text-sm text-[var(--ink)]">
            Add one-hour Mon–Sat ({String(LAB_SCHEDULE.START_HOUR).padStart(2, '0')}:00–
            {String(LAB_SCHEDULE.END_HOUR).padStart(2, '0')}:00) bench slots or remove unused windows. Total catalog slots:{' '}
            <span className="tabular-nums font-bold">{allSlots.length}</span>
          </p>
        </div>

        <button
          type="button"
          disabled={!effectiveSlotItemId}
          onClick={(e) => onOpenSlotsModal(effectiveSlotItemId, e.currentTarget)}
          className="labora-btn text-sm"
        >
          <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          Add slots
        </button>
      </div>

      <div className="mt-4 max-w-xl">
        <label htmlFor="manage-slot-picker" className="mb-1 block text-base font-bold text-[var(--ink)]">
          Select equipment item
        </label>
        <select
          id="manage-slot-picker"
          value={effectiveSlotItemId}
          onChange={(e) => setSlotItemId(e.target.value)}
          className="notebook-input"
        >
          {departments.map((dept) => {
            const deptItems = items.filter((i) => i.departmentId === dept.id);
            if (deptItems.length === 0) return null;
            return (
              <optgroup key={dept.id} label={dept.name}>
                {deptItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({labMap.get(item.labId)?.room ?? item.location})
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {selectedSlotItem && (
        <div className="mt-4 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] px-4 py-3 text-sm text-[var(--ink)]">
          <strong>{selectedSlotItem.name}</strong> · Current status:{' '}
          <strong>{selectedSlotItem.status}</strong> · Next free slot:{' '}
          <strong className="tabular-nums">{selectedSlotItem.nextFreeSlot}</strong>
        </div>
      )}

      {itemSlots.length === 0 ? (
        <p className="mt-4 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-base text-[var(--ink)]">
          No slots scheduled for this item yet. Click &ldquo;Add slots&rdquo; to publish one-hour windows.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {itemSlots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onDeleteFree={() => onDeleteFreeSlot(slot)}
              onDeleteBooked={(btn) => onOpenDeleteBookedSlot(slot, btn)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
