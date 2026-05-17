import type { Track, TrackSample } from './types.ts'
import { TrackParseError } from './types.ts'

export function parseKml(text: string): Track {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new TrackParseError('Invalid KML: malformed XML', 'kml')
  }

  const samples = readGxTrack(doc) ?? readLineString(doc)
  if (!samples || samples.length === 0) {
    throw new TrackParseError(
      'KML contains no gx:Track or timestamped LineString',
      'kml',
    )
  }
  samples.sort((a, b) => a.time - b.time)

  const nameText = (doc.querySelector('name')?.textContent ?? '').trim() || undefined
  return { meta: { name: nameText, source: 'kml' }, samples }
}

function readGxTrack(doc: Document): Array<TrackSample> | null {
  const tracks = doc.getElementsByTagNameNS('*', 'Track')
  if (tracks.length === 0) return null
  const out: Array<TrackSample> = []
  for (const track of Array.from(tracks)) {
    const whens = Array.from(track.getElementsByTagName('when'))
    const coords = Array.from(track.getElementsByTagNameNS('*', 'coord'))
    const count = Math.min(whens.length, coords.length)
    for (let j = 0; j < count; j++) {
      const whenText = whens[j].textContent
      const coordText = coords[j].textContent
      if (!whenText || !coordText) continue
      const t = Date.parse(whenText.trim())
      const parts = coordText.trim().split(/\s+/)
      if (parts.length < 2 || !Number.isFinite(t)) continue
      const lon = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      const alt = parts.length > 2 ? parseFloat(parts[2]) : 0
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
      out.push({
        time: t,
        longitude: lon,
        latitude: lat,
        altitude: Number.isFinite(alt) ? alt : 0,
      })
    }
  }
  return out
}

function readLineString(doc: Document): Array<TrackSample> | null {
  // Fallback: pair a TimeStamp/TimeSpan-less LineString's vertices with
  // synthetic 1-second-spaced timestamps so playback still works. Only do
  // this when no gx:Track exists.
  const coordsText = doc.querySelector('LineString > coordinates')?.textContent
  if (!coordsText) return null
  const tuples = coordsText
    .trim()
    .split(/\s+/)
    .map((tuple) => tuple.split(',').map(parseFloat))
    .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
  if (tuples.length === 0) return null
  const start = Date.now()
  return tuples.map((parts, idx) => ({
    time: start + idx * 1000,
    longitude: parts[0],
    latitude: parts[1],
    altitude: parts.length > 2 && Number.isFinite(parts[2]) ? parts[2] : 0,
  }))
}
