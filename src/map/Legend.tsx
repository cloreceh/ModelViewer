import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { product, type ProductId } from '../data/catalog'
import type { UnitSettings } from '../lib/units'
import { textMeasurer } from '../lib/measureText'
import {
  formatValue,
  labelIndexes,
  legendFor,
  type OverlayNote,
} from './legendData'

interface Props {
  productId: ProductId
  units: UnitSettings
  labelsShown: boolean
  onToggleLabels: () => void
  onOpenSheet: () => void
}

// Words a screen reader says for a unit ("in" alone reads as a word).
const SPOKEN_UNIT: Record<string, string> = {
  in: 'inches',
  mm: 'millimeters',
  cm: 'centimeters',
  '°F': 'degrees Fahrenheit',
  '°C': 'degrees Celsius',
  kt: 'knots',
  mph: 'miles per hour',
  'm/s': 'meters per second',
  mb: 'millibars',
  hPa: 'hectopascals',
  dam: 'decameters',
  'J/kg': 'joules per kilogram',
  dBZ: 'dBZ',
}

function NoteIcon({ kind }: { kind: OverlayNote['kind'] }) {
  if (kind === 'barbs') {
    // A tiny wind barb: staff plus two barbs.
    return (
      <svg className="legend-note-icon" width="16" height="10" aria-hidden>
        <path
          d="M1 9 H15 M15 9 L12 1 M11 9 L8 1"
          stroke="currentColor"
          strokeWidth="1.25"
          fill="none"
        />
      </svg>
    )
  }
  return <span className={`legend-line legend-line-${kind}`} aria-hidden />
}

// The floating legend (Week 5): full width, right on top of the bottom
// panel. Tap it to hide or show the band labels; the chevron opens the
// legend sheet with every band.
export function Legend({
  productId,
  units,
  labelsShown,
  onToggleLabels,
  onOpenSheet,
}: Props) {
  const data = useMemo(() => legendFor(productId, units), [productId, units])
  const barRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLSpanElement>(null)
  const [layout, setLayout] = useState<{ width: number; key: string }>({
    width: 0,
    key: '',
  })

  // Re-measure when the bar changes width or the text size changes.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const update = () =>
      setLayout({
        width: bar.clientWidth,
        key: getComputedStyle(document.documentElement).fontSize,
      })
    update()
    // The labels row grows with the text size, so watching it catches a
    // text size change even when the bar keeps its width.
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    if (labelsRef.current) observer.observe(labelsRef.current)
    return () => observer.disconnect()
  }, [labelsShown])

  const shown = useMemo(() => {
    if (!layout.width) return []
    const measure = textMeasurer(0.6875)
    return labelIndexes(data, layout.width, measure)
  }, [data, layout])

  const unitWords = SPOKEN_UNIT[data.unit] ?? data.unit
  const name = product(productId).label
  const period = product(productId).period
  const summary = `${name}, ${unitWords}${period ? ` in the ${period}` : ''}`

  return (
    <div className={`legend${labelsShown ? '' : ' legend-compact'}`}>
      {/* The whole card toggles the labels; the chevron sits on top. */}
      <button
        type="button"
        className="legend-toggle"
        aria-pressed={labelsShown}
        aria-label={`Legend: ${summary}. ${labelsShown ? 'Hide' : 'Show'} band labels`}
        onClick={onToggleLabels}
      >
        {labelsShown && (
          <span className="legend-top">
            <span className="t-caption-strong">{data.unitLine}</span>
            {data.notes.map((note) => (
              <span key={note.text} className="legend-note t-legend">
                <NoteIcon kind={note.kind} />
                {note.text}
              </span>
            ))}
          </span>
        )}
        <span className="legend-bar" ref={barRef}>
          {data.bands.map((band) => (
            <span
              key={band.from}
              className="legend-band"
              style={{ background: band.color }}
            />
          ))}
        </span>
        {labelsShown && (
          <span className="legend-labels t-legend" ref={labelsRef} aria-hidden>
            {shown.map((i) => (
              <span
                key={data.bands[i].from}
                className={
                  data.bands[i].from === data.bold ? 'legend-bold' : undefined
                }
                style={{ left: `${(i / data.bands.length) * 100}%` }}
              >
                {formatValue(data.bands[i].from, data.unit)}
              </span>
            ))}
          </span>
        )}
      </button>
      {labelsShown && (
        <button
          type="button"
          className="legend-sheet-button"
          aria-label={`All bands: ${summary}`}
          aria-haspopup="dialog"
          onClick={onOpenSheet}
        >
          <ChevronUp size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  )
}
