import { useState } from 'react'
import { Crosshair, Pause, Play, Upload } from 'lucide-react'

import { Button } from '#/components/ui/button.tsx'
import { Slider } from '#/components/ui/slider.tsx'
import { cn } from '#/lib/utils.ts'
import type { PlaybackState } from '#/hooks/use-playback-state.ts'

const SPEED_MIN = -100
const SPEED_MAX = 100
const SPEED_STEP = 5

type Props = {
  state: PlaybackState
  durationSeconds: number
  trackName?: string
  onToggle: () => void
  onSetMultiplier: (m: number) => void
  onSeekSeconds: (s: number) => void
  onUploadAnother: () => void
  onRecenter: () => void
}

export function TransportControls({
  state,
  durationSeconds,
  trackName,
  onToggle,
  onSetMultiplier,
  onSeekSeconds,
  onUploadAnother,
  onRecenter,
}: Props) {
  const [seekDrag, setSeekDrag] = useState<number | null>(null)
  const displaySeconds = seekDrag ?? state.currentSeconds

  const clampedSpeed = clamp(state.multiplier, SPEED_MIN, SPEED_MAX)

  return (
    <div
      className={cn(
        'absolute bottom-6 left-1/2 z-10 -translate-x-1/2',
        'flex w-[min(720px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl',
        'border border-border/60 bg-background/85 px-4 py-3 shadow-xl backdrop-blur-md',
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {trackName ?? 'Flight track'}
        </span>
        <span className="tabular-nums">
          {formatHMS(displaySeconds)} / {formatHMS(durationSeconds)}
        </span>
      </div>

      <Slider
        value={[displaySeconds]}
        min={0}
        max={Math.max(durationSeconds, 0.001)}
        step={0.1}
        onValueChange={(vals) => setSeekDrag(vals[0])}
        onValueCommit={(vals) => {
          onSeekSeconds(vals[0])
          setSeekDrag(null)
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* On mobile this wrapper is its own row (play + load).
            On sm+ `contents` unwraps it so Play and Load join the parent flex. */}
        <div className="flex items-center justify-between gap-2 sm:contents">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon-lg"
              aria-label={state.isPlaying ? 'Pause' : 'Play'}
              onClick={onToggle}
            >
              {state.isPlaying ? <Pause /> : <Play />}
            </Button>

            <Button
              type="button"
              size="icon-lg"
              variant="secondary"
              aria-label="Center view on aircraft"
              title="Center view on aircraft"
              disabled={!state.isUserOverridden}
              onClick={onRecenter}
            >
              <Crosshair />
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onUploadAnother}
            className="sm:order-last"
          >
            <Upload className="size-4" />
            Load another
          </Button>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <span className="hidden text-xs text-muted-foreground select-none sm:inline">
            −100×
          </span>
          <Slider
            value={[clampedSpeed]}
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            onValueChange={(vals) => onSetMultiplier(vals[0])}
            aria-label="Playback speed"
            className="flex-1"
          />
          <span className="hidden text-xs text-muted-foreground select-none sm:inline">
            +100×
          </span>
          <div className="min-w-14 rounded-md bg-secondary px-2 py-1 text-center text-xs font-medium tabular-nums">
            {formatSpeed(clampedSpeed)}
          </div>
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function formatSpeed(m: number): string {
  if (m === 0) return '0×'
  return `${m > 0 ? '+' : ''}${m}×`
}

function formatHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}
