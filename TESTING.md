# Testing Guide & Manual Test Plan — LABORA

This document describes the automated unit/integration test suite for **LABORA** and provides a structured manual verification checklist for UI, accessibility, responsive layout, and end-to-end workflows.

---

## 1. Running Automated Tests

The test suite uses Node.js's built-in test runner (`node:test` with `node:assert/strict`) and runs completely offline without a browser, network access, or a `GEMINI_API_KEY`.

### Commands

```bash
# Run the full automated test suite (runs in ~3 seconds)
npm test

# Run with Node's built-in experimental coverage report
node --import tsx --test --experimental-test-coverage tests/*.test.js

# Run TypeScript typechecking and production build verification
npm run lint
npm run build
```

---

## 2. Automated Test Suite Coverage (Mapped to Features)

All automated tests live under `tests/`, backed by shared builders and deterministic storage/date fixtures in `tests/helpers.js`.

| Test File | Source Module(s) Tested | Feature Areas Covered |
|---|---|---|
| `tests/filter.test.js` | `src/js/filter.ts` | Case-insensitive & trimmed search across name, lab, room, department, type, and specs; individual and combined filters; empty-result handling; pagination clamping; URL query/hash parsing, alias mapping, XSS/control-char stripping, and bookmark hash serialization. |
| `tests/scheduler.test.js` | `src/js/scheduler.ts` | `validateBooking` rules (past dates, Sunday closure, 09:00–17:00 lab hours, slot overlaps, 1–4 hour duration bounds, missing fields); `detectConflicts` overlap grouping; `scoreRequest` 0–100 breakdown summation, deadline urgency, and fairness weighting; deterministic `allocate` tie-breaking, slot reassignment, alternative item proposals, and infeasibility; `canUserBookItem` access rules. |
| `tests/requests.test.js` | `src/js/requests.ts` | `validateRequest` field bounds (title, course, department, team size, future deadline, catalog item IDs, hours 1–100, justification, conditional training checkbox); `transitionRequest` state machine, role guards, mandatory rejection/changes reasons, terminal states, and Smart Booking unlock after approval; `buildFacultySuggestion`. |
| `tests/catalog-admin.test.js` | `src/js/catalog-admin.ts` | Faculty-only role guard on every mutation; add/edit/delete for departments, labs, equipment items, and hourly slots; duplicate name rejection; whitespace normalization & max lengths; `getDependents` detection; safe deletion blocking unless `cancelAffected` is supplied with zero orphaned slots or requests remaining. |
| `tests/analytics.test.js` | `src/js/analytics.ts` | `getUtilizationByLab` percentage and hour totals; `getUnderusedItems` deterministic ascending sort and tie-breaking; `getSummary` pending/weekly-approved/conflict KPIs; zero-capacity and empty-array divide-by-zero safety. |
| `tests/storage.test.js` | `src/js/labData.ts`, `src/js/theme.ts` | `validatePersistedState` schema/enum/foreign-key validation and legacy status migration; corrupt JSON, oversized, and tampered `localStorage` recovery to seed data; memory fallback when storage throws `SecurityError`/`QuotaExceededError`; theme persistence and fallback. |
| `tests/ai-validation.test.js` | `src/js/ai-client.ts`, `server/aiRoutes.ts`, `server/catalogFallback.ts`, `server/geminiClient.ts`, `server/rateLimit.ts` | Project description length limits (10–500 chars) and control-char rejection; 5 KB payload limit and malformed JSON handling; model-output sanitizer (unknown ID removal, deduplication, markup stripping, truncation, 5-item cap); stubbed Gemini success, error fallback, invalid JSON fallback, and timeout fallback; `explain-allocation` validation; sliding-window per-IP rate limiter (`429` + `Retry-After`). |

---

## 3. Testing Approach

- **Pure Logic First**: Filtering, scheduling, conflict scoring, request validation, catalog administration, and analytics are tested directly as pure functions without DOM coupling.
- **Deterministic Clocks & Dates**: Tests supply fixed ISO dates (`2026-11-23`) and fixed numeric timestamps (`1_700_000_000_000`) via explicit `referenceDate` and `now` arguments so results never drift with the system clock.
- **Injectable Dependencies & Stubs**:
  - `labData.ts` accepts an injectable `StorageLike` override (`reloadLabStore`, `flushPersistedState`) and `theme.ts` is tested with stubbed `window`/`document` globals, covering both valid hydration and throwing/blocked storage without altering production behavior.
  - `server/aiRoutes.ts` accepts an injectable `getGeminiClient` and `timeoutMs` via `createAiRouter`, allowing fast, offline Express HTTP tests against stubbed Gemini responses, failures, and timeouts without ever calling the live Gemini API.

---

## 4. Manual Test Checklist

Verify the live application in a browser (`npm run dev` on `http://localhost:3000`) and record outcomes in the table below.

| ID | Area | Steps | Expected Result | Pass/Fail |
|---|---|---|---|---|
| MT-01 | Discover Search & Trimming | Open **Discover**, type `"  spectrometer  "` into the **Search** box. | Results filter case-insensitively after ~250 ms; live count badge updates to matching items. | |
| MT-02 | Discover Individual & Combined Filters | Select a **Department**, **Laboratory**, **Equipment type**, **Availability**, and click an **Access level** button. | Card grid updates to items matching all active filters simultaneously; clearing resets all controls. | |
| MT-03 | Discover Empty State | Enter a non-matching search like `"zzzz-unknown"` in **Discover**. | Friendly empty state appears with **Clear filters** button; clicking it restores all 43 items. | |
| MT-04 | URL Hash Deep-Linking & Sanitization | Navigate to `#dept=electronics&type=dev-kits&p=1`, then test `#discover&q=<script>alert(1)</script>&dept=bad`. | Valid alias loads Electronics Development kits; invalid/malicious params are safely stripped/ignored without errors. | |
| MT-05 | Pagination Controls | On **Discover** with all items shown, click **Page 2**, **Next**, and **Previous**. | Displays 9 items per page, updates URL hash (`&p=2`), and disables Previous on page 1 / Next on last page. | |
| MT-06 | Role Switching & Guardrails | In **Student** mode, open **Faculty Approvals**. Then click the header role switcher to switch to **Faculty**. | Student mode shows the "Faculty access only" guard screen; switching to Faculty unlocks Approvals, Analytics, and Manage tabs. | |
| MT-07 | Smart Booking Validation | On **Smart Booking** for an Open item, try submitting a Sunday date, a past date, >4h duration, or a 2-char purpose. | Inline `role="alert"` error messages explain each violation and move focus to the first invalid control/banner. | |
| MT-08 | Smart Booking Slot Overlap & Create | Pick an open Mon–Sat slot (09:00–17:00), enter a valid purpose, and submit; then try booking the same hour again. | First booking marks slot as booked on the weekly table and updates item availability; second attempt is blocked as overlapping. | |
| MT-09 | Conflict Resolution & Deterministic Allocation | Open **Smart Booking** for `eq-phy-01` (or an item with competing requests) and inspect the Fair-Allocation panel; click **Explain plainly**. | Ranked scores (0–100) and breakdown sum match total; winner keeps contested slot; loser gets earliest free slot or alternative; explanation displays cleanly. | |
| MT-10 | Restricted Item Booking Lock | In **Student** mode, open **Smart Booking** for a `Needs faculty approval` item (e.g., `eq-ece-02`). | Booking form is locked with a notice explaining an approved faculty access request is required. | |
| MT-11 | Request Access Form Validation | On **Request Access**, submit an empty form, then select a `Training required` item without checking the training box. | Validation errors link via `aria-describedby`, `aria-invalid="true"` is set, and focus moves to the first invalid field. | |
| MT-12 | Request Submission & Approval Unlock | In **Student** mode, submit a valid request for `eq-ece-02`. Switch to **Faculty**, move it to **Under review** and **Approved**, then switch back to **Student**. | Status stepper tracks `Submitted` -> `Under review` -> `Approved`; Student can now book `eq-ece-02` on **Smart Booking**. | |
| MT-13 | Request Reject / Changes Requested & Resubmit | As **Faculty**, click **Request Changes** or **Reject** with an empty reason, then provide a valid reason (3–300 chars). As **Student**, resubmit a `Changes requested` request. | Empty reason is blocked inside the modal; valid reason saves and updates status; Student can edit/resubmit back to `Submitted`. | |
| MT-14 | Faculty Add Catalog Entities | As **Faculty**, open **Subjects & Labs**, **Equipment**, and **Slots** tabs and add a new subject, lab, item, and 2-hour slot block. | New records appear in Discover, Lab Index sidebar, and Smart Booking schedule; duplicate names are rejected. | |
| MT-15 | Faculty Delete with Dependents (`cancel` vs `cancelAffected`) | Create a booking or pending request on a test item, then click **Delete** on that item or its parent department. Test **Cancel** first, then **Delete & cancel affected**. | Dependent warning lists active bookings/requests; **Cancel** preserves all records; **Delete & cancel affected** removes entity/slots and moves affected requests to `Changes requested` with no orphans. | |
| MT-16 | AI Equipment Suggestions (Valid Input) | On **Discover**, click **Example 1** in "Tell me about your project" and submit **Suggest equipment**. | Returns up to 5 catalog cards with concise reasons and either `Suggested by AI` or `Smart keyword match` badge. | |
| MT-17 | AI Equipment Suggestions Fallback & Validation | Submit <10 chars (expect validation alert). With `GEMINI_API_KEY` unset/offline, submit a valid 20-char project description. | Validation blocks short input; missing/failing Gemini key degrades smoothly to `Smart keyword match` deterministic results without UI crashes. | |
| MT-18 | Dark Mode Toggle & Persistence | Click the Sun/Moon toggle in the header to enable **Dark mode**, reload the page, and switch back to **Light mode**. | Theme switches immediately without flash of wrong theme on reload; text, borders, badges, and focus rings remain clearly legible. | |
| MT-19 | Daydream Animation Pause Control | Scroll to the footer **Lab daydream** strip and activate the **Pause** / **Play** button. | Strip sets `data-paused="true"`, stops animation, updates button label/icon to **Play**, and updates `aria-pressed`. | |
| MT-20 | Reduced Motion Preference | Enable `prefers-reduced-motion: reduce` in browser DevTools Rendering panel and reload. | Daydream animation starts paused and page transitions/smooth-scrolling are disabled. | |
| MT-21 | Keyboard-Only Bypass & Page Navigation | Press `Tab` immediately on page load and press `Enter` on **Skip to main content**. Tab through header links, breadcrumbs, and **Lab Index**. | Skip link becomes visible on focus and moves focus to `<main>`; every interactive element displays a 3px high-contrast focus ring. | |
| MT-22 | Keyboard Tablist Navigation (Faculty Tabs) | In **Faculty** mode on **Faculty Approvals**, focus the active tab and press `ArrowRight`, `ArrowLeft`, `Home`, and `End`. | Focus and selection move cleanly across `Approvals`, `Subjects & Labs`, `Equipment`, and `Slots` tabs via roving `tabIndex`. | |
| MT-23 | Keyboard Modal Focus Trap & Escape | Open an Equipment Details dialog (**View details**) or Faculty reason modal, press `Tab`/`Shift+Tab` repeatedly, then press `Escape`. | Focus cycles strictly inside the open modal; `Escape` closes it and returns focus to the button that opened it. | |
| MT-24 | Keyboard Weekly Calendar Grid | On **Smart Booking**, `Tab` into the weekly Mon–Sat `<table>` and press `Enter`/`Space` on an open slot cell. | Selected hour updates `aria-pressed="true"` and populates the booking form date/start time; booked cells announce their state. | |
| MT-25 | Screen Reader Live Announcements | Using VoiceOver/NVDA (or inspecting DOM live regions), filter **Discover**, submit a booking, and submit/review a request. | `aria-live="polite"` / `role="status"` regions announce item counts and action confirmations; errors announce via `role="alert"`. | |
| MT-26 | Mobile Layout & Drawer Reflow (`375px` / `320px`) | Resize viewport to `375px` (and `320px`), open/close the **Lab Index** menu drawer, and inspect all 5 pages. | Header wraps cleanly, mobile nav scrolls horizontally inside its bar without page-level horizontal overflow, and weekly table scrolls inside its own card wrapper. | |
| MT-27 | Corrupted Storage Resilience | In browser DevTools Application/Storage, set `labora_notebook_state_v1` to `"{bad"` and reload the app. | App discards corrupted storage cleanly, restores default seed data without throwing, and remains fully interactive. | |
