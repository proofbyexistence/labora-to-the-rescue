# Security Overview — LABORA

This document summarizes the security controls implemented in **LABORA**, how secrets and user inputs are handled, and the known limitations of this prototype.

---

## 1. Protections Implemented

### DOM & XSS Hygiene
- **React JSX Rendering (`src/pages/*`, `src/components/*`)**: All dynamic catalog items, bookings, requests, faculty notes, and AI-generated suggestions are rendered through React text interpolation—never `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`.
- **No Dynamic Code Execution**: Zero `eval`, `new Function`, string-argument `setTimeout`/`setInterval`, or inline `onclick`-style HTML attributes exist in the codebase.
- **No Inline Scripts or Styles (`index.html`, `public/theme-init.js`, `src/css/*`)**: The pre-hydration theme bootstrapper lives in external `/theme-init.js` rather than an inline `<script>`, and visual styles live in dedicated CSS files so a strict Content Security Policy can run cleanly.
- **Model Output Sanitization (`server/geminiClient.ts`)**: `stripMarkup` strips HTML/script angle-bracket tags from all Gemini JSON text responses before returning them to the client.

### Server Security Headers & Origin Restrictions (`server.ts`)
- **`Content-Security-Policy`**: Applied on every server response:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' https://fonts.googleapis.com` in production (`NODE_ENV=production`); in development only, `'unsafe-inline'` is permitted solely so Vite's dev middleware can inject CSS modules.
  - `font-src https://fonts.gstatic.com`
  - `img-src 'self' data:`
  - `connect-src 'self'`
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
  - `frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com` (scoped for the AI Studio live preview iframe)
- **Additional Response Headers**:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-Powered-By` disabled via `app.disable('x-powered-by')`
- **Same-Origin API CORS (`server.ts`)**: `/api/*` requests with a cross-origin `Origin` header (not matching the app's `Host` or configured `APP_URL`) are rejected with `403`.
- **Safe Error Handling (`server.ts`, `server/aiRoutes.ts`)**: Malformed JSON, oversized payloads, and unexpected server errors return generic JSON errors without stack traces or internal configuration details.

### Input, URL, Persistence & Role Validation
- **Text & Date Normalization (`src/js/validation.ts`)**: Shared `hasControlChars`, `normalizeText`, `isValidIsoDate`, and `isSafeString` helpers reject ASCII control characters (`\x00–\x1F`, `\x7F`) and enforce strict length bounds and whitespace normalization across forms and API endpoints.
- **Form & Domain Validation (`src/js/scheduler.ts`, `src/js/requests.ts`, `src/js/catalog-admin.ts`, `src/js/ai-client.ts`)**:
  - Bookings require valid item IDs, future Mon–Sat dates, lab hours `09:00–17:00`, 1–4 hour durations, non-overlapping slots, and clean 3–200 char purpose notes.
  - Access requests validate title, course, existing department, 1–10 team members, future deadline, valid item IDs, 1–100 hours, 10–500 char justification, training confirmation when required, and valid status transitions.
  - Catalog administration enforces field lengths, uniqueness, valid parent references, and safe dependent handling.
- **URL Hash & Query Validation (`src/js/filter.ts`, `src/App.tsx`)**: `parseUrlState` and `parseHashState` validate page names, department IDs, lab IDs, equipment IDs, equipment types, statuses, access levels, and page numbers against known enums/catalog IDs and silently ignore unknown parameters or malformed values.
- **Persisted State Schema Validation (`src/js/labData.ts`)**: `validatePersistedState` verifies every array, object property, enum, ISO date, foreign key (`departmentId`, `labId`, `itemId`), and `activeRole` read from `localStorage`. Corrupted or tampered payloads are discarded and reset cleanly to seed data.
- **Logic-Level Role Checks (`src/js/catalog-admin.ts`, `src/js/requests.ts`, `src/js/labData.ts`)**: Faculty-only actions (`catalog-admin.ts` mutations, `transitionRequest` faculty status transitions, `transitionAccessRequest`, and `reviewAccessRequest`) enforce the caller's role in the logic layer rather than relying on UI-only hiding.

### Dependencies & Repository Hygiene (`package.json`, `.gitignore`, `.env.example`)
- Unused dependencies (`motion`, `autoprefixer`, `esbuild`) were removed and dependency versions in `package.json` are pinned without range operators.
- `.gitignore` excludes all `.env*` secret files while keeping `.env.example` with placeholder keys only.

---

## 2. API Key Handling
- `GEMINI_API_KEY` is read **only on the server** inside `server/geminiClient.ts` via `process.env.GEMINI_API_KEY`.
- The key is never bundled into `src/`, exposed in Vite `VITE_*` client environment variables, serialized into responses, logged, or committed to source control.
- All Gemini calls occur exclusively behind server-side endpoints (`POST /api/suggest-equipment` and `POST /api/explain-allocation`).

---

## 3. Rate Limiting & Fallback Behavior
- **Payload Cap (`server/aiRoutes.ts`)**: API JSON bodies are capped at `5kb` (`express.json({ limit: '5kb' })`), returning `413` if exceeded.
- **Request Validation (`server/aiRoutes.ts`)**:
  - `POST /api/suggest-equipment`: trims/normalizes `project`, rejects control characters, requires 10–500 characters, validates Gemini output against known catalog item IDs, and caps output to at most 5 items.
  - `POST /api/explain-allocation`: validates item IDs, score ranges (`0–100`), finite numeric weights, ISO dates, and slot formats against a strict payload validator.
- **Per-IP Rate Limiting (`server/rateLimit.ts`)**: Sliding window of **10 requests per 60 seconds per client IP** across `/api/*`, returning HTTP `429` with `Retry-After` when exceeded.
- **Deterministic Fallbacks (`server/catalogFallback.ts`)**: If `GEMINI_API_KEY` is unset, the Gemini API errors, or Gemini returns invalid/off-catalog JSON, both endpoints degrade gracefully to deterministic keyword matching or rule-based explanation while clearly returning `source: "fallback"`.

---

## 4. Known Prototype Limitations
- **Demo Role Switcher Is Not Real Authentication**: The Student / Faculty role switch in the header stores the active demo role in browser `localStorage` so reviewers can preview both workflows without accounts. There is no user authentication, session token, or server-side authorization boundary enforcing identity across users.
- **Browser `localStorage` Persistence**: Catalog edits, bookings, and access requests persist locally in the visitor's browser (`labora_notebook_state_v1` and `labora_theme_v1`), not in a central multi-user database. Users can clear or edit their own browser storage, though schema validation in `validatePersistedState` prevents malformed storage from crashing the application.
- **In-Memory Rate Limiter**: `server/rateLimit.ts` stores per-IP request timestamps in Node process memory, which resets on server restart and does not coordinate across multiple server replicas.
- **Preview Framing & Dev Styles**: `server.ts` configures `frame-ancestors` to permit embedding inside the AI Studio preview iframe, and allows `'unsafe-inline'` in `style-src` during `vite.middlewares` development mode only.
