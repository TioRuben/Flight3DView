/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<any> }

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData()
          const file = formData.get('file') as File | null

          // Try to forward to existing client(s)
          const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          if (allClients && allClients.length > 0) {
            for (const client of allClients) {
              try {
                client.postMessage({ type: 'share-target', file })
              } catch (e) {
                // ignore per-client failures
              }
            }
          } else {
            // No client to message — open the app
            await self.clients.openWindow('/')
          }

          // Redirect to the app (303 See Other) so the browser navigates to the app
          return Response.redirect('/', 303)
        } catch (err) {
          return new Response('Share handling failed', { status: 500 })
        }
      })(),
    )
  }
})
