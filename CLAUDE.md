# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A purely client-side UI app that replays GPS tracks as a 3D flight over a Cesium globe, in the style of [skyviz.io](https://skyviz.io/). There is no backend — the production build is a static SPA (HTML + JS + CSS) that can be hosted on any static file server.

**Core capabilities (target):**
- **Track ingestion:** parse common GPS formats — GPX, KML/KMZ, IGC, and potentially FIT, TCX, and raw CSV. Each format should be handled by a dedicated parser that normalizes to a shared internal track model (timestamped lat/lon/alt samples + optional metadata).
- **3D playback:** render the track on a Cesium map with a moving camera/aircraft entity following the path.
- **Playback controls:** play/pause, seek, speed multiplier (e.g. 1x / 5x / 50x), and direction.
- **Video export:** generate downloadable video clips of the playback (likely via `MediaRecorder` capturing the Cesium canvas, or an offline frame-by-frame render).

**Implications for code organization (when these areas are built):**
- Format parsers belong in something like `src/lib/parsers/<format>.ts` and should all return the same normalized `Track` type — keep format-specific concerns out of UI and playback code.
- Cesium is heavy; lazy-load the viewer and its dependencies so the initial bundle stays light.
- Playback state (current time, speed, play/pause) is the central piece of shared state — design it as a single source of truth that both the Cesium scene and UI controls subscribe to.
- Video capture is a separate concern from live playback; expect it to need its own render loop or "headless" mode (deterministic time stepping, no requestAnimationFrame coupling).

## Commands

Package manager: **yarn**.

```bash
yarn dev          # vite dev server on port 3000
yarn build        # production build (static SPA in dist/)
yarn preview      # serve the production build locally
yarn test         # run Vitest once (CI mode). For watch: `yarn vitest`. Single file: `yarn vitest run path/to/file.test.ts`
yarn lint         # ESLint (no fix)
yarn format       # prettier --write . && eslint --fix
yarn check        # prettier --check (no writes)
```

The build output in `dist/` is a fully static site — deploy by copying it to any static host (GitHub Pages, Cloudflare Pages, S3 + CloudFront, Netlify, plain Nginx, etc).

To add a shadcn component: `pnpm dlx shadcn@latest add <name>` (the project uses yarn for everything else, but shadcn's CLI is invoked via pnpm dlx per `.cursorrules`).

## Architecture

**Stack:** Vite + React 19 + Tailwind CSS v4 + shadcn/ui + Cesium (via Resium). Pure client-side SPA — no router, no SSR, no server runtime.

**Entry flow:**
- `index.html` at the repo root is the Vite entry. It loads `/src/main.tsx` as a module script.
- `src/main.tsx` calls `createRoot(...).render(<App />)` and imports `./styles.css`.
- `src/App.tsx` is the single root component for the whole app.

**Plugins in `vite.config.ts`:** `tailwindcss()`, `viteReact()`, `cesium()`. No specific order requirement.

**Path aliases (both work, pick one consistently per file):**
- `#/*` → `./src/*` (declared in `package.json` `imports` and `tsconfig.json` `paths` — works at runtime + types)
- `@/*` → `./src/*` (tsconfig only — shadcn-style, types only)

`vite.config.ts` enables `resolve: { tsconfigPaths: true }`, so tsconfig paths resolve at build time.

**shadcn/ui:** Style `new-york`, base color `zinc`, CSS variables in `src/styles.css`. Aliases per `components.json`: components → `#/components`, ui → `#/components/ui`, utils → `#/lib/utils`, lib → `#/lib`, hooks → `#/hooks`. Icon library: `lucide-react`. The `cn()` helper in `src/lib/utils.ts` is the standard class-merging utility (clsx + tailwind-merge).

**Styling:** Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is CSS-first in `src/styles.css`). `src/main.tsx` imports it directly with `import './styles.css'`.

**TypeScript:** Strict mode + `noUnusedLocals` + `noUnusedParameters` + `verbatimModuleSyntax` (so use `import type` for type-only imports). Target ES2022, bundler module resolution.

**Linting:** `@tanstack/eslint-config` base, with these rules disabled in `eslint.config.js`: `import/no-cycle`, `import/order`, `sort-imports`, `@typescript-eslint/array-type`, `@typescript-eslint/require-await`, `pnpm/json-enforce-catalog`.

**Prettier:** No semicolons, single quotes, trailing commas everywhere.
