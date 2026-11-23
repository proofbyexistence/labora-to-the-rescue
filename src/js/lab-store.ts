/**
 * In-memory catalog store, debounced localStorage persistence, and role/state lifecycle.
 */
import seedData from '../data/labs.json';
import type { CatalogMutationResult, CatalogSnapshot } from './catalog-admin';
import { ROLES, STORAGE_KEYS } from './constants';
import {
  clearCorruptStorage,
  readPersistedState,
  resolveStorage,
  type PersistedState,
  type StorageLike,
} from './storage-guard';
import type { ActionResult, CampusUser, EquipmentItem, LabDataset, TimeSlot, UserRole } from './types';

const DEFAULT_SLOT_WINDOWS = [
  { dayOffset: 0, window: '14:00 – 16:00', durationHours: 2 },
  { dayOffset: 0, window: '16:30 – 18:30', durationHours: 2 },
  { dayOffset: 1, window: '09:30 – 11:30', durationHours: 2 },
  { dayOffset: 1, window: '13:30 – 15:30', durationHours: 2 },
];

function cloneDataset(): LabDataset {
  return JSON.parse(JSON.stringify(seedData)) as LabDataset;
}

function buildDateString(dayOffset: number): string {
  const base = new Date('2026-11-23T00:00:00');
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().slice(0, 10);
}

// Generate deterministic fallback slots for items without seed slots so all items can be booked.
function ensureSlotsForAllItems(items: EquipmentItem[], seedSlots: TimeSlot[]): TimeSlot[] {
  const itemsWithSlots = new Set(seedSlots.map((slot) => slot.itemId));
  const combined: TimeSlot[] = [...seedSlots];
  for (const item of items) {
    if (itemsWithSlots.has(item.id)) continue;
    DEFAULT_SLOT_WINDOWS.forEach((tpl, idx) => {
      const isBooked = item.status === 'Booked' || (item.status === 'Limited' && idx < 2);
      combined.push({
        id: `sl-auto-${item.id}-${idx + 1}`,
        itemId: item.id,
        date: buildDateString(tpl.dayOffset),
        window: tpl.window,
        durationHours: tpl.durationHours,
        booked: isBooked,
        bookedBy: isBooked ? 'Assigned Lab Cohort' : null,
        note: isBooked ? 'Reserved coursework session' : '',
      });
    });
  }
  return combined;
}

function loadInitialState(storageOverride?: StorageLike | null): {
  dataset: LabDataset;
  activeRole: UserRole;
  loadedFromStorage: boolean;
} {
  const base = cloneDataset();
  base.slots = ensureSlotsForAllItems(base.items, base.slots);
  const loaded = readPersistedState(storageOverride);
  if (!loaded.ok) {
    return { dataset: base, activeRole: ROLES.STUDENT, loadedFromStorage: false };
  }
  base.departments = loaded.value.departments;
  base.labs = loaded.value.labs;
  base.items = loaded.value.items;
  base.slots = loaded.value.slots;
  base.requests = loaded.value.requests;
  return { dataset: base, activeRole: loaded.value.activeRole, loadedFromStorage: true };
}

const initialLoaded = loadInitialState();
let state: { dataset: LabDataset; activeRole: UserRole } = {
  dataset: initialLoaded.dataset,
  activeRole: initialLoaded.activeRole,
};
let stateVersion = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistListenersRegistered = false;

/**
 * Returns the internal mutable store handle for query and mutation modules.
 *
 * @returns Current dataset and active role handle.
 */
export function getStoreState(): { dataset: LabDataset; activeRole: UserRole } {
  return state;
}

/**
 * Returns the monotonic state change counter used to coordinate UI re-renders.
 *
 * @returns Integer state version.
 */
export function getStateVersion(): number {
  return stateVersion;
}

/**
 * Reloads store state from injected or browser storage, falling back to clean seed data.
 *
 * @param storageOverride - Optional storage override for deterministic testing.
 * @returns Active role and whether state was hydrated from storage.
 */
export function reloadLabStore(storageOverride?: StorageLike | null): {
  activeRole: UserRole;
  loadedFromStorage: boolean;
} {
  stateVersion += 1;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const loaded = loadInitialState(storageOverride);
  state = { dataset: loaded.dataset, activeRole: loaded.activeRole };
  return { activeRole: loaded.activeRole, loadedFromStorage: loaded.loadedFromStorage };
}

/**
 * Synchronously writes in-memory notebook state to storage when available.
 *
 * @param storageOverride - Optional storage override.
 * @returns Result indicating whether storage persistence succeeded.
 */
export function flushPersistedState(storageOverride?: StorageLike | null): ActionResult<void> {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const storage = resolveStorage(storageOverride);
    if (!storage) return { ok: false, error: 'Storage is unavailable.' };
    const payload: PersistedState = {
      departments: state.dataset.departments,
      labs: state.dataset.labs,
      items: state.dataset.items,
      slots: state.dataset.slots,
      requests: state.dataset.requests,
      activeRole: state.activeRole,
    };
    storage.setItem(STORAGE_KEYS.NOTEBOOK_STATE, JSON.stringify(payload));
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage write failed.' };
  }
}

function registerFlushListeners(): void {
  if (persistListenersRegistered || typeof window === 'undefined') return;
  persistListenersRegistered = true;
  window.addEventListener('pagehide', () => {
    flushPersistedState();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && persistTimer !== null) flushPersistedState();
    });
  }
}

/**
 * Increments store version and schedules debounced localStorage persistence.
 */
export function persistState(): void {
  stateVersion += 1;
  if (typeof window === 'undefined') return;
  registerFlushListeners();
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistedState();
  }, 150);
}

/**
 * Switches active demo role (`student` vs `faculty`) and schedules persistence.
 *
 * @param role - Target role to activate.
 * @returns Updated active user profile copy.
 */
export function switchUserRole(role: UserRole): CampusUser {
  state.activeRole = role === ROLES.FACULTY ? ROLES.FACULTY : ROLES.STUDENT;
  persistState();
  return { ...state.dataset.users[state.activeRole] };
}

/**
 * Builds a pure snapshot passed into catalog admin helpers.
 *
 * @returns Current catalog arrays snapshot.
 */
export function getCatalogSnapshot(): CatalogSnapshot {
  return {
    departments: state.dataset.departments,
    labs: state.dataset.labs,
    items: state.dataset.items,
    slots: state.dataset.slots,
    requests: state.dataset.requests,
  };
}

/**
 * Commits successful pure catalog admin mutation state and schedules persistence.
 *
 * @param result - Mutation result produced by a catalog admin helper.
 * @returns Unmodified `result` for chaining back to UI callers.
 */
export function commitCatalogResult<T>(
  result: CatalogMutationResult<T>
): CatalogMutationResult<T> {
  if (result.ok && result.nextState) {
    state.dataset.departments = result.nextState.departments;
    state.dataset.labs = result.nextState.labs;
    state.dataset.items = result.nextState.items;
    state.dataset.slots = result.nextState.slots;
    state.dataset.requests = result.nextState.requests;
    persistState();
  }
  return result;
}

/**
 * Resets store state cleanly to initial seed defaults and clears saved storage.
 */
export function resetLabStore(): void {
  stateVersion += 1;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const base = cloneDataset();
  base.slots = ensureSlotsForAllItems(base.items, base.slots);
  state = { dataset: base, activeRole: ROLES.STUDENT };
  clearCorruptStorage();
}
