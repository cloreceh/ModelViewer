import type {
  LayerSpecification,
  Map as MapLibreMap,
  RasterTileSource,
  VectorTileSource,
} from 'maplibre-gl'
import { variableIsAccumulated } from '@openmeteo/weather-map-layer'
import { omFileUrl, type Dataset } from '../data/openmeteo/mapSources'
import type { RunInfo } from '../data/openmeteo/runs'
import { reflectivityTiles, type IemRun } from '../data/iem/reflectivity'

// Tech spikes 1 and 2: test layers. Pick one by adding ?layer=... to the
// address, e.g. /?layer=hrrr-refl. These get replaced by the real catalog later.
export const SPIKE_LAYERS = {
  'hrrr-t2m': { label: 'HRRR 2 m temperature', dataset: 'ncep_hrrr_conus' },
  'gfs-500': { label: 'GFS 500 mb heights and wind', dataset: 'ncep_gfs025' },
  'hrrr-refl': {
    label: 'HRRR simulated reflectivity (IEM)',
    dataset: 'ncep_hrrr_conus',
  },
} as const satisfies Record<string, { label: string; dataset: Dataset }>

export type SpikeLayer = keyof typeof SPIKE_LAYERS

// Open-Meteo fields each test layer reads.
const SPIKE_VARIABLES: Record<SpikeLayer, string[]> = {
  'hrrr-t2m': ['temperature_2m'],
  'gfs-500': ['wind_speed_500hPa', 'geopotential_height_500hPa'],
  'hrrr-refl': [], // IEM tiles only, no Open-Meteo fields
}

// Totals like precipitation don't exist in a run's first file (nothing has
// added up yet), so layers that use them start at the run's second hour.
export function firstHourIndex(layer: SpikeLayer): number {
  return SPIKE_VARIABLES[layer].some((v) => variableIsAccumulated(v)) ? 1 : 0
}

export function pickSpikeLayer(): SpikeLayer {
  const value = new URLSearchParams(window.location.search).get('layer')
  return value === 'gfs-500' || value === 'hrrr-refl' ? value : 'hrrr-t2m'
}

// One map source and the layer that draws it.
interface SourceSpec {
  id: string
  type: 'raster' | 'vector'
  url?: string // om:// file address (Open-Meteo)
  tiles?: string[] // tile address template (IEM)
  hidden?: boolean // true when there's no data for this valid time
  layer: Omit<LayerSpecification, 'id' | 'source'> & Record<string, unknown>
}

// Everything a spike layer needs for one valid time, bottom to top.
function sourceSpecs(
  layer: SpikeLayer,
  run: RunInfo,
  validTime: Date,
  iemRun?: IemRun,
): SourceSpec[] {
  const shaded = (variable: string, opacity = 0.75): SourceSpec => ({
    id: 'weather',
    type: 'raster',
    url: omFileUrl(run, validTime, variable),
    layer: { type: 'raster', paint: { 'raster-opacity': opacity } },
  })

  if (layer === 'hrrr-t2m') return [shaded('temperature_2m')]

  if (layer === 'gfs-500') {
    return [
      shaded('wind_speed_500hPa'),
      {
        id: 'weather-contours',
        type: 'vector',
        url: omFileUrl(run, validTime, 'geopotential_height_500hPa', {
          contours: 'true',
          intervals: '60',
        }),
        layer: {
          type: 'line',
          'source-layer': 'contours',
          paint: { 'line-color': '#1e1e1e', 'line-width': 1.2 },
        },
      },
    ]
  }

  // hrrr-refl: IEM reflectivity tiles only.
  if (!iemRun) return []
  const tiles = reflectivityTiles(iemRun, validTime)
  return [
    {
      id: 'reflectivity',
      type: 'raster',
      // Past F18 (or before the run) IEM has no tile: keep the source pointed
      // at the run's first frame and hide the layer instead.
      tiles: [tiles ?? reflectivityTiles(iemRun, iemRun.runTime)!],
      hidden: !tiles,
      layer: { type: 'raster', paint: { 'raster-opacity': 0.8 } },
    },
  ]
}

// Adds the layers underneath `beforeId`, so borders and city names stay on top.
export function addSpikeLayer(
  map: MapLibreMap,
  layer: SpikeLayer,
  run: RunInfo,
  validTime: Date,
  beforeId?: string,
  iemRun?: IemRun,
) {
  for (const spec of sourceSpecs(layer, run, validTime, iemRun)) {
    if (spec.tiles) {
      map.addSource(spec.id, {
        type: 'raster',
        tiles: spec.tiles,
        tileSize: 256,
        maxzoom: 10,
        attribution: 'Reflectivity © Iowa Environmental Mesonet',
      })
    } else {
      map.addSource(spec.id, { type: spec.type, url: spec.url })
    }
    map.addLayer(
      { id: spec.id, source: spec.id, ...spec.layer } as LayerSpecification,
      beforeId,
    )
    if (spec.hidden) map.setLayoutProperty(spec.id, 'visibility', 'none')
  }
}

// Points the existing layers at a new valid time, without re-adding them.
export function updateSpikeLayer(
  map: MapLibreMap,
  layer: SpikeLayer,
  run: RunInfo,
  validTime: Date,
  iemRun?: IemRun,
) {
  for (const spec of sourceSpecs(layer, run, validTime, iemRun)) {
    const source = map.getSource(spec.id) as
      RasterTileSource | VectorTileSource | undefined
    if (!source) continue
    if (spec.tiles && !spec.hidden) source.setTiles(spec.tiles)
    else if (spec.url) source.setUrl(spec.url)
    map.setLayoutProperty(
      spec.id,
      'visibility',
      spec.hidden ? 'none' : 'visible',
    )
  }
}
