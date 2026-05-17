// Initial bearing from point 1 to point 2, in radians, measured
// clockwise from true north (matches Cesium's HeadingPitchRange.heading).
// https://www.movable-type.co.uk/scripts/latlong.html
export function bearingRad(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number,
): number {
  const lat1 = (lat1Deg * Math.PI) / 180
  const lat2 = (lat2Deg * Math.PI) / 180
  const dLon = ((lon2Deg - lon1Deg) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return Math.atan2(y, x)
}

// Equirectangular distance approximation, good enough for the short
// segments (<1 km) typical of GPS log spacing.
export function approxDistanceMeters(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number,
): number {
  const R = 6_371_000
  const lat1 = (lat1Deg * Math.PI) / 180
  const lat2 = (lat2Deg * Math.PI) / 180
  const x = ((lon2Deg - lon1Deg) * Math.PI) / 180 * Math.cos((lat1 + lat2) / 2)
  const y = lat2 - lat1
  return Math.sqrt(x * x + y * y) * R
}
