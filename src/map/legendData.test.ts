import { describe, expect, it } from 'vitest'
import { DEFAULT_UNITS, UNIT_PRESETS } from '../lib/units'
import { formatValue, labelIndexes, legendFor } from './legendData'

// A stand-in for measuring 11 px text: about 6.5 px a character.
const measure = (text: string) => text.length * 6.5
const WIDTH = 368 // legend bar on a 390 px phone (390 − 2 × 10 padding − 2 edge)

const labels = (id: Parameters<typeof legendFor>[0], units = DEFAULT_UNITS) => {
  const data = legendFor(id, units)
  return labelIndexes(data, WIDTH, measure).map((i) =>
    formatValue(data.bands[i].from, data.unit),
  )
}

describe('legend', () => {
  it('formats values the way the Figma legends do', () => {
    expect(formatValue(0.01, 'in')).toBe('.01')
    expect(formatValue(1.5, 'in')).toBe('1.5')
    expect(formatValue(-40, '°F')).toBe('−40')
    expect(formatValue(0.25, 'mm')).toBe('0.25')
  })

  it('SLP and precipitation: inches in the past hour, every band labeled', () => {
    const data = legendFor('slpPrecip', DEFAULT_UNITS)
    expect(data.unitLine).toBe('in · past hour')
    expect(data.notes).toEqual([{ kind: 'contour', text: 'SLP every 4 mb' }])
    expect(labels('slpPrecip')).toEqual([
      '.01',
      '.02',
      '.05',
      '.1',
      '.15',
      '.2',
      '.3',
      '.5',
      '.75',
      '1',
      '1.5',
      '2',
    ])
  })

  it('surface temperature: every 20 °F with a bold 32 (Week 6)', () => {
    const data = legendFor('temp2m', DEFAULT_UNITS)
    expect(data.unitLine).toBe('°F')
    expect(data.bold).toBe(32)
    expect(data.notes).toEqual([{ kind: 'freezing', text: 'Freezing line' }])
    expect(labels('temp2m')).toEqual([
      '−40',
      '−20',
      '0',
      '20',
      '32',
      '50',
      '70',
      '90',
    ])
  })

  it('CAPE: every other band (Week 7)', () => {
    expect(labels('cape')).toEqual([
      '100',
      '500',
      '1000',
      '2000',
      '3000',
      '5000',
    ])
  })

  it('reflectivity: dBZ every 10, from IEM N0Q colors', () => {
    const data = legendFor('reflectivity', DEFAULT_UNITS)
    expect(data.unitLine).toBe('dBZ')
    expect(data.bands).toHaveLength(15)
    expect(labels('reflectivity')).toEqual([
      '10',
      '20',
      '30',
      '40',
      '50',
      '60',
      '70',
    ])
  })

  it('500mb: heights and barbs notes, kt aloft', () => {
    const data = legendFor('heights500', DEFAULT_UNITS)
    expect(data.unitLine).toBe('kt')
    expect(data.notes.map((n) => n.text)).toEqual([
      'Heights every 6 dam',
      'Barbs',
    ])
    const us = legendFor('heights500', UNIT_PRESETS.us)
    expect(us.notes.map((n) => n.text)).toEqual([
      'Heights every 6 dam',
      'Barbs in kt',
    ])
  })

  it('every product has a legend in every unit preset', () => {
    for (const preset of Object.values(UNIT_PRESETS)) {
      for (const id of [
        'wind250',
        'heights500',
        'temp850',
        'temp925',
        'temp2m',
        'cape',
        'slpPrecip',
        'reflectivity',
        'pwat',
        'snowfall',
      ] as const) {
        const data = legendFor(id, preset)
        expect(labelIndexes(data, WIDTH, measure).length).toBeGreaterThan(2)
      }
    }
  })
})
