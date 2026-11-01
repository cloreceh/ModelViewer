import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre draws map data in a background worker. Point it at the worker
// file explicitly so Vite includes it in both dev and production builds.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { BASEMAP_STYLES, CONUS_BOUNDS } from './basemap'
import { nationOutline, stateLines } from './boundaries'

maplibregl.setWorkerUrl(workerUrl)

export function MapView() {
  // A reference to the <div> the map draws into.
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create the map once, when the component first appears.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.light,
      bounds: CONUS_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      // Keep the map flat and north-up, like other model viewers.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()

    // Once the basemap loads, draw our own state and national borders on top.
    map.on('load', () => {
      map.addSource('state-lines', { type: 'geojson', data: stateLines })
      map.addSource('nation-outline', { type: 'geojson', data: nationOutline })
      map.addLayer({
        id: 'state-lines',
        type: 'line',
        source: 'state-lines',
        paint: { 'line-color': '#5f6b78', 'line-width': 0.8 },
      })
      map.addLayer({
        id: 'nation-outline',
        type: 'line',
        source: 'nation-outline',
        paint: { 'line-color': '#4a5561', 'line-width': 1.2 },
      })
    })

    // Clean up the map if the component is removed.
    return () => map.remove()
  }, [])

  return <div ref={containerRef} className="map" />
}
