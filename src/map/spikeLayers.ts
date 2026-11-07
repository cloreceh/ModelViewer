import type { Map as MapLibreMap } from 'maplibre-gl'
import { omFileUrl, type Dataset } from '../data/openmeteo/mapSources'
import type { RunInfo } from '../data/openmeteo/runs'

// Tech spike 1: two test layers. Pick one by adding ?layer=... to the
// address, e.g. /?layer=gfs-500. These get replaced by the real catalog later.
export const SPIKE_LAYERS = {
  'hrrr-t2m': { label: 'HRRR 2 m temperature', dataset: 'ncep_hrrr_conus' },
  'gfs-500': { label: 'GFS 500 mb heights and wind', dataset: 'ncep_gfs025' },
} as const satisfies Record<string, { label: string; dataset: Dataset }>

export type SpikeLayer = keyof typeof SPIKE_LAYERS

export function pickSpikeLayer(): SpikeLayer {
  const value = new URLSearchParams(window.location.search).get('layer')
  return value === 'gfs-500' ? 'gfs-500' : 'hrrr-t2m'
}

// Adds the weather layers for one run and valid time underneath `beforeId`,
// so borders and city names stay readable on top of the colors.
export function addSpikeLayer(
  map: MapLibreMap,
  layer: SpikeLayer,
  run: RunInfo,
  validTime: Date,
  beforeId?: string,
) {
  if (layer === 'hrrr-t2m') {
    map.addSource('weather', {
      type: 'raster',
      url: omFileUrl(run, validTime, 'temperature_2m'),
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
    url: omFileUrl(run, validTime, 'wind_speed_500hPa'),
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
    url: omFileUrl(run, validTime, 'geopotential_height_500hPa', {
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
