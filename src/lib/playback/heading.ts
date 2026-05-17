import type { Track, TrackSample } from '#/lib/parsers/index.ts'
import { bearingRad } from './geo.ts'

const LOOKAHEAD_SECONDS = 3

// Precompute per-sample headings, smoothed by averaging the bearings to all
// future track samples within LOOKAHEAD_SECONDS. Averaging is done on the
// unit-circle (sum of cos/sin) so wraparound at ±π is handled correctly.
//
// At playback time we re-blend the precomputed values with the previous
// frame's heading (in playback.ts), which gives a second pass of smoothing
// that hides the remaining stair-step from low-rate GPS without lagging
// behind real turns.
export function precomputeHeadings(track: Track): Float64Array {
  const samples = track.samples
  const n = samples.length
  const out = new Float64Array(n)
  if (n < 2) return out

  for (let i = 0; i < n; i++) {
    const here = samples[i]
    const windowEnd = here.time + LOOKAHEAD_SECONDS * 1000
    let cosSum = 0
    let sinSum = 0
    let count = 0
    for (let j = i + 1; j < n; j++) {
      const next = samples[j]
      if (next.time > windowEnd) break
      if (next.latitude === here.latitude && next.longitude === here.longitude) {
        continue
      }
      const b = bearingRad(here.latitude, here.longitude, next.latitude, next.longitude)
      cosSum += Math.cos(b)
      sinSum += Math.sin(b)
      count++
    }
    if (count === 0) {
      // End of track or stationary: fall back to previous heading.
      out[i] = i > 0 ? out[i - 1] : 0
    } else {
      out[i] = Math.atan2(sinSum, cosSum)
    }
  }
  return out
}

// Linear interpolation of a heading at an arbitrary time, with proper
// wrap-around handling. Returns radians in (-π, π].
export function headingAt(
  samples: ReadonlyArray<TrackSample>,
  headings: Float64Array,
  timeMs: number,
): number {
  const n = samples.length
  if (n === 0) return 0
  if (timeMs <= samples[0].time) return headings[0]
  if (timeMs >= samples[n - 1].time) return headings[n - 1]

  // Binary search
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].time <= timeMs) lo = mid
    else hi = mid
  }
  const t0 = samples[lo].time
  const t1 = samples[hi].time
  const u = t1 === t0 ? 0 : (timeMs - t0) / (t1 - t0)
  return lerpAngle(headings[lo], headings[hi], u)
}

export function lerpAngle(a: number, b: number, t: number): number {
  // Shortest-arc lerp
  let diff = b - a
  if (diff > Math.PI) diff -= 2 * Math.PI
  else if (diff < -Math.PI) diff += 2 * Math.PI
  return a + diff * t
}
