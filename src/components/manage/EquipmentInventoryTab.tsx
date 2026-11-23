/**
 * Equipment inventory CRUD tab panel with search, subject, and lab filters.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../../js/types';
import {
  EquipmentInventoryFilters,
  EquipmentInventoryRow,
} from './EquipmentInventoryRow';

interface EquipmentInventoryTabProps {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  deptMap: Map<string, Department>;
  labMap: Map<string, Lab>;
  onOpenItemModal: (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    item?: EquipmentItem
  ) => void;
  onOpenDeleteModal: (
    entityType: 'item',
    entityId: string,
    entityName: string,
    trigger: HTMLButtonElement
  ) => void;
}

/**
 * Renders the faculty Equipment Inventory management tab with filters and item actions.
 *
 * @param props - Departments, labs, equipment items, lookup maps, and modal callbacks.
 * @returns Notebook section displaying filterable equipment records.
 */
export function EquipmentInventoryTab({
  departments,
  labs,
  items,
  deptMap,
  labMap,
  onOpenItemModal,
  onOpenDeleteModal,
}: EquipmentInventoryTabProps) {
  const [equipQuery, setEquipQuery] = useState('');
  const [equipDeptFilter, setEquipDeptFilter] = useState('');
  const [equipLabFilter, setEquipLabFilter] = useState('');

  const scopedLabs = equipDeptFilter
    ? labs.filter((l) => l.departmentId === equipDeptFilter)
    : labs;
  const normalizedQuery = equipQuery.trim().toLowerCase();
  const filteredEquipment = items.filter((item) => {
    if (equipDeptFilter && item.departmentId !== equipDeptFilter) return false;
    if (equipLabFilter && item.labId !== equipLabFilter) return false;
    if (!normalizedQuery) return true;
    const dept = deptMap.get(item.departmentId)?.name ?? '';
    const lab = labMap.get(item.labId)?.name ?? '';
    return `${item.name} ${item.location} ${item.specs} ${item.type} ${dept} ${lab}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section className="notebook-sheet p-6" aria-labelledby="manage-equipment-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h2 id="manage-equipment-heading" className="text-2xl font-bold text-[var(--ink)]">
            Equipment Inventory
          </h2>
          <p className="text-sm text-[var(--ink)]">
            Showing {filteredEquipment.length} of {items.length} catalog items
          </p>
        </div>

        <button
          type="button"
          disabled={labs.length === 0}
          onClick={(e) => onOpenItemModal('add', e.currentTarget)}
          className="labora-btn text-sm"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          Add equipment
        </button>
      </div>

      <EquipmentInventoryFilters
        equipQuery={equipQuery}
        equipDeptFilter={equipDeptFilter}
        equipLabFilter={equipLabFilter}
        departments={departments}
        scopedLabs={scopedLabs}
        onQueryChange={setEquipQuery}
        onDeptChange={(id) => {
          setEquipDeptFilter(id);
          setEquipLabFilter('');
        }}
        onLabChange={setEquipLabFilter}
      />

      {filteredEquipment.length === 0 ? (
        <p className="mt-5 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-center text-base text-[var(--ink)]">
          No equipment matches the selected filters.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {filteredEquipment.map((item) => (
            <EquipmentInventoryRow
              key={item.id}
              item={item}
              deptName={deptMap.get(item.departmentId)?.name ?? item.departmentId}
              labName={labMap.get(item.labId)?.name ?? item.labId}
              onEdit={(btn) => onOpenItemModal('edit', btn, item)}
              onDelete={(btn) => onOpenDeleteModal('item', item.id, item.name, btn)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
