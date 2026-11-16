// What the floating legend and the legend sheet show for a product: the
// unit line, overlay notes, color bands and which bands get a label.
// Built from the same color scales the map draws with (Week 4).

import { product, type ProductId } from '../data/catalog'
import { scaleFor } from '../data/colorScales'
import { displayUnit, type DisplayUnit, type UnitSettings } from '../lib/units'

export interface Band {
  from: number
  to?: number // undefined for the top band
  color: string
}

export interface OverlayNote {
  kind: 'contour' | 'freezing' | 'barbs'
  text: string
}

export interface LegendData {
  unit: DisplayUnit | 'dBZ'
  unitLine: string // "in · past hour"
  notes: OverlayNote[]
  bands: Band[]
  // Values to label under the bar. Undefined: as many bands as fit.
  labelValues?: readonly number[]
  bold?: number // the freezing mark on temperature legends
  hiddenBelow?: string // what isn't shaded, for the legend sheet
}

// IEM's HRRR reflectivity tiles use the same colors as its NEXRAD N0Q
// composites (IEM's HRRR page). These are N0Q's colors at the middle of each
// 5 dBZ band, from pyIEM's composite_n0q color table. Replaces the Week 6
// stand-in (NWS-style radar colors).
const REFLECTIVITY_BANDS: Band[] = [
  ['#4b64a1', 5],
  ['#518bbb', 10],
  ['#6fd6e8', 15],
  ['#10cd17', 20],
  ['#0d9e11', 25],
  ['#096f0c', 30],
  ['#98a806', 35],
  ['#ffc400', 40],
  ['#ff8f00', 45],
  ['#cd0000', 50],
  ['#7f0000', 55],
  ['#ffb3ff', 60],
  ['#ea2bec', 65],
  ['#7900e2', 70],
  ['#05ccd0', 75],
].map(([color, from], i, all) => ({
  color: color as string,
  from: from as number,
  to: (all[i + 1]?.[1] as number | undefined) ?? undefined,
}))

// Label spacing chosen in Figma where "as many as fit" would look busy or
// uneven (Weeks 6 and 7): temperature every 20 °F or 10 °C with the freezing
// mark in bold, CAPE and reflectivity every other band.
const LABELS: Partial<Record<string, readonly number[]>> = {
  'surfaceTemperature °F': [-40, -20, 0, 20, 32, 50, 70, 90],
  'surfaceTemperature °C': [-40, -30, -20, -10, 0, 10, 20, 30, 40],
  'temperature925 °F': [-20, 0, 20, 32, 50, 70, 90],
  'temperature925 °C': [-30, -20, -10, 0, 10, 20, 30],
  'temperature850 °F': [-40, -20, 0, 20, 32, 50, 70],
  'temperature850 °C': [-40, -30, -20, -10, 0, 10, 20, 30],
  'cape J/kg': [100, 500, 1000, 2000, 3000, 5000],
  reflectivity: [10, 20, 30, 40, 50, 60, 70],
}

// "−40", ".05", "1.5": minus sign, no leading zero on inches under 1.
export function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value)
  let text = String(Math.round(abs * 100) / 100)
  if (unit === 'in' && abs < 1 && abs > 0) text = text.replace(/^0/, '')
  return value < 0 ? `−${text}` : text
}

export function legendFor(id: ProductId, units: UnitSettings): LegendData {
  const p = product(id)
  const notes: OverlayNote[] = []
  let main: Omit<LegendData, 'unitLine' | 'notes'> | undefined

  for (const layer of p.layers) {
    if (layer.kind === 'iem-reflectivity') {
      main = {
        unit: 'dBZ',
        bands: REFLECTIVITY_BANDS,
        labelValues: LABELS.reflectivity,
        hiddenBelow: 'Under 5 dBZ',
      }
    } else if (layer.kind === 'shaded') {
      const unit = displayUnit(layer.quantity, p.level, units)
      const scale = scaleFor(layer.scale, unit)
      const bands = scale.breakpoints.map((from, i) => ({
        from,
        to: scale.breakpoints[i + 1],
        color: scale.colors[i],
      }))
      main = {
        unit,
        bands,
        labelValues: LABELS[`${layer.scale} ${unit}`],
        bold:
          layer.quantity === 'temperature'
            ? unit === '°F'
              ? 32
              : 0
            : undefined,
        hiddenBelow: scale.hideBelow
          ? `Under ${formatValue(bands[0].from, unit)} ${unit}`
          : undefined,
      }
    } else if (layer.kind === 'contour') {
      if (layer.style === 'freezing') {
        notes.push({ kind: 'freezing', text: 'Freezing line' })
      } else if (layer.quantity === 'pressure') {
        notes.push({
          kind: 'contour',
          text: `SLP every ${layer.intervals[0]} ${units.pressure}`,
        })
      } else if (layer.quantity === 'height') {
        notes.push({
          kind: 'contour',
          text: `Heights every ${layer.intervals[0] / 10} dam`,
        })
      }
    } else if (layer.kind === 'barbs') {
      // Barbs are always drawn in knots (Week 4); say so when the shading
      // is in another wind unit.
      const wind = displayUnit('wind', p.level, units)
      notes.push({
        kind: 'barbs',
        text: wind === 'kt' ? 'Barbs' : 'Barbs in kt',
      })
    }
  }
  if (!main) throw new Error(`Product ${id} has nothing shaded`)
  return {
    ...main,
    unitLine: p.period ? `${main.unit} · ${p.period}` : main.unit,
    notes,
  }
}

// Which bands get a label under the bar, as indexes into `bands`. Labels
// sit at the left edge of their band (as in Figma). A label that would come
// within 4 px of another, or run past the right edge, is dropped; with no
// fixed list, the most bands that fit evenly are labeled (every band, every
// other band, …).
export function labelIndexes(
  data: LegendData,
  width: number,
  measure: (text: string, bold: boolean) => number,
): number[] {
  const { bands } = data
  const bandWidth = width / bands.length
  const GAP = 4
  const spanOf = (i: number): [number, number] => {
    const text = formatValue(bands[i].from, data.unit)
    const x = i * bandWidth
    return [x, x + measure(text, bands[i].from === data.bold)]
  }
  const fits = (indexes: number[]) => {
    let lastEnd = -Infinity
    for (const i of indexes) {
      const [a, b] = spanOf(i)
      if (a < lastEnd + GAP || b > width) return false
      lastEnd = b
    }
    return true
  }

  if (data.labelValues) {
    const wanted = data.labelValues
      .map((v) => bands.findIndex((b) => b.from === v))
      .filter((i) => i >= 0)
    // Keep the bold mark, then drop whatever crowds it or runs off the end.
    const out: number[] = []
    let lastEnd = -Infinity
    const boldIndex = bands.findIndex((b) => b.from === data.bold)
    for (const i of wanted) {
      const [a, b] = spanOf(i)
      if (b > width) continue
      if (i !== boldIndex && boldIndex >= 0) {
        const [ba, bb] = spanOf(boldIndex)
        if (a < bb + GAP && b > ba - GAP) continue
      }
      if (a < lastEnd + GAP) continue
      out.push(i)
      lastEnd = b
    }
    return out
  }

  for (let step = 1; step <= bands.length; step++) {
    const indexes: number[] = []
    for (let i = 0; i < bands.length; i += step) indexes.push(i)
    if (fits(indexes)) return indexes
    // The last label can run past the edge on an otherwise even spacing;
    // try without it before spacing them out further.
    if (fits(indexes.slice(0, -1))) return indexes.slice(0, -1)
  }
  return [0]
}
