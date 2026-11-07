import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre draws map data in a background worker. Point it at the worker
// file explicitly so Vite includes it in both dev and production builds.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { omProtocol } from '@openmeteo/weather-map-layer'
import { BASEMAP_STYLES, CONUS_BOUNDS } from './basemap'
import { nationOutline, stateLines } from './boundaries'
import { SPIKE_LAYERS, addSpikeLayer, pickSpikeLayer } from './spikeLayers'

maplibregl.setWorkerUrl(workerUrl)
// Teach MapLibre to read om:// addresses (Open-Meteo weather files).
// Registered once, before any map is created.
maplibregl.addProtocol('om', omProtocol)

export function MapView() {
  // A reference to the <div> the map draws into.
  const containerRef = useRef<HTMLDivElement>(null)
  // Spike 1 notes shown on screen, so they can be read on a phone.
  const [spikeInfo, setSpikeInfo] = useState('Loading…')

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

    map.on('load', () => {
      // The first label layer in the basemap. Everything we add goes
      // underneath it, so city names stay on top of the weather colors.
      const firstLabelId = map
        .getStyle()
        .layers.find((layer) => layer.type === 'symbol')?.id

      // 1. Weather data (bottom)
      const layer = pickSpikeLayer()
      addSpikeLayer(map, layer, firstLabelId)

      // 2. State and national borders, above the weather but below labels
      map.addSource('state-lines', { type: 'geojson', data: stateLines })
      map.addSource('nation-outline', { type: 'geojson', data: nationOutline })
      map.addLayer(
        {
          id: 'state-lines',
          type: 'line',
          source: 'state-lines',
          paint: { 'line-color': '#5f6b78', 'line-width': 0.8 },
        },
        firstLabelId,
      )
      map.addLayer(
        {
          id: 'nation-outline',
          type: 'line',
          source: 'nation-outline',
          paint: { 'line-color': '#4a5561', 'line-width': 1.2 },
        },
        firstLabelId,
      )

      // Spike note: time from page load until the map first finishes drawing.
      map.once('idle', () => {
        const ms = Math.round(performance.now())
        const isolated = window.crossOriginIsolated ? 'yes' : 'no'
        setSpikeInfo(
          `${SPIKE_LAYERS[layer]} · first frame ${ms} ms · isolated: ${isolated}`,
        )
      })
    })

    map.on('error', (event) => {
      setSpikeInfo(`Error: ${event.error?.message ?? 'unknown'}`)
    })

    // Clean up the map if the component is removed.
    return () => map.remove()
  }, [])

  return (
    <>
      <div ref={containerRef} className="map" />
      <div className="spike-info">{spikeInfo}</div>
    </>
  )
}