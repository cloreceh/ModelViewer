import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UNITS,
  UNIT_PRESETS,
  displayUnit,
  fromDataUnits,
  toDataUnits,
  unitsKey,
} from './units'

describe('displayUnit', () => {
  it('uses the College of DuPage mix by default', () => {
    expect(displayUnit('temperature', 'surface', DEFAULT_UNITS)).toBe('°F')
    expect(displayUnit('temperature', 'aloft', DEFAULT_UNITS)).toBe('°C')
    expect(displayUnit('wind', 'surface', DEFAULT_UNITS)).toBe('mph')
    expect(displayUnit('wind', 'aloft', DEFAULT_UNITS)).toBe('kt')
    expect(displayUnit('precipitation', 'surface', DEFAULT_UNITS)).toBe('in')
    expect(displayUnit('snow', 'surface', DEFAULT_UNITS)).toBe('in')
    expect(displayUnit('pressure', 'surface', DEFAULT_UNITS)).toBe('mb')
  })

  it('follows the All US and All metric shortcuts at every level', () => {
    expect(displayUnit('temperature', 'aloft', UNIT_PRESETS.us)).toBe('°F')
    expect(displayUnit('wind', 'aloft', UNIT_PRESETS.us)).toBe('mph')
    expect(displayUnit('wind', 'surface', UNIT_PRESETS.metric)).toBe('m/s')
    expect(displayUnit('precipitation', 'surface', UNIT_PRESETS.metric)).toBe(
      'mm',
    )
    expect(displayUnit('snow', 'surface', UNIT_PRESETS.metric)).toBe('cm')
    expect(displayUnit('pressure', 'surface', UNIT_PRESETS.metric)).toBe('hPa')
  })

  it('always shows heights in dam and CAPE in J/kg', () => {
    for (const preset of Object.values(UNIT_PRESETS)) {
      expect(displayUnit('height', 'aloft', preset)).toBe('dam')
      expect(displayUnit('cape', 'surface', preset)).toBe('J/kg')
    }
  })
})

describe('conversions', () => {
  it('converts data units to display units', () => {
    expect(fromDataUnits(0, 'temperature', '°F')).toBe(32)
    expect(fromDataUnits(100, 'temperature', '°F')).toBeCloseTo(212)
    expect(fromDataUnits(10, 'wind', 'kt')).toBeCloseTo(19.44, 2)
    expect(fromDataUnits(10, 'wind', 'mph')).toBeCloseTo(22.37, 2)
    expect(fromDataUnits(25.4, 'precipitation', 'in')).toBeCloseTo(1)
    expect(fromDataUnits(2.54, 'snow', 'in')).toBeCloseTo(1) // snow data is cm
    expect(fromDataUnits(5640, 'height', 'dam')).toBe(564)
    expect(fromDataUnits(1008, 'pressure', 'mb')).toBe(1008)
  })

  it('converts back to data units', () => {
    expect(toDataUnits(32, 'temperature', '°F')).toBe(0)
    expect(toDataUnits(50, 'wind', 'kt')).toBeCloseTo(25.72, 2)
    expect(toDataUnits(1, 'precipitation', 'in')).toBeCloseTo(25.4)
    expect(toDataUnits(1, 'snow', 'in')).toBeCloseTo(2.54)
  })

  it('round-trips every pair', () => {
    const cases = [
      ['temperature', '°F'],
      ['wind', 'kt'],
      ['wind', 'mph'],
      ['precipitableWater', 'in'],
      ['snow', 'in'],
      ['height', 'dam'],
    ] as const
    for (const [q, u] of cases) {
      expect(toDataUnits(fromDataUnits(12.3, q, u), q, u)).toBeCloseTo(12.3)
    }
  })

  it('refuses a unit a quantity has no conversion for', () => {
    expect(() => fromDataUnits(1, 'temperature', 'kt')).toThrow()
  })
})

describe('unitsKey', () => {
  it('differs between settings and is safe in a URL', () => {
    const keys = Object.values(UNIT_PRESETS).map(unitsKey)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-zA-Z0-9-]+$/)
  })
})
