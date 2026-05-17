export type TrackSample = {
  time: number
  longitude: number
  latitude: number
  altitude: number
}

export type TrackMeta = {
  name?: string
  description?: string
  source: TrackFormat
}

export type TrackFormat = 'gpx' | 'kml' | 'igc' | 'fr24-csv'

export type Track = {
  meta: TrackMeta
  samples: ReadonlyArray<TrackSample>
}

export class TrackParseError extends Error {
  readonly format: TrackFormat | 'unknown'
  constructor(message: string, format: TrackFormat | 'unknown' = 'unknown') {
    super(message)
    this.name = 'TrackParseError'
    this.format = format
  }
}
