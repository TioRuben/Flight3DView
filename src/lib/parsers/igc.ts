import type { Track, TrackSample } from './types.ts'
import { TrackParseError } from './types.ts'

// IGC reference: https://xp-soaring.github.io/igc_file_format/index.html
// B record layout (column positions, 0-based):
//   0       'B'
//   1-7     HHMMSS (UTC time of day)
//   7-15    DDMMmmm (lat degrees+minutes, last 3 chars are thousandths of minute)
//   15      'N' or 'S'
//   15-24   DDDMMmmm (lon)
//   24      'E' or 'W'
//   24      'A' or 'V' (valid 3D fix)
//   25-30   pressure altitude (5 digits, may be 0 if not used)
//   30-35   GPS altitude (5 digits, preferred when nonzero)

export function parseIgc(text: string): Track {
  const lines = text.split(/\r?\n/)
  let baseDate: number | null = null
  let pilot: string | undefined
  const samples: Array<TrackSample> = []
  let lastTimeOfDay = -1
  let dayOffset = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (line.startsWith('HFDTE')) {
      baseDate = parseHfdte(line)
    } else if (line.startsWith('HFPLT') || line.startsWith('HFPLTPILOT')) {
      pilot = line.split(':').slice(1).join(':').trim() || undefined
    } else if (line.startsWith('B') && baseDate != null && line.length >= 35) {
      const hh = parseInt(line.slice(1, 3), 10)
      const mm = parseInt(line.slice(3, 5), 10)
      const ss = parseInt(line.slice(5, 7), 10)
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) continue
      const tod = hh * 3600 + mm * 60 + ss
      if (tod < lastTimeOfDay - 60) dayOffset += 86_400 // crossed UTC midnight
      lastTimeOfDay = tod

      const latDeg = parseInt(line.slice(7, 9), 10)
      const latMinThousandths = parseInt(line.slice(9, 14), 10)
      const latHem = line[14]
      const lonDeg = parseInt(line.slice(15, 18), 10)
      const lonMinThousandths = parseInt(line.slice(18, 23), 10)
      const lonHem = line[23]
      const validity = line[24]
      const pressAlt = parseInt(line.slice(25, 30), 10)
      const gpsAlt = parseInt(line.slice(30, 35), 10)

      if (validity === 'V') continue
      if (
        !Number.isFinite(latDeg) ||
        !Number.isFinite(latMinThousandths) ||
        !Number.isFinite(lonDeg) ||
        !Number.isFinite(lonMinThousandths)
      ) {
        continue
      }
      let lat = latDeg + latMinThousandths / 1000 / 60
      if (latHem === 'S') lat = -lat
      let lon = lonDeg + lonMinThousandths / 1000 / 60
      if (lonHem === 'W') lon = -lon
      const altitude = Number.isFinite(gpsAlt) && gpsAlt !== 0 ? gpsAlt : pressAlt

      samples.push({
        time: baseDate + (tod + dayOffset) * 1000,
        longitude: lon,
        latitude: lat,
        altitude: Number.isFinite(altitude) ? altitude : 0,
      })
    }
  }

  if (samples.length === 0) {
    throw new TrackParseError('IGC contains no usable B records', 'igc')
  }
  return { meta: { name: pilot, source: 'igc' }, samples }
}

function parseHfdte(line: string): number | null {
  // Legacy:  "HFDTE150724"  → DDMMYY
  // Modern:  "HFDTEDATE:150724,01"
  const m = line.match(/(\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const dd = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const yy = parseInt(m[3], 10)
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return null
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  return Date.UTC(year, mm - 1, dd)
}
