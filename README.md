# LABORA — Every lab. One notebook.

LABORA (LabLink) is a notebook-themed campus laboratory resource-sharing platform that makes university instruments, development kits, workstations, and safety gear discoverable and bookable across departments.

## Pages

- **Home**: Overview spread, live inventory summary, "Browse by subject" department directory, and ready-to-book instruments.
- **Discover**: Search and filter campus equipment by department, laboratory, equipment type, availability status, and access level, plus a "Tell me about your project" equipment recommender.
- **Smart Booking**: Inspect weekly Mon–Sat lab availability (09:00–17:00), reserve or release bench windows, inspect deterministic fair-allocation conflict scores, and view plain-language summaries.
- **Request Access**: Submit access requests for faculty-approved or training-required instruments and monitor request status.
- **Faculty Approvals**: Switch to the faculty supervisor role to review, request info on, approve, or deny access requests, inspect lab analytics, and manage subjects, labs, equipment, and slots.

## Folder Structure

```text
├── index.html
├── metadata.json
├── package.json
├── README.md
├── server.ts                 # Express server mounting /api routes + Vite dev/static serving
├── server/
│   ├── aiRoutes.ts           # POST /api/suggest-equipment & POST /api/explain-allocation
│   ├── catalogFallback.ts    # Compact catalog loader + deterministic keyword fallback
│   ├── geminiClient.ts       # Lazy server-side @google/genai client, timeout & sanitization
│   └── rateLimit.ts          # Per-IP sliding-window rate limiter (10 req/min)
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── assets/images/        # Local laboratory and instrument photography
    ├── components/
    │   ├── CatalogManagePanel.tsx # Faculty CRUD UI for subjects, labs, items, and slots
    │   ├── EquipmentCard.tsx      # Reusable equipment card template
    │   └── Layout.tsx             # Shared navbar, Lab Index sidebar, breadcrumbs, and footer
    ├── css/
    │   ├── tokens.css        # Design tokens (colors, fonts, spacing, radius, shadows)
    │   └── pages.css         # Shared notebook surface and typography rules
    ├── data/
    │   └── labs.json         # 7 departments, 14 labs, 43 items, slots, 6 requests, users
    ├── js/
    │   ├── ai-client.ts      # Client fetch helpers and project input validation
    │   ├── analytics.ts      # Pure lab utilization and conflict analytics helpers
    │   ├── catalog-admin.ts  # Role-guarded pure CRUD + safe-delete dependency rules
    │   ├── filter.ts         # Pure equipment filtering and pagination helpers
    │   ├── labData.ts        # Shared data module with in-memory state + localStorage persistence
    │   ├── requests.ts       # Pure access request validation & workflow transitions
    │   ├── scheduler.ts      # Pure booking validation, conflict detection & fair allocation
    │   └── types.ts          # TypeScript interfaces for the campus lab domain
    ├── pages/
    │   ├── HomePage.tsx
    │   ├── DiscoverPage.tsx
    │   ├── SmartBookingPage.tsx
    │   ├── RequestAccessPage.tsx
    │   └── FacultyApprovalsPage.tsx
    └── tests/
        └── labData.test.ts   # Automated checks for data, scheduler, requests, admin & AI routes
```

## AI Features and Security

LABORA includes two server-assisted features: **"Tell me about your project"** equipment recommendations on Discover (`POST /api/suggest-equipment`) and **"Explain in plain words"** summaries for fair-allocation results on Smart Booking (`POST /api/explain-allocation`).

- **Server-only API key**: `GEMINI_API_KEY` is read exclusively inside `server/geminiClient.ts` on the Node server (configured via environment variables or **Settings > Secrets**). It is never bundled into `src/`, sent in URLs, exposed to the browser, or committed to version control (`.env*` files are excluded by `.gitignore`, while `.env.example` holds placeholder names only).
- **Prompt isolation & strict schema validation**: Student project descriptions are trimmed and length-validated (`10–500` characters) on both client and server, enclosed inside untrusted data delimiters (`<student_project>`), and paired with instructions to ignore embedded commands. Responses from Gemini use `responseMimeType: 'application/json'` and are verified against known catalog item IDs with duplicates removed, markup stripped, and reason lengths capped under 120 characters.
- **Deterministic authority on allocation**: All priority scores, feasibility checks, slot assignments, and alternative equipment recommendations are computed deterministically in `src/js/scheduler.ts`. `POST /api/explain-allocation` strictly validates the allocation payload structure and rewrites existing facts into 2–3 plain-language sentences without changing any decision or score.
- **Payload caps, timeouts, and rate limiting**: `/api` endpoints enforce a `5 KB` JSON body limit, a `10-second` upstream timeout, and an in-memory per-IP rate limit of `10 requests per minute` (`429 Too Many Requests` on burst traffic). Raw model text and stack traces are never returned to the client, and user inputs or secrets are never logged.
- **Automatic deterministic fallback**: If `GEMINI_API_KEY` is absent, the upstream call fails or times out, or model output fails validation, `/api/suggest-equipment` seamlessly falls back to keyword matching via `filterItems` and `/api/explain-allocation` returns the deterministic `explainAllocation()` summary. The UI clearly distinguishes results with `"Suggested by AI"` vs. `"Smart keyword match"`.

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
3. Run the unit and API route tests:
   ```bash
   npx tsx src/tests/labData.test.ts
   ```
4. Typecheck, build, and run in production mode:
   ```bash
   npm run lint
   npm run build
   npm start
   ```
