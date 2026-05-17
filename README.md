# 3d-flight

A purely client-side web app that replays GPS tracks (GPX, KML/KMZ, IGC, …) as a 3D flight over a Cesium globe.

## Getting started

```bash
yarn install
yarn dev
```

The dev server runs on http://localhost:3000.

You'll need a [Cesium ion](https://ion.cesium.com/) access token on first run — the app prompts for one and stores it in `localStorage`.

## Building

```bash
yarn build
```

Output goes to `dist/` as a static SPA (HTML + JS + CSS + assets). Deploy by copying `dist/` to any static host (GitHub Pages, Cloudflare Pages, S3, Netlify, plain Nginx, etc).

```bash
yarn preview
```

Serves the `dist/` build locally for sanity checking before deploy.

## Stack

- Vite + React 19
- Tailwind CSS v4 (CSS-first config in `src/styles.css`)
- shadcn/ui (new-york / zinc)
- Cesium via [Resium](https://resium.darwineducation.com/)

## Scripts

```bash
yarn dev          # vite dev server
yarn build        # production build → dist/
yarn preview      # preview the production build
yarn test         # vitest (run once)
yarn lint         # eslint
yarn format       # prettier --write + eslint --fix
yarn check        # prettier --check
```

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <name>
```

(Everything else uses yarn; shadcn's CLI is invoked via `pnpm dlx` per `.cursorrules`.)

## License

[MIT](LICENSE)
