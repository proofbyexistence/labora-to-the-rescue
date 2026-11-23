import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flushPersistedState,
  getCurrentUser,
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getAllSlots,
  reloadLabStore,
  resetLabStore,
  switchUserRole,
  validatePersistedState,
} from '../src/js/lab-data.ts';
import { LIMITS, ROLES, STORAGE_KEYS } from '../src/js/constants.ts';
import {
  applyTheme,
  getInitialTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from '../src/js/theme.ts';
import { createMemoryStorage, createThrowingStorage } from './helpers.js';

const STORAGE_KEY = STORAGE_KEYS.NOTEBOOK_STATE;

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

function restoreGlobals() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
  } else {
    delete globalThis.document;
  }
}

afterEach(() => {
  restoreGlobals();
  resetLabStore();
});

describe('validatePersistedState schema guard', () => {
  it('accepts a valid persisted state and migrates legacy request statuses', () => {
    resetLabStore();
    const valid = {
      departments: getDepartments(),
      labs: getLabs(),
      items: getItems(),
      slots: getAllSlots(),
      requests: getRequests().map((r, idx) =>
        idx === 0 ? { ...r, status: 'Pending' } : r
      ),
      activeRole: ROLES.FACULTY,
    };

    const result = validatePersistedState(valid);
    assert.ok(result);
    assert.equal(result.activeRole, ROLES.FACULTY);
    assert.equal(result.requests[0].status, 'Submitted');
  });

  it('rejects null, non-objects, missing arrays, invalid roles, and tampered foreign keys or enums', () => {
    resetLabStore();
    const base = {
      departments: getDepartments(),
      labs: getLabs(),
      items: getItems(),
      slots: getAllSlots(),
      requests: getRequests(),
      activeRole: ROLES.STUDENT,
    };

    assert.equal(validatePersistedState(null), null);
    assert.equal(validatePersistedState([]), null);
    assert.equal(validatePersistedState({ ...base, items: 'not-an-array' }), null);
    assert.equal(validatePersistedState({ ...base, activeRole: 'superuser' }), null);
    assert.equal(
      validatePersistedState({
        ...base,
        items: [{ ...base.items[0], labId: 'lab-nonexistent' }],
      }),
      null
    );
    assert.equal(
      validatePersistedState({
        ...base,
        items: [{ ...base.items[0], type: 'Hazardous' }],
      }),
      null
    );
    assert.equal(
      validatePersistedState({
        ...base,
        slots: [{ ...base.slots[0], durationHours: 99 }],
      }),
      null
    );
    assert.equal(
      validatePersistedState({
        ...base,
        requests: [{ ...base.requests[0], deadline: 'not-a-date' }],
      }),
      null
    );
  });
});

describe('labData storage hydration and fallback', () => {
  it('discards corrupted JSON in localStorage, clears the bad entry, and restores seed data', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{broken-json' });
    const status = reloadLabStore(storage);

    assert.equal(status.loadedFromStorage, false);
    assert.equal(status.activeRole, ROLES.STUDENT);
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.equal(getDepartments().length, 7);
    assert.equal(getItems().length, 43);
  });

  it('discards tampered or oversized storage payloads and falls back to seed data', () => {
    resetLabStore();
    const tampered = JSON.stringify({
      departments: getDepartments(),
      labs: getLabs(),
      items: getItems(),
      slots: getAllSlots(),
      requests: getRequests(),
      activeRole: 'root',
    });
    const storage = createMemoryStorage({ [STORAGE_KEY]: tampered });

    const status = reloadLabStore(storage);
    assert.equal(status.loadedFromStorage, false);
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.equal(getCurrentUser().role, ROLES.STUDENT);

    const oversized = createMemoryStorage({
      [STORAGE_KEY]: 'x'.repeat(LIMITS.STORAGE_MAX_BYTES + 1),
    });
    const bigStatus = reloadLabStore(oversized);
    assert.equal(bigStatus.loadedFromStorage, false);
    assert.equal(oversized.getItem(STORAGE_KEY), null);
  });

  it('hydrates valid persisted state cleanly from storage', () => {
    resetLabStore();
    switchUserRole(ROLES.FACULTY);
    const storage = createMemoryStorage();
    flushPersistedState(storage);

    switchUserRole(ROLES.STUDENT);
    assert.equal(getCurrentUser().role, ROLES.STUDENT);

    const status = reloadLabStore(storage);
    assert.equal(status.loadedFromStorage, true);
    assert.equal(status.activeRole, ROLES.FACULTY);
    assert.equal(getCurrentUser().role, ROLES.FACULTY);
  });

  it('falls back to in-memory state without throwing when storage access throws', () => {
    const blocked = createThrowingStorage('SecurityError: storage disabled');

    const status = reloadLabStore(blocked);
    assert.equal(status.loadedFromStorage, false);
    assert.equal(getDepartments().length, 7);

    const switched = switchUserRole(ROLES.FACULTY);
    assert.equal(switched.role, ROLES.FACULTY);
    flushPersistedState(blocked);
    assert.equal(getCurrentUser().role, ROLES.FACULTY);
  });
});

describe('theme storage resilience', () => {
  it('reads and writes theme preference when storage works and falls back gracefully when storage is blocked', () => {
    const storage = createMemoryStorage({ [THEME_STORAGE_KEY]: 'dark' });
    let appliedAttr = null;
    globalThis.window = {
      localStorage: storage,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    };
    globalThis.document = {
      documentElement: {
        getAttribute: () => appliedAttr,
        setAttribute: (_k, v) => {
          appliedAttr = v;
        },
      },
    };

    assert.equal(getInitialTheme(), 'dark');
    applyTheme('dark');
    assert.equal(appliedAttr, 'dark');
    saveTheme('light');
    assert.equal(storage.getItem(THEME_STORAGE_KEY), 'light');

    globalThis.window = {
      localStorage: createThrowingStorage('Blocked'),
      matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    };
    appliedAttr = null;
    assert.equal(getInitialTheme(), 'dark');
    saveTheme('light');
    assert.equal(getInitialTheme(), 'dark');
  });
});
