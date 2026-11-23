/**
 * Faculty catalog management workspace UI for subjects, labs, equipment items, and bench slots.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CatalogMutationResult, DependentReport } from '../js/catalog-admin';
import {
  adminAddDepartment,
  adminAddItem,
  adminAddLab,
  adminAddSlots,
  adminDeleteDepartment,
  adminDeleteItem,
  adminDeleteLab,
  adminDeleteSlot,
  adminEditDepartment,
  adminEditItem,
  adminEditLab,
  getAllSlots,
  getDepartments,
  getEntityDependents,
  getItems,
  getLabs,
  getSlots,
} from '../js/labData';
import { DEFAULT_REFERENCE_DATE, formatHour, LAB_END_HOUR, LAB_START_HOUR } from '../js/scheduler';
import type {
  AccessLevel,
  AvailabilityStatus,
  Department,
  EquipmentItem,
  EquipmentType,
  Lab,
  TimeSlot,
} from '../js/types';

export type ManageTabId = 'subjects' | 'equipment' | 'slots';

interface CatalogManagePanelProps {
  activeTab: Exclude<ManageTabId, never>;
  onNotify: (kind: 'success' | 'error', message: string) => void;
  onDataMutated: () => void;
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Instruments',
  'Development kits',
  'Workstations',
  'Safety gear',
];

const STATUS_OPTIONS: AvailabilityStatus[] = ['Available', 'Limited', 'Booked'];

const ACCESS_OPTIONS: AccessLevel[] = [
  'Open',
  'Needs faculty approval',
  'Training required',
];

const START_HOURS = Array.from(
  { length: LAB_END_HOUR - LAB_START_HOUR },
  (_, idx) => formatHour(LAB_START_HOUR + idx)
);

const END_HOURS = Array.from(
  { length: LAB_END_HOUR - LAB_START_HOUR },
  (_, idx) => formatHour(LAB_START_HOUR + 1 + idx)
);

type ActiveModal =
  | { kind: 'dept'; mode: 'add' | 'edit'; dept?: Department }
  | { kind: 'lab'; mode: 'add' | 'edit'; defaultDeptId?: string; lab?: Lab }
  | { kind: 'item'; mode: 'add' | 'edit'; item?: EquipmentItem }
  | { kind: 'slots'; itemId: string }
  | {
      kind: 'delete';
      entityType: 'department' | 'lab' | 'item' | 'slot';
      entityId: string;
      entityName: string;
      dependents: DependentReport;
    };

export function CatalogManagePanel({
  activeTab,
  onNotify,
  onDataMutated,
}: CatalogManagePanelProps) {
  const departments = getDepartments();
  const labs = getLabs();
  const items = getItems();
  const allSlots = getAllSlots();

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const labMap = new Map(labs.map((l) => [l.id, l]));

  // Equipment tab filters
  const [equipQuery, setEquipQuery] = useState('');
  const [equipDeptFilter, setEquipDeptFilter] = useState('');
  const [equipLabFilter, setEquipLabFilter] = useState('');

  // Slots tab selected item
  const [slotItemId, setSlotItemId] = useState(items[0]?.id ?? '');

  // Dialog state & shared focus management
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formBannerError, setFormBannerError] = useState('');

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);

  // Subject form state
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptBuilding, setDeptBuilding] = useState('');
  const [deptLead, setDeptLead] = useState('');
  const [deptSummary, setDeptSummary] = useState('');

  // Lab form state
  const [labDeptId, setLabDeptId] = useState('');
  const [labName, setLabName] = useState('');
  const [labRoom, setLabRoom] = useState('');
  const [labSupervisor, setLabSupervisor] = useState('');
  const [labHours, setLabHours] = useState('');
  const [labDescription, setLabDescription] = useState('');

  // Equipment form state
  const [itemName, setItemName] = useState('');
  const [itemDeptId, setItemDeptId] = useState('');
  const [itemLabId, setItemLabId] = useState('');
  const [itemType, setItemType] = useState<EquipmentType>('Instruments');
  const [itemLocation, setItemLocation] = useState('');
  const [itemStatus, setItemStatus] = useState<AvailabilityStatus>('Available');
  const [itemAccess, setItemAccess] = useState<AccessLevel>('Open');
  const [itemSpecs, setItemSpecs] = useState('');

  // Slot add form state
  const [slotDate, setSlotDate] = useState(DEFAULT_REFERENCE_DATE);
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('12:00');

  // Keep slotItemId valid if an item was deleted.
  const effectiveSlotItemId = items.some((i) => i.id === slotItemId)
    ? slotItemId
    : items[0]?.id ?? '';

  const closeModal = () => {
    setModal(null);
    setFieldErrors({});
    setFormBannerError('');
    window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
  };

  useEffect(() => {
    if (!modal) return;

    window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      );
      firstFocusable?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModal(null);
        setFieldErrors({});
        setFormBannerError('');
        window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const focusFirstErrorField = (
    errors: Record<string, string>,
    idByField: Record<string, string>
  ) => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    const domId = idByField[firstKey];
    if (domId) {
      window.requestAnimationFrame(() => {
        document.getElementById(domId)?.focus();
      });
    }
  };

  const applyMutationFeedback = <T,>(
    result: CatalogMutationResult<T>,
    successMsg: string,
    idByField: Record<string, string>
  ): boolean => {
    if (!result.ok) {
      const errors = result.fieldErrors ?? {};
      setFieldErrors(errors);
      setFormBannerError(result.error ?? 'Could not save changes.');
      onNotify('error', result.error ?? 'Could not save changes.');
      focusFirstErrorField(errors, idByField);
      return false;
    }

    setFieldErrors({});
    setFormBannerError('');
    setModal(null);
    onNotify('success', successMsg);
    onDataMutated();
    window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
    return true;
  };

  // Modal openers
  const openDeptModal = (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    dept?: Department
  ) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
    setDeptName(dept?.name ?? '');
    setDeptCode(dept?.code ?? '');
    setDeptBuilding(dept?.building ?? '');
    setDeptLead(dept?.leadFaculty ?? '');
    setDeptSummary(dept?.summary ?? '');
    setModal({ kind: 'dept', mode, dept });
  };

  const openLabModal = (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    options?: { defaultDeptId?: string; lab?: Lab }
  ) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
    const targetLab = options?.lab;
    setLabDeptId(
      targetLab?.departmentId ?? options?.defaultDeptId ?? departments[0]?.id ?? ''
    );
    setLabName(targetLab?.name ?? '');
    setLabRoom(targetLab?.room ?? '');
    setLabSupervisor(targetLab?.supervisor ?? '');
    setLabHours(targetLab?.hours ?? '09:00 – 17:00');
    setLabDescription(targetLab?.description ?? '');
    setModal({
      kind: 'lab',
      mode,
      defaultDeptId: options?.defaultDeptId,
      lab: targetLab,
    });
  };

  const openItemModal = (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    item?: EquipmentItem
  ) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
    const fallbackDept = item?.departmentId ?? departments[0]?.id ?? '';
    const deptLabs = labs.filter((l) => l.departmentId === fallbackDept);
    setItemName(item?.name ?? '');
    setItemDeptId(fallbackDept);
    setItemLabId(item?.labId ?? deptLabs[0]?.id ?? '');
    setItemType(item?.type ?? 'Instruments');
    setItemLocation(item?.location ?? '');
    setItemStatus(item?.status ?? 'Available');
    setItemAccess(item?.accessLevel ?? 'Open');
    setItemSpecs(item?.specs ?? '');
    setModal({ kind: 'item', mode, item });
  };

  const openSlotsModal = (itemId: string, trigger: HTMLButtonElement) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
    setSlotDate(DEFAULT_REFERENCE_DATE);
    setSlotStart('09:00');
    setSlotEnd('12:00');
    setModal({ kind: 'slots', itemId });
  };

  const openDeleteModal = (
    entityType: 'department' | 'lab' | 'item' | 'slot',
    entityId: string,
    entityName: string,
    trigger: HTMLButtonElement
  ) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
    const dependents = getEntityDependents({ type: entityType, id: entityId });
    setModal({
      kind: 'delete',
      entityType,
      entityId,
      entityName,
      dependents,
    });
  };

  // Submit handlers
  const handleDeptSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'dept') return;
    const payload = {
      name: deptName,
      code: deptCode,
      building: deptBuilding,
      leadFaculty: deptLead,
      summary: deptSummary,
    };
    const result =
      modal.mode === 'add'
        ? adminAddDepartment(payload)
        : adminEditDepartment(modal.dept!.id, payload);
    applyMutationFeedback(
      result,
      modal.mode === 'add'
        ? `Added subject "${deptName.trim()}".`
        : `Updated subject "${deptName.trim()}".`,
      {
        name: 'manage-dept-name',
        code: 'manage-dept-code',
        building: 'manage-dept-building',
        leadFaculty: 'manage-dept-lead',
        summary: 'manage-dept-summary',
      }
    );
  };

  const handleLabSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'lab') return;
    const payload = {
      departmentId: labDeptId,
      name: labName,
      room: labRoom,
      supervisor: labSupervisor,
      hours: labHours,
      description: labDescription,
    };
    const result =
      modal.mode === 'add'
        ? adminAddLab(payload)
        : adminEditLab(modal.lab!.id, payload);
    applyMutationFeedback(
      result,
      modal.mode === 'add'
        ? `Added laboratory "${labName.trim()}".`
        : `Updated laboratory "${labName.trim()}".`,
      {
        departmentId: 'manage-lab-dept',
        name: 'manage-lab-name',
        room: 'manage-lab-room',
        supervisor: 'manage-lab-supervisor',
        hours: 'manage-lab-hours',
        description: 'manage-lab-description',
      }
    );
  };

  const handleItemSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'item') return;
    const payload = {
      name: itemName,
      departmentId: itemDeptId,
      labId: itemLabId,
      type: itemType,
      location: itemLocation,
      status: itemStatus,
      accessLevel: itemAccess,
      specs: itemSpecs,
    };
    const result =
      modal.mode === 'add'
        ? adminAddItem(payload)
        : adminEditItem(modal.item!.id, payload);
    applyMutationFeedback(
      result,
      modal.mode === 'add'
        ? `Added equipment "${itemName.trim()}".`
        : `Updated equipment "${itemName.trim()}".`,
      {
        name: 'manage-item-name',
        departmentId: 'manage-item-dept',
        labId: 'manage-item-lab',
        type: 'manage-item-type',
        location: 'manage-item-location',
        status: 'manage-item-status',
        accessLevel: 'manage-item-access',
        specs: 'manage-item-specs',
      }
    );
  };

  const handleSlotsSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'slots') return;
    const result = adminAddSlots({
      itemId: modal.itemId,
      date: slotDate,
      startTime: slotStart,
      endTime: slotEnd,
    });
    const count = result.data?.length ?? 0;
    applyMutationFeedback(
      result,
      `Created ${count} one-hour slot${count === 1 ? '' : 's'} on ${slotDate}.`,
      {
        itemId: 'manage-slot-item',
        date: 'manage-slot-date',
        startTime: 'manage-slot-start',
        endTime: 'manage-slot-end',
      }
    );
  };

  const handleConfirmDelete = () => {
    if (modal?.kind !== 'delete') return;
    const option = modal.dependents.totalCount > 0 ? 'cancelAffected' : undefined;
    let result: CatalogMutationResult<unknown>;
    if (modal.entityType === 'department') {
      result = adminDeleteDepartment(modal.entityId, option);
    } else if (modal.entityType === 'lab') {
      result = adminDeleteLab(modal.entityId, option);
    } else if (modal.entityType === 'item') {
      result = adminDeleteItem(modal.entityId, option);
    } else {
      result = adminDeleteSlot(modal.entityId, option);
    }

    if (!result.ok) {
      setFormBannerError(result.error ?? 'Deletion blocked.');
      onNotify('error', result.error ?? 'Deletion blocked.');
      return;
    }

    const msg =
      modal.dependents.totalCount > 0
        ? `Removed "${modal.entityName}" and resolved ${modal.dependents.totalCount} dependent record(s).`
        : `Removed "${modal.entityName}" from the catalog.`;
    setModal(null);
    setFormBannerError('');
    onNotify('success', msg);
    onDataMutated();
    window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
  };

  const handleDeleteFreeSlot = (slot: TimeSlot) => {
    const result = adminDeleteSlot(slot.id);
    if (!result.ok) {
      onNotify('error', result.error ?? 'Unable to delete slot.');
      return;
    }
    onNotify('success', `Deleted free slot ${slot.date} (${slot.window}).`);
    onDataMutated();
  };

  // Filtered equipment list for Equipment tab
  const scopedEquipLabs = equipDeptFilter
    ? labs.filter((l) => l.departmentId === equipDeptFilter)
    : labs;
  const normalizedEquipQuery = equipQuery.trim().toLowerCase();
  const filteredEquipment = items.filter((item) => {
    if (equipDeptFilter && item.departmentId !== equipDeptFilter) return false;
    if (equipLabFilter && item.labId !== equipLabFilter) return false;
    if (normalizedEquipQuery) {
      const dept = deptMap.get(item.departmentId)?.name ?? '';
      const lab = labMap.get(item.labId)?.name ?? '';
      const text =
        `${item.name} ${item.location} ${item.specs} ${item.type} ${dept} ${lab}`.toLowerCase();
      if (!text.includes(normalizedEquipQuery)) return false;
    }
    return true;
  });

  // Slots for selected item in Slots tab
  const selectedSlotItem = items.find((i) => i.id === effectiveSlotItemId);
  const itemSlots = effectiveSlotItemId
    ? getSlots(effectiveSlotItemId).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start ?? a.window).localeCompare(b.start ?? b.window);
      })
    : [];

  return (
    <div className="space-y-5">
      {/* TAB: SUBJECTS & LABS */}
      {activeTab === 'subjects' && (
        <section className="notebook-sheet p-6" aria-labelledby="manage-subjects-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
            <div>
              <h2
                id="manage-subjects-heading"
                className="text-2xl font-bold text-[var(--ink)]"
              >
                Subjects &amp; Laboratories
              </h2>
              <p className="text-sm text-[var(--ink)]">
                {departments.length} subjects · {labs.length} laboratories in campus notebook
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(e) => openDeptModal('add', e.currentTarget)}
                className="labora-btn text-sm"
              >
                <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                Add subject
              </button>
              <button
                type="button"
                disabled={departments.length === 0}
                onClick={(e) => openLabModal('add', e.currentTarget)}
                className="labora-btn labora-btn-paper text-sm"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                Add lab
              </button>
            </div>
          </div>

          {departments.length === 0 ? (
            <p className="mt-5 text-base text-[var(--ink)]">
              No subjects configured yet. Add a subject to start creating campus laboratories.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {departments.map((dept) => {
                const deptLabs = labs.filter((l) => l.departmentId === dept.id);
                const deptItemCount = items.filter((i) => i.departmentId === dept.id).length;

                return (
                  <li
                    key={dept.id}
                    className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[6px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2 py-0.5 text-xs font-bold text-[var(--on-lavender)]">
                            {dept.code}
                          </span>
                          <h3 className="text-xl font-bold text-[var(--ink)]">
                            {dept.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-[var(--ink)]">
                          {dept.building} · Lead: {dept.leadFaculty} ·{' '}
                          <span className="tabular-nums font-bold">
                            {deptLabs.length} lab{deptLabs.length === 1 ? '' : 's'}, {deptItemCount} item{deptItemCount === 1 ? '' : 's'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) =>
                            openLabModal('add', e.currentTarget, {
                              defaultDeptId: dept.id,
                            })
                          }
                          className="labora-btn labora-btn-paper text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Add lab
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openDeptModal('edit', e.currentTarget, dept)}
                          aria-label={`Edit subject ${dept.name}`}
                          className="labora-btn labora-btn-paper text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) =>
                            openDeleteModal(
                              'department',
                              dept.id,
                              dept.name,
                              e.currentTarget
                            )
                          }
                          aria-label={`Delete subject ${dept.name}`}
                          className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {deptLabs.length === 0 ? (
                      <p className="mt-3 rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--ink)]">
                        No laboratories in {dept.name} yet.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 border-t-2 border-dashed border-[var(--border-subtle)] pt-3 pl-3">
                        {deptLabs.map((lab) => {
                          const labItemCount = items.filter(
                            (i) => i.labId === lab.id
                          ).length;
                          return (
                            <li
                              key={lab.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] px-3 py-2.5"
                            >
                              <div>
                                <div className="font-bold text-[var(--ink)]">
                                  {lab.name}{' '}
                                  <span className="tabular-nums text-sm font-normal">
                                    ({lab.room})
                                  </span>
                                </div>
                                <div className="text-xs text-[var(--ink)]">
                                  {lab.supervisor} · {lab.hours} ·{' '}
                                  <span className="tabular-nums font-bold">
                                    {labItemCount} equipment item{labItemCount === 1 ? '' : 's'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openLabModal('edit', e.currentTarget, { lab })
                                  }
                                  aria-label={`Edit lab ${lab.name}`}
                                  className="labora-btn labora-btn-paper text-xs"
                                >
                                  <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openDeleteModal(
                                      'lab',
                                      lab.id,
                                      lab.name,
                                      e.currentTarget
                                    )
                                  }
                                  aria-label={`Delete lab ${lab.name}`}
                                  className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
                                >
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  Delete
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* TAB: EQUIPMENT */}
      {activeTab === 'equipment' && (
        <section className="notebook-sheet p-6" aria-labelledby="manage-equipment-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
            <div>
              <h2
                id="manage-equipment-heading"
                className="text-2xl font-bold text-[var(--ink)]"
              >
                Equipment Inventory
              </h2>
              <p className="text-sm text-[var(--ink)]">
                Showing {filteredEquipment.length} of {items.length} catalog items
              </p>
            </div>

            <button
              type="button"
              disabled={labs.length === 0}
              onClick={(e) => openItemModal('add', e.currentTarget)}
              className="labora-btn text-sm"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              Add equipment
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="manage-equip-search"
                className="mb-1 block text-sm font-bold text-[var(--ink)]"
              >
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
                  onChange={(e) => setEquipQuery(e.target.value)}
                  placeholder="Name, location, specs..."
                  className="notebook-input !pl-9"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="manage-equip-dept"
                className="mb-1 block text-sm font-bold text-[var(--ink)]"
              >
                Subject
              </label>
              <select
                id="manage-equip-dept"
                value={equipDeptFilter}
                onChange={(e) => {
                  setEquipDeptFilter(e.target.value);
                  setEquipLabFilter('');
                }}
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
              <label
                htmlFor="manage-equip-lab"
                className="mb-1 block text-sm font-bold text-[var(--ink)]"
              >
                Laboratory
              </label>
              <select
                id="manage-equip-lab"
                value={equipLabFilter}
                onChange={(e) => setEquipLabFilter(e.target.value)}
                className="notebook-input"
              >
                <option value="">All Laboratories</option>
                {scopedEquipLabs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.room})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredEquipment.length === 0 ? (
            <p className="mt-5 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-center text-base text-[var(--ink)]">
              No equipment matches the selected filters.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {filteredEquipment.map((item) => {
                const dept = deptMap.get(item.departmentId);
                const lab = labMap.get(item.labId);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-[var(--ink)]">
                          {item.name}
                        </h3>
                        <span
                          className={`status-badge ${
                            item.status === 'Available'
                              ? 'status-badge-available'
                              : item.status === 'Limited'
                                ? 'status-badge-limited'
                                : 'status-badge-booked'
                          }`}
                        >
                          {item.status === 'Available' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{item.status}</span>
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink)]">
                        <strong>{dept?.name ?? item.departmentId}</strong> &gt;{' '}
                        {lab?.name ?? item.labId} · {item.type} · {item.accessLevel}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--ink)]">
                        Location: {item.location} · Next slot:{' '}
                        <span className="tabular-nums font-bold">{item.nextFreeSlot}</span>
                      </p>
                      {item.specs && (
                        <p className="mt-0.5 text-xs text-[var(--ink)]">{item.specs}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => openItemModal('edit', e.currentTarget, item)}
                        aria-label={`Edit equipment ${item.name}`}
                        className="labora-btn labora-btn-paper text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) =>
                          openDeleteModal('item', item.id, item.name, e.currentTarget)
                        }
                        aria-label={`Delete equipment ${item.name}`}
                        className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* TAB: SLOTS */}
      {activeTab === 'slots' && (
        <section className="notebook-sheet p-6" aria-labelledby="manage-slots-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
            <div>
              <h2
                id="manage-slots-heading"
                className="text-2xl font-bold text-[var(--ink)]"
              >
                Manage Equipment Slots
              </h2>
              <p className="text-sm text-[var(--ink)]">
                Add one-hour Mon–Sat (09:00–17:00) bench slots or remove unused windows. Total catalog slots:{' '}
                <span className="tabular-nums font-bold">{allSlots.length}</span>
              </p>
            </div>

            <button
              type="button"
              disabled={!effectiveSlotItemId}
              onClick={(e) => openSlotsModal(effectiveSlotItemId, e.currentTarget)}
              className="labora-btn text-sm"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              Add slots
            </button>
          </div>

          <div className="mt-4 max-w-xl">
            <label
              htmlFor="manage-slot-picker"
              className="mb-1 block text-base font-bold text-[var(--ink)]"
            >
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
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums font-bold text-[var(--ink)]">
                        {slot.date} · {slot.window}
                      </span>
                      <span
                        className={`status-badge ${
                          slot.booked
                            ? 'status-badge-booked'
                            : 'status-badge-available'
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
                      onClick={() => handleDeleteFreeSlot(slot)}
                      aria-label={`Delete free slot ${slot.date} ${slot.window}`}
                      className="labora-btn labora-btn-paper text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Delete free slot
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) =>
                        openDeleteModal(
                          'slot',
                          slot.id,
                          `${slot.date} ${slot.window}`,
                          e.currentTarget
                        )
                      }
                      aria-label={`Cancel booking and delete slot ${slot.date} ${slot.window}`}
                      className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Cancel &amp; delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ACCESSIBLE DIALOGS FOR ADD / EDIT / SLOTS / SAFE DELETE */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            role={modal.kind === 'delete' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="manage-dialog-title"
            aria-describedby={modal.kind === 'delete' ? 'manage-delete-desc' : undefined}
            className="notebook-sheet max-h-[90vh] w-full max-w-xl overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
              <h2
                id="manage-dialog-title"
                className="text-2xl font-bold text-[var(--ink)]"
              >
                {modal.kind === 'dept' &&
                  (modal.mode === 'add' ? 'Add Subject / Department' : 'Edit Subject / Department')}
                {modal.kind === 'lab' &&
                  (modal.mode === 'add' ? 'Add Laboratory' : 'Edit Laboratory')}
                {modal.kind === 'item' &&
                  (modal.mode === 'add' ? 'Add Equipment Item' : 'Edit Equipment Item')}
                {modal.kind === 'slots' && 'Add One-Hour Slots'}
                {modal.kind === 'delete' && `Confirm Deletion: ${modal.entityName}`}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="labora-btn labora-btn-paper !px-2.5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {formBannerError && (
              <div
                role="alert"
                className="mt-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
              >
                {formBannerError}
              </div>
            )}

            {/* SUBJECT FORM */}
            {modal.kind === 'dept' && (
              <form onSubmit={handleDeptSubmit} noValidate className="mt-4 space-y-3">
                <div>
                  <label htmlFor="manage-dept-name" className="block text-sm font-bold text-[var(--ink)]">
                    Subject name (required, 2–50 characters)
                  </label>
                  <input
                    id="manage-dept-name"
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'err-dept-name' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.name && (
                    <p id="err-dept-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="manage-dept-code" className="block text-sm font-bold text-[var(--ink)]">
                      Department code (2–10 chars)
                    </label>
                    <input
                      id="manage-dept-code"
                      type="text"
                      value={deptCode}
                      onChange={(e) => setDeptCode(e.target.value)}
                      placeholder="e.g., AERO"
                      aria-invalid={Boolean(fieldErrors.code)}
                      aria-describedby={fieldErrors.code ? 'err-dept-code' : undefined}
                      className="notebook-input mt-1"
                    />
                    {fieldErrors.code && (
                      <p id="err-dept-code" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.code}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="manage-dept-building" className="block text-sm font-bold text-[var(--ink)]">
                      Building
                    </label>
                    <input
                      id="manage-dept-building"
                      type="text"
                      value={deptBuilding}
                      onChange={(e) => setDeptBuilding(e.target.value)}
                      placeholder="e.g., Faraday Hall"
                      aria-invalid={Boolean(fieldErrors.building)}
                      aria-describedby={fieldErrors.building ? 'err-dept-building' : undefined}
                      className="notebook-input mt-1"
                    />
                    {fieldErrors.building && (
                      <p id="err-dept-building" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.building}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="manage-dept-lead" className="block text-sm font-bold text-[var(--ink)]">
                    Lead faculty
                  </label>
                  <input
                    id="manage-dept-lead"
                    type="text"
                    value={deptLead}
                    onChange={(e) => setDeptLead(e.target.value)}
                    placeholder="e.g., Prof. Maya Patel"
                    aria-invalid={Boolean(fieldErrors.leadFaculty)}
                    aria-describedby={fieldErrors.leadFaculty ? 'err-dept-lead' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.leadFaculty && (
                    <p id="err-dept-lead" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.leadFaculty}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="manage-dept-summary" className="block text-sm font-bold text-[var(--ink)]">
                    Summary (up to 200 characters)
                  </label>
                  <textarea
                    id="manage-dept-summary"
                    rows={2}
                    value={deptSummary}
                    onChange={(e) => setDeptSummary(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.summary)}
                    aria-describedby={fieldErrors.summary ? 'err-dept-summary' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.summary && (
                    <p id="err-dept-summary" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.summary}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="labora-btn labora-btn-paper text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="labora-btn text-sm">
                    {modal.mode === 'add' ? 'Create Subject' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* LAB FORM */}
            {modal.kind === 'lab' && (
              <form onSubmit={handleLabSubmit} noValidate className="mt-4 space-y-3">
                <div>
                  <label htmlFor="manage-lab-dept" className="block text-sm font-bold text-[var(--ink)]">
                    Subject / Department (required)
                  </label>
                  <select
                    id="manage-lab-dept"
                    value={labDeptId}
                    onChange={(e) => setLabDeptId(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.departmentId)}
                    aria-describedby={fieldErrors.departmentId ? 'err-lab-dept' : undefined}
                    className="notebook-input mt-1"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.departmentId && (
                    <p id="err-lab-dept" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.departmentId}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="manage-lab-name" className="block text-sm font-bold text-[var(--ink)]">
                    Laboratory name (required, 2–60 characters)
                  </label>
                  <input
                    id="manage-lab-name"
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'err-lab-name' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.name && (
                    <p id="err-lab-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="manage-lab-room" className="block text-sm font-bold text-[var(--ink)]">
                      Room code
                    </label>
                    <input
                      id="manage-lab-room"
                      type="text"
                      value={labRoom}
                      onChange={(e) => setLabRoom(e.target.value)}
                      placeholder="e.g., SHN-310"
                      aria-invalid={Boolean(fieldErrors.room)}
                      aria-describedby={fieldErrors.room ? 'err-lab-room' : undefined}
                      className="notebook-input mt-1"
                    />
                    {fieldErrors.room && (
                      <p id="err-lab-room" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.room}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="manage-lab-hours" className="block text-sm font-bold text-[var(--ink)]">
                      Lab hours
                    </label>
                    <input
                      id="manage-lab-hours"
                      type="text"
                      value={labHours}
                      onChange={(e) => setLabHours(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.hours)}
                      aria-describedby={fieldErrors.hours ? 'err-lab-hours' : undefined}
                      className="notebook-input mt-1"
                    />
                    {fieldErrors.hours && (
                      <p id="err-lab-hours" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.hours}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="manage-lab-supervisor" className="block text-sm font-bold text-[var(--ink)]">
                    Supervisor
                  </label>
                  <input
                    id="manage-lab-supervisor"
                    type="text"
                    value={labSupervisor}
                    onChange={(e) => setLabSupervisor(e.target.value)}
                    placeholder="e.g., Dr. Elena Rostova"
                    aria-invalid={Boolean(fieldErrors.supervisor)}
                    aria-describedby={fieldErrors.supervisor ? 'err-lab-supervisor' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.supervisor && (
                    <p id="err-lab-supervisor" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.supervisor}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="manage-lab-description" className="block text-sm font-bold text-[var(--ink)]">
                    Description (up to 200 characters)
                  </label>
                  <textarea
                    id="manage-lab-description"
                    rows={2}
                    value={labDescription}
                    onChange={(e) => setLabDescription(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={fieldErrors.description ? 'err-lab-desc' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.description && (
                    <p id="err-lab-desc" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.description}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="labora-btn labora-btn-paper text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="labora-btn text-sm">
                    {modal.mode === 'add' ? 'Create Lab' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* EQUIPMENT FORM */}
            {modal.kind === 'item' && (
              <form onSubmit={handleItemSubmit} noValidate className="mt-4 space-y-3">
                <div>
                  <label htmlFor="manage-item-name" className="block text-sm font-bold text-[var(--ink)]">
                    Equipment name (required, 2–80 characters)
                  </label>
                  <input
                    id="manage-item-name"
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'err-item-name' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.name && (
                    <p id="err-item-name" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="manage-item-dept" className="block text-sm font-bold text-[var(--ink)]">
                      Subject (required)
                    </label>
                    <select
                      id="manage-item-dept"
                      value={itemDeptId}
                      onChange={(e) => {
                        const nextDept = e.target.value;
                        setItemDeptId(nextDept);
                        const matchingLabs = labs.filter((l) => l.departmentId === nextDept);
                        setItemLabId(matchingLabs[0]?.id ?? '');
                      }}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.departmentId)}
                      aria-describedby={fieldErrors.departmentId ? 'err-item-dept' : undefined}
                      className="notebook-input mt-1"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.departmentId && (
                      <p id="err-item-dept" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.departmentId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="manage-item-lab" className="block text-sm font-bold text-[var(--ink)]">
                      Laboratory (required)
                    </label>
                    <select
                      id="manage-item-lab"
                      value={itemLabId}
                      onChange={(e) => setItemLabId(e.target.value)}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.labId)}
                      aria-describedby={fieldErrors.labId ? 'err-item-lab' : undefined}
                      className="notebook-input mt-1"
                    >
                      {labs
                        .filter((l) => l.departmentId === itemDeptId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.room})
                          </option>
                        ))}
                    </select>
                    {fieldErrors.labId && (
                      <p id="err-item-lab" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.labId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="manage-item-type" className="block text-sm font-bold text-[var(--ink)]">
                      Type
                    </label>
                    <select
                      id="manage-item-type"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value as EquipmentType)}
                      aria-invalid={Boolean(fieldErrors.type)}
                      aria-describedby={fieldErrors.type ? 'err-item-type' : undefined}
                      className="notebook-input mt-1"
                    >
                      {EQUIPMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="manage-item-status" className="block text-sm font-bold text-[var(--ink)]">
                      Status
                    </label>
                    <select
                      id="manage-item-status"
                      value={itemStatus}
                      onChange={(e) => setItemStatus(e.target.value as AvailabilityStatus)}
                      className="notebook-input mt-1"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="manage-item-access" className="block text-sm font-bold text-[var(--ink)]">
                      Access level
                    </label>
                    <select
                      id="manage-item-access"
                      value={itemAccess}
                      onChange={(e) => setItemAccess(e.target.value as AccessLevel)}
                      className="notebook-input mt-1"
                    >
                      {ACCESS_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="manage-item-location" className="block text-sm font-bold text-[var(--ink)]">
                    Bench location (required)
                  </label>
                  <input
                    id="manage-item-location"
                    type="text"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    placeholder="e.g., SHN-204 · Bench C"
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.location)}
                    aria-describedby={fieldErrors.location ? 'err-item-location' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.location && (
                    <p id="err-item-location" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.location}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="manage-item-specs" className="block text-sm font-bold text-[var(--ink)]">
                    Specifications (up to 200 characters)
                  </label>
                  <textarea
                    id="manage-item-specs"
                    rows={2}
                    value={itemSpecs}
                    onChange={(e) => setItemSpecs(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.specs)}
                    aria-describedby={fieldErrors.specs ? 'err-item-specs' : undefined}
                    className="notebook-input mt-1"
                  />
                  {fieldErrors.specs && (
                    <p id="err-item-specs" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.specs}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="labora-btn labora-btn-paper text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="labora-btn text-sm">
                    {modal.mode === 'add' ? 'Create Equipment' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* ADD SLOTS FORM */}
            {modal.kind === 'slots' && (
              <form onSubmit={handleSlotsSubmit} noValidate className="mt-4 space-y-3">
                <p className="text-sm text-[var(--ink)]">
                  Equipment: <strong>{items.find((i) => i.id === modal.itemId)?.name}</strong>
                </p>

                <div>
                  <label htmlFor="manage-slot-date" className="block text-sm font-bold text-[var(--ink)]">
                    Date (required, Mon–Sat, {DEFAULT_REFERENCE_DATE} or later)
                  </label>
                  <input
                    id="manage-slot-date"
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.date)}
                    aria-describedby={fieldErrors.date ? 'err-slot-date' : undefined}
                    className="notebook-input mt-1 tabular-nums"
                  />
                  {fieldErrors.date && (
                    <p id="err-slot-date" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {fieldErrors.date}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="manage-slot-start" className="block text-sm font-bold text-[var(--ink)]">
                      Start time (required)
                    </label>
                    <select
                      id="manage-slot-start"
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.startTime)}
                      aria-describedby={fieldErrors.startTime ? 'err-slot-start' : undefined}
                      className="notebook-input mt-1 tabular-nums"
                    >
                      {START_HOURS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.startTime && (
                      <p id="err-slot-start" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.startTime}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="manage-slot-end" className="block text-sm font-bold text-[var(--ink)]">
                      End time (required)
                    </label>
                    <select
                      id="manage-slot-end"
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.endTime)}
                      aria-describedby={fieldErrors.endTime ? 'err-slot-end' : undefined}
                      className="notebook-input mt-1 tabular-nums"
                    >
                      {END_HOURS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.endTime && (
                      <p id="err-slot-end" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {fieldErrors.endTime}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="labora-btn labora-btn-paper text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="labora-btn text-sm">
                    Create Hourly Slots
                  </button>
                </div>
              </form>
            )}

            {/* SAFE DELETE CONFIRMATION */}
            {modal.kind === 'delete' && (
              <div className="mt-4 space-y-4">
                <p id="manage-delete-desc" className="text-base text-[var(--ink)]">
                  You are about to remove{' '}
                  <strong>
                    {modal.entityType}: {modal.entityName}
                  </strong>
                  .
                </p>

                {modal.dependents.totalCount > 0 ? (
                  <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-limited-bg)] p-3.5 text-sm text-[var(--ink)]">
                    <p className="font-bold">
                      Active dependent records reference this {modal.entityType}:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {modal.dependents.childLabs.map((l) => (
                        <li key={l.id}>Laboratory: {l.name} ({l.room})</li>
                      ))}
                      {modal.dependents.childItems.map((i) => (
                        <li key={i.id}>Equipment: {i.name}</li>
                      ))}
                      {modal.dependents.activeBookings.map((b) => (
                        <li key={b.id}>
                          Active booking: {b.date} {b.window} ({b.bookedBy ?? 'Student'})
                        </li>
                      ))}
                      {modal.dependents.affectedRequests.map((r) => (
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
                  <button
                    type="button"
                    onClick={closeModal}
                    className="labora-btn labora-btn-paper text-sm"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="labora-btn !bg-[var(--status-booked-bg)] text-sm"
                  >
                    {modal.dependents.totalCount > 0
                      ? 'Cancel affected bookings and delete'
                      : 'Confirm delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
