/**
 * Browser catalog state store facade unifying hydration, queries, and persisted mutations.
 */
export {
  applyAllocationSuggestion,
  cancelSlotBooking,
  createCustomBooking,
} from './lab-booking-mutations';
export {
  getAllSlots,
  getCurrentUser,
  getDepartments,
  getItemById,
  getItems,
  getLabs,
  getRequests,
  getSlots,
} from './lab-queries';
export {
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
  reviewAccessRequest,
  submitAccessRequest,
  transitionAccessRequest,
} from './lab-request-mutations';
export {
  flushPersistedState,
  getStateVersion,
  reloadLabStore,
  resetLabStore,
  switchUserRole,
} from './lab-store';
export { validatePersistedState, type StorageLike } from './storage-guard';
