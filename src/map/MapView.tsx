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
import { fetchLatestRun, forecastHour } from '../data/openmeteo/runs'

maplibregl.setWorkerUrl(workerUrl)
// Teach MapLibre to read om:// addresses (Open-Meteo weather files).
// Registered once, before any map is created.
maplibregl.addProtocol('om', omProtocol)

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export function MapView() {
  // A reference to the <div> the map draws into.
  const containerRef = useRef<HTMLDivElement>(null)
  // Spike 1 notes shown on screen, so they can be read on a phone.
  const [spikeInfo, setSpikeInfo] = useState('Loading…')

  useEffect(() => {
    if (!containerRef.current) return
    let removed = false
    let errorText = ''

    const layer = pickSpikeLayer()
    const { label, dataset } = SPIKE_LAYERS[layer]

    // Start looking up the newest run right away, at the same time as the
    // basemap loads, instead of waiting for the map to be ready.
    const runRequest = fetchLatestRun(dataset)
    let runFoundAt = 0
    runRequest.then(() => (runFoundAt = performance.now())).catch(() => {})

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

    // "style.load" fires as soon as the basemap style is read, before its
    // tiles arrive, so the weather download starts in parallel with them.
    map.once('style.load', () => {
      // The first label layer in the basemap. Everything we add goes
      // underneath it, so city names stay on top of the weather colors.
      const firstLabelId = map
        .getStyle()
        .layers.find((l) => l.type === 'symbol')?.id

      // State and national borders, below the labels
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

      // Weather data, underneath the borders. Shows the run's first hour.
      runRequest
        .then((run) => {
          if (removed) return
          const validTime = run.validTimes[0]
          addSpikeLayer(map, layer, run, validTime, 'state-lines')
          const runName = `${String(run.referenceTime.getUTCHours()).padStart(2, '0')}Z F${String(forecastHour(run, validTime)).padStart(2, '0')}`

          // Spike note: time from page load until the weather first draws.
          map.once('idle', () => {
            if (removed || errorText) return
            const isolated = window.crossOriginIsolated ? 'yes' : 'no'
            setSpikeInfo(
              `${label} ${runName} · run found ${seconds(runFoundAt)} · first frame ${seconds(performance.now())} · isolated: ${isolated}`,
            )
          })
        })
        .catch((error: Error) => {
          errorText = error.message
          setSpikeInfo(`Error: ${errorText}`)
        })
    })

    map.on('error', (event) => {
      errorText = event.error?.message ?? 'unknown'
      setSpikeInfo(`Error: ${errorText}`)
    })

    // Clean up the map if the component is removed.
    return () => {
      removed = true
      map.remove()
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="map" />
      <div className="spike-info">{spikeInfo}</div>
    </>
  )
}
