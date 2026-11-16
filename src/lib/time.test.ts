import { describe, expect, it } from 'vitest'
import {
  dayTicks,
  fractionAt,
  hourLabel,
  hourRange,
  indexAtFraction,
  indexAtHour,
  indexDayAway,
  runName,
  shortValid,
  snapIndex,
  spokenValid,
  stepSize,
} from './time'

const TZ = 'America/Chicago'
const HOUR = 3_600_000

// Valid times every `step` hours from `start`, up to `hours`, with an
// optional later step (GFS goes 3-hourly after F120).
function run(start: string, hours: number, step = 1, after?: [number, number]) {
  const t0 = new Date(start).getTime()
  const times: Date[] = []
  for (let h = 0; h <= hours;) {
    times.push(new Date(t0 + h * HOUR))
    h += after && h >= after[0] ? after[1] : step
  }
  return times
}

// A stand-in for measuring 11 px text: about 6.5 px a character.
const measure = (text: string) => text.length * 6.5

describe('labels', () => {
  it('names runs in UTC and forecast hours with two digits or more', () => {
    expect(runName(new Date('2026-11-08T06:00Z'))).toBe('06Z')
    expect(hourLabel(0)).toBe('F00')
    expect(hourLabel(39)).toBe('F39')
    expect(hourLabel(384)).toBe('F384')
  })

  it('shows valid times in the local zone', () => {
    const t = new Date('2026-11-09T21:00Z') // Mon 3 PM CST
    expect(shortValid(t, TZ)).toBe('Mon 3 PM CST')
    expect(spokenValid(t, TZ)).toBe('Monday 3 PM CST')
  })
})

describe('hours a product can show', () => {
  const gfs = run('2026-11-08T06:00Z', 384, 1, [120, 3])
  const hrrr48 = run('2026-11-08T12:00Z', 48)

  it('covers the whole run by default, and stops reflectivity at F18', () => {
    expect(hourRange(gfs, 0)).toMatchObject({ first: 0, last: gfs.length - 1 })
    expect(hourRange(hrrr48, 0, 18).last).toBe(18)
  })

  it('starts totals products one hour in', () => {
    expect(hourRange(hrrr48, 1).first).toBe(1)
  })

  it('snaps to the nearest hour the product has', () => {
    const range = hourRange(gfs, 1)
    expect(snapIndex(range)).toBe(1) // opening hour: the first it can show
    expect(snapIndex(range, gfs[0].getTime())).toBe(1) // F00 → F01
    // F121 isn't in the 3-hourly part: F120 and F123 are 1 and 2 hours away
    const f121 = gfs[0].getTime() + 121 * HOUR
    expect(snapIndex(range, f121)).toBe(120) // index 120 is F120
  })

  it('moves forward on a tie (ECMWF upper air)', () => {
    const ecmwfUpper = run('2026-11-08T06:00Z', 360, 3)
    const range = hourRange(ecmwfUpper, 0)
    const f4 = ecmwfUpper[0].getTime() + 4.5 * HOUR
    expect(snapIndex(range, f4)).toBe(2) // F06, not F03
  })

  it('finds the hour from the address', () => {
    const range = hourRange(gfs, 0)
    expect(indexAtHour(range, 39)).toBe(39)
    expect(indexAtHour(range, 121)).toBe(121) // F123, the first at or after
    expect(range.times[121].getTime() - gfs[0].getTime()).toBe(123 * HOUR)
    expect(indexAtHour(range, 999)).toBe(range.last)
  })

  it('labels the step buttons with the step size', () => {
    const range = hourRange(gfs, 0)
    expect(stepSize(range, 0, -1)).toBeUndefined()
    expect(stepSize(range, 0, 1)).toBe(1)
    expect(stepSize(range, 120, 1)).toBe(3) // F120 → F123
    expect(stepSize(range, 120, -1)).toBe(1)
    expect(stepSize(range, range.last, 1)).toBeUndefined()
  })

  it('maps slider positions to hours and back', () => {
    const range = hourRange(gfs, 0)
    expect(indexAtFraction(range, 0)).toBe(0)
    expect(indexAtFraction(range, 1)).toBe(range.last)
    expect(fractionAt(range, indexAtFraction(range, 39 / 384))).toBeCloseTo(
      39 / 384,
    )
    // Reflectivity: positions past F18 snap back to F18
    expect(indexAtFraction(hourRange(hrrr48, 0, 18), 0.9)).toBe(18)
  })

  it('moves a day with Page Up and Page Down', () => {
    const range = hourRange(gfs, 0)
    expect(indexDayAway(range, 39, 1)).toBe(63)
    expect(indexDayAway(range, 10, -1)).toBe(0)
    expect(indexDayAway(range, 0, -1)).toBe(0)
  })
})

describe('day ticks (Week 7, option B)', () => {
  const texts = (r: ReturnType<typeof dayTicks>) => r.labels.map((l) => l.text)

  it('GFS 06Z: every other day between F00 and F384', () => {
    const r = dayTicks(
      new Date('2026-11-08T06:00Z'),
      new Date('2026-11-24T06:00Z'),
      364,
      measure,
      TZ,
    )
    expect(texts(r)).toEqual([
      'F00',
      'F384',
      'Tue',
      'Thu',
      'Sat',
      'Mon',
      'Wed',
      'Fri',
    ])
    // 15 midnights, no 6-hour ticks (days are 23 px)
    expect(r.ticks.filter((t) => t.kind === 'day')).toHaveLength(15)
    expect(r.ticks.some((t) => t.kind === 'sixHour')).toBe(false)
    expect(r.ticks[0].x).toBeCloseTo(364 / 16)
  })

  it('HRRR 15Z (F18): Sun, a midnight at F15 and 6-hour ticks', () => {
    const r = dayTicks(
      new Date('2026-11-08T15:00Z'),
      new Date('2026-11-09T09:00Z'),
      364,
      measure,
      TZ,
    )
    expect(texts(r)).toEqual(['F00', 'F18', 'Sun'])
    const hours = (kind: string) =>
      r.ticks
        .filter((t) => t.kind === kind)
        .map((t) => Math.round((t.x / 364) * 18))
    expect(hours('day')).toEqual([15])
    expect(hours('sixHour')).toEqual([3, 9])
  })

  it('HRRR 12Z (F48): Sun and Mon, Tue dropped next to F48', () => {
    const r = dayTicks(
      new Date('2026-11-08T12:00Z'),
      new Date('2026-11-10T12:00Z'),
      364,
      measure,
      TZ,
    )
    expect(texts(r)).toEqual(['F00', 'F48', 'Sun', 'Mon'])
    const hours = (kind: string) =>
      r.ticks
        .filter((t) => t.kind === kind)
        .map((t) => Math.round((t.x / 364) * 48))
    expect(hours('day')).toEqual([18, 42])
    expect(hours('sixHour')).toEqual([6, 12, 24, 30, 36])
  })
})
