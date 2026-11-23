export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'labora_theme_v1';

/**
 * Determine initial theme using saved localStorage preference first,
 * then OS prefers-color-scheme, safely handling restricted storage environments.
 */
export function getInitialTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    const preset = document.documentElement.getAttribute('data-theme');
    if (preset === 'dark' || preset === 'light') {
      return preset;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // Ignore storage access errors in private browsing or restricted iframes.
    }

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  }

  return 'light';
}

/**
 * Apply theme attribute to the root element so CSS token variables switch instantly.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Persist explicit user theme choice safely inside try/catch.
 */
export function saveTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota or security errors cleanly.
  }
}

/**
 * Follow system theme changes only when the user has not explicitly saved a preference.
 */
export function watchSystemTheme(onChange: (theme: ThemeMode) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (event: MediaQueryListEvent) => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return;
      }
    } catch {
      // Fall through to system preference when storage is unavailable.
    }
    onChange(event.matches ? 'dark' : 'light');
  };

  mql.addEventListener('change', listener);
  return () => mql.removeEventListener('change', listener);
}
