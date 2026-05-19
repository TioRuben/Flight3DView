import { defineConfig, loadEnv } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'

const APP_NAME = 'Flight3d Replay'
const APP_SHORT_NAME = 'Flight3d'
const APP_DESCRIPTION =
  'Replay GPS tracks as a Flight3d over a Cesium globe. Drop in GPX, KML, IGC, or Flightradar24 CSV.'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appUrl = (env.VITE_APP_URL || '').replace(/\/+$/, '')

  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      viteReact(),
      cesium(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: null,
        injectManifest: {
          // Increase maximum precache size to accommodate Cesium's bundle.
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
        includeAssets: ['favicon.ico', 'robots.txt', 'logo192.png', 'logo512.png'],
        manifest: {
          id: appUrl ? `${appUrl}/` : '/',
          name: APP_NAME,
          short_name: APP_SHORT_NAME,
          description: APP_DESCRIPTION,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#000000',
          theme_color: '#000000',
          categories: ['navigation', 'travel', 'utilities'],
          icons: [
            { src: 'logo192.png', sizes: '192x192', type: 'image/png' },
            { src: 'logo512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'logo512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
          launch_handler: { client_mode: ['navigate-existing', 'auto'] },
          file_handlers: [
            {
              action: '/',
              accept: {
                'application/gpx+xml': ['.gpx'],
                'application/vnd.google-earth.kml+xml': ['.kml'],
                'application/octet-stream': ['.igc'],
                'text/csv': ['.csv'],
              },
              launch_type: 'single-client',
              icons: [{ src: 'logo192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
          // Support incoming shares from other Android apps (Share sheet).
          // Web Share Target requires a `share_target` manifest entry. The
          // service worker (src/sw.ts) will receive the POST at `/share` and
          // forward the file to the client via postMessage.
          share_target: {
            action: '/share',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              files: [
                {
                  name: 'file',
                  accept: [
                    '.gpx',
                    '.kml',
                    '.igc',
                    '.csv',
                    'application/gpx+xml',
                    'application/vnd.google-earth.kml+xml',
                    'text/csv',
                  ],
                },
              ],
            },
          },
        } as unknown as ManifestOptions,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          // Cesium streams tiles/imagery from external endpoints. Don't precache them.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/sockjs-node\//],
          // 5 MB cap is too small once Cesium's bundle chunk gets in; bump it.
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.origin === 'https://fonts.googleapis.com' ||
                url.origin === 'https://fonts.gstatic.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts' },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
