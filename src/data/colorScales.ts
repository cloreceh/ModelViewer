// Turns our color scales (display units, hex colors) into the map layer's
// breakpoint format (data units, RGBA), for whatever units are picked.

import type { OmProtocolSettings } from '@openmeteo/weather-map-layer'
import {
  DATA_UNIT,
  displayUnit,
  toDataUnits,
  type DisplayUnit,
  type Quantity,
  type UnitSettings,
} from '../lib/units'
import { PRODUCTS, type ProductDef } from './catalog'
import { SCALES, type ScaleDef, type ScaleKey } from './colorScaleData'

export { SCALES, type ScaleDef, type ScaleKey }

// The map layer's own color scale type, as its settings use it.
export type OmColorScale = OmProtocolSettings['colorScales'][string]
type RGBA = [number, number, number, number]

const hexToRgba = (hex: string): RGBA => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  1,
]

// The scale for one product in one display unit.
export function scaleFor(key: ScaleKey, unit: DisplayUnit): ScaleDef {
  const scale = SCALES[key][unit]
  if (!scale) throw new Error(`No ${key} color scale in ${unit}`)
  return scale
}

// Breakpoints converted to the data's units. Values under the first
// breakpoint take the first color, so a transparent first band hides them.
export function toOmScale(
  scale: ScaleDef,
  quantity: Quantity,
  unit: DisplayUnit,
): OmColorScale {
  const breakpoints = scale.breakpoints.map((b) =>
    toDataUnits(b, quantity, unit),
  )
  const colors = scale.colors.map(hexToRgba)
  if (scale.hideBelow) {
    breakpoints.unshift(-1e9)
    colors.unshift([0, 0, 0, 0])
  }
  return { type: 'breakpoint', unit: DATA_UNIT[quantity], breakpoints, colors }
}

// Every shaded product's scale, keyed by Open-Meteo variable name, in the
// units the setting picks. The map layer looks scales up by exact variable
// name first, so each level gets its own scale.
export function buildColorScales(
  units: UnitSettings,
): Record<string, OmColorScale> {
  const scales: Record<string, OmColorScale> = {}
  for (const p of Object.values(PRODUCTS) as ProductDef[]) {
    for (const layer of p.layers) {
      if (layer.kind !== 'shaded') continue
      const unit = displayUnit(layer.quantity, p.level, units)
      scales[layer.variable] = toOmScale(
        scaleFor(layer.scale, unit),
        layer.quantity,
        unit,
      )
    }
  }
  return scales
}
