// Time helpers for the run label, step buttons, slider and day ticks.
// Valid times are shown in the phone's own time zone (CST in November);
// runs are named in UTC ("06Z"), the way model sites name them.

const HOUR = 3_600_000

const pad = (n: number) => String(n).padStart(2, '0')

// "06Z" for a run that started at 06 UTC.
export function runName(referenceTime: Date): string {
  return `${pad(referenceTime.getUTCHours())}Z`
}

// Forecast hour label: F00, F06, F39, F384.
export function hourLabel(forecastHour: number): string {
  return `F${pad(forecastHour)}`
}

// Whole hours from the run's start to a valid time (13Z run at 15Z = 2).
export function hoursBetween(start: Date, time: Date): number {
  return Math.round((time.getTime() - start.getTime()) / HOUR)
}

// The phone's time zone, unless a test passes one in.
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function parts(time: Date, timeZone: string, weekday: 'short' | 'long') {
  const list = new Intl.DateTimeFormat('en-US', {
    weekday,
    hour: 'numeric',
    timeZoneName: 'short',
    timeZone,
  }).formatToParts(time)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    list.find((p) => p.type === type)?.value ?? ''
  return {
    weekday: get('weekday'),
    hour: `${get('hour')} ${get('dayPeriod')}`,
    zone: get('timeZoneName'),
  }
}

// "Mon 3 PM CST" (run label, popup, model switch).
export function shortValid(time: Date, timeZone = localZone()): string {
  const p = parts(time, timeZone, 'short')
  return `${p.weekday} ${p.hour} ${p.zone}`
}

// "Monday 3 PM CST" (read out by screen readers).
export function spokenValid(time: Date, timeZone = localZone()): string {
  const p = parts(time, timeZone, 'long')
  return `${p.weekday} ${p.hour} ${p.zone}`
}

// ---------- Hours on the slider ----------

// Which of a run's valid times a product can show. The slider spans the
// whole run (F00 to the last hour); hours outside first..last are greyed.
export interface HourRange {
  times: Date[] // every valid time in the run, in order
  first: number // index of the first hour the product can show
  last: number // index of the last hour the product can show
}

// `firstIndex`: 1 for products made only of totals (no F00 file).
// `maxForecastHour`: IEM reflectivity stops at F18.
export function hourRange(
  times: Date[],
  firstIndex: number,
  maxForecastHour?: number,
): HourRange {
  let last = times.length - 1
  if (maxForecastHour !== undefined && times.length > 0) {
    while (last > 0 && hoursBetween(times[0], times[last]) > maxForecastHour)
      last--
  }
  return { times, first: Math.min(firstIndex, last), last }
}

// The index to show for a wanted valid time: the same time if the product
// has it, otherwise the nearest hour it can show (the later one on a tie,
// so ECMWF's 3-hourly upper air moves forward rather than back).
export function snapIndex(range: HourRange, wanted?: number): number {
  const { times, first, last } = range
  if (wanted === undefined) return first
  let best = first
  let bestGap = Infinity
  for (let i = first; i <= last; i++) {
    const gap = Math.abs(times[i].getTime() - wanted)
    if (gap < bestGap || (gap === bestGap && times[i].getTime() > wanted)) {
      best = i
      bestGap = gap
    }
  }
  return best
}

// The first index at or after a forecast hour (for ?hour= in the address).
export function indexAtHour(range: HourRange, forecastHour: number): number {
  const start = range.times[0]
  for (let i = range.first; i <= range.last; i++) {
    if (hoursBetween(start, range.times[i]) >= forecastHour) return i
  }
  return range.last
}

// Hours to the previous (-1) or next (+1) hour, or undefined at the ends.
// Labels the step buttons ("−1 h", "+3 h").
export function stepSize(
  range: HourRange,
  index: number,
  direction: -1 | 1,
): number | undefined {
  const next = index + direction
  if (next < range.first || next > range.last) return undefined
  return Math.abs(hoursBetween(range.times[index], range.times[next]))
}

// Index for a point along the slider (0 to 1), snapped to an hour the
// product can show. The slider is linear in time, so long runs with
// 3- and 6-hourly steps still line up with the day ticks.
export function indexAtFraction(range: HourRange, fraction: number): number {
  const { times } = range
  const start = times[0].getTime()
  const span = times[times.length - 1].getTime() - start
  return snapIndex(range, start + Math.min(1, Math.max(0, fraction)) * span)
}

// Where an index sits along the slider, 0 to 1.
export function fractionAt(range: HourRange, index: number): number {
  const { times } = range
  const start = times[0].getTime()
  const span = times[times.length - 1].getTime() - start
  return span > 0 ? (times[index].getTime() - start) / span : 0
}

// The first index a day later or earlier (Page Up and Page Down).
export function indexDayAway(
  range: HourRange,
  index: number,
  direction: -1 | 1,
): number {
  const target = range.times[index].getTime() + direction * 24 * HOUR
  const snapped = snapIndex(range, target)
  // Always move at least one step, even near the ends.
  if (snapped === index) {
    return Math.min(range.last, Math.max(range.first, index + direction))
  }
  return snapped
}

// ---------- Day ticks (Week 7, option B) ----------

export interface Tick {
  x: number // px from the slider's left edge
  kind: 'day' | 'sixHour'
}

export interface TickLabel {
  x: number // px: left edge for 'start', center for 'middle', right for 'end'
  text: string
  align: 'start' | 'middle' | 'end'
}

const MIN_DAY_FOR_SIX_HOUR = 100 // px: 6-hour ticks on wide days (HRRR)
const MIN_DAY_FOR_EVERY_DAY = 32 // px: every other day below this (GFS, ECMWF)
const LABEL_GAP = 4 // px: labels closer than this are dropped

function localHour(time: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone,
  }).format(time)
  return Number(h)
}

function weekdayName(time: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone,
  }).format(time)
}

// Ticks and labels for the row under the slider: F00 and the last hour at
// the ends, a tick at each local midnight with the day's name centered on
// it, and 6-hour ticks when days are wide. `measure` gives a label's width
// in px (canvas in the app, a stand-in in tests).
export function dayTicks(
  start: Date,
  end: Date,
  width: number,
  measure: (text: string) => number,
  timeZone = localZone(),
): { ticks: Tick[]; labels: TickLabel[] } {
  const totalHours = hoursBetween(start, end)
  if (totalHours <= 0 || width <= 0) return { ticks: [], labels: [] }
  const pxPerHour = width / totalHours
  const dayWidth = pxPerHour * 24
  const xAt = (h: number) => h * pxPerHour

  // Local midnights and 6-hour marks, from the hour after F00 to the hour
  // before the last (none at the ends).
  const midnights: number[] = []
  const ticks: Tick[] = []
  for (let h = 1; h < totalHours; h++) {
    const local = localHour(new Date(start.getTime() + h * HOUR), timeZone)
    if (local === 0) {
      midnights.push(h)
      ticks.push({ x: xAt(h), kind: 'day' })
    } else if (dayWidth >= MIN_DAY_FOR_SIX_HOUR && local % 6 === 0) {
      ticks.push({ x: xAt(h), kind: 'sixHour' })
    }
  }

  // The ends first: they always show.
  const endText = hourLabel(totalHours)
  const ends: TickLabel[] = [
    { x: 0, text: hourLabel(0), align: 'start' },
    { x: width, text: endText, align: 'end' },
  ]
  const span = (l: TickLabel): [number, number] => {
    const w = measure(l.text)
    if (l.align === 'start') return [l.x, l.x + w]
    if (l.align === 'end') return [l.x - w, l.x]
    return [l.x - w / 2, l.x + w / 2]
  }
  const placed = ends.map(span)

  // Each day runs from one midnight to the next, clipped to the run.
  const bounds = [0, ...midnights, totalHours]
  const days: TickLabel[] = []
  const dayEdges: [number, number][] = []
  const everyOther = dayWidth < MIN_DAY_FOR_EVERY_DAY
  for (let d = 0; d < bounds.length - 1; d++) {
    if (everyOther && d % 2 === 1) continue
    const from = bounds[d]
    const to = bounds[d + 1]
    const mid = (from + to) / 2
    days.push({
      x: xAt(mid),
      text: weekdayName(new Date(start.getTime() + mid * HOUR), timeZone),
      align: 'middle',
    })
    dayEdges.push([xAt(from), xAt(to)])
  }

  const labels = [...ends]
  days.forEach((label, i) => {
    const [a, b] = span(label)
    const [dayStart, dayEnd] = dayEdges[i]
    // A name that doesn't fit inside its own day is dropped (except on
    // long runs, where a day is narrower than its name by design).
    if (!everyOther && (a < dayStart || b > dayEnd)) return
    const crowded = placed.some(
      ([c, d]) => a < d + LABEL_GAP && b > c - LABEL_GAP,
    )
    if (crowded) return
    placed.push([a, b])
    labels.push(label)
  })
  return { ticks, labels }
}

// "1h ago", "11h ago", "45m ago" (model menu and model switch, Week 5).
export function ageLabel(referenceTime: Date, now = Date.now()): string {
  const minutes = Math.max(
    0,
    Math.round((now - referenceTime.getTime()) / 60_000),
  )
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

// "1 hour ago", "11 hours ago" (read out by screen readers).
export function spokenAge(referenceTime: Date, now = Date.now()): string {
  const minutes = Math.max(
    0,
    Math.round((now - referenceTime.getTime()) / 60_000),
  )
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}
