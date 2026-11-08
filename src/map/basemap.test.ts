import { describe, expect, it } from 'vitest'
import type { LayerSpecification } from 'maplibre-gl'
import {
  MIN_ZOOM,
  ROAD_OPACITY,
  tuneBasemap,
  type BasemapTarget,
} from './basemap'

// A stand-in for the map that records what tuneBasemap changes.
function fakeMap(layers: LayerSpecification[]) {
  const calls: string[] = []
  const map: BasemapTarget = {
    getStyle: () => ({ layers }),
    setPaintProperty: (id, name, value) =>
      calls.push(`paint ${id} ${name}=${value}`),
    setLayoutProperty: (id, name, value) =>
      calls.push(`layout ${id} ${name}=${value}`),
    setLayerZoomRange: (id, min, max) => calls.push(`zoom ${id} ${min}-${max}`),
  }
  return { map, calls }
}

const line = (id: string, src: string, extra: object = {}) =>
  ({
    id,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': src,
    ...extra,
  }) as LayerSpecification
const label = (id: string, src: string, extra: object = {}) =>
  ({
    id,
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': src,
    ...extra,
  }) as LayerSpecification

describe('tuneBasemap', () => {
  it('lightens roads and starts them at regional zoom', () => {
    const { map, calls } = fakeMap([
      line('highway_motorway_inner', 'transportation', { minzoom: 6 }),
    ])
    tuneBasemap(map, 'dark')
    expect(calls).toContain(
      `paint highway_motorway_inner line-opacity=${ROAD_OPACITY.dark}`,
    )
    expect(calls).toContain(`zoom highway_motorway_inner ${MIN_ZOOM.roads}-24`)
  })

  it('hides low-zoom road layers that would never draw', () => {
    const { map, calls } = fakeMap([
      line('highway_motorway_subtle', 'transportation', { maxzoom: 6 }),
    ])
    tuneBasemap(map, 'light')
    expect(calls).toContain('layout highway_motorway_subtle visibility=none')
  })

  it('hides basemap state lines in both styles and keeps country borders', () => {
    const { map, calls } = fakeMap([
      line('boundary_state', 'boundary'),
      line('boundary_3', 'boundary', { minzoom: 8 }),
      line('boundary_2', 'boundary'),
    ])
    tuneBasemap(map, 'light')
    expect(calls).toContain('layout boundary_state visibility=none')
    expect(calls).toContain('layout boundary_3 visibility=none')
    expect(calls.some((c) => c.includes('boundary_2'))).toBe(false)
  })

  it('keeps states and large cities at the CONUS view and delays smaller places', () => {
    const { map, calls } = fakeMap([
      label('place_state', 'place'),
      label('place_city_large', 'place', { layout: { 'text-size': 14 } }),
      label('label_city_capital', 'place', { minzoom: 3 }),
      label('place_city', 'place'),
      label('label_town', 'place', { minzoom: 6 }),
      label('place_village', 'place'),
    ])
    tuneBasemap(map, 'dark')
    expect(calls).toContain('layout place_city_large text-size=12')
    expect(calls).toContain(`zoom place_city ${MIN_ZOOM.cities}-24`)
    expect(calls).toContain(`zoom label_town ${MIN_ZOOM.towns}-24`)
    expect(calls).toContain(`zoom place_village ${MIN_ZOOM.villages}-24`)
    expect(calls.some((c) => c.includes('place_state'))).toBe(false)
    expect(calls.some((c) => c.startsWith('zoom label_city_capital'))).toBe(
      false,
    )
  })

  it('leaves layers it does not know alone', () => {
    const { map, calls } = fakeMap([
      { id: 'background', type: 'background' } as LayerSpecification,
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
      } as LayerSpecification,
    ])
    tuneBasemap(map, 'light')
    expect(calls).toEqual([])
  })
})
