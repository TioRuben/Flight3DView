import { registerSW } from 'virtual:pwa-register'
import { parseTrackFile } from '#/lib/parsers/index.ts'
import type { Track } from '#/lib/parsers/index.ts'

export function registerPwa() {
  registerSW({ immediate: true })
}

type LaunchParams = {
  readonly files: ReadonlyArray<FileSystemHandle>
}

type LaunchQueue = {
  setConsumer: (consumer: (params: LaunchParams) => void) => void
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue
  }
}

// Subscribes to OS-level "open with" launches. The PWA must be installed for
// this to fire. Currently Chromium-only; gracefully no-ops elsewhere.
export function listenForLaunchedFiles(
  onTrack: (track: Track) => void,
  onError: (message: string) => void,
): () => void {
  const queue = typeof window !== 'undefined' ? window.launchQueue : undefined
  if (!queue) return () => {}

  queue.setConsumer(async (params) => {
    if (params.files.length === 0) return
    const handle = params.files[0]
    if (handle.kind !== 'file') return
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      const track = await parseTrackFile(file)
      onTrack(track)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to open file')
    }
  })

  return () => {}
}

// Listen for Web Share Target messages from the service worker. The service
// worker posts `{ type: 'share-target', file }` where `file` is a `File`.
export function listenForSharedFiles(
  onTrack: (track: Track) => void,
  onError: (message: string) => void,
): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  const handler = async (ev: MessageEvent) => {
    try {
      const data = ev.data
      if (!data || data.type !== 'share-target') return
      const file = data.file as File | undefined | null
      if (!file) return
      const track = await parseTrackFile(file)
      onTrack(track)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to open shared file')
    }
  }

  navigator.serviceWorker.addEventListener('message', handler)
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler)
  }
}
