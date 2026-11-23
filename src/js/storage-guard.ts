/**
 * Schema validation and restricted-storage guards for persisted localStorage payloads.
 */
import { ROLES, STORAGE_KEYS } from './constants';
import {
  isValidPersistedDepartment,
  isValidPersistedItem,
  isValidPersistedLab,
  isValidPersistedRequest,
  isValidPersistedSlot,
  normalizePersistedRequest,
} from './storage-validators';
import type {
  ActionResult,
  Department,
  EquipmentItem,
  Lab,
  TimeSlot,
  UserRole,
  AccessRequest,
} from './types';

export interface PersistedState {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  slots: TimeSlot[];
  requests: AccessRequest[];
  activeRole: UserRole;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Resolves either an injected storage override or browser `window.localStorage` safely.
 *
 * @param storageOverride - Optional test mock or explicit `null`.
 * @returns Accessible storage adapter or null when unavailable/blocked.
 */
export function resolveStorage(storageOverride?: StorageLike | null): StorageLike | null {
  if (storageOverride !== undefined) return storageOverride;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (err) {
    void err;
    return null;
  }
  return null;
}

/**
 * Removes malformed or oversized persisted notebook payloads safely.
 *
 * @param storageOverride - Optional storage override.
 * @returns `{ ok: true }` on clear or `{ ok: false, error }` if storage throws.
 */
export function clearCorruptStorage(storageOverride?: StorageLike | null): ActionResult<void> {
  try {
    const storage = resolveStorage(storageOverride);
    storage?.removeItem(STORAGE_KEYS.NOTEBOOK_STATE);
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage clear failed.' };
  }
}

/**
 * Validates and migrates a parsed browser storage payload before state hydration.
 *
 * @param raw - Unknown parsed JSON payload.
 * @returns Validated `PersistedState` object, or null when schema/foreign-key checks fail.
 */
export function validatePersistedState(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<PersistedState>;
  const hasArrays =
    Array.isArray(parsed.departments) &&
    Array.isArray(parsed.labs) &&
    Array.isArray(parsed.items) &&
    Array.isArray(parsed.slots) &&
    Array.isArray(parsed.requests);
  if (!hasArrays) return null;

  if (!parsed.departments!.every(isValidPersistedDepartment)) return null;
  const deptIds = new Set(parsed.departments!.map((d) => d.id));
  if (!parsed.labs!.every((l) => isValidPersistedLab(l, deptIds))) return null;
  const labIds = new Set(parsed.labs!.map((l) => l.id));
  if (!parsed.items!.every((i) => isValidPersistedItem(i, deptIds, labIds))) return null;
  const itemIds = new Set(parsed.items!.map((i) => i.id));
  if (!parsed.slots!.every((s) => isValidPersistedSlot(s, itemIds))) return null;
  if (!parsed.requests!.every((r) => isValidPersistedRequest(r, deptIds, itemIds))) return null;

  if (parsed.activeRole !== ROLES.FACULTY && parsed.activeRole !== ROLES.STUDENT) return null;
  return {
    departments: parsed.departments!,
    labs: parsed.labs!,
    items: parsed.items!,
    slots: parsed.slots!,
    requests: parsed.requests!.map(normalizePersistedRequest),
    activeRole: parsed.activeRole,
  };
}

/**
 * Attempts to read and validate persisted state from browser or injected storage.
 *
 * @param storageOverride - Optional storage override.
 * @returns Consistent `{ ok, value | error }` wrapper for storage hydration.
 */
export function readPersistedState(
  storageOverride?: StorageLike | null
): ActionResult<PersistedState> {
  try {
    const storage = resolveStorage(storageOverride);
    if (!storage) return { ok: false, error: 'Storage is unavailable.' };
    const raw = storage.getItem(STORAGE_KEYS.NOTEBOOK_STATE);
    if (!raw) return { ok: false, error: 'No persisted state stored.' };
    if (raw.length > 500_000) {
      clearCorruptStorage(storage);
      return { ok: false, error: 'Persisted state exceeded maximum size.' };
    }
    const validated = validatePersistedState(JSON.parse(raw) as unknown);
    if (!validated) {
      clearCorruptStorage(storage);
      return { ok: false, error: 'Persisted state failed schema validation.' };
    }
    return { ok: true, value: validated };
  } catch (err) {
    clearCorruptStorage(storageOverride);
    return { ok: false, error: err instanceof Error ? err.message : 'Storage read failed.' };
  }
}
