# Accessibility Statement — LABORA (WCAG 2.2 AA)

This document details the accessibility architecture implemented in **LABORA**, supported keyboard shortcuts and ARIA patterns, verification steps, and honest known limitations.

---

## 1. Accessibility Controls Implemented (by File)

### Structure, Landmarks & Page Titles
- **`index.html`, `src/App.tsx`**:
  - `<html lang="en">` is declared at document root.
  - `document.title` updates dynamically per route, active department/lab filter, and selected equipment item so every view has a unique, descriptive title.
- **`src/components/Layout.tsx`**:
  - Provides a **"Skip to main content"** link (`.skip-link` in `src/css/pages.css`) as the first focusable element, visually revealed on focus and moving focus directly to `<main id="main-content" tabIndex={-1}>`.
  - Distinguishes repeated landmarks with unique `aria-label`s: `<header>`, `<nav aria-label="Main navigation">`, `<nav aria-label="Mobile navigation">`, `<aside id="lab-index-sidebar" aria-label="Lab Index">`, `<nav aria-label="Breadcrumb">`, `<main>`, `<nav aria-label="Footer navigation">`, and `<footer>`.
  - Active page navigation links use `aria-current="page"`; breadcrumbs use semantic `<ol><li>` markup with `aria-current="page"` on the current crumb.
- **Heading Hierarchy (`src/pages/*`)**:
  - Every page renders exactly one `<h1>` and follows a sequential `<h1> -> <h2> -> <h3>` hierarchy without skipped levels.
- **Semantic Data Table (`src/pages/SmartBookingPage.tsx`)**:
  - The Mon–Sat (09:00–17:00) booking grid is built as an HTML `<table>` with a screen-reader `<caption>`, `<th scope="col">` day headers, and `<th scope="row">` time headers.

### Keyboard Navigation, Focus Management & Live Regions
- **Visible 3px Focus Indicator (`src/css/tokens.css`, `src/css/pages.css`)**:
  - Shared `--focus-ring` and `--focus-ring-offset` tokens define a consistent 3px focus ring with >= 3:1 contrast in both light and dark themes across all buttons, links, inputs, selects, textareas, `[tabindex]` targets, and `<summary>` elements.
  - Zero positive `tabindex` values are used anywhere.
- **Accessible Dialogs (`src/components/ItemDetailsDialog.tsx`, `src/pages/FacultyApprovalsPage.tsx`, `src/components/CatalogManagePanel.tsx`)**:
  - Equipment details, faculty decision reason, and catalog management modals use `role="dialog"` (and `role="alertdialog"` for delete confirmation), `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` where applicable.
  - Opening any dialog moves focus inside; `Tab` and `Shift+Tab` are trapped within the dialog; `Escape` or backdrop click closes it and returns focus to the triggering button.
- **Mobile Lab Index Drawer (`src/components/Layout.tsx`)**:
  - Toggle button uses `aria-expanded` and `aria-controls="lab-index-sidebar"`. Opening moves focus into the drawer, `Escape` or the close button dismisses it, and focus returns to the toggle button.
- **Workspace Tabs (`src/pages/FacultyApprovalsPage.tsx`)**:
  - Implements the WAI-ARIA `tablist` / `tab` / `tabpanel` pattern with roving `tabIndex`, `aria-selected`, and `ArrowLeft`, `ArrowRight`, `Home`, and `End` keyboard navigation.
- **Live Announcements & Alerts (`src/pages/DiscoverPage.tsx`, `src/pages/SmartBookingPage.tsx`, `src/pages/RequestAccessPage.tsx`, `src/pages/FacultyApprovalsPage.tsx`, `src/components/CatalogManagePanel.tsx`)**:
  - Filter result counts, AI recommendations, booking confirmations, request resubmissions, and faculty review updates announce politely via `aria-live="polite"` / `role="status"`.
  - Validation and API errors render with `role="alert"`.

### Forms & Controls
- **Programmatic Labels, Required States & Error Linking (`src/pages/DiscoverPage.tsx`, `src/pages/SmartBookingPage.tsx`, `src/pages/RequestAccessPage.tsx`, `src/pages/FacultyApprovalsPage.tsx`, `src/components/CatalogManagePanel.tsx`)**:
  - Every input, select, textarea, and checkbox has a visible `<label htmlFor="...">` (never relying on placeholders as labels).
  - Required fields are marked in visible label text (`(required)`) and `aria-required="true"`.
  - Helper text and validation errors are linked via `aria-describedby` and flagged with `aria-invalid`.
  - Failed form submissions move focus directly to the first invalid field (or error banner).
  - Calendar slot buttons expose `aria-pressed` and full day/time/status `aria-label`s; filter pills expose `aria-pressed`; Lab Index departments expose `aria-expanded` and `aria-current`.

### Color, Contrast, Reflow & Touch Targets
- **Theme Tokens (`src/css/tokens.css`, `src/css/pages.css`)**:
  - Light and dark mode palettes maintain >= 4.5:1 normal text contrast and >= 3:1 contrast for UI borders, icons, placeholders (`--placeholder`), subtle dividers (`--border-subtle`), and disabled controls (`--disabled-bg`, `--disabled-ink`, `--disabled-border` instead of low-contrast `opacity`).
  - Status badges, calendar slots, conflict items, and bar charts always combine text + icon (never color alone).
  - Prose/breadcrumb/footer links keep visible underlines (`underline underline-offset-4`).
  - Interactive buttons and controls enforce `min-height: 44px` and `min-width: 44px` touch targets.
  - Font sizing uses relative `rem` units (`--text-base: 1.125rem`, `line-height: 1.6`), and header/buttons wrap cleanly down to `320px` width and `200%–400%` zoom without horizontal page overflow.

### Images, Charts & Motion
- **SVGs (`src/components/LabDoodles.tsx`, `src/components/DaydreamStrip.tsx`, `src/pages/FacultyApprovalsPage.tsx`)**:
  - Decorative doodles and the daydream strip SVG carry `aria-hidden="true"` and `focusable="false"`.
  - Lab utilization chart bars carry `role="img"`, `focusable="false"`, descriptive `aria-label`s, visible hour/percentage text, and a visually hidden (`sr-only`) overall summary.
- **Reduced Motion & Pause Control (`src/css/pages.css`, `src/css/daydream.css`, `src/components/DaydreamStrip.tsx`, `src/App.tsx`, `src/pages/SmartBookingPage.tsx`)**:
  - Global `@media (prefers-reduced-motion: reduce)` disables all CSS animations and transitions site-wide, and JS smooth-scrolling falls back to `'auto'`.
  - The >5-second daydream animation strip automatically honors `prefers-reduced-motion` (including live OS changes), pauses when the browser tab is hidden, and provides an accessible Pause/Play toggle button.
  - Nothing flashes more than 3 times per second.

---

## 2. Keyboard Shortcuts & ARIA Patterns

| Area | Keys / Controls | Behavior |
|---|---|---|
| Page Bypass | `Tab` on load, then `Enter` | Focuses `"Skip to main content"` and jumps focus to `<main>` |
| Navigation & Filters | `Tab`, `Shift+Tab`, `Enter` / `Space` | Navigates navbar, breadcrumbs, Lab Index departments/labs, filter buttons, and pagination |
| Faculty Workspace Tabs | `ArrowLeft`, `ArrowRight`, `Home`, `End` | Moves focus and selection across `Approvals`, `Subjects & Labs`, `Equipment`, and `Slots` |
| Modal Dialogs | `Tab`, `Shift+Tab`, `Escape` | Focus trapped inside dialog; `Escape` closes and restores focus to opening button |
| Mobile Lab Index Drawer | `Enter` / `Space` on menu button, `Escape` | Opens drawer and moves focus inside; `Escape` or close button closes and returns focus |
| Weekly Schedule Table | `Tab`, `Enter` / `Space` | Navigates free/conflicting 1-hour Mon–Sat slots and toggles `aria-pressed` selection |
| Daydream Animation | `Enter` / `Space` on `Pause` / `Play` | Pauses or resumes the strip animation (`aria-pressed`) |

---

## 3. How to Test

1. **Keyboard-Only Walk-Through**: Press `Tab` from page load to confirm `"Skip to main content"` appears and moves focus to `<main>`. Tab through navbar, Lab Index, Discover filters, Smart Booking calendar table, Request Access multi-select, Faculty tabs (`ArrowLeft`/`ArrowRight`/`Home`/`End`), and modal dialogs (`Tab` trap + `Escape` focus return).
2. **Forms & Screen Reader Verification**: Submit empty/invalid forms on Discover, Smart Booking, Request Access, and Manage modals; verify `aria-invalid`, `role="alert"`, and focus moving to the first invalid field. Verify live counts/status updates announce via screen reader (VoiceOver / NVDA).
3. **Zoom, Reflow & Text Spacing**: Resize viewport to `320px` wide and test `200%` / `400%` browser zoom with no horizontal scrollbar on the main document. Apply text-spacing overrides (`line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`) to verify cards and labels do not clip.
4. **Reduced Motion & Themes**: Toggle Dark/Light mode and enable `prefers-reduced-motion: reduce` in OS or browser DevTools to verify static daydream frame, disabled transitions, and >= 4.5:1 text / >= 3:1 focus ring contrast.
5. **Automated Checks**: Run `npx tsx src/tests/labData.test.ts`, `npm run lint`, and `npm run build`.

---

## 4. Known Honest Limitations

- **No Automated Headless Browser Accessibility Runner in CI**: Contrast ratios, focus traps, and ARIA roles were audited and fixed in code and stylesheets rather than executed inside an automated headless Chromium + `axe-core` test harness.
- **Native `<input type="date">` & `<select>` Popups**: Calendar date inputs and dropdown option popups rely on native browser/OS controls whose internal popup contrast and keyboard UX vary slightly across browsers.
- **Horizontally Scrollable Weekly Schedule Wrapper**: On very narrow screens (`320px`), the 7-column Mon–Sat schedule table scrolls horizontally inside its own dedicated `overflow-x-auto` card container rather than wrapping the entire page horizontally.
