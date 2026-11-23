/**
 * Accessible focus-trapped dialog shell hosting catalog add, edit, slot, and delete views.
 */
import { useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useDialogFocusTrap } from '../../js/dialog-focus-trap';
import type { Department, EquipmentItem, Lab } from '../../js/types';
import { AddSlotsForm } from './AddSlotsForm';
import { ConfirmDeleteView } from './ConfirmDeleteView';
import { DepartmentForm } from './DepartmentForm';
import { EquipmentItemForm } from './EquipmentItemForm';
import { LabForm } from './LabForm';
import type {
  ActiveModal,
  DeptFormState,
  ItemFormState,
  LabFormState,
  SlotsFormState,
} from './types';

interface CatalogModalHostProps {
  modal: ActiveModal | null;
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  deptForm: DeptFormState;
  labForm: LabFormState;
  itemForm: ItemFormState;
  slotsForm: SlotsFormState;
  fieldErrors: Record<string, string>;
  formBannerError: string;
  onDeptChange: (next: DeptFormState) => void;
  onLabChange: (next: LabFormState) => void;
  onItemChange: (next: ItemFormState) => void;
  onSlotsChange: (next: SlotsFormState) => void;
  onClose: () => void;
  onDeptSubmit: (e: FormEvent) => void;
  onLabSubmit: (e: FormEvent) => void;
  onItemSubmit: (e: FormEvent) => void;
  onSlotsSubmit: (e: FormEvent) => void;
  onConfirmDelete: () => void;
}

function getModalTitle(modal: ActiveModal): string {
  if (modal.kind === 'dept') {
    return modal.mode === 'add' ? 'Add Subject / Department' : 'Edit Subject / Department';
  }
  if (modal.kind === 'lab') {
    return modal.mode === 'add' ? 'Add Laboratory' : 'Edit Laboratory';
  }
  if (modal.kind === 'item') {
    return modal.mode === 'add' ? 'Add Equipment Item' : 'Edit Equipment Item';
  }
  if (modal.kind === 'slots') return 'Add One-Hour Slots';
  return `Confirm Deletion: ${modal.entityName}`;
}

/**
 * Renders the modal overlay for catalog management forms and deletion confirmations.
 *
 * @param props - Active modal descriptor, controlled form slices, errors, and submit handlers.
 * @returns Focus-trapped dialog backdrop or null when closed.
 */
export function CatalogModalHost({
  modal,
  departments,
  labs,
  items,
  deptForm,
  labForm,
  itemForm,
  slotsForm,
  fieldErrors,
  formBannerError,
  onDeptChange,
  onLabChange,
  onItemChange,
  onSlotsChange,
  onClose,
  onDeptSubmit,
  onLabSubmit,
  onItemSubmit,
  onSlotsSubmit,
  onConfirmDelete,
}: CatalogModalHostProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(Boolean(modal), dialogRef, onClose, {
    focusableSelector:
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]',
  });

  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          <h2 id="manage-dialog-title" className="text-2xl font-bold text-[var(--ink)]">
            {getModalTitle(modal)}
          </h2>
          <button
            type="button"
            onClick={onClose}
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

        {modal.kind === 'dept' && (
          <DepartmentForm
            mode={modal.mode}
            values={deptForm}
            fieldErrors={fieldErrors}
            onChange={onDeptChange}
            onCancel={onClose}
            onSubmit={onDeptSubmit}
          />
        )}
        {modal.kind === 'lab' && (
          <LabForm
            mode={modal.mode}
            departments={departments}
            values={labForm}
            fieldErrors={fieldErrors}
            onChange={onLabChange}
            onCancel={onClose}
            onSubmit={onLabSubmit}
          />
        )}
        {modal.kind === 'item' && (
          <EquipmentItemForm
            mode={modal.mode}
            departments={departments}
            labs={labs}
            values={itemForm}
            fieldErrors={fieldErrors}
            onChange={onItemChange}
            onCancel={onClose}
            onSubmit={onItemSubmit}
          />
        )}
        {modal.kind === 'slots' && (
          <AddSlotsForm
            itemName={items.find((i) => i.id === modal.itemId)?.name ?? ''}
            values={slotsForm}
            fieldErrors={fieldErrors}
            onChange={onSlotsChange}
            onCancel={onClose}
            onSubmit={onSlotsSubmit}
          />
        )}
        {modal.kind === 'delete' && (
          <ConfirmDeleteView
            entityType={modal.entityType}
            entityName={modal.entityName}
            dependents={modal.dependents}
            onCancel={onClose}
            onConfirm={onConfirmDelete}
          />
        )}
      </div>
    </div>
  );
}
