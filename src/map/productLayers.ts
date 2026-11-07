import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  RasterTileSource,
  VectorTileSource,
} from 'maplibre-gl'
import { variableIsAccumulated } from '@openmeteo/weather-map-layer'
import {
  datasetFor,
  product,
  productVariables,
  type ContourLayer,
  type ModelId,
  type ProductId,
} from '../data/catalog'
import { omFileUrl, type Dataset } from '../data/openmeteo/mapSources'
import type { RunInfo } from '../data/openmeteo/runs'
import { reflectivityTiles, type IemRun } from '../data/iem/reflectivity'
import { unitsKey, type UnitSettings } from '../lib/units'

export type Theme = 'light' | 'dark'

// Everything needed to draw a product for one model.
export interface ProductContext {
  model: ModelId
  product: ProductId
  runs: Partial<Record<Dataset, RunInfo>> // one per dataset the product uses
  iemRun?: IemRun
  units: UnitSettings
  theme: Theme
}

// Line and label colors (Week 4, Task 3): near-black on light, near-white on dark.
const INK = {
  light: { contour: '#1e1e1e', slp: '#3a3a3a', halo: '#ffffff' },
  dark: { contour: '#f0f0f0', slp: '#cfcfcf', halo: '#141414' },
}
const SHADED_OPACITY = 0.8 // assumed in the Task 4 checks; settle on the phone
const LABEL_FONT = ['Noto Sans Regular'] // available in both OpenFreeMap styles

// One map source and the layers that draw it.
interface SourceSpec {
  id: string
  type: 'raster' | 'vector'
  url?: string // om:// file address (Open-Meteo)
  tiles?: string[] // tile address template (IEM)
  hidden: boolean // true when there's no data for this valid time
  layers: (Omit<LayerSpecification, 'id' | 'source'> & {
    idSuffix?: string
  } & Record<string, unknown>)[]
}

const sameTime = (a: Date, b: Date) => a.getTime() === b.getTime()

// Whether a dataset has this valid time, and isn't a total at F00
// (a run's first file has no totals yet).
function hasFrame(run: RunInfo, validTime: Date, variable: string): boolean {
  if (!run.validTimes.some((t) => sameTime(t, validTime))) return false
  if (variableIsAccumulated(variable) && sameTime(validTime, run.referenceTime))
    return false
  return true
}

// A valid time the dataset does have, so a hidden layer still has a real file.
function fallbackTime(run: RunInfo, variable: string): Date {
  return run.validTimes[variableIsAccumulated(variable) ? 1 : 0]
}

// Label text: heights in decameters ("564"), pressure as is ("1008").
function labelText(layer: ContourLayer): ExpressionSpecification {
  const value: ExpressionSpecification = ['to-number', ['get', 'value']]
  return layer.quantity === 'height'
    ? ['to-string', ['round', ['/', value, 10]]]
    : ['to-string', ['round', value]]
}

function sourceSpecs(ctx: ProductContext, validTime: Date): SourceSpec[] {
  const ink = INK[ctx.theme]
  const units = unitsKey(ctx.units)
  return product(ctx.product).layers.map((layer, i): SourceSpec => {
    const id = `product-${i}`

    if (layer.kind === 'iem-reflectivity') {
      const iemRun = ctx.iemRun
      const tiles = iemRun ? reflectivityTiles(iemRun, validTime) : undefined
      return {
        id,
        type: 'raster',
        // Past F18 (or before the run) IEM has no tile: keep the source
        // pointed at the run's first frame and hide the layer instead.
        tiles: iemRun
          ? [tiles ?? reflectivityTiles(iemRun, iemRun.runTime)!]
          : [],
        hidden: !tiles,
        layers: [{ type: 'raster', paint: { 'raster-opacity': 0.8 } }],
      }
    }

    const run = ctx.runs[datasetFor(ctx.model, layer.variable)]
    if (!run) throw new Error(`No run loaded for ${layer.variable}`)
    const ok = hasFrame(run, validTime, layer.variable)
    const time = ok ? validTime : fallbackTime(run, layer.variable)

    if (layer.kind === 'shaded') {
      return {
        id,
        type: 'raster',
        url: omFileUrl(run, time, layer.variable, { units }),
        hidden: !ok,
        layers: [
          { type: 'raster', paint: { 'raster-opacity': SHADED_OPACITY } },
        ],
      }
    }

    if (layer.kind === 'barbs') {
      const color = ink.contour
      return {
        id,
        type: 'vector',
        url: omFileUrl(run, time, layer.variable, {
          arrows: 'true',
          arrow_style: 'barb',
        }),
        hidden: !ok,
        layers: [
          {
            type: 'line',
            'source-layer': 'wind-arrows',
            paint: { 'line-color': color, 'line-width': 1 },
          },
          {
            idSuffix: 'pennants',
            type: 'fill',
            'source-layer': 'wind-barb-pennants',
            paint: { 'fill-color': color },
          },
        ],
      }
    }

    // Contours, with the value printed in the line
    const color = layer.quantity === 'pressure' ? ink.slp : ink.contour
    const width =
      layer.style === 'freezing'
        ? 2
        : layer.quantity === 'pressure'
          ? 1.25
          : 1.5
    const lines: SourceSpec['layers'] = [
      {
        type: 'line',
        'source-layer': 'contours',
        paint: { 'line-color': color, 'line-width': width },
      },
    ]
    if (layer.labels) {
      lines.push({
        idSuffix: 'labels',
        type: 'symbol',
        'source-layer': 'contours',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 250,
          'text-field': labelText(layer),
          'text-font': LABEL_FONT,
          'text-size': 11,
          'text-keep-upright': true,
          // Contours traced from a model grid zigzag at small scale; a strict
          // angle limit (MapLibre's default is 45°) stops every label.
          'text-max-angle': 180,
        },
        // A halo in the map's color breaks the line around the number.
        paint: {
          'text-color': color,
          'text-halo-color': ink.halo,
          'text-halo-width': 3,
        },
      })
    }
    return {
      id,
      type: 'vector',
      url: omFileUrl(run, time, layer.variable, {
        contours: 'true',
        intervals: layer.intervals.join(','),
      }),
      hidden: !ok,
      layers: lines,
    }
  })
}

const layerId = (sourceId: string, suffix?: string) =>
  suffix ? `${sourceId}-${suffix}` : sourceId

// Adds the product's layers underneath `beforeId`, so borders and city names
// stay on top.
export function addProductLayers(
  map: MapLibreMap,
  ctx: ProductContext,
  validTime: Date,
  beforeId?: string,
) {
  for (const spec of sourceSpecs(ctx, validTime)) {
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
    for (const { idSuffix, ...layer } of spec.layers) {
      const id = layerId(spec.id, idSuffix)
      map.addLayer(
        { id, source: spec.id, ...layer } as LayerSpecification,
        beforeId,
      )
      if (spec.hidden) map.setLayoutProperty(id, 'visibility', 'none')
    }
  }
}

// Points the existing layers at a new valid time, without re-adding them.
export function updateProductLayers(
  map: MapLibreMap,
  ctx: ProductContext,
  validTime: Date,
) {
  for (const spec of sourceSpecs(ctx, validTime)) {
    const source = map.getSource(spec.id) as
      RasterTileSource | VectorTileSource | undefined
    if (!source) continue
    if (spec.tiles && !spec.hidden) source.setTiles(spec.tiles)
    else if (spec.url) source.setUrl(spec.url)
    for (const { idSuffix } of spec.layers) {
      map.setLayoutProperty(
        layerId(spec.id, idSuffix),
        'visibility',
        spec.hidden ? 'none' : 'visible',
      )
    }
  }
}

// Removes a product's layers and sources (before switching products).
export function removeProductLayers(map: MapLibreMap, ctx: ProductContext) {
  product(ctx.product).layers.forEach((_, i) => {
    const id = `product-${i}`
    for (const suffix of [undefined, 'labels', 'pennants']) {
      const lid = layerId(id, suffix)
      if (map.getLayer(lid)) map.removeLayer(lid)
    }
    if (map.getSource(id)) map.removeSource(id)
  })
}

// Totals don't exist in a run's first file, so products made only of totals
// start one hour in. SLP and precipitation starts at F00 with SLP alone.
export function firstHourIndex(id: ProductId): number {
  const vars = productVariables(id)
  return vars.length > 0 && vars.every((v) => variableIsAccumulated(v)) ? 1 : 0
}
