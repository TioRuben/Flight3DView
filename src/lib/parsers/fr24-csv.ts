import type { Track, TrackSample } from './types.ts'
import { TrackParseError } from './types.ts'

// Flightradar24 KML/CSV exports look like:
//   Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction
//   1626188400,2021-07-13T13:00:00Z,DLH401,"40.65122,-73.78947",0,0,0
// Altitude is in feet, Position is "lat,lon" (quoted).

const FEET_TO_METERS = 0.3048

export function parseFr24Csv(text: string): Track {
  const rows: Array<Array<string>> = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) continue
    rows.push(splitCsvRow(line))
  }
  if (rows.length < 2) {
    throw new TrackParseError('CSV has no data rows', 'fr24-csv')
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = {
    timestamp: header.indexOf('timestamp'),
    utc: header.indexOf('utc'),
    callsign: header.indexOf('callsign'),
    position: header.indexOf('position'),
    altitude: header.indexOf('altitude'),
  }
  if (idx.position === -1 || (idx.timestamp === -1 && idx.utc === -1)) {
    throw new TrackParseError(
      "CSV doesn't look like Flightradar24 export (missing Position or time column)",
      'fr24-csv',
    )
  }

  const samples: Array<TrackSample> = []
  let callsign: string | undefined
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (idx.callsign !== -1 && !callsign) callsign = cols[idx.callsign]?.trim() || undefined

    const t = readTime(cols, idx)
    if (!Number.isFinite(t)) continue
    const pos = cols[idx.position]?.trim() ?? ''
    const [latStr, lonStr] = pos.split(',')
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const altFeet = idx.altitude !== -1 ? parseFloat(cols[idx.altitude]) : 0
    const altitude = Number.isFinite(altFeet) ? altFeet * FEET_TO_METERS : 0
    samples.push({ time: t, longitude: lon, latitude: lat, altitude })
  }

  if (samples.length === 0) {
    throw new TrackParseError('CSV has no usable rows', 'fr24-csv')
  }
  samples.sort((a, b) => a.time - b.time)
  return { meta: { name: callsign, source: 'fr24-csv' }, samples }
}

function readTime(cols: Array<string>, idx: { timestamp: number; utc: number }): number {
  if (idx.utc !== -1) {
    const t = Date.parse(cols[idx.utc]?.trim() ?? '')
    if (Number.isFinite(t)) return t
  }
  if (idx.timestamp !== -1) {
    const epoch = parseFloat(cols[idx.timestamp])
    if (Number.isFinite(epoch)) return epoch * 1000
  }
  return NaN
}

function splitCsvRow(line: string): Array<string> {
  const out: Array<string> = []
  let buf = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          buf += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        buf += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  out.push(buf)
  return out
}
