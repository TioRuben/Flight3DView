import { parseGpx } from './gpx.ts'
import { parseKml } from './kml.ts'
import { parseIgc } from './igc.ts'
import { parseFr24Csv } from './fr24-csv.ts'
import { TrackParseError } from './types.ts'
import type { Track, TrackFormat } from './types.ts'

export type { Track, TrackFormat, TrackSample, TrackMeta } from './types.ts'
export { TrackParseError } from './types.ts'

export async function parseTrackFile(file: File): Promise<Track> {
  const text = await file.text()
  const format = detectFormat(file.name, text)
  switch (format) {
    case 'gpx':
      return parseGpx(text)
    case 'kml':
      return parseKml(text)
    case 'igc':
      return parseIgc(text)
    case 'fr24-csv':
      return parseFr24Csv(text)
    default:
      throw new TrackParseError(
        `Unrecognized file format for "${file.name}". Supported: GPX, KML, IGC, Flightradar24 CSV.`,
      )
  }
}

function detectFormat(name: string, text: string): TrackFormat | null {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  if (ext === 'igc') return 'igc'
  if (ext === 'csv') return 'fr24-csv'

  // Fallback: sniff content. Cheap heuristics on the first ~512 chars.
  const head = text.slice(0, 512)
  if (/<gpx[\s>]/i.test(head)) return 'gpx'
  if (/<kml[\s>]/i.test(head)) return 'kml'
  if (/^AX[A-Z0-9]{3}|^HFDTE/m.test(head)) return 'igc'
  if (/^Timestamp,UTC,Callsign,Position/i.test(head)) return 'fr24-csv'
  return null
}
