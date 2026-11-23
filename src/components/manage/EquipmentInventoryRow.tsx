/**
 * Filter bar and inventory row components for EquipmentInventoryTab.
 */
import { AlertTriangle, CheckCircle2, Pencil, Search, Trash2 } from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../../js/types';

/**
 * Renders search, subject, and laboratory filters for the faculty Equipment Inventory tab.
 *
 * @param props - Filter values, catalog dropdown options, and filter change handlers.
 * @returns Three-column filter grid.
 */
export function EquipmentInventoryFilters({
  equipQuery,
  equipDeptFilter,
  equipLabFilter,
  departments,
  scopedLabs,
  onQueryChange,
  onDeptChange,
  onLabChange,
}: {
  equipQuery: string;
  equipDeptFilter: string;
  equipLabFilter: string;
  departments: Department[];
  scopedLabs: Lab[];
  onQueryChange: (q: string) => void;
  onDeptChange: (id: string) => void;
  onLabChange: (id: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="manage-equip-search" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          Search equipment
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink)]"
            aria-hidden="true"
          />
          <input
            id="manage-equip-search"
            type="search"
            value={equipQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Name, location, specs..."
            className="notebook-input !pl-9"
          />
        </div>
      </div>

      <div>
        <label htmlFor="manage-equip-dept" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          Subject
        </label>
        <select
          id="manage-equip-dept"
          value={equipDeptFilter}
          onChange={(e) => onDeptChange(e.target.value)}
          className="notebook-input"
        >
          <option value="">All Subjects</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="manage-equip-lab" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          Laboratory
        </label>
        <select
          id="manage-equip-lab"
          value={equipLabFilter}
          onChange={(e) => onLabChange(e.target.value)}
          className="notebook-input"
        >
          <option value="">All Laboratories</option>
          {scopedLabs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.room})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Renders one equipment inventory item row with status badge and edit/delete triggers.
 *
 * @param props - Equipment item, resolved department/lab names, and edit/delete callbacks.
 * @returns List item element representing an equipment record.
 */
export function EquipmentInventoryRow({
  item,
  deptName,
  labName,
  onEdit,
  onDelete,
}: {
  item: EquipmentItem;
  deptName: string;
  labName: string;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  const statusClass =
    item.status === 'Available'
      ? 'status-badge-available'
      : item.status === 'Limited'
        ? 'status-badge-limited'
        : 'status-badge-booked';

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-bold text-[var(--ink)]">{item.name}</h3>
          <span className={`status-badge ${statusClass}`}>
            {item.status === 'Available' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{item.status}</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--ink)]">
          <strong>{deptName}</strong> &gt; {labName} · {item.type} · {item.accessLevel}
        </p>
        <p className="mt-0.5 text-sm text-[var(--ink)]">
          Location: {item.location} · Next slot:{' '}
          <span className="tabular-nums font-bold">{item.nextFreeSlot}</span>
        </p>
        {item.specs && <p className="mt-0.5 text-xs text-[var(--ink)]">{item.specs}</p>}
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => onEdit(e.currentTarget)}
          aria-label={`Edit equipment ${item.name}`}
          className="labora-btn labora-btn-paper text-xs"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => onDelete(e.currentTarget)}
          aria-label={`Delete equipment ${item.name}`}
          className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Delete
        </button>
      </div>
    </li>
  );
}
