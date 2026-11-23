/**
 * Searchable multi-select equipment picker grouped by Department and Laboratory.
 */
import { type ChangeEvent, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../js/types';

export interface GroupedDepartmentCatalog {
  dept: Department;
  labs: { lab: Lab; items: EquipmentItem[] }[];
}

interface EquipmentMultiSelectProps {
  groupedCatalog: GroupedDepartmentCatalog[];
  selectedItems: EquipmentItem[];
  selectedItemIds: string[];
  equipmentQuery: string;
  searchRef: RefObject<HTMLInputElement | null>;
  error?: string;
  onQueryChange: (query: string) => void;
  onToggleItem: (itemId: string) => void;
}

function SelectedEquipmentChips({
  selectedItems,
  onToggleItem,
}: {
  selectedItems: EquipmentItem[];
  onToggleItem: (itemId: string) => void;
}) {
  if (selectedItems.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Selected equipment items">
      {selectedItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onToggleItem(item.id)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-3 py-1.5 text-sm font-bold text-[var(--on-lavender)]"
          aria-label={`Remove ${item.name}`}
        >
          <span>{item.name}</span>
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function EquipmentGroupList({
  groupedCatalog,
  selectedItemIds,
  equipmentQuery,
  onToggleItem,
}: {
  groupedCatalog: GroupedDepartmentCatalog[];
  selectedItemIds: string[];
  equipmentQuery: string;
  onToggleItem: (itemId: string) => void;
}) {
  const handleContainerChange = (event: ChangeEvent<HTMLDivElement>) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>(
      'input[type="checkbox"][data-equip-id]'
    );
    const equipId = input?.dataset.equipId;
    if (equipId) onToggleItem(equipId);
  };

  return (
    <div
      className="mt-3 max-h-60 space-y-3 overflow-y-auto rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] p-3"
      onChange={handleContainerChange}
    >
      {groupedCatalog.length === 0 ? (
        <p className="text-sm text-[var(--ink)]">
          No catalog items match &ldquo;{equipmentQuery}&rdquo;.
        </p>
      ) : (
        groupedCatalog.map(({ dept, labs }) => (
          <div key={dept.id} className="space-y-2">
            {labs.map(({ lab, items }) => (
              <div key={lab.id}>
                <div className="border-b border-dashed border-[var(--border-subtle)] pb-0.5 text-sm font-bold text-[var(--ink)]">
                  {dept.name} &gt; {lab.name} ({lab.room})
                </div>
                <ul className="mt-1 space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--lavender-soft)]">
                        <input
                          type="checkbox"
                          data-equip-id={item.id}
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => undefined}
                          className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                        />
                        <span className="flex-1">
                          <span className="font-bold">{item.name}</span>
                          <span className="block text-xs">
                            {item.type} · {item.accessLevel}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Renders the searchable multi-select equipment catalog picker inside the request form.
 *
 * @param props - Grouped catalog data, current selection, search state, and callbacks.
 * @returns Fieldset element with search input, chips, and grouped checkboxes.
 */
export function EquipmentMultiSelect({
  groupedCatalog,
  selectedItems,
  selectedItemIds,
  equipmentQuery,
  searchRef,
  error,
  onQueryChange,
  onToggleItem,
}: EquipmentMultiSelectProps) {
  return (
    <fieldset className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5">
      <legend className="px-1.5 text-base font-bold text-[var(--ink)]">
        Equipment needed (required · {selectedItems.length} selected)
      </legend>

      <label htmlFor="req-equip-search" className="block text-sm font-bold text-[var(--ink)]">
        Search equipment catalog (by name, lab, or department)
      </label>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink)]"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          id="req-equip-search"
          type="search"
          value={equipmentQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'err-equipment' : undefined}
          placeholder="Type instrument, kit, or lab name..."
          className="notebook-input !pl-9"
        />
      </div>

      <SelectedEquipmentChips selectedItems={selectedItems} onToggleItem={onToggleItem} />
      <EquipmentGroupList
        groupedCatalog={groupedCatalog}
        selectedItemIds={selectedItemIds}
        equipmentQuery={equipmentQuery}
        onToggleItem={onToggleItem}
      />

      {error && (
        <p id="err-equipment" role="alert" className="mt-1.5 text-sm font-bold text-[var(--ink)]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
