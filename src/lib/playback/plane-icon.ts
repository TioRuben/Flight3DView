// Inline plane SVG used as the aircraft billboard. Kept small and embedded
// as a data URL so we don't ship a separate asset. Swap to a Cesium Model
// entity (glTF) when we add a real airplane mesh under public/models/.
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#fb923c" stroke="#1f2937" stroke-width="0.8" stroke-linejoin="round">
  <path d="M12 1.5 L13.4 10 L22 12 L13.4 14 L12.5 21 L11 22 L9.5 21 L8.6 14 L0 12 L8.6 10 Z"/>
</svg>
`.trim()

export const PLANE_ICON_DATA_URL =
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG)
