/**
 * Role-guarded pure catalog CRUD operations and cascade-safe dependent deletion facade.
 */
export { addDepartment, deleteDepartment, editDepartment } from './catalog-admin-departments';
export { getDependents } from './catalog-admin-dependents';
export { deriveNextFreeSlot } from './catalog-admin-helpers';
export { addItem, deleteItem, editItem } from './catalog-admin-items';
export { addLab, deleteLab, editLab } from './catalog-admin-labs';
export { addSlots, deleteSlot } from './catalog-admin-slots';
export type {
  AddSlotsInput,
  CatalogMutationResult,
  CatalogSnapshot,
  DeleteOption,
  DepartmentInput,
  DependentReport,
  EquipmentInput,
  LabInput,
} from './catalog-admin-types';
