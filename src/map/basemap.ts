// Basemap styles from OpenFreeMap (free, no API key).
export const BASEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

// Starting view: the lower 48 states [west, south, east, north].
export const CONUS_BOUNDS: [number, number, number, number] = [
  -125, 24, -66.5, 49.5,
]
