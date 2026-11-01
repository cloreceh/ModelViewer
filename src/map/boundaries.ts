import { mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import usAtlas from 'us-atlas/states-10m.json'

// U.S. state and national boundaries from the Census Bureau (public domain),
// packaged by us-atlas. Drawn by the app so they show at every zoom level.
const topology = usAtlas as unknown as Topology<{
  states: GeometryCollection
  nation: GeometryCollection
}>

// Borders between states (shared edges only, so coastlines aren't doubled).
export const stateLines = mesh(
  topology,
  topology.objects.states,
  (a, b) => a !== b,
)

// Outline of the U.S.: coastlines and borders with Canada and Mexico.
export const nationOutline = mesh(topology, topology.objects.nation)
