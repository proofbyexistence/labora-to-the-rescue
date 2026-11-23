/**
 * Faculty catalog management workspace UI coordinating Subjects, Equipment, Slots tabs, and modals.
 */
import {
  getAllSlots,
  getDepartments,
  getItems,
  getLabs,
} from '../js/lab-data';
import { CatalogModalHost } from './manage/CatalogModalHost';
import { EquipmentInventoryTab } from './manage/EquipmentInventoryTab';
import { SlotsManageTab } from './manage/SlotsManageTab';
import { SubjectsLabsTab } from './manage/SubjectsLabsTab';
import type { ManageTabId } from './manage/types';
import { useCatalogManage } from './manage/use-catalog-manage';

export type { ManageTabId };

interface CatalogManagePanelProps {
  activeTab: ManageTabId;
  onNotify: (kind: 'success' | 'error', message: string) => void;
  onDataMutated: () => void;
}

/**
 * Coordinates catalog CRUD tabs and modal dialogs for subjects, labs, equipment, and slots.
 *
 * @param props - Active management tab, notification toast handler, and refresh callback.
 * @returns Active tab view and modal host for faculty catalog administration.
 */
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

  const manage = useCatalogManage({ departments, labs, onNotify, onDataMutated });

  return (
    <div className="space-y-5">
      {activeTab === 'subjects' && (
        <SubjectsLabsTab
          departments={departments}
          labs={labs}
          items={items}
          onOpenDeptModal={manage.openDeptModal}
          onOpenLabModal={manage.openLabModal}
          onOpenDeleteModal={manage.openDeleteModal}
        />
      )}
      {activeTab === 'equipment' && (
        <EquipmentInventoryTab
          departments={departments}
          labs={labs}
          items={items}
          deptMap={deptMap}
          labMap={labMap}
          onOpenItemModal={manage.openItemModal}
          onOpenDeleteModal={manage.openDeleteModal}
        />
      )}
      {activeTab === 'slots' && (
        <SlotsManageTab
          departments={departments}
          items={items}
          allSlots={allSlots}
          labMap={labMap}
          onOpenSlotsModal={manage.openSlotsModal}
          onDeleteFreeSlot={manage.handleDeleteFreeSlot}
          onOpenDeleteBookedSlot={(slot, btn) =>
            manage.openDeleteModal('slot', slot.id, `${slot.date} ${slot.window}`, btn)
          }
        />
      )}

      <CatalogModalHost
        modal={manage.modal}
        departments={departments}
        labs={labs}
        items={items}
        deptForm={manage.deptForm}
        labForm={manage.labForm}
        itemForm={manage.itemForm}
        slotsForm={manage.slotsForm}
        fieldErrors={manage.fieldErrors}
        formBannerError={manage.formBannerError}
        onDeptChange={manage.setDeptForm}
        onLabChange={manage.setLabForm}
        onItemChange={manage.setItemForm}
        onSlotsChange={manage.setSlotsForm}
        onClose={manage.closeModal}
        onDeptSubmit={manage.handleDeptSubmit}
        onLabSubmit={manage.handleLabSubmit}
        onItemSubmit={manage.handleItemSubmit}
        onSlotsSubmit={manage.handleSlotsSubmit}
        onConfirmDelete={manage.handleConfirmDelete}
      />
    </div>
  );
}
