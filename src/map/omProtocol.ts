import * as maplibregl from 'maplibre-gl'
import {
  defaultOmProtocolSettings,
  omProtocol,
  type OmProtocolSettings,
} from '@openmeteo/weather-map-layer'
import { buildColorScales } from '../data/colorScales'
import { DEFAULT_UNITS, type UnitSettings } from '../lib/units'

// The map layer's settings, with our color scales on top of its own.
// Kept as one object so changing units updates it in place.
const settings: OmProtocolSettings = {
  ...defaultOmProtocolSettings,
  colorScales: { ...defaultOmProtocolSettings.colorScales },
}

// Swaps in the color scales for a units setting. Layers pick them up on
// their next tile request (their addresses carry a units key to force it).
export function applyUnits(units: UnitSettings) {
  Object.assign(settings.colorScales, buildColorScales(units))
}

let registered = false

// Teach MapLibre to read om:// addresses (Open-Meteo weather files).
// Call once, before any map is created.
export function registerOmProtocol(units: UnitSettings = DEFAULT_UNITS) {
  applyUnits(units)
  if (registered) return
  maplibregl.addProtocol('om', (params, abortController) =>
    omProtocol(params, abortController, settings),
  )
  registered = true
}
