import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  dayTicks,
  fractionAt,
  hourLabel,
  hoursBetween,
  indexAtFraction,
  indexDayAway,
  shortValid,
  spokenValid,
  type HourRange,
} from '../lib/time'
import { textMeasurer } from '../lib/measureText'

interface Props {
  range: HourRange
  index: number // the hour on screen
  // What greyed hours after the product's last one are called, e.g.
  // "No reflectivity after F18" (S2).
  afterLastNote?: string
  onPreview: (index: number | undefined) => void // while dragging
  onChange: (index: number, how: 'drag' | 'key') => void
}

// How long the thumb has to rest while dragging before the map follows.
// Each new hour is a download, so the map waits instead of chasing every
// hour the thumb passes (GFS has 200 of them).
const REST_MS = 250

// The forecast-hour slider (Weeks 5 to 7): full width, snapping to the
// hours the model has, with F00 and the last hour at the ends and day ticks
// between, a popup while dragging, and keys and screen reader support.
export function TimeSlider({
  range,
  index,
  afterLastNote,
  onPreview,
  onChange,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(0)
  const [textSize, setTextSize] = useState('')
  const [dragIndex, setDragIndex] = useState<number>()
  const restTimer = useRef<number | undefined>(undefined)
  const lastCommitted = useRef(index)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const update = () => {
      setWidth(row.clientWidth)
      setTextSize(getComputedStyle(document.documentElement).fontSize)
    }
    update()
    // The labels row grows with the text size: re-measure then too.
    const observer = new ResizeObserver(update)
    observer.observe(row)
    if (labelsRef.current) observer.observe(labelsRef.current)
    return () => observer.disconnect()
  }, [])

  const { times, first, last } = range
  const start = times[0]
  const end = times[times.length - 1]
  const ticks = useMemo(() => {
    void textSize // re-measure when the text size changes
    return width ? dayTicks(start, end, width, textMeasurer(0.6875)) : null
  }, [start, end, width, textSize])

  const shownIndex = dragIndex ?? index
  const thumbX = fractionAt(range, shownIndex) * width
  const xOf = (i: number) => fractionAt(range, i) * width
  const fh = (i: number) => hoursBetween(start, times[i])

  // ---------- Dragging and tapping the track ----------
  const indexAt = (clientX: number) => {
    const rect = rowRef.current!.getBoundingClientRect()
    return indexAtFraction(range, (clientX - rect.left) / rect.width)
  }
  const commit = (i: number, how: 'drag' | 'key') => {
    window.clearTimeout(restTimer.current)
    if (i !== lastCommitted.current || how === 'key') {
      lastCommitted.current = i
      onChange(i, how)
    }
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const i = indexAt(e.clientX)
    lastCommitted.current = index
    setDragIndex(i)
    onPreview(i)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragIndex === undefined) return
    const i = indexAt(e.clientX)
    if (i === dragIndex) return
    setDragIndex(i)
    onPreview(i)
    window.clearTimeout(restTimer.current)
    restTimer.current = window.setTimeout(() => commit(i, 'drag'), REST_MS)
  }
  const endDrag = () => {
    if (dragIndex === undefined) return
    commit(dragIndex, 'drag')
    setDragIndex(undefined)
    onPreview(undefined)
  }

  // ---------- Keys (Week 7): arrows one step, Page Up and Down one day,
  // Home and End the first and last hour ----------
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(last, index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(first, index - 1)
        break
      case 'PageUp':
        next = indexDayAway(range, index, 1)
        break
      case 'PageDown':
        next = indexDayAway(range, index, -1)
        break
      case 'Home':
        next = first
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    e.preventDefault()
    if (next !== index) commit(next, 'key')
  }

  const valueText = `Forecast hour ${fh(index)}, ${spokenValid(times[index])}${
    last < times.length - 1 && afterLastNote ? `. ${afterLastNote}` : ''
  }`

  return (
    <div className="slider">
      {/* Hours the product can't show: a light dashed outline (Week 5),
          with a note above it when there's room (S2). */}
      {width > 0 && first > 0 && (
        <span
          className="slider-greyed"
          style={{ left: 0, width: xOf(first) }}
          aria-hidden
        />
      )}
      {width > 0 && last < times.length - 1 && (
        <>
          <span
            className="slider-greyed"
            style={{ left: xOf(last), width: width - xOf(last) }}
            aria-hidden
          />
          {afterLastNote && width - xOf(last) > 120 && (
            <span
              className="slider-greyed-note t-caption"
              style={{ left: (xOf(last) + width) / 2 }}
              aria-hidden
            >
              {afterLastNote}
            </span>
          )}
        </>
      )}
      <div
        ref={rowRef}
        className={`slider-row${dragIndex !== undefined ? ' dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Forecast hour"
        aria-valuemin={fh(first)}
        aria-valuemax={fh(last)}
        aria-valuenow={fh(index)}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <span className="slider-track" aria-hidden />
        <span className="slider-fill" style={{ width: thumbX }} aria-hidden />
        {ticks?.ticks.map((t) => (
          <span
            key={`${t.kind}${t.x}`}
            className={`slider-tick slider-tick-${t.kind}`}
            style={{ left: t.x }}
            aria-hidden
          />
        ))}
        <span className="slider-thumb" style={{ left: thumbX }} aria-hidden />
        <span className="slider-labels t-legend" ref={labelsRef} aria-hidden>
          {ticks?.labels.map((l) => (
            <span
              key={l.text + l.x}
              className={`slider-label slider-label-${l.align}`}
              style={{ left: l.x }}
            >
              {l.text}
            </span>
          ))}
        </span>
      </div>
      {dragIndex !== undefined && width > 0 && (
        <div
          className="slider-popup"
          style={{
            left: Math.min(Math.max(thumbX, 42), width - 42),
          }}
          aria-hidden
        >
          <span className="t-heading">{hourLabel(fh(dragIndex))}</span>
          <span className="t-caption">{shortValid(times[dragIndex])}</span>
          <span
            className="slider-popup-pointer"
            style={{
              left: `calc(50% + ${thumbX - Math.min(Math.max(thumbX, 42), width - 42)}px)`,
            }}
          />
        </div>
      )}
    </div>
  )
}
