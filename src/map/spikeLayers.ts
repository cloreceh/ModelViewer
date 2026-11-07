import type { Map as MapLibreMap } from 'maplibre-gl'
import { omUrl } from '../data/openmeteo/mapSources'

// Tech spike 1: two test layers. Pick one by adding ?layer=... to the
// address, e.g. /?layer=gfs-500. These get replaced by the real catalog later.
export const SPIKE_LAYERS = {
  'hrrr-t2m': 'HRRR 2 m temperature',
  'gfs-500': 'GFS 500 mb heights and wind',
} as const

export type SpikeLayer = keyof typeof SPIKE_LAYERS

export function pickSpikeLayer(): SpikeLayer {
  const value = new URLSearchParams(window.location.search).get('layer')
  return value === 'gfs-500' ? 'gfs-500' : 'hrrr-t2m'
}

// Adds the weather layers underneath `beforeId` (the first label layer),
// so city names and borders stay readable on top of the colors.
export function addSpikeLayer(
  map: MapLibreMap,
  layer: SpikeLayer,
  beforeId?: string,
) {
  if (layer === 'hrrr-t2m') {
    map.addSource('weather', {
      type: 'raster',
      url: omUrl('ncep_hrrr_conus', 'temperature_2m'),
    })
    map.addLayer(
      {
        id: 'weather',
        type: 'raster',
        source: 'weather',
        paint: { 'raster-opacity': 0.75 },
      },
      beforeId,
    )
    return
  }

  // GFS 500 mb: wind speed shading with height contours every 60 m.
  map.addSource('weather', {
    type: 'raster',
    url: omUrl('ncep_gfs025', 'wind_speed_500hPa'),
  })
  map.addLayer(
    {
      id: 'weather',
      type: 'raster',
      source: 'weather',
      paint: { 'raster-opacity': 0.75 },
    },
    beforeId,
  )
  map.addSource('weather-contours', {
    type: 'vector',
    url: omUrl('ncep_gfs025', 'geopotential_height_500hPa', {
      contours: 'true',
      intervals: '60',
    }),
  })
  map.addLayer(
    {
      id: 'weather-contours',
      type: 'line',
      source: 'weather-contours',
      'source-layer': 'contours',
      paint: { 'line-color': '#1e1e1e', 'line-width': 1.2 },
    },
    beforeId,
  )
}