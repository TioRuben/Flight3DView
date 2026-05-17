import type { Track, TrackSample } from './types.ts'
import { TrackParseError } from './types.ts'

export function parseGpx(text: string): Track {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new TrackParseError('Invalid GPX: malformed XML', 'gpx')
  }

  const samples: Array<TrackSample> = []
  for (const pt of Array.from(doc.querySelectorAll('trkpt'))) {
    const lat = parseFloat(pt.getAttribute('lat') ?? '')
    const lon = parseFloat(pt.getAttribute('lon') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const timeText = pt.querySelector('time')?.textContent
    const eleText = pt.querySelector('ele')?.textContent
    if (!timeText) continue
    const t = Date.parse(timeText.trim())
    if (!Number.isFinite(t)) continue
    const alt = eleText ? parseFloat(eleText) : 0
    samples.push({
      time: t,
      longitude: lon,
      latitude: lat,
      altitude: Number.isFinite(alt) ? alt : 0,
    })
  }

  if (samples.length === 0) {
    throw new TrackParseError('GPX contains no timestamped trkpt samples', 'gpx')
  }
  samples.sort((a, b) => a.time - b.time)

  const nameNode = doc.querySelector('trk > name') ?? doc.querySelector('name')
  const nameText = (nameNode?.textContent ?? '').trim() || undefined

  return {
    meta: { name: nameText, source: 'gpx' },
    samples,
  }
}
