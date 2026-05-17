# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A purely client-side UI app that replays GPS tracks as a 3D flight over a Cesium globe, in the style of [skyviz.io](https://skyviz.io/). There is no backend domain logic — the TanStack Start server is only the host for the SPA.

**Core capabilities (target):**
- **Track ingestion:** parse common GPS formats — GPX, KML/KMZ, IGC, and potentially FIT, TCX, and raw CSV. Each format should be handled by a dedicated parser that normalizes to a shared internal track model (timestamped lat/lon/alt samples + optional metadata).
- **3D playback:** render the track on a Cesium map with a moving camera/aircraft entity following the path.
- **Playback controls:** play/pause, seek, speed multiplier (e.g. 1x / 5x / 50x), and direction.
- **Video export:** generate downloadable video clips of the playback (likely via `MediaRecorder` capturing the Cesium canvas, or an offline frame-by-frame render).

**Implications for code organization (when these areas are built):**
- Format parsers belong in something like `src/lib/parsers/<format>.ts` and should all return the same normalized `Track` type — keep format-specific concerns out of UI and playback code.
- Cesium is heavy; lazy-load the viewer and its dependencies so the initial route stays light.
- Playback state (current time, speed, play/pause) is the central piece of shared state — design it as a single source of truth that both the Cesium scene and UI controls subscribe to.
- Video capture is a separate concern from live playback; expect it to need its own render loop or "headless" mode (deterministic time stepping, no requestAnimationFrame coupling).

## Commands

Package manager: **yarn** (per `.cta.json`).

```bash
yarn dev          # vite dev server on port 3000
yarn build        # production build (Vite + Nitro server output)
yarn preview      # preview the production build
yarn test         # run Vitest once (CI mode). For watch: `yarn vitest`. Single file: `yarn vitest run path/to/file.test.ts`
yarn lint         # ESLint (no fix)
yarn format       # prettier --write . && eslint --fix
yarn check        # prettier --check (no writes)
```

To run the built server: `node dist/server/index.mjs`.

To add a shadcn component: `pnpm dlx shadcn@latest add <name>` (the project uses yarn for everything else, but shadcn's CLI is invoked via pnpm dlx per `.cursorrules`).

## Architecture

**Stack:** TanStack Start (SSR React meta-framework) + TanStack Router (file-based routing) + Vite + Nitro (server adapter) + React 19 + Tailwind CSS v4 + shadcn/ui.

**Entry flow:**
- `vite.config.ts` wires plugins in this order: `devtools()`, `nitro()`, `tailwindcss()`, `tanstackStart()`, `viteReact()`. Order matters — `tanstackStart` must come before `viteReact`. Nitro is configured to externalize `@sentry/*`.
- `src/router.tsx` exports `getRouter()`, the entry point TanStack Start calls to build the router. Defaults: `defaultPreload: 'intent'`, `scrollRestoration: true`.
- `src/routes/__root.tsx` is the shell — defines `<html>`, `<head>`, devtools panel, and renders `{children}`.
- `src/routeTree.gen.ts` is **auto-generated** by `@tanstack/router-plugin` from files in `src/routes/`. Never edit by hand; the dev server regenerates it.

**Routing:** File-based. Each file in `src/routes/` becomes a route via `createFileRoute('/path')({ component })`. API routes live in the same tree using the `server.handlers` property on a route (see README). Server functions use `createServerFn` from `@tanstack/react-start`.

**Path aliases (both work, pick one consistently per file):**
- `#/*` → `./src/*` (declared in `package.json` `imports` and `tsconfig.json` `paths` — works at runtime + types)
- `@/*` → `./src/*` (tsconfig only — shadcn-style, types only)

`vite.config.ts` enables `resolve: { tsconfigPaths: true }`, so tsconfig paths resolve at build time.

**shadcn/ui:** Style `new-york`, base color `zinc`, CSS variables in `src/styles.css`. Aliases per `components.json`: components → `#/components`, ui → `#/components/ui`, utils → `#/lib/utils`, lib → `#/lib`, hooks → `#/hooks`. Icon library: `lucide-react`. The `cn()` helper in `src/lib/utils.ts` is the standard class-merging utility (clsx + tailwind-merge).

**Styling:** Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is CSS-first in `src/styles.css`). The root route imports it via `import appCss from '../styles.css?url'` and links it in `<head>`.

**TypeScript:** Strict mode + `noUnusedLocals` + `noUnusedParameters` + `verbatimModuleSyntax` (so use `import type` for type-only imports). Target ES2022, bundler module resolution.

**Linting:** `@tanstack/eslint-config` base, with these rules disabled in `eslint.config.js`: `import/no-cycle`, `import/order`, `sort-imports`, `@typescript-eslint/array-type`, `@typescript-eslint/require-await`, `pnpm/json-enforce-catalog`.

**Prettier:** No semicolons, single quotes, trailing commas everywhere.
