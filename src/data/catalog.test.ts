import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRODUCT,
  GROUPS,
  PRODUCTS,
  datasetFor,
  isAvailable,
  productDatasets,
  type ModelId,
  type ProductDef,
  type ProductId,
} from './catalog'
import { SCALES, buildColorScales, scaleFor, toOmScale } from './colorScales'
import {
  DEFAULT_UNITS,
  UNIT_PRESETS,
  displayUnit,
  fromDataUnits,
} from '../lib/units'
import { firstHourIndex } from '../map/productLayers'

const ids = Object.keys(PRODUCTS) as ProductId[]
const models: ModelId[] = ['hrrr', 'gfs', 'ecmwf']

describe('datasets', () => {
  it('splits GFS and ECMWF between surface and upper air (Week 2 check)', () => {
    expect(datasetFor('gfs', 'temperature_2m')).toBe('ncep_gfs013')
    expect(datasetFor('gfs', 'precipitation')).toBe('ncep_gfs013')
    expect(datasetFor('gfs', 'pressure_msl')).toBe('ncep_gfs025')
    expect(datasetFor('gfs', 'cape')).toBe('ncep_gfs025')
    expect(datasetFor('gfs', 'wind_speed_500hPa')).toBe('ncep_gfs025')
    expect(datasetFor('ecmwf', 'temperature_2m')).toBe('ecmwf_ifs')
    expect(datasetFor('ecmwf', 'temperature_850hPa')).toBe('ecmwf_ifs025')
    expect(datasetFor('hrrr', 'temperature_850hPa')).toBe('ncep_hrrr_conus')
  })

  it('uses both GFS datasets for SLP and precipitation', () => {
    expect(productDatasets('slpPrecip', 'gfs').sort()).toEqual([
      'ncep_gfs013',
      'ncep_gfs025',
    ])
    expect(productDatasets('slpPrecip', 'hrrr')).toEqual(['ncep_hrrr_conus'])
  })
})

describe('products', () => {
  it('has all ten core products, each in a picker group', () => {
    expect(ids).toHaveLength(10)
    for (const id of ids) {
      expect(GROUPS).toContain((PRODUCTS[id] as ProductDef).group)
    }
  })

  it('keeps short labels short enough for the product button', () => {
    for (const id of ids) {
      expect(PRODUCTS[id].shortLabel.length).toBeLessThanOrEqual(18)
    }
  })

  it('opens on SLP and precipitation', () => {
    expect(DEFAULT_PRODUCT).toBe('slpPrecip')
  })

  it('has a color scale for every shaded layer in every unit option', () => {
    for (const id of ids) {
      const p = PRODUCTS[id] as ProductDef
      for (const layer of p.layers) {
        if (layer.kind !== 'shaded') continue
        for (const preset of Object.values(UNIT_PRESETS)) {
          const unit = displayUnit(layer.quantity, p.level, preset)
          expect(() => scaleFor(layer.scale, unit)).not.toThrow()
        }
      }
    }
  })
})

describe('availability', () => {
  it('shows reflectivity on HRRR only', () => {
    expect(isAvailable('reflectivity', 'hrrr')).toBe(true)
    expect(isAvailable('reflectivity', 'gfs')).toBe(false)
    expect(isAvailable('reflectivity', 'ecmwf')).toBe(false)
  })

  it('keeps snowfall totals off until summing is built', () => {
    for (const m of models) expect(isAvailable('snowTotal', m)).toBe(false)
  })

  it('checks the run variable lists, including derived variables', () => {
    const hrrr = {
      ncep_hrrr_conus: [
        'wind_u_component_500hPa',
        'wind_v_component_500hPa',
        'geopotential_height_500hPa',
      ],
    }
    expect(isAvailable('heights500', 'hrrr', hrrr)).toBe(true)
    expect(isAvailable('cape', 'hrrr', hrrr)).toBe(false)
  })
})

describe('color scales', () => {
  it('converts breakpoints to data units, hiding values under the threshold', () => {
    const om = toOmScale(scaleFor('wind250', 'kt'), 'wind', 'kt')
    if (om.type !== 'breakpoint' || Array.isArray(om.colors) === false) {
      throw new Error('expected a breakpoint scale')
    }
    expect(om.breakpoints[0]).toBe(-1e9) // transparent band under 50 kt
    expect((om.colors as number[][])[0][3]).toBe(0)
    expect(fromDataUnits(om.breakpoints[1], 'wind', 'kt')).toBeCloseTo(50)
    expect(om.unit).toBe('m/s')
  })

  it('puts freezing at 0 °C in both temperature units', () => {
    const f = toOmScale(
      scaleFor('surfaceTemperature', '°F'),
      'temperature',
      '°F',
    )
    const c = toOmScale(
      scaleFor('surfaceTemperature', '°C'),
      'temperature',
      '°C',
    )
    if (f.type !== 'breakpoint' || c.type !== 'breakpoint') throw new Error()
    const freezeF = f.breakpoints.findIndex((b) => Math.abs(b) < 1e-9)
    const freezeC = c.breakpoints.findIndex((b) => Math.abs(b) < 1e-9)
    expect(freezeF).toBeGreaterThan(-1)
    expect(freezeC).toBeGreaterThan(-1)
    // Same color at freezing whatever the units
    const fColors = f.colors as number[][]
    const cColors = c.colors as number[][]
    expect(fColors[freezeF]).toEqual(cColors[freezeC])
  })

  it('has matching breakpoints and colors, in order', () => {
    for (const byUnit of Object.values(SCALES)) {
      for (const scale of Object.values(byUnit)) {
        expect(scale!.colors).toHaveLength(scale!.breakpoints.length)
        const sorted = [...scale!.breakpoints].sort((a, b) => a - b)
        expect(scale!.breakpoints).toEqual(sorted)
      }
    }
  })

  it('keys scales by exact variable name, one per level', () => {
    const scales = buildColorScales(DEFAULT_UNITS)
    expect(Object.keys(scales)).toEqual(
      expect.arrayContaining([
        'temperature_2m',
        'temperature_850hPa',
        'temperature_925hPa',
        'wind_speed_500hPa',
        'wind_speed_250hPa',
        'precipitation',
        'cape',
      ]),
    )
  })
})

describe('first hour', () => {
  it('starts products made only of totals at F01, others at F00', () => {
    expect(firstHourIndex('snowTotal')).toBe(1)
    expect(firstHourIndex('slpPrecip')).toBe(0) // SLP alone at F00
    expect(firstHourIndex('temp2m')).toBe(0)
    expect(firstHourIndex('reflectivity')).toBe(0)
  })
})
