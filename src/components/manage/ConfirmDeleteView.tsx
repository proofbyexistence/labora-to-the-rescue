/**
 * Safe deletion confirmation view warning about dependent child labs, items, bookings, and requests.
 */
import type { DependentReport } from '../../js/catalog-admin';

interface ConfirmDeleteViewProps {
  entityType: 'department' | 'lab' | 'item' | 'slot';
  entityName: string;
  dependents: DependentReport;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Renders the dependency summary and confirmation actions before catalog deletion.
 *
 * @param props - Target entity metadata, dependent record report, and cancel/confirm callbacks.
 * @returns Confirmation panel rendered inside CatalogModalHost.
 */
export function ConfirmDeleteView({
  entityType,
  entityName,
  dependents,
  onCancel,
  onConfirm,
}: ConfirmDeleteViewProps) {
  return (
    <div className="mt-4 space-y-4">
      <p id="manage-delete-desc" className="text-base text-[var(--ink)]">
        You are about to remove{' '}
        <strong>
          {entityType}: {entityName}
        </strong>
        .
      </p>

      {dependents.totalCount > 0 ? (
        <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-limited-bg)] p-3.5 text-sm text-[var(--ink)]">
          <p className="font-bold">Active dependent records reference this {entityType}:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {dependents.childLabs.map((l) => (
              <li key={l.id}>
                Laboratory: {l.name} ({l.room})
              </li>
            ))}
            {dependents.childItems.map((i) => (
              <li key={i.id}>Equipment: {i.name}</li>
            ))}
            {dependents.activeBookings.map((b) => (
              <li key={b.id}>
                Active booking: {b.date} {b.window} ({b.bookedBy ?? 'Student'})
              </li>
            ))}
            {dependents.affectedRequests.map((r) => (
              <li key={r.id}>
                Request {r.id} ({r.status}): {r.project} — {r.student}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]">
          No active bookings, pending/approved requests, or child items depend on this entry.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="labora-btn labora-btn-paper text-sm">
          Keep it
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="labora-btn !bg-[var(--status-booked-bg)] text-sm"
        >
          {dependents.totalCount > 0 ? 'Cancel affected bookings and delete' : 'Confirm delete'}
        </button>
      </div>
    </div>
  );
}
