/**
 * State hook managing modal forms, validation feedback, and catalog CRUD handlers.
 */
import { useRef, useState, type FormEvent } from 'react';
import type { CatalogMutationResult } from '../../js/catalog-admin';
import { ACCESS_LEVELS, AVAILABILITY_STATUSES, EQUIPMENT_TYPES } from '../../js/constants';
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
  getEntityDependents,
} from '../../js/lab-data';
import type { Department, EquipmentItem, Lab, TimeSlot } from '../../js/types';
import {
  DEPT_FIELD_IDS,
  EMPTY_DEPT,
  EMPTY_ITEM,
  EMPTY_LAB,
  EMPTY_SLOTS,
  focusFirstErrorField,
  ITEM_FIELD_IDS,
  LAB_FIELD_IDS,
  SLOT_FIELD_IDS,
} from './catalog-manage-defaults';
import type {
  ActiveModal,
  DeptFormState,
  ItemFormState,
  LabFormState,
  SlotsFormState,
} from './types';

/**
 * Encapsulates modal state, form inputs, and CRUD mutation callbacks for CatalogManagePanel.
 *
 * @param params - Departments, labs, notification handler, and data refresh callback.
 * @returns Modal state, form states, setters, and submit/delete callbacks.
 */
export function useCatalogManage({
  departments,
  labs,
  onNotify,
  onDataMutated,
}: {
  departments: Department[];
  labs: Lab[];
  onNotify: (kind: 'success' | 'error', message: string) => void;
  onDataMutated: () => void;
}) {
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formBannerError, setFormBannerError] = useState('');
  const [deptForm, setDeptForm] = useState<DeptFormState>(EMPTY_DEPT);
  const [labForm, setLabForm] = useState<LabFormState>(EMPTY_LAB);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM);
  const [slotsForm, setSlotsForm] = useState<SlotsFormState>(EMPTY_SLOTS);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeModal = () => {
    setModal(null);
    setFieldErrors({});
    setFormBannerError('');
    window.requestAnimationFrame(() => triggerBtnRef.current?.focus());
  };

  const applyFeedback = <T,>(
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
    closeModal();
    onNotify('success', successMsg);
    onDataMutated();
    return true;
  };

  const prepareOpen = (trigger: HTMLButtonElement) => {
    triggerBtnRef.current = trigger;
    setFieldErrors({});
    setFormBannerError('');
  };

  const openDeptModal = (mode: 'add' | 'edit', trigger: HTMLButtonElement, dept?: Department) => {
    prepareOpen(trigger);
    setDeptForm({
      name: dept?.name ?? '',
      code: dept?.code ?? '',
      building: dept?.building ?? '',
      leadFaculty: dept?.leadFaculty ?? '',
      summary: dept?.summary ?? '',
    });
    setModal({ kind: 'dept', mode, dept });
  };

  const openLabModal = (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    options?: { defaultDeptId?: string; lab?: Lab }
  ) => {
    prepareOpen(trigger);
    const lab = options?.lab;
    setLabForm({
      departmentId: lab?.departmentId ?? options?.defaultDeptId ?? departments[0]?.id ?? '',
      name: lab?.name ?? '',
      room: lab?.room ?? '',
      supervisor: lab?.supervisor ?? '',
      hours: lab?.hours ?? '09:00 – 17:00',
      description: lab?.description ?? '',
    });
    setModal({ kind: 'lab', mode, defaultDeptId: options?.defaultDeptId, lab });
  };

  const openItemModal = (mode: 'add' | 'edit', trigger: HTMLButtonElement, item?: EquipmentItem) => {
    prepareOpen(trigger);
    const fallbackDept = item?.departmentId ?? departments[0]?.id ?? '';
    const deptLabs = labs.filter((l) => l.departmentId === fallbackDept);
    setItemForm({
      name: item?.name ?? '',
      departmentId: fallbackDept,
      labId: item?.labId ?? deptLabs[0]?.id ?? '',
      type: item?.type ?? EQUIPMENT_TYPES[0],
      location: item?.location ?? '',
      status: item?.status ?? AVAILABILITY_STATUSES[0],
      accessLevel: item?.accessLevel ?? ACCESS_LEVELS[0],
      specs: item?.specs ?? '',
    });
    setModal({ kind: 'item', mode, item });
  };

  const openSlotsModal = (itemId: string, trigger: HTMLButtonElement) => {
    prepareOpen(trigger);
    setSlotsForm(EMPTY_SLOTS);
    setModal({ kind: 'slots', itemId });
  };

  const openDeleteModal = (
    entityType: 'department' | 'lab' | 'item' | 'slot',
    entityId: string,
    entityName: string,
    trigger: HTMLButtonElement
  ) => {
    prepareOpen(trigger);
    const dependents = getEntityDependents({ type: entityType, id: entityId });
    setModal({ kind: 'delete', entityType, entityId, entityName, dependents });
  };

  const handleDeptSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'dept') return;
    const res =
      modal.mode === 'add' ? adminAddDepartment(deptForm) : adminEditDepartment(modal.dept!.id, deptForm);
    applyFeedback(res, `${modal.mode === 'add' ? 'Added' : 'Updated'} subject "${deptForm.name.trim()}".`, DEPT_FIELD_IDS);
  };

  const handleLabSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'lab') return;
    const res = modal.mode === 'add' ? adminAddLab(labForm) : adminEditLab(modal.lab!.id, labForm);
    applyFeedback(res, `${modal.mode === 'add' ? 'Added' : 'Updated'} laboratory "${labForm.name.trim()}".`, LAB_FIELD_IDS);
  };

  const handleItemSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'item') return;
    const res = modal.mode === 'add' ? adminAddItem(itemForm) : adminEditItem(modal.item!.id, itemForm);
    applyFeedback(res, `${modal.mode === 'add' ? 'Added' : 'Updated'} equipment "${itemForm.name.trim()}".`, ITEM_FIELD_IDS);
  };

  const handleSlotsSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (modal?.kind !== 'slots') return;
    const res = adminAddSlots({ itemId: modal.itemId, ...slotsForm });
    const count = res.data?.length ?? 0;
    applyFeedback(res, `Created ${count} one-hour slot${count === 1 ? '' : 's'} on ${slotsForm.date}.`, SLOT_FIELD_IDS);
  };

  const handleConfirmDelete = () => {
    if (modal?.kind !== 'delete') return;
    const option = modal.dependents.totalCount > 0 ? 'cancelAffected' : undefined;
    const deleteFn = { department: adminDeleteDepartment, lab: adminDeleteLab, item: adminDeleteItem, slot: adminDeleteSlot }[modal.entityType];
    const result = deleteFn(modal.entityId, option);
    if (!result.ok) {
      setFormBannerError(result.error ?? 'Deletion blocked.');
      onNotify('error', result.error ?? 'Deletion blocked.');
      return;
    }
    const msg = modal.dependents.totalCount > 0
      ? `Removed "${modal.entityName}" and resolved ${modal.dependents.totalCount} dependent record(s).`
      : `Removed "${modal.entityName}" from the catalog.`;
    closeModal();
    onNotify('success', msg);
    onDataMutated();
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

  return {
    modal, fieldErrors, formBannerError, deptForm, labForm, itemForm, slotsForm,
    setDeptForm, setLabForm, setItemForm, setSlotsForm,
    closeModal, openDeptModal, openLabModal, openItemModal, openSlotsModal, openDeleteModal,
    handleDeptSubmit, handleLabSubmit, handleItemSubmit, handleSlotsSubmit,
    handleConfirmDelete, handleDeleteFreeSlot,
  };
}
