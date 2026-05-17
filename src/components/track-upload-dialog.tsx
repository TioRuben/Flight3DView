import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { parseTrackFile, TrackParseError } from '#/lib/parsers/index.ts'
import type { Track } from '#/lib/parsers/index.ts'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoaded: (track: Track) => void
}

export function TrackUploadDialog({ open, onOpenChange, onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const track = await parseTrackFile(file)
      onLoaded(track)
      onOpenChange(false)
    } catch (err) {
      const msg =
        err instanceof TrackParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to read file'
      setError(msg)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load a flight track</DialogTitle>
          <DialogDescription>
            GPX, KML, IGC, or Flightradar24 CSV exports.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".gpx,.kml,.igc,.csv,application/gpx+xml,application/vnd.google-earth.kml+xml,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full"
          >
            <Upload />
            {busy ? 'Reading…' : 'Choose file'}
          </Button>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
