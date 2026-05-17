import { useEffect, useRef, useState } from 'react'
import { JulianDate } from 'cesium'
import type { Viewer as CesiumViewerType } from 'cesium'

import type { PlaybackHandle } from '#/lib/playback/playback.ts'

export type PlaybackState = {
  isPlaying: boolean
  currentSeconds: number
  multiplier: number
  isUserOverridden: boolean
}

// Subscribed at ~10 Hz off requestAnimationFrame so progress UI ticks
// smoothly without re-rendering on every Cesium frame.
const UI_UPDATE_INTERVAL_MS = 100

export function usePlaybackState(
  viewer: CesiumViewerType | null,
  handle: PlaybackHandle | null,
): {
  state: PlaybackState
  play: () => void
  pause: () => void
  toggle: () => void
  setMultiplier: (m: number) => void
  seekSeconds: (seconds: number) => void
  recenter: () => void
} {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    currentSeconds: 0,
    multiplier: 1,
    isUserOverridden: false,
  })

  const lastUpdateRef = useRef(0)

  useEffect(() => {
    if (!viewer || !handle) return
    let rafId = 0

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      if (now - lastUpdateRef.current < UI_UPDATE_INTERVAL_MS) return
      lastUpdateRef.current = now
      const clock = viewer.clock
      const seconds = JulianDate.secondsDifference(clock.currentTime, handle.start)
      const overridden = handle.isUserOverridden()
      setState((prev) => {
        if (
          prev.isPlaying === clock.shouldAnimate &&
          prev.multiplier === clock.multiplier &&
          prev.isUserOverridden === overridden &&
          Math.abs(prev.currentSeconds - seconds) < 0.05
        ) {
          return prev
        }
        return {
          isPlaying: clock.shouldAnimate,
          currentSeconds: seconds,
          multiplier: clock.multiplier,
          isUserOverridden: overridden,
        }
      })
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [viewer, handle])

  const play = () => {
    if (!viewer || !handle) return
    const clock = viewer.clock
    // If we're at the end, rewind to start first so play actually does something.
    if (JulianDate.greaterThanOrEquals(clock.currentTime, handle.stop)) {
      clock.currentTime = handle.start.clone()
    }
    // Pressing play when the slider is parked at 0× should actually move.
    if (clock.multiplier === 0) clock.multiplier = 1
    clock.shouldAnimate = true
  }

  const pause = () => {
    if (!viewer) return
    viewer.clock.shouldAnimate = false
  }

  const toggle = () => {
    if (!viewer) return
    if (viewer.clock.shouldAnimate) pause()
    else play()
  }

  const setMultiplier = (m: number) => {
    if (!viewer) return
    viewer.clock.multiplier = m
  }

  const seekSeconds = (seconds: number) => {
    if (!viewer || !handle) return
    const clamped = Math.max(0, Math.min(seconds, handle.durationSeconds))
    viewer.clock.currentTime = JulianDate.addSeconds(
      handle.start,
      clamped,
      new JulianDate(),
    )
  }

  const recenter = () => {
    handle?.recenter()
  }

  return { state, play, pause, toggle, setMultiplier, seekSeconds, recenter }
}
