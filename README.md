# LABORA (LabLink): Every lab. One notebook.

LABORA is a campus laboratory resource-sharing platform that brings multi-department equipment catalogs, availability schedules, project-based access approvals, and utilization analytics together into one shared notebook interface. Students can discover instruments across departments, book weekly bench slots, and submit justified access requests, while faculty supervisors resolve scheduling conflicts and manage catalog capacity.

Live demo: `<ADD LINK>`

---

## THE PROBLEM AND HOW LABORA SOLVES IT

University laboratories often operate in isolated departmental silos with spreadsheet sign-up sheets, unclear prerequisites, and underused equipment. **LABORA** unifies campus laboratories around the core workflows needed to keep shared instruments accessible, fair, and well-utilized:

| Domain Requirement | How LABORA Solves It | Implementing File(s) |
|---|---|---|
| **Equipment discovery** | Searchable, multi-faceted catalog across 7 departments and 14 labs with filters for type, availability, and access level, plus AI-assisted project matching. | `src/pages/DiscoverPage.tsx`, `src/js/filter.ts`, `server/catalogFallback.ts` |
| **Intelligent slot booking** | Interactive weekly Mon–Sat (`09:00–17:00`) grid validating lab hours, Sunday closures, 1–4 hour durations, and non-overlapping slots before reserving. | `src/pages/SmartBookingPage.tsx`, `src/js/scheduler.ts` |
| **Project-based access requests** | Validated student request workflow capturing project title, course, team size, deadline, multi-item gear, required hours, written justification, and training sign-off. | `src/pages/RequestAccessPage.tsx`, `src/js/requests.ts` |
| **Faculty approvals** | Role-guarded review workspace with status state machine (`Submitted -> Under review -> Approved / Changes requested / Rejected`), mandatory reasons, and instant Smart Booking unlock. | `src/pages/FacultyApprovalsPage.tsx`, `src/js/requests.ts`, `src/js/labData.ts` |
| **Conflict resolution & fair and feasible allocation** | Groups overlapping requests on the same instrument window and ranks contenders with a transparent 0–100 score weighting **deadlines** (35 pts), schedule **availability** / feasibility (25 pts), **student requirements** (20 pts), and historical usage fairness (20 pts), reassigning remaining teams to earliest open slots or similar alternatives. | `src/js/scheduler.ts`, `src/pages/SmartBookingPage.tsx`, `server/aiRoutes.ts` |
| **Resource utilisation** | Live analytics computing booked vs. scheduled capacity percentages by lab, surfacing underused instruments, and allowing faculty catalog/slot CRUD. | `src/js/analytics.ts`, `src/pages/FacultyApprovalsPage.tsx`, `src/js/catalog-admin.ts` |

---

## FEATURES

### Pages Overview
- **Home (`#home`)**: Platform summary, live 4-card campus inventory KPIs, interactive "Browse by subject" department directory, and currently open equipment ready to reserve.
- **Discover (`#discover`)**: Case-insensitive keyword search (`250 ms` debounced), Department / Lab / Type / Availability / Access filters, 9-item pagination synced to bookmarkable URL hashes, inspect modal, and the **"Tell me about your project"** equipment recommender.
- **Smart Booking (`#booking`)**: Weekly Monday–Saturday (`09:00–17:00`) schedule table, booking form with validation and access gating (`Open` vs. `Needs faculty approval` / `Training required`), slot release control, and the **Fair-Allocation Recommendation** panel with **"Explain in plain words"** summaries.
- **Request Access (`#request`)**: Multi-select catalog picker grouped by department and lab, conditional safety-training attestation, field-level validation, and a live **"Your requests"** progress tracker with resubmission when changes are requested.
- **Faculty Approvals & Manage (`#approvals`)**: Role-guarded workspace (prompts non-faculty users to switch roles) with pending queue filters, rule-backed faculty recommendations, reason dialogs, conflict queue, SVG utilization charts, underused-item alerts, and **Subjects & Labs / Equipment / Slots** management tabs with dependency-safe deletion.

### Quick Demo Flow
1. **Switch role**: Click the top-right **Student / Faculty** switcher to preview either perspective.
2. **Search**: Open **Discover**, type `"spectrometer"` or pick **Electronics & ECE**, and inspect an item's specifications.
3. **Book**: Click **Book slot** on an `Open` instrument, click any free Mon–Sat cell, add a purpose, and confirm.
4. **Resolve a conflict**: In **Smart Booking**, pick `UV-Vis Optical Spectrometer` (`eq-phy-01`) to inspect competing requests, priority scores (0–100), **"Explain in plain words"**, and **Accept suggestion**.
5. **Request access & approve**: As **Student**, submit an access request on **Request Access** for a `Needs faculty approval` item (`eq-ece-02`). Switch to **Faculty**, click **Start review** then **Approve** in **Faculty Approvals**, and switch back to **Student** to verify **Smart Booking** unlocks.
6. **Manage the catalog**: As **Faculty**, open **Subjects & Labs**, **Equipment**, or **Slots** to add records or test safe cascade deletion.
7. **Use the AI finder**: On **Discover**, select an example under **"Tell me about your project"** and submit **Suggest equipment**.

---

## TECH AND ARCHITECTURE

### Folder Structure
```text
├── .env.example                 # Template environment variables (GEMINI_API_KEY, APP_URL)
├── ACCESSIBILITY.md             # WCAG 2.2 AA accessibility controls, shortcuts, and verification
├── PERFORMANCE.md               # Bundle splitting, compression, caching, and animation optimizations
├── SECURITY.md                  # Security headers, validation, rate limits, and AI key isolation
├── TESTING.md                   # Automated suite map (76+ tests) and 27-point manual test plan
├── index.html                   # Document shell, font preconnects, favicon, and pre-paint theme script
├── metadata.json                # Applet manifest metadata
├── package.json                 # Pinned dependencies and scripts (dev, build, start, lint, test)
├── server.ts                    # Express server with CSP, compression, /api mounting, and SPA serving
├── vite.config.ts               # Vite + React + Tailwind CSS build and manual chunk splitting
├── public/
│   ├── favicon.svg              # Vector flask icon for browser tabs
│   └── theme-init.js            # External pre-hydration light/dark theme initializer
├── server/
│   ├── aiRoutes.ts              # POST /api/suggest-equipment & POST /api/explain-allocation
│   ├── catalogFallback.ts       # Compact catalog loader & deterministic keyword fallback
│   ├── geminiClient.ts          # Lazy server-only @google/genai wrapper, timeout & sanitizer
│   └── rateLimit.ts             # Per-IP sliding-window rate limiter (10 requests / 60s)
├── src/
│   ├── App.tsx                  # Hash/pathname router, lazy page loader, 404 view, dynamic meta tags
│   ├── index.css                # Tailwind v4 + LABORA CSS entry point
│   ├── main.tsx                 # Client React root bootstrap
│   ├── components/              # Shared UI shell, EquipmentCard, ItemDetailsDialog, LabDoodles, CatalogManagePanel, DaydreamStrip
│   ├── css/                     # Theme tokens (tokens.css), notebook rules (pages.css), daydream CSS (daydream.css)
│   ├── data/labs.json           # Seed catalog (7 departments, 14 labs, 43 items, slots, requests, users)
│   ├── js/                      # Pure domain modules (filter, scheduler, requests, catalog-admin, analytics, validation, ai-client, theme, types) + labData store
│   └── pages/                   # Route views (Home, Discover, SmartBooking, RequestAccess, FacultyApprovals)
└── tests/                       # Offline Node test suite (node:test) across all pure logic, storage & API routes
```

### Data Flow
1. **Hydration & Persistence**: `src/js/labData.ts` loads seed catalog records from `src/data/labs.json`, validates any stored browser state in `localStorage` (`validatePersistedState`), and debounces writes (`150 ms`) with `pagehide` / `visibilitychange` flushes.
2. **Pure Logic Modules**: All filtering (`filter.ts`), slot validation and fair allocation (`scheduler.ts`), request transitions (`requests.ts`), role-guarded CRUD (`catalog-admin.ts`), and analytics (`analytics.ts`) run as deterministic, DOM-free pure functions.
3. **Server AI Proxy**: UI components call `/api/*` via `src/js/ai-client.ts`; `server/aiRoutes.ts` enforces size limits, input validation, rate limits, and Gemini schema checking before falling back cleanly when needed.

---

## JUDGING CRITERIA MAP

| Criterion | What was done | Where (file names) | How to verify |
|---|---|---|---|
| **Code Quality** | Modular pure TypeScript domain logic cleanly separated from React views and Express routes, shared validation/date utilities, single-responsibility module headers, zero unused code or debug logs, friendly 404 route handling. | `src/js/*`, `src/pages/*`, `src/components/*`, `src/App.tsx`, `server.ts`, `server/*` | Run `npm run lint` and `npm run build`; visit `#nonexistent-route` or `/unknown-path` for 404 recovery. |
| **Security** | Server-only `GEMINI_API_KEY`, strict CSP without inline script execution, same-origin API check, `5 KB` JSON body cap, `10 req/min` rate limiter, HTML/markup stripping, URL/storage schema validation, and logic-layer role checks. See [SECURITY.md](SECURITY.md). | `server.ts`, `server/aiRoutes.ts`, `server/geminiClient.ts`, `server/rateLimit.ts`, `src/js/validation.ts`, `src/js/labData.ts`, `src/js/filter.ts` | Inspect headers on HTTP responses, test oversized/invalid payloads or rate limits via `npm test`, and review [SECURITY.md](SECURITY.md). |
| **Efficiency** | Brotli/Gzip response compression, strong ETags & immutable asset cache headers, Vite vendor chunking (`react-vendor`, `icons`), `React.lazy` routes & Manage panel, memoized filtering, debounced search & storage writes, shared SVG `<symbol>` sprite, and GPU-composited/auto-paused animation. See [PERFORMANCE.md](PERFORMANCE.md). | `server.ts`, `vite.config.ts`, `src/App.tsx`, `src/js/filter.ts`, `src/js/labData.ts`, `src/components/LabDoodles.tsx`, `src/css/daydream.css`, `src/css/pages.css` | Run `npm run build` to inspect split chunks, check `Content-Encoding`/`Cache-Control` headers, and review [PERFORMANCE.md](PERFORMANCE.md). |
| **Testing** | Offline automated suite built on Node's built-in test runner (`node:test` + `node:assert/strict`) using fixed reference dates and injectable storage/API stubs, plus a 27-case manual test plan. See [TESTING.md](TESTING.md). | `tests/*.test.js`, `tests/helpers.js`, [TESTING.md](TESTING.md) | Run `npm test` (offline, no browser or API key needed) and follow the manual checklist in [TESTING.md](TESTING.md). |
| **Accessibility** | WCAG 2.2 AA design: skip-to-main link, distinct ARIA landmarks, semantic Mon–Sat schedule `<table>`, 3px light/dark focus rings, focus-trapped modals (`Escape` restores trigger), roving `tablist` arrows, icon+text badges, `44px` minimum touch targets, dynamic page titles/meta, and reduced-motion + Pause toggle. See [ACCESSIBILITY.md](ACCESSIBILITY.md). | `src/components/Layout.tsx`, `src/components/ItemDetailsDialog.tsx`, `src/pages/SmartBookingPage.tsx`, `src/pages/FacultyApprovalsPage.tsx`, `src/components/DaydreamStrip.tsx`, `src/css/tokens.css`, `src/css/pages.css` | Complete the keyboard, zoom (`320px`/`400%`), reduced-motion, and screen-reader walkthrough in [ACCESSIBILITY.md](ACCESSIBILITY.md). |
| **Problem Statement Alignment** | Covers the full campus lab lifecycle: equipment discovery, intelligent Mon–Sat slot booking, project-based access requests, faculty approvals, conflict detection, deterministic fair/feasible allocation, and lab utilization analytics. | `src/pages/*`, `src/js/scheduler.ts`, `src/js/requests.ts`, `src/js/analytics.ts`, `src/js/catalog-admin.ts`, `src/data/labs.json` | Follow the 7-step Quick Demo Flow above across Student and Faculty roles. |

---

## AI FEATURES

- **What Gemini does**:
  1. `POST /api/suggest-equipment`: Matches a student's project description (`10–500` chars) against a compact JSON snapshot of the catalog (`src/data/labs.json`) and returns up to 5 catalog `itemId`s with concise reasons (`<120` chars).
  2. `POST /api/explain-allocation`: Rewrites an already-computed deterministic `AllocationResult` into 2–3 plain-language sentences for students without changing scores, dates, or slot winners.
- **What deterministic logic decides**: All eligibility checks (`canUserBookItem`), slot validation (`validateBooking`), conflict detection (`detectConflicts`), 0–100 priority scoring (`scoreRequest`), tie-breaking, earliest-slot reassignment, and alternative equipment selection (`allocate`) are 100% deterministic in `src/js/scheduler.ts`.
- **Key protection**: `GEMINI_API_KEY` is read strictly on the server in `server/geminiClient.ts` (`process.env.GEMINI_API_KEY`), never exposed to Vite `VITE_*` client bundles, with `5 KB` request caps, `<student_project>` / `<allocation_data>` untrusted-data framing, output markup stripping, `10s` timeouts, and per-IP rate limiting (`10 req/min`).
- **Fallback**: Whenever `GEMINI_API_KEY` is unset, times out, fails, or returns malformed/off-catalog IDs, `server/catalogFallback.ts` (`suggestEquipmentFallback`) ranks catalog matches via `filterItems`, and `/api/explain-allocation` returns `explainAllocation()`, clearly badged in the UI (`Suggested by AI` vs. `Smart keyword match`).

---

## RUN LOCALLY & RUN TESTS

### Environment Variables
Copy `.env.example` to `.env` if setting a local key:
```bash
cp .env.example .env
```
- `GEMINI_API_KEY` (optional): Gemini API key used strictly by the Node backend. Leave unset to run seamlessly in deterministic fallback mode.
- `APP_URL` (optional): Public origin allowed by same-origin `/api` CORS checks when deployed behind a custom host.

### Run Locally
```bash
# Install dependencies
npm install

# Start development server (Express + Vite middleware on http://localhost:3000)
npm run dev

# Build and start production server
npm run build
NODE_ENV=production npm start
```

### Run Tests & Checks
```bash
# Run all automated offline tests (Node built-in runner; no API key or browser required)
npm test

# Typecheck TypeScript across client, server, and shared logic
npm run lint
```

---

## KNOWN LIMITATIONS

- **Demo role switch, not real authentication**: Toggling between Student and Faculty updates an active demo role in browser `localStorage` so reviewers can test both personas easily; there are no user accounts, passwords, or server sessions.
- **Browser-local persistence**: Seed data from `src/data/labs.json` and edits/bookings persist in the visitor's browser `localStorage` (`labora_notebook_state_v1`) rather than a multi-user backend database.
- **What a production version would add**: Institutional SSO/OAuth authentication (e.g., campus identity provider with server-enforced RBAC), a central relational or document database for concurrent multi-student bookings, and transactional email/calendar notifications on approvals and slot changes.

---

## CREDITS

Built for **Prompt Wars** with **Stitch**, **Google AI Studio (Gemini)**, and **Claude**.
