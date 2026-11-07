// Units: what the app shows, and conversions from Open-Meteo's data.
// Open-Meteo map files are metric (°C, m/s, mm, cm, hPa, m); the app converts
// to whatever the units setting asks for. See the Week 4 page, Task 1.

export type Quantity =
  | 'temperature'
  | 'wind'
  | 'precipitation' // rain and total precipitation
  | 'precipitableWater'
  | 'snow'
  | 'pressure'
  | 'height' // geopotential height
  | 'cape'

// Products at 925, 850, 500 and 250mb are "aloft"; everything else is "surface".
export type Level = 'surface' | 'aloft'

export type DataUnit = '°C' | 'm/s' | 'mm' | 'cm' | 'hPa' | 'm' | 'J/kg'
export type DisplayUnit =
  | '°F'
  | '°C'
  | 'kt'
  | 'mph'
  | 'm/s'
  | 'in'
  | 'mm'
  | 'cm'
  | 'mb'
  | 'hPa'
  | 'dam'
  | 'J/kg'

// The units setting: one choice per quantity (Settings screen).
export interface UnitSettings {
  temperature: 'mixed' | '°F' | '°C' // mixed: °F at the surface, °C aloft
  wind: 'mixed' | 'mph' | 'kt' | 'm/s' // mixed: mph at the surface, kt aloft
  precipitation: 'in' | 'metric' // metric: mm for rain and PWAT, cm for snow
  pressure: 'mb' | 'hPa'
}

// New users start on a College of DuPage style mix.
export const DEFAULT_UNITS: UnitSettings = {
  temperature: 'mixed',
  wind: 'mixed',
  precipitation: 'in',
  pressure: 'mb',
}

// The shortcuts on the Settings screen.
export const UNIT_PRESETS = {
  default: DEFAULT_UNITS,
  us: { temperature: '°F', wind: 'mph', precipitation: 'in', pressure: 'mb' },
  metric: {
    temperature: '°C',
    wind: 'm/s',
    precipitation: 'metric',
    pressure: 'hPa',
  },
} as const satisfies Record<string, UnitSettings>

export type UnitPreset = keyof typeof UNIT_PRESETS

export const DATA_UNIT: Record<Quantity, DataUnit> = {
  temperature: '°C',
  wind: 'm/s',
  precipitation: 'mm',
  precipitableWater: 'mm',
  snow: 'cm', // Open-Meteo's snowfall (about 7:1) comes out in cm
  pressure: 'hPa',
  height: 'm',
  cape: 'J/kg',
}

// The unit a quantity is shown in, given the setting and the product's level.
export function displayUnit(
  quantity: Quantity,
  level: Level,
  settings: UnitSettings,
): DisplayUnit {
  switch (quantity) {
    case 'temperature':
      if (settings.temperature !== 'mixed') return settings.temperature
      return level === 'aloft' ? '°C' : '°F'
    case 'wind':
      if (settings.wind !== 'mixed') return settings.wind
      return level === 'aloft' ? 'kt' : 'mph'
    case 'precipitation':
    case 'precipitableWater':
      return settings.precipitation === 'in' ? 'in' : 'mm'
    case 'snow':
      return settings.precipitation === 'in' ? 'in' : 'cm'
    case 'pressure':
      return settings.pressure
    case 'height':
      return 'dam' // always decameters
    case 'cape':
      return 'J/kg'
  }
}

// One conversion per data unit and display unit pair: [to display, back to data].
type Pair = [(v: number) => number, (v: number) => number]
const same: Pair = [(v) => v, (v) => v]
const CONVERSIONS: Record<DataUnit, Partial<Record<DisplayUnit, Pair>>> = {
  '°C': {
    '°C': same,
    '°F': [(v) => (v * 9) / 5 + 32, (v) => ((v - 32) * 5) / 9],
  },
  'm/s': {
    'm/s': same,
    kt: [(v) => v * 1.943844, (v) => v / 1.943844],
    mph: [(v) => v * 2.236936, (v) => v / 2.236936],
  },
  mm: { mm: same, in: [(v) => v / 25.4, (v) => v * 25.4] },
  cm: { cm: same, in: [(v) => v / 2.54, (v) => v * 2.54] },
  hPa: { hPa: same, mb: same },
  m: { dam: [(v) => v / 10, (v) => v * 10] },
  'J/kg': { 'J/kg': same },
}

function pair(quantity: Quantity, unit: DisplayUnit): Pair {
  const found = CONVERSIONS[DATA_UNIT[quantity]][unit]
  if (!found) throw new Error(`Can't show ${quantity} in ${unit}`)
  return found
}

// Data value (e.g. °C) to the value shown (e.g. °F).
export function fromDataUnits(
  value: number,
  quantity: Quantity,
  unit: DisplayUnit,
): number {
  return pair(quantity, unit)[0](value)
}

// Shown value (e.g. 32 °F) back to the data's units (0 °C).
export function toDataUnits(
  value: number,
  quantity: Quantity,
  unit: DisplayUnit,
): number {
  return pair(quantity, unit)[1](value)
}

// A short key for a settings combination, used to refresh map tiles when
// the units change (the color scales change with them).
export function unitsKey(settings: UnitSettings): string {
  return [
    settings.temperature,
    settings.wind,
    settings.precipitation,
    settings.pressure,
  ]
    .join('-')
    .replace(/[°/]/g, '')
}
