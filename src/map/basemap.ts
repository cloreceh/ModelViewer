import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from './productLayers'

// Basemap styles from OpenFreeMap (free, no API key).
export const BASEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

// Starting view: the lower 48 states [west, south, east, north].
export const CONUS_BOUNDS: [number, number, number, number] = [
  -125, 24, -66.5, 49.5,
]

// The parts of a MapLibre map that tuneBasemap uses (kept small so the
// tests can pass in a stand-in).
export interface BasemapTarget {
  getStyle(): { layers: LayerSpecification[] }
  setPaintProperty(layerId: string, name: string, value: unknown): unknown
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown
  setLayerZoomRange(layerId: string, minzoom: number, maxzoom: number): unknown
}

// How strongly roads, railways and runways draw (Week 5 basemap pass).
// Dark roads were the boldest thing on the phone in Week 4, so they get
// the most toning down.
export const ROAD_OPACITY: Record<Theme, number> = { light: 0.6, dark: 0.4 }

// Zoom levels where basemap details first appear. At the CONUS view
// (about zoom 2 to 4 on a phone) only states, the largest cities and
// countries are labeled; roads appear at regional zoom.
export const MIN_ZOOM = {
  roads: 6,
  roadNames: 10,
  waterNames: 5,
  cities: 5,
  towns: 7,
  villages: 8,
} as const

// The largest labels in the dark style are 14 px; keep them at 12 px.
const MAX_LABEL_SIZE = 12

function sourceLayer(layer: LayerSpecification): string | undefined {
  return 'source-layer' in layer ? layer['source-layer'] : undefined
}

// Which place labels a layer holds, from its name. OpenFreeMap's Positron
// and Dark styles name these layers differently (label_city, place_city),
// so this goes by the words in the name instead of exact layer IDs.
function placeKind(
  id: string,
): 'country' | 'state' | 'largeCity' | 'city' | 'town' | 'village' {
  if (id.includes('country')) return 'country'
  if (id.includes('state')) return 'state'
  if (id.includes('capital') || id.includes('large')) return 'largeCity'
  if (id.includes('city')) return 'city'
  if (id.includes('town')) return 'town'
  return 'village' // village, suburb, hamlet, other
}

// Tone the basemap down so the weather colors lead: lighter roads that
// only appear once zoomed in, fewer and smaller labels at the CONUS view,
// and no basemap state lines (the app draws its own, from the Census).
// Changes the loaded OpenFreeMap style in place, so the basemap keeps
// getting OpenFreeMap's updates. Call it on "style.load", before the
// app's own layers are added.
export function tuneBasemap(map: BasemapTarget, theme: Theme): void {
  const raiseMinZoom = (layer: LayerSpecification, zoom: number) => {
    const min = Math.max(layer.minzoom ?? 0, zoom)
    const max = layer.maxzoom ?? 24
    // A layer that only drew below the new minimum (like the "subtle"
    // low-zoom road layers) is hidden instead.
    if (min >= max) map.setLayoutProperty(layer.id, 'visibility', 'none')
    else map.setLayerZoomRange(layer.id, min, max)
  }

  for (const layer of map.getStyle().layers) {
    const src = sourceLayer(layer)

    if (src === 'transportation' || src === 'aeroway') {
      if (layer.type === 'line') {
        map.setPaintProperty(layer.id, 'line-opacity', ROAD_OPACITY[theme])
      }
      if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-opacity', ROAD_OPACITY[theme])
      }
      raiseMinZoom(layer, MIN_ZOOM.roads)
    } else if (src === 'transportation_name' || src === 'aerodrome_label') {
      raiseMinZoom(layer, MIN_ZOOM.roadNames)
    } else if (src === 'boundary') {
      // State and province lines (admin levels 3 and 4); country borders stay.
      if (layer.id.includes('state') || layer.id.endsWith('_3')) {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
      }
    } else if (src === 'water_name' || src === 'waterway') {
      if (layer.type === 'symbol') raiseMinZoom(layer, MIN_ZOOM.waterNames)
    } else if (src === 'place' && layer.type === 'symbol') {
      const kind = placeKind(layer.id)
      if (kind === 'city') raiseMinZoom(layer, MIN_ZOOM.cities)
      if (kind === 'town') raiseMinZoom(layer, MIN_ZOOM.towns)
      if (kind === 'village') raiseMinZoom(layer, MIN_ZOOM.villages)
      const size = layer.layout?.['text-size']
      if (typeof size === 'number' && size > MAX_LABEL_SIZE) {
        map.setLayoutProperty(layer.id, 'text-size', MAX_LABEL_SIZE)
      }
    }
  }
}
