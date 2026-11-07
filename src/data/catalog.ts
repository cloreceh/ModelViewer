// The model and product catalog: maps app concepts (HRRR, "500mb heights
// and wind") to Open-Meteo datasets and variables, and says how to draw each
// product. Everything else in the app reads from here. Replaces the spike's
// test layers (src/map/spikeLayers.ts).

import type { Dataset } from './openmeteo/mapSources'
import type { ScaleKey } from './colorScaleData'
import type { Level, Quantity } from '../lib/units'

// ---------- Models ----------

export type ModelId = 'hrrr' | 'gfs' | 'ecmwf'

export interface ModelDef {
  id: ModelId
  label: string
  resolution: string
  range: string
  updates: string
  surfaceDataset: Dataset
  upperDataset: Dataset // pressure-level (upper-air) fields
  // Surface fields Open-Meteo keeps in the upper-air dataset for this model.
  upperOnly?: readonly string[]
  pointModel: string // Forecast API model ID, for the tap readout
}

// Dataset IDs and splits are from the Week 2 data check.
export const MODELS: Record<ModelId, ModelDef> = {
  hrrr: {
    id: 'hrrr',
    label: 'HRRR',
    resolution: '3 km',
    range: '18 h (48 h on 00, 06, 12, 18Z)',
    updates: 'Every hour',
    surfaceDataset: 'ncep_hrrr_conus',
    upperDataset: 'ncep_hrrr_conus',
    pointModel: 'gfs_hrrr',
  },
  gfs: {
    id: 'gfs',
    label: 'GFS',
    resolution: '0.13° surface, 0.25° upper air',
    range: '16 days',
    updates: 'Every 6 hours',
    surfaceDataset: 'ncep_gfs013',
    upperDataset: 'ncep_gfs025',
    upperOnly: ['pressure_msl', 'cape'],
    pointModel: 'gfs_global',
  },
  ecmwf: {
    id: 'ecmwf',
    label: 'ECMWF',
    resolution: '9 km surface, 0.25° upper air',
    range: '15 days',
    updates: 'Every 6 hours',
    surfaceDataset: 'ecmwf_ifs',
    upperDataset: 'ecmwf_ifs025', // 3-hourly
    pointModel: 'ecmwf_ifs',
  },
}

const PRESSURE_LEVEL = /_\d+hPa$/

// Which of a model's datasets holds a variable.
export function datasetFor(model: ModelId, variable: string): Dataset {
  const m = MODELS[model]
  if (PRESSURE_LEVEL.test(variable) || m.upperOnly?.includes(variable)) {
    return m.upperDataset
  }
  return m.surfaceDataset
}

// ---------- Products ----------

// Picker groups, top of the atmosphere down (College of DuPage order).
export const GROUPS = [
  '250mb',
  '500mb',
  '700mb',
  '850mb',
  '925mb',
  'Surface',
  'Convective',
  'Precipitation',
  'Winter',
] as const
export type Group = (typeof GROUPS)[number]

// Shaded colors from one variable.
export interface ShadedLayer {
  kind: 'shaded'
  variable: string
  scale: ScaleKey
  quantity: Quantity
}

// Lines with value labels in the line (Week 4, Task 3).
export interface ContourLayer {
  kind: 'contour'
  variable: string
  quantity: 'pressure' | 'height' | 'temperature'
  // One number: a line every `interval` data units. Several: exactly those
  // levels (the freezing line uses 0 and a level that never happens).
  intervals: readonly number[]
  style: 'contour' | 'freezing'
  labels: boolean
}

// Wind barbs, always in knots (drawn by the map layer).
export interface BarbLayer {
  kind: 'barbs'
  variable: string // a wind_speed_* variable
}

// HRRR simulated reflectivity tiles from IEM (already colored).
export interface IemReflectivityLayer {
  kind: 'iem-reflectivity'
}

export type ProductLayer =
  ShadedLayer | ContourLayer | BarbLayer | IemReflectivityLayer

export interface ProductDef {
  id: string
  label: string // picker and legend sheet
  shortLabel: string // product button (long names get cut off there)
  group: Group
  level: Level // decides "mixed" units: aloft is °C and kt
  layers: readonly ProductLayer[] // bottom to top
  period?: 'past hour' | 'total' // shown after the unit in the legend
  models?: readonly ModelId[] // only these models have it (default: all three)
  maxForecastHour?: number // IEM reflectivity stops at F18
  // Not built yet: the map layer shows one time step per file, so totals
  // over several hours need summing in the app (see the Week 4 page).
  needsSum?: boolean
}

const FREEZING = [0, 9999] // °C; 9999 never happens, so only 0 is drawn

const freezingLine = (variable: string): ContourLayer => ({
  kind: 'contour',
  variable,
  quantity: 'temperature',
  intervals: FREEZING,
  style: 'freezing',
  labels: false,
})

const heights = (level: number, everyDam: number): ContourLayer => ({
  kind: 'contour',
  variable: `geopotential_height_${level}hPa`,
  quantity: 'height',
  intervals: [everyDam * 10], // data is in m
  style: 'contour',
  labels: true,
})

export const PRODUCTS = {
  wind250: {
    id: 'wind250',
    label: '250mb wind speed',
    shortLabel: '250mb wind',
    group: '250mb',
    level: 'aloft',
    layers: [
      {
        kind: 'shaded',
        variable: 'wind_speed_250hPa',
        scale: 'wind250',
        quantity: 'wind',
      },
      heights(250, 12),
      { kind: 'barbs', variable: 'wind_speed_250hPa' },
    ],
  },
  heights500: {
    id: 'heights500',
    label: '500mb heights and wind',
    shortLabel: '500mb hgt + wind',
    group: '500mb',
    level: 'aloft',
    layers: [
      {
        kind: 'shaded',
        variable: 'wind_speed_500hPa',
        scale: 'wind500',
        quantity: 'wind',
      },
      heights(500, 6),
      { kind: 'barbs', variable: 'wind_speed_500hPa' },
    ],
  },
  temp850: {
    id: 'temp850',
    label: '850mb temperature and wind',
    shortLabel: '850mb temp + wind',
    group: '850mb',
    level: 'aloft',
    layers: [
      {
        kind: 'shaded',
        variable: 'temperature_850hPa',
        scale: 'temperature850',
        quantity: 'temperature',
      },
      freezingLine('temperature_850hPa'),
      { kind: 'barbs', variable: 'wind_speed_850hPa' },
    ],
  },
  temp925: {
    id: 'temp925',
    label: '925mb temperature',
    shortLabel: '925mb temp',
    group: '925mb',
    level: 'aloft',
    layers: [
      {
        kind: 'shaded',
        variable: 'temperature_925hPa',
        scale: 'temperature925',
        quantity: 'temperature',
      },
      freezingLine('temperature_925hPa'),
    ],
  },
  temp2m: {
    id: 'temp2m',
    label: 'Surface temperature',
    shortLabel: 'Surface temp',
    group: 'Surface',
    level: 'surface',
    layers: [
      {
        kind: 'shaded',
        variable: 'temperature_2m',
        scale: 'surfaceTemperature',
        quantity: 'temperature',
      },
      freezingLine('temperature_2m'),
    ],
  },
  cape: {
    id: 'cape',
    label: 'CAPE',
    shortLabel: 'CAPE',
    group: 'Convective',
    level: 'surface',
    layers: [
      { kind: 'shaded', variable: 'cape', scale: 'cape', quantity: 'cape' },
    ],
  },
  slpPrecip: {
    id: 'slpPrecip',
    label: 'SLP and precipitation',
    shortLabel: 'SLP & precip',
    group: 'Precipitation',
    level: 'surface',
    period: 'past hour',
    layers: [
      {
        kind: 'shaded',
        variable: 'precipitation',
        scale: 'precipitation',
        quantity: 'precipitation',
      },
      {
        kind: 'contour',
        variable: 'pressure_msl',
        quantity: 'pressure',
        intervals: [4],
        style: 'contour',
        labels: true,
      },
    ],
  },
  reflectivity: {
    id: 'reflectivity',
    label: 'Simulated reflectivity',
    shortLabel: 'Reflectivity',
    group: 'Precipitation',
    level: 'surface',
    models: ['hrrr'],
    maxForecastHour: 18,
    layers: [{ kind: 'iem-reflectivity' }],
  },
  pwat: {
    id: 'pwat',
    label: 'Precipitable water',
    shortLabel: 'PWAT',
    group: 'Precipitation',
    level: 'surface',
    layers: [
      {
        kind: 'shaded',
        variable: 'total_column_integrated_water_vapour',
        scale: 'precipitableWater',
        quantity: 'precipitableWater',
      },
    ],
  },
  // Hourly for now: a running total needs summing every hour since the run
  // started in the app (see the Week 4 page). Totals come later.
  snowfall: {
    id: 'snowfall',
    label: 'Snowfall (past hour)',
    shortLabel: 'Snowfall',
    group: 'Winter',
    level: 'surface',
    period: 'past hour',
    layers: [
      {
        kind: 'shaded',
        variable: 'snowfall',
        scale: 'snowfallHourly',
        quantity: 'snow',
      },
    ],
  },
} as const satisfies Record<string, ProductDef>

export type ProductId = keyof typeof PRODUCTS

// Opens when a model is picked from the model menu (Week 3 decision).
export const DEFAULT_PRODUCT: ProductId = 'slpPrecip'

export function product(id: ProductId): ProductDef {
  return PRODUCTS[id]
}

export function isProductId(value: string | null): value is ProductId {
  return value !== null && value in PRODUCTS
}

export function isModelId(value: string | null): value is ModelId {
  return value === 'hrrr' || value === 'gfs' || value === 'ecmwf'
}

// The Open-Meteo variables a product reads (IEM layers have none).
export function productVariables(id: ProductId): string[] {
  return product(id).layers.flatMap((l) =>
    'variable' in l ? [l.variable] : [],
  )
}

// The datasets a product needs for a model, for the run lookups.
export function productDatasets(id: ProductId, model: ModelId): Dataset[] {
  return [...new Set(productVariables(id).map((v) => datasetFor(model, v)))]
}

// Whether a model can show a product. `variables` is the run's variable list
// per dataset (from latest.json); without it, only the catalog is checked.
export function isAvailable(
  id: ProductId,
  model: ModelId,
  variables?: Partial<Record<Dataset, readonly string[]>>,
): boolean {
  const p = product(id)
  if (p.needsSum) return false
  if (p.models && !p.models.includes(model)) return false
  if (!variables) return true
  return productVariables(id).every((v) => {
    const list = variables[datasetFor(model, v)]
    return !list || hasVariable(list, v)
  })
}

// latest.json lists stored variables; the map layer derives a few more
// (wind speed from its u/v parts, snowfall from its water equivalent).
function hasVariable(list: readonly string[], variable: string): boolean {
  if (list.includes(variable)) return true
  const wind = variable.match(/^wind_speed_(.+)$/)
  if (wind) return list.includes(`wind_u_component_${wind[1]}`)
  if (variable === 'snowfall') return list.includes('snowfall_water_equivalent')
  return false
}
