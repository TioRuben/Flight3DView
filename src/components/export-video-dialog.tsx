import { useEffect, useRef, useState } from 'react'
import { Video } from 'lucide-react'
import type { Viewer as CesiumViewerType } from 'cesium'

import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Progress } from '#/components/ui/progress.tsx'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  VideoExportUnsupportedError,
  exportVideo,
} from '#/lib/export/video-export.ts'
import type { ExportFps, ExportResolution } from '#/lib/export/video-export.ts'
import type { PlaybackHandle } from '#/lib/playback/playback.ts'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewer: CesiumViewerType
  handle: PlaybackHandle
  multiplier: number
  trackName?: string
}

const RESOLUTION_LABELS: Array<{
  value: ExportResolution
  label: string
  sub: string
}> = [
  { value: '720p-landscape', label: '720p landscape', sub: '1280 × 720' },
  { value: '1080p-landscape', label: '1080p landscape', sub: '1920 × 1080' },
  { value: '720p-portrait', label: '720p portrait', sub: '720 × 1280' },
  { value: '1080p-portrait', label: '1080p portrait', sub: '1080 × 1920' },
]

const FPS_OPTIONS: Array<ExportFps> = [25, 30]

export function ExportVideoDialog({
  open,
  onOpenChange,
  viewer,
  handle,
  multiplier,
  trackName,
}: Props) {
  const [resolution, setResolution] =
    useState<ExportResolution>('1080p-landscape')
  const [fps, setFps] = useState<ExportFps>(30)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [frame, setFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // If the dialog is closed externally while encoding, abort to clean up.
  useEffect(() => {
    if (!open && busy) abortRef.current?.abort()
  }, [open, busy])

  const effectiveMultiplier =
    Math.abs(multiplier) >= 1 ? Math.abs(multiplier) : 1
  const exportSeconds = handle.durationSeconds / effectiveMultiplier

  async function handleExport() {
    setError(null)
    setBusy(true)
    setProgress(0)
    setFrame(0)
    setTotalFrames(0)
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const blob = await exportVideo(viewer, handle, {
        resolution,
        fps,
        multiplier: effectiveMultiplier,
        signal: ac.signal,
        onProgress: (fraction, f, total) => {
          setProgress(fraction)
          setFrame(f)
          setTotalFrames(total)
        },
      })
      triggerDownload(blob, trackName)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted — silent close path is handled by the abort button.
        return
      }
      const msg =
        err instanceof VideoExportUnsupportedError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Export failed'
      setError(msg)
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  function handleAbort() {
    abortRef.current?.abort()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't allow closing the dialog mid-encode by clicking outside; user
        // must explicitly abort. (busy=true and onOpenChange would otherwise
        // tear down state we still need.)
        if (busy && !next) {
          handleAbort()
          return
        }
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{busy ? 'Encoding…' : 'Export video'}</DialogTitle>
          <DialogDescription>
            {busy
              ? `${frame.toLocaleString()} / ${totalFrames.toLocaleString()} frames`
              : `MP4 H.264 • ${formatDuration(exportSeconds)} at ${effectiveMultiplier}× playback speed`}
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col gap-3">
            <Progress value={Math.round(progress * 100)} />
            <p className="text-xs tabular-nums text-muted-foreground">
              {Math.round(progress * 100)}%
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Resolution</Label>
              <RadioGroup
                value={resolution}
                onValueChange={(v) => setResolution(v as ExportResolution)}
                className="grid-cols-2"
              >
                {RESOLUTION_LABELS.map((r) => (
                  <Label
                    key={r.value}
                    htmlFor={`res-${r.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-3 hover:bg-accent/40"
                  >
                    <RadioGroupItem value={r.value} id={`res-${r.value}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-tight">
                        {r.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.sub}
                      </span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Frame rate</Label>
              <RadioGroup
                value={String(fps)}
                onValueChange={(v) => setFps(Number(v) as ExportFps)}
                className="grid-cols-2"
              >
                {FPS_OPTIONS.map((f) => (
                  <Label
                    key={f}
                    htmlFor={`fps-${f}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-3 hover:bg-accent/40"
                  >
                    <RadioGroupItem value={String(f)} id={`fps-${f}`} />
                    <span className="text-sm font-medium">{f} fps</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {busy ? (
            <Button type="button" variant="secondary" onClick={handleAbort}>
              Abort
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleExport}>
                <Video />
                Export
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function triggerDownload(blob: Blob, trackName: string | undefined) {
  const stamp = formatStamp(new Date())
  const base = trackName
    ? trackName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_')
    : 'flight'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}-${stamp}.mp4`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function formatStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return m > 0 ? `${m}m ${ss}s` : `${ss}s`
}
