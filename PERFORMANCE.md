# Performance & Efficiency Notes — LABORA

This document summarizes the concrete performance and payload efficiency optimizations implemented in **LABORA** and where each optimization lives in the codebase.

---

## 1. Bundle Splitting & Route Lazy Loading
- **Vendor Chunk Separation (`vite.config.ts`)**: `build.rolldownOptions.output.manualChunks` isolates `react`/`react-dom` (`react-vendor`) and `lucide-react` (`icons`) from application route code so shared libraries cache independently across deployments.
- **Lazy Route & Modal Loading (`src/App.tsx`, `src/pages/FacultyApprovalsPage.tsx`)**: All five top-level pages (`HomePage`, `DiscoverPage`, `SmartBookingPage`, `RequestAccessPage`, `FacultyApprovalsPage`), `ItemDetailsDialog`, and the faculty-only `CatalogManagePanel` load via `React.lazy` and `Suspense`, keeping initial boot payload small and deferring catalog CRUD UI until a faculty reviewer opens a management tab.

## 2. Server Compression & HTTP Caching (`server.ts`)
- **Streaming Compression (`compressionMiddleware`)**: Compresses eligible text, JSON, JavaScript, and SVG responses >= 1 KB using Brotli (`quality: 4`) when the client accepts `br`, or Gzip (`level: 6`) fallback, sets `Vary: Accept-Encoding`, and skips `HEAD`, `204`, `304`, or already-encoded responses.
- **Cache-Control & Strong ETags**: Enables strong ETags (`app.set('etag', 'strong')`), marks hashed `/assets/*` bundles `public, max-age=31536000, immutable`, applies `no-cache, must-revalidate` to HTML entry points, and marks `/api/*` responses `no-store`.

## 3. Client Computation, Filtering & Persistence
- **Single-Entry Filter Memoization (`src/js/filter.ts`)**: `filterItems` caches the previous input slice, context references, and normalized criteria so repeated React renders without filter changes return a shallow copy without rescanning the 43-item catalog.
- **Debounced Live Search (`src/pages/DiscoverPage.tsx`)**: Typing in the Discover search input debounces URL hash sync and filter updates by `250 ms` so rapid keystrokes never thrash history or re-render unnecessarily.
- **Debounced `localStorage` Writes (`src/js/labData.ts`)**: `persistState()` batches mutations into a single `150 ms` timer and flushes synchronously on `pagehide` and `document.visibilitychange` (when hidden) so burst state updates do not block interaction with synchronous `JSON.stringify` / `localStorage.setItem` calls.
- **Server Catalog Caching (`server/catalogFallback.ts`)**: `loadServerCatalog()` reads `src/data/labs.json` once and caches compact catalog entries and valid item ID sets in memory across requests.

## 4. Graphics, CSS Paint & Layout Stability
- **Shared Inline SVG `<symbol>` Sprite (`src/components/LabDoodles.tsx`, `src/components/DaydreamStrip.tsx`)**: `DoodleSprite` defines all 7 hand-drawn lab doodles once in the document, and equipment cards, Lab Index tabs, and the daydream thought bubble reference them via `<use href="#doodle-...">` rather than duplicating SVG paths.
- **Compositor-Only Strip Animation (`src/css/daydream.css`, `src/components/DaydreamStrip.tsx`)**: The stick-figure daydream animates strictly via CSS `transform` and `opacity` (zero layout-reflow properties), promotes layers only while unpaused, and automatically pauses via `IntersectionObserver` when scrolled off-screen, on `document.hidden`, or when `prefers-reduced-motion: reduce` is active.
- **Render Skipping & CLS Guards (`src/css/pages.css`)**: `.perf-section` uses `content-visibility: auto` with `contain-intrinsic-size: auto 480px` for below-the-fold sections, while `.results-grid-stable`, `.calendar-card-stable`, and `.chart-panel-stable` reserve minimum heights to prevent layout shift when switching tabs or loading lazy chunks.
- **Non-Blocking Fonts & Theme Boot (`index.html`, `public/theme-init.js`)**: Preconnects to Google Fonts origins cleanly and executes `/theme-init.js` synchronously before React mounts so dark mode renders without a light-to-dark flash.

## 5. How to Verify
- Run `npm run build` and inspect the emitted chunks under `dist/assets/` (`react-vendor`, `icons`, and per-route chunks).
- Start the production server (`NODE_ENV=production node server.ts`) and inspect response headers (`Content-Encoding: br`, `ETag`, and `Cache-Control`) with `curl -I -H "Accept-Encoding: br"`.
- Run `npm test` to confirm debounced persistence flushing (`flushPersistedState`), filter caching, and server fallback behavior pass offline.
