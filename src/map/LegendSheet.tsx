import { useMemo } from 'react'
import { product, type ProductId } from '../data/catalog'
import type { UnitSettings } from '../lib/units'
import { Sheet } from '../ui/Sheet'
import { legendFor, type OverlayNote } from './legendData'

interface Props {
  productId: ProductId
  units: UnitSettings
  onClose: () => void
}

// "0.01", "−40": every band written out in full in the sheet (no dropped
// leading zero, unlike the small legend labels).
const full = (v: number) =>
  v < 0 ? `−${Math.round(-v * 100) / 100}` : String(Math.round(v * 100) / 100)

const OVERLAY_TEXT: Record<OverlayNote['kind'], (text: string) => string> = {
  contour: (text) => `${text}, labeled in the line`,
  freezing: () => 'Freezing line: 32 °F (0 °C)',
  barbs: () => 'Wind barbs, always in knots',
}

// The legend sheet (08): every band as text, what isn't shaded, and what
// the lines and barbs mean.
export function LegendSheet({ productId, units, onClose }: Props) {
  const data = useMemo(() => legendFor(productId, units), [productId, units])
  const p = product(productId)
  const subtitle = [
    data.unitLine,
    data.hiddenBelow
      ? `${data.hiddenBelow.replace(/^Under/, 'under')} not shaded`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  const half = Math.ceil(data.bands.length / 2)
  const columns = [data.bands.slice(0, half), data.bands.slice(half)]

  return (
    <Sheet title={p.label} subtitle={subtitle} onClose={onClose}>
      <div className="legend-sheet-bands">
        {columns.map((column, c) => (
          <ul key={c} className="legend-sheet-column">
            {column.map((band) => {
              const range =
                band.to === undefined
                  ? `${full(band.from)}+`
                  : `${full(band.from)} to ${full(band.to)}`
              return (
                <li key={band.from} className="legend-sheet-band t-body">
                  <span
                    className="legend-sheet-swatch"
                    style={{ background: band.color }}
                    aria-hidden
                  />
                  <span>
                    {range}
                    <span className="visually-hidden"> {data.unit}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
      {data.notes.map((note) => (
        <p key={note.text} className="legend-sheet-note t-caption">
          <span className="legend-sheet-note-icon" aria-hidden />
          {OVERLAY_TEXT[note.kind](note.text)}
        </p>
      ))}
      {data.unit === 'dBZ' && (
        <p className="legend-sheet-note t-caption">
          Colors from the Iowa Environmental Mesonet’s radar scale (N0Q)
        </p>
      )}
    </Sheet>
  )
}
